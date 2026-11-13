# Drive PDF Batch Extractor

[English](README.md) | [Tiếng Việt](README.vi.md)

Script chạy trong Console của trình duyệt để dựng lại file PDF từ trình xem PDF của Google Drive. Script tự cuộn tài liệu, chụp từng trang, giữ nguyên các link bấm được, và xuất một file PDF mới sau mỗi **N trang** (mặc định 100) để tài liệu lớn không làm tràn bộ nhớ trình duyệt.

## Tính năng

- **Hoàn toàn tự động:** tự cuộn, tự chờ trang load, không cần cuộn tay.
- **Xuất theo đợt:** mỗi 100 trang một file PDF (có thể đổi), ví dụ `Sach_part03_p201-300.pdf`.
- **Link vẫn bấm được:** vị trí link được đo ngay lúc chụp từng trang rồi tạo lại trong PDF.
- **Ít tốn RAM:** ảnh được mã hóa thẳng sang JPEG (không qua base64), thêm vào đợt hiện tại, và đợt đó được giải phóng sau khi lưu.
- **Dừng giữa chừng không mất dữ liệu:** có nút "Stop & save current batch", và nếu gặp lỗi thì phần đã chụp vẫn được lưu.
- **Tùy chọn giảm chất lượng/kích thước ảnh** để file nhẹ hơn.
- **Tool gộp** tất cả các phần thành 1 file PDF.

## Yêu cầu

- Trình duyệt desktop nền Chromium (Chrome, Edge, ...).
- File PDF mở trong trình xem của Google Drive (`drive.google.com/file/d/.../view`).
- Có internet để tải [jsPDF 2.5.1](https://cdnjs.com/libraries/jspdf) từ cdnjs.
- Để gộp file: Python 3 và `pip install pypdf`.

## Bắt đầu nhanh

1. Mở file PDF trong trình xem của Google Drive và chờ hiện trang đầu tiên.
2. Mở Console của DevTools (`F12`, hoặc `Ctrl+Shift+J` / `Cmd+Option+J`).
   Lần đầu Chrome có thể chặn dán: gõ `allow pasting` rồi nhấn Enter.
3. Copy toàn bộ nội dung file [`src/pdf_extractor_batch.js`](src/pdf_extractor_batch.js), dán vào Console và nhấn Enter.
4. Giữ tab mở và ở phía trước. Bảng tiến trình hiện ở góc phải trên.
   Nếu trình duyệt hỏi cho phép tải nhiều file, bấm **Allow** (Cho phép).
5. Khi xong sẽ có các file như:

```
Sach_part01_p001-100.pdf
Sach_part02_p101-200.pdf
...
Sach_part11_p1001-1032.pdf
```

File cuối ngắn hơn các file còn lại là bình thường.

## Cấu hình

Sửa object `CONFIG` ở đầu script trước khi dán.

| Tùy chọn | Mặc định | Mô tả |
| --- | --- | --- |
| `batchSize` | `100` | Số trang mỗi file PDF. `1` = mỗi trang một file. |
| `maxPages` | `0` | `0` = lấy hết. `1` = chỉ trang đầu, `5` = 5 trang đầu. |
| `jpegQuality` | `0.92` | Chất lượng JPEG. Đặt `0.80` để file nhẹ hơn rõ rệt. |
| `dpi` | `72` | Kích thước trang PDF = số pixel ảnh tại DPI này. |
| `maxImageWidth` | `0` | `0` = giữ độ phân giải gốc. Ví dụ `1600` sẽ thu nhỏ trang rộng hơn mức đó. |
| `minPageWidth` | `300` | Bỏ qua ảnh blob hẹp hơn mức này (icon, ...). |
| `pageDelay` | `250` | ms chờ sau khi cuộn tới trang để link kịp hiện. Tăng lên nếu mất link. |
| `scrollDelay` | `500` | ms chờ sau mỗi bước cuộn để trang mới load. Tăng lên nếu mạng chậm. |
| `saveDelay` | `1500` | ms nghỉ giữa các lần tải file. |
| `endRetries` | `4` | Số lần thử lại ở cuối tài liệu trước khi kết luận hết trang. |
| `pdfCompression` | `true` | Bật nén stream của jsPDF. |
| `progressIndicator` | `true` | Hiện bảng tiến trình. |

Ví dụ:

```js
// Chỉ lấy trang đầu, ra 1 file
batchSize: 100, maxPages: 1,

// Mỗi trang một file riêng (sẽ có rất nhiều file tải về)
batchSize: 1, saveDelay: 500,

// Xuất file nhẹ hơn
jpegQuality: 0.80, maxImageWidth: 1600,
```

## Gộp các phần thành 1 file PDF

```bash
pip install pypdf
python tools/merge_pdfs.py /duong/dan/thu/muc/tai/ve
# hoặc tự đặt tên file xuất
python tools/merge_pdfs.py /duong/dan/thu/muc/tai/ve -o "Sach.pdf"
```

Các phần được sắp theo số `_partNN` và link được giữ nguyên. Cũng có thể dùng phần mềm như PDF24 Creator hoặc PDFgear (nhớ sắp xếp theo tên file trước khi gộp).

## Cách hoạt động

1. Chờ ảnh `img[src^="blob:"]` đầu tiên (ảnh các trang của trình xem) và tìm vùng cuộn.
2. Lấy trang chưa xử lý nằm cao nhất, cuộn tới trang đó và chờ một chút để lớp text/link render.
3. Trong một bước đồng bộ, đo hình chữ nhật của trang và mọi thẻ `a[href]` có tâm nằm trên trang.
4. Vẽ trang lên một canvas dùng lại (nền trắng), mã hóa JPEG rồi thêm vào tài liệu jsPDF của đợt hiện tại cùng các link đã quy đổi sang tọa độ PDF.
5. Khi đợt đủ `batchSize` trang thì lưu và giải phóng. Khi cuối tài liệu không còn trang mới thì lưu phần còn lại.

## Xử lý sự cố

| Vấn đề | Cách xử lý |
| --- | --- |
| Console không cho dán | Gõ `allow pasting`, nhấn Enter rồi dán lại. |
| "No page images found" | Chờ hiện trang đầu tiên rồi chạy lại script. |
| Không tải được jsPDF | CSP của trang hoặc mạng đã chặn cdnjs. Thử mạng khác hoặc nạp jsPDF từ nguồn khác. |
| Chỉ tải được một vài file | Cho phép "tải nhiều file" cho trang này, hoặc tăng `saveDelay`. |
| Mất link | Tăng `pageDelay` (ví dụ `600`). |
| Bị thiếu trang | Tăng `scrollDelay` và `pageDelay`; giữ tab ở phía trước. |
| File xuất quá nặng | Giảm `jpegQuality` và/hoặc đặt `maxImageWidth`. |

## Hạn chế

- Trang xuất ra là **ảnh**: không chọn hoặc tìm kiếm được chữ. Nếu cần, chạy thêm công cụ OCR như [OCRmyPDF](https://github.com/ocrmypdf/OCRmyPDF).
- Chỉ tạo lại link (không có bookmark, form hay metadata).
- Phụ thuộc cấu trúc hiện tại của trình xem Google Drive, Google có thể thay đổi bất cứ lúc nào.

## Miễn trừ trách nhiệm

Chỉ dùng công cụ này với tài liệu bạn sở hữu hoặc được phép sao chép, và tôn trọng bản quyền cùng điều khoản dịch vụ của các nền tảng liên quan. Công cụ được cung cấp nguyên trạng, không bảo hành, và không liên kết với Google.

## Giấy phép

[MIT](LICENSE)
