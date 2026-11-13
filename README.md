# Drive PDF Batch Extractor

[English](README.md) | [Tiếng Việt](README.vi.md)

A browser-console script that rebuilds a PDF from the Google Drive PDF viewer. It scrolls the document for you, captures every page, keeps the clickable links, and saves a new PDF every **N pages** (default 100) so large documents don't exhaust the browser's memory.

## Features

- **Fully automatic:** scrolls the viewer, waits for each page to load, no manual scrolling.
- **Batch export:** one PDF per 100 pages (configurable), e.g. `My Book_part03_p201-300.pdf`.
- **Working links:** link annotations are measured on each page at capture time and re-created in the PDF.
- **Low memory:** pages are encoded straight to JPEG bytes (no base64), added to the current batch, and the batch is released after it is saved.
- **Safe to interrupt:** a "Stop & save current batch" button, and whatever was captured is saved even if an error occurs.
- **Optional downscaling and quality control** for smaller files.
- **Helper script** to merge all parts back into a single PDF.

## Requirements

- A Chromium-based desktop browser (Chrome, Edge, ...).
- The PDF opened in the Google Drive viewer (`drive.google.com/file/d/.../view`).
- Internet access to load [jsPDF 2.5.1](https://cdnjs.com/libraries/jspdf) from cdnjs.
- For merging: Python 3 and `pip install pypdf`.

## Quick start

1. Open the PDF in the Google Drive viewer and wait until the first page is visible.
2. Open the DevTools console (`F12`, or `Ctrl+Shift+J` / `Cmd+Option+J`).
   Chrome may block pasting the first time: type `allow pasting` and press Enter.
3. Copy the entire contents of [`src/pdf_extractor_batch.js`](src/pdf_extractor_batch.js), paste it into the console and press Enter.
4. Leave the tab open and in the foreground. A progress panel appears in the top-right corner.
   If the browser asks to allow multiple downloads, click **Allow**.
5. When it finishes you get files like:

```
My Book_part01_p001-100.pdf
My Book_part02_p101-200.pdf
...
My Book_part11_p1001-1032.pdf
```

The last file is shorter than the others; that's expected.

## Configuration

Edit the `CONFIG` object at the top of the script before pasting it.

| Option | Default | Description |
| --- | --- | --- |
| `batchSize` | `100` | Pages per exported PDF. `1` = one file per page. |
| `maxPages` | `0` | `0` = whole document. `1` = only the first page, `5` = first five pages. |
| `jpegQuality` | `0.92` | JPEG quality. Use `0.80` for noticeably smaller files. |
| `dpi` | `72` | PDF page size = image pixels at this DPI. |
| `maxImageWidth` | `0` | `0` = keep native resolution. e.g. `1600` downscales wider pages. |
| `minPageWidth` | `300` | Ignore blob images narrower than this (icons, etc.). |
| `pageDelay` | `250` | ms to wait after scrolling to a page so its links render. Increase if links are missing. |
| `scrollDelay` | `500` | ms to wait after each scroll step for new pages to load. Increase on slow connections. |
| `saveDelay` | `1500` | ms pause between downloads. |
| `endRetries` | `4` | Retries at the bottom of the document before concluding there are no more pages. |
| `pdfCompression` | `true` | Enable jsPDF stream compression. |
| `progressIndicator` | `true` | Show the progress panel. |

Examples:

```js
// Only the first page, as one file
batchSize: 100, maxPages: 1,

// Every page as its own file (expect many downloads)
batchSize: 1, saveDelay: 500,

// Smaller output
jpegQuality: 0.80, maxImageWidth: 1600,
```

## Merge the parts into one PDF

```bash
pip install pypdf
python tools/merge_pdfs.py /path/to/downloads
# or choose the output name
python tools/merge_pdfs.py /path/to/downloads -o "My Book.pdf"
```

Parts are ordered by the `_partNN` number and links are preserved. Desktop tools such as PDF24 Creator or PDFgear also work (sort by file name before merging).

## How it works

1. Waits for the first `img[src^="blob:"]` (the page images of the viewer) and detects the scrollable container.
2. Takes the top-most page that hasn't been processed, scrolls it into view and waits briefly so the text/link layer renders.
3. In one synchronous step, measures the page rectangle and every `a[href]` whose centre lies on it.
4. Draws the page on a reusable canvas (white background), encodes it as JPEG and appends it to the current jsPDF document together with link annotations scaled to PDF coordinates.
5. When a batch reaches `batchSize`, saves it and discards it. When no new pages appear at the bottom, saves the remainder.

## Troubleshooting

| Problem | What to try |
| --- | --- |
| Console refuses to paste | Type `allow pasting` and press Enter, then paste again. |
| "No page images found" | Wait until the first page is visible, then run the script again. |
| jsPDF fails to load | The page's CSP or network blocked cdnjs. Try another network or load jsPDF from another source. |
| Only some downloads appear | Allow "multiple downloads" for the site, or increase `saveDelay`. |
| Links are missing | Increase `pageDelay` (e.g. `600`). |
| Some pages are skipped | Increase `scrollDelay` and `pageDelay`; keep the tab in the foreground. |
| Output is too large | Lower `jpegQuality` and/or set `maxImageWidth`. |

## Limitations

- Output pages are **images**: text is not selectable or searchable. Run an OCR tool such as [OCRmyPDF](https://github.com/ocrmypdf/OCRmyPDF) afterwards if you need that.
- Only link annotations are recreated (no bookmarks, forms or metadata).
- Depends on the current structure of the Google Drive viewer, which Google can change at any time.

## Disclaimer

Use this tool only on documents you own or have permission to copy, and respect copyright and the terms of service of the platforms involved. It is provided as is, without warranty, and is not affiliated with Google.

## License

[MIT](LICENSE)
