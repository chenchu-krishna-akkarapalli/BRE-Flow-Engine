"""Payslip PDF -> rows of table cells, read entirely on this host.

Pages with a text layer are read from pdfium's character boxes; scanned pages are
rendered and OCR'd with Tesseract. Both become rows like
"Basic Salary | 71,900.00 | Ee PF contribution | 1,800.00": glyphs on one baseline
form a row, and a column-wide gap starts a new cell, so the model sees the table.
"""

import re
import shutil
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import pypdfium2 as pdfium
import pytesseract

DPI = 300
# Huge page boxes would otherwise render to images Tesseract takes minutes over.
MAX_SIDE_PX = 7000
# Gaps measured in glyph heights: wider than the cell gap starts a new cell, wider
# than SPACE_GAP is a word break inside one. Text-layer boxes span the font height
# (word spaces ~0.25, adjacent columns from ~0.9); OCR boxes hug the ink, so OCR
# needs a wider gap before calling it a column.
CELL_GAP_TEXT = 0.7
CELL_GAP_OCR = 1.2
SPACE_GAP = 0.15
# Glyph centres within this fraction of the glyph height share a row. Some slips
# bottom-align labels and top-align values in one cell (~0.56 apart); real rows sit
# at least ~1.15 apart.
ROW_TOLERANCE = 0.65
BASELINE_SHIFT = 0.3
# A page with fewer real characters than this is a scan (or a stamp) and gets OCR.
MIN_PAGE_CHARS = 20
# Below this Tesseract word confidence a digit is reported as unreliable.
DIGIT_MIN_CONF = 80.0
TESS_CONFIG = "--oem 1 --psm 6"

_DIGIT = re.compile(r"\d")
_RULE_CHARS = frozenset("|¦│┃║")
_HAS_WORD = re.compile(r"[^\W_]")
_HAS_LETTER = re.compile(r"[^\W\d_]")


@dataclass
class Glyph:
    """A character (text layer) or word (OCR) in PDF points, top-left origin."""

    text: str
    x0: float
    y0: float
    x1: float
    y1: float
    page: int
    ocr: bool = False

    @property
    def height(self) -> float:
        return max(self.y1 - self.y0, 1.0)

    @property
    def cy(self) -> float:
        return (self.y0 + self.y1) / 2


@dataclass
class Row:
    page: int
    cells: List[str] = field(default_factory=list)
    # Left edge of each cell in PDF points, index-aligned with `cells`.
    xs: List[float] = field(default_factory=list)

    def text(self) -> str:
        return " | ".join(self.cells)


@dataclass
class PdfText:
    rows: List[Row]
    pages: int
    source: str  # "pdf_text", "ocr" or "mixed"
    low_confidence_digits: List[str]


def ocr_available() -> bool:
    return shutil.which(pytesseract.pytesseract.tesseract_cmd) is not None or shutil.which("tesseract") is not None


def _text_layer(page: "pdfium.PdfPage", number: int) -> List[Glyph]:
    _, height = page.get_size()
    textpage = page.get_textpage()
    try:
        glyphs = []
        for i in range(textpage.count_chars()):
            char = textpage.get_text_range(i, 1)
            # Text-drawn table borders ("|Basic Salary | | 50,500.00 |") would read as
            # empty cells and blur where one column ends; the gap they leave still
            # splits the cell, as on OCR'd pages.
            if not char.strip() or char in _RULE_CHARS:
                continue
            # Loose boxes span the font's full height, so every glyph on a line
            # shares one centre regardless of its shape ("e" vs "L").
            left, bottom, right, top = textpage.get_charbox(i, loose=True)
            glyphs.append(Glyph(char, left, height - top, right, height - bottom, number))
        return glyphs
    finally:
        textpage.close()


def _ocr(page: "pdfium.PdfPage", number: int) -> Tuple[List[Glyph], List[str]]:
    width, height = page.get_size()
    scale = min(DPI / 72.0, MAX_SIDE_PX / max(width, height, 1.0))
    image = page.render(scale=scale).to_pil().convert("L")
    data = pytesseract.image_to_data(image, lang="eng", config=TESS_CONFIG, output_type=pytesseract.Output.DICT)
    glyphs, doubtful = [], []
    for i, text in enumerate(data["text"]):
        conf = float(data["conf"][i])
        # Table rules read as "|" or "�"; kept, they fuse neighbouring cells.
        if conf < 0 or not any(c.isalnum() for c in text):
            continue
        x, y, w, h = data["left"][i], data["top"][i], data["width"][i], data["height"][i]
        glyphs.append(Glyph(text.strip(), x / scale, y / scale, (x + w) / scale, (y + h) / scale, number, ocr=True))
        if _DIGIT.search(text) and conf < DIGIT_MIN_CONF:
            doubtful.append(text.strip())
    return glyphs, doubtful


