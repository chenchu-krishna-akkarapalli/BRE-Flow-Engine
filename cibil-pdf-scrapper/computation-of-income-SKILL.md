---
name: rust-document-extraction-engine
description: Build or extend a Rust-based document/data extraction engine that turns semi-structured financial documents (CIBIL reports, ITR computation sheets, bank statements, KYC forms, etc.) into nested JSON, entirely on-device with no cloud OCR or API calls. Use this whenever the user wants to write, scaffold, extend, or debug a Rust extraction pipeline/engine, port a Python prototype (pdfplumber/regex-based) to Rust for production speed, add a new document-type parser to an existing Rust engine, or design the crate/module architecture for offline document AI. Trigger this for phrases like "extraction engine", "parsing engine", "Rust pipeline for [document type]", or "port this to Rust" in a document-AI context — even if the user doesn't say "skill" or name Rust explicitly but describes wanting a fast, compiled, on-prem extraction service.
---

# Rust Document Extraction Engine

## When this applies

Financial/regulatory documents in India (CIBIL reports, ITR computation sheets,
bank statements, GST returns, KYC forms) generally cannot be sent to cloud OCR
or LLM APIs for extraction — this is a hard data-residency constraint, not a
preference. This skill is for building the **offline, compiled** extraction
engine that replaces a cloud pipeline: fast, deployable as a single binary,
embeddable behind FastAPI/PostgreSQL via FFI or a sidecar process, and safe to
run on infrastructure that never touches the public internet.

It assumes the same design philosophy already validated in Python prototypes
for this kind of work:
1. **Never call cloud OCR/vision APIs.** Text-layer PDFs are read directly.
   Scanned pages fall back to a *local* OCR engine only.
2. **Layout-agnostic extraction.** Different source software (Winman, Saral,
   ClearTax, TransUnion CIBIL, bank core-banking exports, etc.) renders the
   same logical document differently. Parse by anchoring on known field
   labels and structural patterns, not fixed coordinates or table indices.
3. **Business logic stays out of the extractor.** The engine's only job is
   to turn raw document layout into faithful nested JSON of what's printed.
   Underwriting rules, eligibility scoring, EMI ratios, etc. are a separate
   downstream stage — never computed inside the parser.

## Architecture

```
cibil-pdf-scrapper/
├── Cargo.toml                      // Workspace manifest (coi-*, cibil-*, payslip-*)
├── crates/
│   ├── coi-core/                  // Common error types, traits, and primitive types
│   ├── coi-pdf/                   // PDF text run extraction via lopdf / pdfium-render
│   ├── coi-layout/                // Y-bucket line grouping & column-gap reconstruction
│   ├── coi-domain/                // Domain structs representing computation of income
│   ├── coi-parser/                // Label-anchored key:value & block regex extraction
│   ├── coi-validation/            // Schema validation & JSON schema contract check
│   └── coi-cli/                   // Standalone executable binary entrypoint
├── computation-of-income-output-reff.json  // Ground-truth nested JSON reference output
└── computation-of-income-SKILL.md // Skill specification document
```

Modularize domain logic across `coi-*` crates. Keep `coi-parser` focused strictly on label anchoring, block regexes, and populating `coi-domain` structs. Apply token-minimization rules (single concise context line comments, compact field representation) during JSON generation to ensure strict contract compliance with `computation-of-income-output-reff.json`.

## Recommended crates

| Need | Crate | Notes |
|---|---|---|
| PDF text-layer + glyph positions | `pdfium-render` | Wraps Google's PDFium; gives per-character x/y like pdfplumber does. Preferred over `lopdf` when you need layout-aware spacing, not just raw text. |
| Lightweight PDF parsing (no positions needed) | `lopdf` or `pdf-extract` | Fine for simple flat text extraction. |
| Local OCR fallback | `leptess` (Tesseract bindings) or `ort` (ONNX Runtime) running a local PaddleOCR/PP-OCR model export | Both fully offline. `ort` is the better fit if you're already exporting the PaddleOCR models used in the Python pipeline. |
| Regex / label matching | `regex` | Compile label patterns once with `lazy_static`/`once_cell`, reuse across documents. |
| JSON schema + serialization | `serde`, `serde_json` | Derive `Serialize`/`Deserialize` on every document schema struct — gives you validation for free. |
| CLI | `clap` (derive API) | For a standalone binary; skip if this will be embedded as a lib and called from Python/FastAPI via `pyo3` or a JSON-over-stdin sidecar. |
| Number parsing (Indian digit grouping, "Nil", parenthesized negatives) | write a small `parse_amount(&str) -> Option<i64>` helper — no crate needed | Mirrors the `_to_number()` helper from the Python version: strip commas, treat "Nil"/"-" as 0, `(123)` as -123. |

