# Workspace Guide: CIBIL PDF Scraper Engine

## 1. Quick Start & Common Commands
- **Build Workspace**: `cargo build --workspace`
- **Build CLI Binary**: `cargo build --bin cibil-cli`
- **Run All Unit & Integration Tests**: `cargo test --workspace`
- **Fast Type Check**: `cargo check --workspace`
- **Lint & Static Analysis**: `cargo clippy --workspace -- -D warnings`
- **Check Formatting**: `cargo fmt --check`
- **Run End-to-End Test Suite**: `python run_tests.py` (processes test files in `test/`, invokes `cibil-cli.exe`, and formats JSON into `output/`)

## 2. Architecture & Crate Graph
The workspace is organized into a modular layered architecture under `crates/`:
- **`crates/cibil-core`**: Core traits (`PdfDocumentLoader`, `OcrEngineAdapter`), error domain matrix (`CibilError`, `Result<T>`), and common interfaces.
- **`crates/cibil-pdf`**: PDF document loading, stream decoding, stream object parsing, and PyMuPDF/lopdf block extraction adapters.
- **`crates/cibil-layout`**: Spatial geometry engine (`BoundingBox`), XY-Cut segmentation, reading order recovery, and cell coordinate calculations.
- **`crates/cibil-semantic`**: High-level block classification, section header identification, and semantic structure tags.
- **`crates/cibil-domain`**: Core data domain models (`ReportMetadata`, `CreditAccount`, `PaymentHistory`), DPD matrix stitching logic (`DpdStitcher`), and Aadhaar redaction (`redact_aadhaar`).
- **`crates/cibil-validation`**: Structural validation rules, schema compliance checking, and data completeness verification against CIBIL standards.
- **`crates/cibil-parser`**: Specialized lexical parsing engines for Consumer Info, Scores, Account Registries, and Enquiries.
- **`crates/cibil-graph`**: Contextual DAG relational mapper connecting parent reports, account nodes, DPD matrices, and host crate for the `cibil-cli` binary.

### 5-Stage Lifecycle Architecture
1. **Stage 1: Prototype (Foundational Architecture & Module Matrix)**: Multi-crate workspace setup, standard primitives, decoupled data domain memory maps (`ReportMetadata`, `CreditAccount`, `PaymentHistory`).
2. **Stage 2: Builder (Trait Contracts & Traceable Structs)**: Explicit `Result<T, CibilError>` handling, adapter traits for PDF loaders/OCR, and DPD Matrix stitching logic (`DpdStitcher`).
3. **Stage 3: Sweeper (Memory Layer, Performance & Geometrical Safety)**: Zero-copy string allocations (`Cow<'a, str>`, `&'a str`), multi-threaded Rayon processing safety, and cross-page table/column wrap boundary mitigation.
4. **Stage 4: Grower (Provider Agnostic Expansion Architecture)**: Bureau-agnostic data abstractions enabling pluggable support for Experian, Equifax, or CRIF High Mark formats without modifying graph builders.
5. **Stage 5: Maintainer (Validation, Schema Definitions & Verification)**: JSON schema output formatting, end-to-end automated testing (`run_tests.py`), and operational validation.

## 3. Token & Context Optimization Rules (Critical)
- **File Reading Protocol**: Read specific line ranges (`StartLine`/`EndLine`); avoid loading entire files unless necessary.
- **Diff Editing Protocol**: Use targeted line replacements; never rewrite whole files for small tweaks.
- **Log Output Management**: Truncate long test outputs; grep for errors instead of printing entire stack traces.
- **No Filler Policy**: Provide zero conversational padding, redundant summaries, or repetitive disclaimers.
- **Code Comment Efficiency**: Minimize token consumption in code snippets; use only concise single-line context comments (`// ...`) and avoid verbose multi-line block comments or docstrings.

## 4. Code & Security Standards
- **Zero-Copy & Performance**: Prefer standard Rust primitives, `Cow<'a, str>`, and slice references (`&'a str`) to minimize allocations.
- **Aadhaar Redaction Rule**: Strict masking of 12-digit Indian Aadhaar numbers (`[Aadhaar Redacted]`) before serialization.
- **Error Handling**: Use explicit `Result<T, E>` and custom domain error enums; no silent swallowed errors or unwrap in production code.

## 5. Opus 5 Operational Directives
- **Direct Lead Answers**: Always start responses with the direct answer or outcome.
- **Minimal Tool Narration**: Say what you're doing in one brief sentence before tool use.
- **Subagent Policy**: No subagent spawning for simple single-file tasks or self-verification.
