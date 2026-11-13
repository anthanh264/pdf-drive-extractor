(async function () {
    console.log("=== Ultimate PDF Extractor (batch mode) ===");
    console.log("Auto-scroll • 100 pages per file • Working links • Low memory\n");

    // ================= CONFIG =================
    const CONFIG = {
        batchSize: 100,         // số trang mỗi file PDF xuất ra (1 = mỗi trang 1 file)
        maxPages: 0,            // 0 = lấy hết; vd 1 = chỉ lấy trang đầu, 5 = chỉ 5 trang đầu
        jpegQuality: 0.92,      // 0.92 = đẹp; hạ 0.80 nếu muốn file nhẹ hơn
        dpi: 72,                // kích thước trang PDF = pixel @ DPI này
        maxImageWidth: 0,       // 0 = giữ nguyên; vd 1600 để thu nhỏ ảnh cho file nhẹ
        minPageWidth: 300,      // bỏ qua ảnh blob nhỏ (icon...)
        pageDelay: 250,         // ms chờ sau khi cuộn tới trang (để link/text layer render)
        scrollDelay: 500,       // ms chờ sau mỗi bước cuộn để trang mới load
        saveDelay: 1500,        // ms nghỉ giữa các lần tải file
        endRetries: 4,          // số lần thử lại ở cuối tài liệu trước khi kết luận hết trang
        pdfCompression: true,
        progressIndicator: true
    };

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const pad = (n, l) => String(n).padStart(l, '0');

    // ================= Load jsPDF =================
    const loadScript = (src) => new Promise((resolve, reject) => {
        let script = document.createElement('script');
        script.onload = resolve;
        script.onerror = reject;
        if (window.trustedTypes && trustedTypes.createPolicy) {
            const policy = trustedTypes.createPolicy('ultimatePolicy_' + Date.now(), {
                createScriptURL: (input) => input
            });
            script.src = policy.createScriptURL(src);
        } else {
            script.src = src;
        }
        document.body.appendChild(script);
    });

    if (!(window.jspdf && window.jspdf.jsPDF)) {
        console.log("Loading jsPDF library...");
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    }
    const { jsPDF } = window.jspdf;
    console.log("✓ jsPDF ready\n");

    // ================= Progress UI =================
    let stopRequested = false;
    let progressDiv = null, elText, elBar, elStats;

    if (CONFIG.progressIndicator) {
        progressDiv = document.createElement('div');
        progressDiv.style.cssText = `
            position: fixed; top: 20px; right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; padding: 20px 25px; border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3); z-index: 2147483647;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            min-width: 340px;`;

        // Tạo bằng DOM API để tránh lỗi TrustedHTML
        const title = document.createElement('div');
        title.style.cssText = 'font-size: 18px; font-weight: 600; margin-bottom: 12px;';
        title.textContent = '📄 Creating PDF (batch mode)';

        elText = document.createElement('div');
        elText.style.cssText = 'font-size: 14px; margin-bottom: 8px; opacity: 0.95;';
        elText.textContent = 'Initializing...';

        const barWrap = document.createElement('div');
        barWrap.style.cssText = 'background: rgba(255,255,255,0.2); height: 6px; border-radius: 3px; overflow: hidden; margin-bottom: 8px;';
        elBar = document.createElement('div');
        elBar.style.cssText = 'height: 100%; background: white; width: 0%; transition: width 0.3s ease;';
        barWrap.appendChild(elBar);

        elStats = document.createElement('div');
        elStats.style.cssText = 'font-size: 12px; opacity: 0.85; margin-bottom: 10px;';
        elStats.textContent = 'Pages: 0 • Links: 0 • Files: 0';

        const stopBtn = document.createElement('button');
        stopBtn.textContent = 'Stop & save current batch';
        stopBtn.style.cssText = 'border: 0; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 12px;';
        stopBtn.onclick = () => {
            stopRequested = true;
            stopBtn.textContent = 'Stopping...';
        };

        progressDiv.append(title, elText, barWrap, elStats, stopBtn);
        document.body.appendChild(progressDiv);
    }

    const updateProgress = (text, percent, stats) => {
        if (!progressDiv) return;
        if (text !== undefined) elText.textContent = text;
        if (percent !== undefined) elBar.style.width = Math.max(0, Math.min(100, percent)) + '%';
        if (stats !== undefined) elStats.textContent = stats;
    };

    // ================= Tìm trang đầu + scroll container =================
    const getImgs = () => Array.from(document.querySelectorAll('img[src^="blob:"]'));

    updateProgress('Waiting for first page...', 2);
    let t0 = Date.now();
    while (!getImgs().some((i) => i.naturalWidth >= CONFIG.minPageWidth) && Date.now() - t0 < 15000) {
        await sleep(300);
    }
    const firstImg = getImgs().find((i) => i.naturalWidth >= CONFIG.minPageWidth);
    if (!firstImg) {
        alert("❌ No page images found! Make sure the document is open and loaded.");
        if (progressDiv) progressDiv.remove();
        return;
    }

    const findScroller = (el) => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            const oy = getComputedStyle(p).overflowY;
            if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 50) return p;
        }
        return document.scrollingElement || document.documentElement;
    };
    const scroller = findScroller(firstImg);
    console.log("Scroll container:", scroller.tagName, scroller.className || '(no class)');

    const scrollPercent = () => {
        const max = scroller.scrollHeight - scroller.clientHeight;
        return max > 0 ? (scroller.scrollTop / max) * 100 : 100;
    };

    // ================= Tên file =================
    let baseName = 'document';
    try {
        let t = document.title.replace(/ - Google Drive$/i, '').trim()
            .replace(/[<>:"/\\|?*]/g, '-').replace(/\.pdf$/i, '');
        if (t) baseName = t;
    } catch (e) { /* dùng mặc định */ }
    console.log(`Base filename: ${baseName}\n`);

    // ================= Link =================
    // Phải gọi đồng bộ cùng lúc với getBoundingClientRect của ảnh (không await ở giữa)
    const collectLinks = (imgRect) => {
        const out = [];
        const seen = new Set();
        for (const a of document.querySelectorAll('a[href]')) {
            const href = a.href;
            if (!href || href.startsWith('javascript:')) continue;
            const r = a.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) continue;

            // Chỉ gán link cho trang chứa tâm của link (tránh trùng giữa 2 trang)
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            if (cx < imgRect.left || cx > imgRect.right || cy < imgRect.top || cy > imgRect.bottom) continue;

            const key = href + '|' + Math.round(r.left) + '|' + Math.round(r.top);
            if (seen.has(key)) continue;
            seen.add(key);

            const left = Math.max(r.left, imgRect.left);
            const top = Math.max(r.top, imgRect.top);
            const right = Math.min(r.right, imgRect.right);
            const bottom = Math.min(r.bottom, imgRect.bottom);
            out.push({ href, x: left - imgRect.left, y: top - imgRect.top, w: right - left, h: bottom - top });
        }
        return out;
    };

    // ================= Trạng thái theo đợt =================
    let pdf = null;
    let batchNo = 0, batchStart = 0, batchPages = 0, batchLinks = 0;
    let totalPages = 0, totalLinks = 0, filesSaved = 0;
    const startTime = Date.now();

    const stats = () => `Pages: ${totalPages} • Links: ${totalLinks} • Files: ${filesSaved}`;

    const flushBatch = async () => {
        if (!pdf || batchPages === 0) return;
        const fileName = `${baseName}_part${pad(batchNo, 2)}_p${pad(batchStart, 3)}-${pad(batchStart + batchPages - 1, 3)}.pdf`;
        updateProgress(`Saving ${fileName}...`, undefined, stats());
        console.log(`\n=== Saving ${fileName} (${batchPages} pages, ${batchLinks} links) ===\n`);
        pdf.save(fileName);
        filesSaved++;
        pdf = null;               // giải phóng bộ nhớ của đợt này
        batchPages = 0;
        batchLinks = 0;
        await sleep(CONFIG.saveDelay); // cho trình duyệt thời gian xử lý download
    };

    // ================= Chụp 1 trang =================
    const processed = new WeakSet();
    const seenSrc = new Set();
    const markDone = (img) => { processed.add(img); seenSrc.add(img.src); };

    const canvas = document.createElement('canvas');           // dùng lại 1 canvas cho mọi trang
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Trang chưa xử lý nằm cao nhất trong DOM (giữ đúng thứ tự trang)
    const nextImage = () => {
        let best = null, bestTop = Infinity;
        for (const img of getImgs()) {
            if (processed.has(img) || seenSrc.has(img.src)) continue;
            if (img.complete && img.naturalWidth > 0 && img.naturalWidth < CONFIG.minPageWidth) {
                markDone(img); // icon/ảnh nhỏ, bỏ qua
                continue;
            }
            const top = img.getBoundingClientRect().top;
            if (top < bestTop) { bestTop = top; best = img; }
        }
        return best;
    };

    const capturePage = async (img) => {
        try {
            img.scrollIntoView({ block: 'start', behavior: 'instant' });
            await sleep(CONFIG.pageDelay);
            await Promise.race([img.decode().catch(() => {}), sleep(5000)]);

            const w = img.naturalWidth, h = img.naturalHeight;
            if (w < CONFIG.minPageWidth) return; // chưa load được / không phải trang

            // --- đo đồng bộ ---
            const rect = img.getBoundingClientRect();
            const links = collectLinks(rect);
            const rw = rect.width, rh = rect.height;

            // --- render JPEG (không qua base64, tiết kiệm ~33% RAM) ---
            const scale = (CONFIG.maxImageWidth > 0 && w > CONFIG.maxImageWidth) ? CONFIG.maxImageWidth / w : 1;
            canvas.width = Math.round(w * scale);
            canvas.height = Math.round(h * scale);
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', CONFIG.jpegQuality));
            if (!blob) { console.log(`  ✗ Could not encode page ${totalPages + 1}`); return; }
            const bytes = new Uint8Array(await blob.arrayBuffer());

            // --- thêm vào PDF của đợt hiện tại ---
            const wMM = (w * 25.4) / CONFIG.dpi;   // kích thước trang tính theo ảnh gốc
            const hMM = (h * 25.4) / CONFIG.dpi;
            const orientation = w > h ? 'l' : 'p';

            if (!pdf) {
                batchNo++;
                batchStart = totalPages + 1;
                pdf = new jsPDF({ orientation, unit: 'mm', format: [wMM, hMM], compress: CONFIG.pdfCompression });
            } else {
                pdf.addPage([wMM, hMM], orientation);
            }
            pdf.addImage(bytes, 'JPEG', 0, 0, wMM, hMM, 'pg' + (totalPages + 1));

            let added = 0;
            for (const l of links) {
                try {
                    pdf.link((l.x / rw) * wMM, (l.y / rh) * hMM, (l.w / rw) * wMM, (l.h / rh) * hMM, { url: l.href });
                    added++;
                } catch (e) {
                    console.log(`  ✗ Failed to add link: ${e.message}`);
                }
            }

            totalPages++;
            batchPages++;
            totalLinks += added;
            batchLinks += added;
            console.log(`Page ${totalPages} (batch ${batchNo}: ${batchPages}/${CONFIG.batchSize}) • ${added} links`);
            updateProgress(
                `Batch ${batchNo}: page ${batchPages}/${CONFIG.batchSize} (total ${totalPages})`,
                scrollPercent(),
                stats()
            );
        } finally {
            markDone(img);
        }
    };

    // ================= Vòng lặp chính: cuộn → chụp → xuất mỗi 100 trang =================
    try {
        let idle = 0;
        while (!stopRequested && !(CONFIG.maxPages > 0 && totalPages >= CONFIG.maxPages)) {
            const img = nextImage();

            if (img) {
                idle = 0;
                await capturePage(img);
                if (batchPages >= CONFIG.batchSize) await flushBatch();
                continue;
            }

            // Hết trang đang có trong DOM → cuộn tiếp để load trang mới
            const before = scroller.scrollTop;
            const atBottom = before >= scroller.scrollHeight - scroller.clientHeight - 4;
            if (!atBottom) scroller.scrollTop = before + scroller.clientHeight * 0.8;
            await sleep(atBottom ? CONFIG.scrollDelay * 2 : CONFIG.scrollDelay);

            if (atBottom || scroller.scrollTop === before) {
                if (++idle > CONFIG.endRetries) break; // đã tới cuối, không còn trang mới
            } else {
                idle = 0;
            }
            updateProgress('Scrolling to load more pages...', scrollPercent());
        }
    } catch (err) {
        console.error("Error during extraction:", err);
    } finally {
        await flushBatch(); // luôn lưu phần còn lại (kể cả khi Stop hoặc lỗi)
    }

    // ================= Tổng kết =================
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    updateProgress(`Complete! ✓ ${filesSaved} file(s)`, 100, stats());
    setTimeout(() => { if (progressDiv) progressDiv.remove(); }, 8000);

    console.log(`\n=== Complete ===`);
    console.log(`✓ Pages processed: ${totalPages}`);
    console.log(`✓ Links added: ${totalLinks}`);
    console.log(`✓ Files saved: ${filesSaved}`);
    console.log(`✓ Time taken: ${elapsed}s`);
    console.log(`✓ JPEG quality: ${(CONFIG.jpegQuality * 100).toFixed(0)}%`);
})();
