---
name: document-skills
description: Official Anthropic collection that executes Python scripts to extract text, read tables, or create and manipulate real PDF, DOCX, XLSX, and PPTX files rather than just generating text descriptions of them. Use this whenever the user's task involves reading from or producing an actual PDF, Word, Excel, or PowerPoint file, rather than a plain-text or markdown answer.
---

# Document Skills

An umbrella skill covering real, structured file manipulation for the four major office document formats — actual files, not text approximations of them.

## When to use this

- The user uploads a PDF/DOCX/XLSX/PPTX and wants content read, extracted, or summarized from it.
- The user wants a new document produced in one of these formats (a report as a Word doc, a model as a spreadsheet, a deck as PowerPoint, a form-fillable PDF).
- The user wants an existing document edited, reformatted, or restructured while remaining a real file of the same type.

## Format-specific coverage

### PDF
- Extract text, tables, and images from existing PDFs, including OCR for scanned documents.
- Fill PDF forms programmatically.
- Create new PDFs, merge/split/rotate pages, add watermarks, encrypt/decrypt.

### DOCX
- Read and extract structured content (headings, tables, tracked changes, comments) from Word documents.
- Create professional documents with proper structure: headings, table of contents, page numbers, styles — not just plain paragraphs.
- Edit existing documents in place (find-and-replace, image insertion/replacement) while preserving formatting.

### XLSX
- Read and clean messy tabular data (misaligned headers, malformed rows) into a proper structured spreadsheet.
- Compute formulas, add charts, and format existing spreadsheets.
- Create new spreadsheets/models from other data sources.

### PPTX
- Read and extract text/notes from existing slide decks, including speaker notes and comments.
- Create new decks with proper slide structure and layouts.
- Edit existing presentations, including working with templates (.potx) and layouts.

## Core principle

For all four formats, work happens through real file manipulation (via the appropriate scripts/libraries for each format), producing an actual downloadable file — never simulate a document's contents as plain text or markdown when a real file of the correct type was requested, since that isn't usable the way the real format is (openable in Word/Excel/PowerPoint/a PDF viewer, preserving formatting, formulas, slide structure, etc.).

## Workflow

1. Identify the format involved (from the file the user uploaded, or from what they want produced).
2. Read the relevant format-specific approach before starting — each format has different libraries, quirks, and constraints that materially affect output quality.
3. For edits: work on the actual uploaded file, preserving everything not explicitly being changed.
4. For creation: build the file with proper structure for its format (real headings in DOCX, real formulas in XLSX, real slide layouts in PPTX, real form fields in PDF) rather than a flat, unstructured approximation.
5. Deliver the actual file to the user, not a text description of what it would contain.
