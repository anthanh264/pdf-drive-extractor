#!/usr/bin/env python3
"""Merge the part files produced by src/pdf_extractor_batch.js into one PDF.

Usage:
    python tools/merge_pdfs.py [FOLDER] [-p PATTERN] [-o OUTPUT]

Examples:
    python tools/merge_pdfs.py ~/Downloads
    python tools/merge_pdfs.py ./parts -o "My Book.pdf"

Parts are ordered by the number in "_partNN", so part02 comes before part10.
Link annotations are preserved.
"""
import argparse
import re
import sys
from pathlib import Path

try:
    from pypdf import PdfWriter
except ImportError:
    sys.exit("Missing dependency. Install it with:  pip install pypdf")


def part_key(path: Path):
    m = re.search(r"_part(\d+)", path.name)
    return (int(m.group(1)) if m else 10**9, path.name)


def main() -> None:
    ap = argparse.ArgumentParser(description="Merge extractor part PDFs into one file.")
    ap.add_argument("folder", nargs="?", default=".", help="folder containing the parts (default: .)")
    ap.add_argument("-p", "--pattern", default="*_part*.pdf", help="glob pattern (default: *_part*.pdf)")
    ap.add_argument("-o", "--output", help="output file (default: <title>.pdf in the same folder)")
    args = ap.parse_args()

    folder = Path(args.folder)
    files = sorted(folder.glob(args.pattern), key=part_key)
    if not files:
        sys.exit(f"No files matching '{args.pattern}' in {folder.resolve()}")

    if args.output:
        output = Path(args.output)
    else:
        title = re.sub(r"_part\d+_p\d+-\d+$", "", files[0].stem)
        output = folder / f"{title}.pdf"

    files = [f for f in files if f.resolve() != output.resolve()]

    print(f"Merging {len(files)} file(s):")
    with PdfWriter() as writer:
        for f in files:
            print("  +", f.name)
            writer.append(str(f))
        total = len(writer.pages)
        writer.write(str(output))

    print(f"\nDone: {output} ({total} pages)")


if __name__ == "__main__":
    main()