## Core extraction pattern (mirrors the validated Python approach)

1. **Detect text layer vs scan.** If `page.chars().count()` (via pdfium-render)
   is above a threshold, use the text layer. Otherwise OCR that page locally.
   Record which path was used per page in the output (`_meta.ocr_used`) —
   this is important for downstream QA/audit trails.

2. **Reconstruct layout-aware lines.** Don't just concatenate glyphs left to
   right — bucket characters by `y` (line), sort by `x`, and re-insert
   whitespace proportional to the horizontal gap. This is what lets you
   later split a two-column header row (`STATUS : INDIVIDUAL   ASSESSMENT
   YEAR : 2026-27`) reliably, regardless of which software produced the PDF.

3. **Label-anchor, don't coordinate-anchor.** For each known field, search
   the reconstructed text for `LABEL\s*:\s*(value)`, with a lookahead that
   stops at the next all-caps label if there's a same-line second column.
   Keep the label list as data (a `phf_map!` or plain `&[(&str, &str)]` of
   label → JSON path), not hardcoded per-document logic — this is what lets
   you add a new source-software variant by adding label synonyms, not by
   rewriting a parser.

4. **Repeating-block regexes for tables.** Presumptive-income tiers, TDS
   line items, tax slabs, EMI schedules — these repeat an unknown number of
   times. Use `Regex::captures_iter` over a block pattern rather than
   assuming a fixed row count.

5. **One `schema.rs` struct tree per document type**, always `serde`-
   serializable, always the same shape regardless of source layout. That
   stability is the actual deliverable — the parsing mechanics are allowed
   to be messy internally as long as the output contract never moves.

## Workflow for adding a new document type

1. Get 2-3 real (anonymized) samples of the document from *different*
   source software, if they exist. Put them in `tests/fixtures/`.
2. Diff their raw layout-aware text output first — this tells you which
   labels are stable across vendors and which need synonyms.
3. Define the `schema.rs` struct for the target nested JSON shape before
   writing any parsing code.
4. Write the label list and block patterns in `documents/<name>.rs`.
5. Add a fixture-based test per sample that asserts on the parsed struct,
   not just "it didn't panic."
6. Only if a sample lacks a text layer, wire up the OCR fallback path for
   that document type and re-verify field accuracy — OCR accuracy needs its
   own test tier since it degrades independently of the parsing logic.

## Interop with the existing Python/Kaggle pipeline

If this engine is meant to sit alongside the existing LayoutLMv3/PaddleOCR
work rather than replace it:
- Expose it as a small binary that takes a PDF path and prints JSON to
  stdout (or via `pyo3` bindings called directly from Python) — this keeps
  FastAPI as the orchestration layer and lets Rust just be the fast,
  deterministic extraction step for document types that don't need ML.
- Reserve the ML pipeline (LayoutLMv3) for documents where label-anchored
  regex genuinely can't cope with the layout variance (e.g. CIBIL's
  multi-page tabular account history) — the Rust engine is the right tool
  for computation-sheet-style label:value documents like ITR computations,
  not necessarily a wholesale replacement for the ML approach.

## Testing checklist before calling a document type "done"

- [ ] Text-layer path tested against every distinct source-software sample
- [ ] Local OCR fallback tested against at least one genuinely scanned sample
- [ ] Number parsing handles: comma grouping, "Nil", parenthesized negatives,
      trailing/leading whitespace
- [ ] Output JSON validated against the `schema.rs` contract (fails loudly
      on a shape mismatch, doesn't silently drop fields)
- [ ] No network calls anywhere in the dependency chain (`cargo tree` audit
      for any HTTP client crate pulled in transitively)