def group_rows(glyphs: List[Glyph]) -> List[Row]:
    """Glyphs -> rows by baseline, split into cells at column-wide gaps."""
    ordered = sorted(glyphs, key=lambda g: (g.page, g.cy, g.x0))
    lines: List[List[Glyph]] = []
    for g in ordered:
        current = lines[-1] if lines else None
        if (
            current
            and current[0].page == g.page
            and abs(current[0].cy - g.cy) <= ROW_TOLERANCE * min(current[0].height, g.height)
        ):
            current.append(g)
        else:
            lines.append([g])

    rows = []
    for line in lines:
        line.sort(key=lambda g: g.x0)
        cells, text, x = [], line[0].text, line[0].x0
        for prev, g in zip(line, line[1:]):
            gap = g.x0 - prev.x1
            height = min(prev.height, g.height)
            cell_gap = CELL_GAP_OCR if g.ocr else CELL_GAP_TEXT
            # Words of one phrase share a baseline; a shifted one is another cell's
            # text (a top-aligned "Amount" beside a bottom-aligned "Deductions").
            shifted = abs(g.cy - prev.cy) > BASELINE_SHIFT * height
            if gap > cell_gap * height or shifted:
                cells.append((text, x))
                text, x = g.text, g.x0
            else:
                text += (" " if gap > SPACE_GAP * height else "") + g.text
        cells.append((text, x))
        # Rule lines ("--------", "=====") carry no letters or digits.
        kept = [(t.strip(), x) for t, x in cells if _HAS_WORD.search(t)]
        rows.append(Row(line[0].page, [t for t, _ in kept], [x for _, x in kept]))
    return [r for r in rows if r.cells]


_EARNINGS_HEAD = re.compile(r"^\s*earnings?\b", re.IGNORECASE)
_DEDUCTIONS_HEAD = re.compile(r"^\s*deductions?\b", re.IGNORECASE)
# Ends the table: "Total", "Total Earnings", "Gross Earnings" - not "Gross up on ...".
_TOTAL_CELL = re.compile(r"^\s*(total|gross\s+(earnings?|salary|pay|deductions?))\b", re.IGNORECASE)


def split_side_by_side(rows: List[Row]) -> List[Row]:
    """Re-emit an Earnings | Deductions table as two blocks, one per column.

    A small model reading "Basic | 50,500.00 | EE GPF | 7,575.00" as one row tends to
    file the deduction under earnings. When a header row has both an Earnings and a
    Deductions cell, every cell up to the table's Total row is assigned to the side
    of the header it sits under. Values and labels are unchanged, so grounding holds.
    """
    out: List[Row] = []
    i = 0
    while i < len(rows):
        row = rows[i]
        # A table header starts with its Earnings cell; a summary row that merely
        # mentions both ("Bank | Earnings | Deductions | Net") is not one.
        earn = row.xs[0] if _EARNINGS_HEAD.match(row.cells[0]) else None
        ded = next((x for c, x in zip(row.cells, row.xs) if _DEDUCTIONS_HEAD.match(c)), None)
        end = next(
            (j for j in range(i + 1, len(rows))
             if rows[j].page == row.page and any(_TOTAL_CELL.match(c) for c in rows[j].cells)),
            None,
        )
        if earn is None or ded is None or earn >= ded or end is None:
            out.append(row)
            i += 1
            continue
        # Cells left of the midpoint between the two headers belong to earnings; a
        # value right-aligned under "Amount" still lands on its own side.
        boundary = ded - (ded - earn) * 0.05
        left: List[Row] = []
        right: List[Row] = []
        # The header row is split too: each block keeps its own "Amount | YTD" columns.
        for body in rows[i: end + 1]:
            parts = [
                [(c, x) for c, x in zip(body.cells, body.xs) if x < boundary],
                [(c, x) for c, x in zip(body.cells, body.xs) if x >= boundary],
            ]
            # One "Total" label often serves both columns; carry it over so the
            # deductions total is not left as a bare number.
            if body is rows[end] and parts[0] and parts[1] and not any(_HAS_LETTER.search(c) for c, _ in parts[1]):
                parts[1].insert(0, (parts[0][0][0], boundary))
            for side, part in zip((left, right), parts):
                if part:
                    side.append(Row(body.page, [c for c, _ in part], [x for _, x in part]))
        out += left + right
        i = end + 1
    return out


def read_pdf(data: bytes) -> PdfText:
    """Blocking (pdfium and Tesseract): call it from a worker thread."""
    pdf = pdfium.PdfDocument(data)
    try:
        glyphs: List[Glyph] = []
        doubtful: List[str] = []
        kinds = set()
        for index in range(len(pdf)):
            page = pdf[index]
            try:
                page_glyphs = _text_layer(page, index + 1)
                if len(page_glyphs) < MIN_PAGE_CHARS:
                    if not ocr_available():
                        raise OcrUnavailable()
                    page_glyphs, page_doubtful = _ocr(page, index + 1)
                    doubtful += page_doubtful
                    kinds.add("ocr")
                else:
                    kinds.add("pdf_text")
                glyphs += page_glyphs
            finally:
                page.close()
        source = kinds.pop() if len(kinds) == 1 else "mixed"
        return PdfText(split_side_by_side(group_rows(glyphs)), len(pdf), source, doubtful)
    finally:
        pdf.close()


class OcrUnavailable(RuntimeError):
    """A page is a scan and Tesseract is not installed on this host."""
