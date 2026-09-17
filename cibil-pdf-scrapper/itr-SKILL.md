---
name: rust-itr-document-extraction-engine
description: Build or extend a Rust-based ITR (Income Tax Return / ITR-V) document extraction engine that parses Indian IT Return acknowledgements and detailed ITR forms into structured nested JSON, entirely on-device with zero cloud dependencies.
---

# Rust ITR Document Extraction Engine

## Overview & Scope

This skill governs the offline, compiled extraction engine for **Income Tax Return (ITR)** documents (including ITR-V Acknowledgements and ITR-1 to ITR-4 forms). The engine processes text-layer PDFs directly (falling back to local OCR when scanned), extracts key identity, return filing metadata, taxable income details, tax computations, accreted income, and electronic verification details, and serializes them into a strongly-typed, schema-validated JSON contract.

## Design Philosophy & Constraints

1. **Zero Cloud API / OCR Dependency**: All parsing runs compiled natively on-device. No PII or tax data is transmitted externally.
2. **Layout-Agnostic Extraction**: Handles variations across Assessment Years (AY 2021-22 through AY 2026-27+) and software export formats by anchoring on normalized labels rather than rigid pixel positions.
3. **Strict Separation of Extraction vs Business Rules**: The engine extracts exact printed tax document figures into JSON. Underwriting policies, DSCR calculations, and borrower income eligibility rules belong exclusively in downstream BRE engines.

## Crate Architecture

The ITR extraction engine is modularized inside the `cibil-pdf-scrapper` workspace across dedicated `itr-*` crates:

```
cibil-pdf-scrapper/
├── Cargo.toml                    // Workspace manifest (registered with "crates/itr-*")
├── itr-SKILL.md                  // Architectural & parsing specification (this document)
├── itr-output-reff.json          // Ground-truth target JSON output schema contract
├── itr-test/                     // Input test corpus (ITR-V and ITR PDFs)
├── itr-output/                   // Batch CLI output target directory
└── crates/
    ├── itr-core/                 // Error types, common money/date parsing traits, utilities
    ├── itr-pdf/                  // lopdf PDF stream decoding & text run extraction
    ├── itr-layout/               // Y-bucket line reconstruction & column boundary grouping
    ├── itr-domain/               // Rust structs representing ItrDocument (Serde serializable)
    ├── itr-parser/               // Label-anchored key-value, tabular, and block extraction algorithms
    ├── itr-validation/           // Mathematical invariants check & JSON schema verification
    └── itr-cli/                  // Binary CLI application (supports single file, stdin IPC, and --batch mode)
```

## Recommended Crates

| Function | Crate | Usage |
|---|---|---|
| PDF Text Layer Parsing | `lopdf` | Direct content stream & font decode |
| Regex Matching | `regex` | Label anchoring & numeric extraction |
| Serialization & Contracts | `serde`, `serde_json` | Derives `Serialize`/`Deserialize` for `ItrDocument` |
| CLI & Arguments | `clap` | Standalone CLI entrypoint (`itr-cli`) |
| Date & Financial Calculations | `jiff`, `indexmap` | Time parsing & map ordering |

## Core Extraction Flow

1. **Text Extraction & Line Reconstruction**:
   - Parse PDF character runs using `lopdf`.
   - Reconstruct lines using Y-coordinate bucketing and horizontal gap analysis.
2. **Label-Anchored Key-Value Extraction**:
   - Extract top-level metadata:
     - `PAN`: `[A-Z]{5}[0-9]{4}[A-Z]{1}`
     - `Name`: Text following `Name` label
     - `Assessment Year`: Format `20XX-YY` (e.g., `2026-27`)
     - `Financial Year`: Automatically derived as `AY - 1` (e.g., `2025-26`)
     - `Form Number`: `ITR-1`, `ITR-2`, `ITR-3`, `ITR-4`
     - `e-Filing Acknowledgement Number`: 15-digit numeric string
     - `Date of Filing`: Date pattern `DD-MMM-YYYY` or `DD/MM/YYYY`
3. **Table & Tax Section Parsing**:
   - **Taxable Income Details**: Total Income (Item 1A), Net Tax Payable (Item 4), Taxes Paid (Item 7), Tax Payable/Refundable (Item 8).
   - **Accreted Income Details (u/s 115TD)**: Accreted income (Item 9), Tax paid (Item 13), Balance (Item 14).
4. **Electronic Verification Details**:
   - Extraction of Transmission Date/Time, IP Address, Verifier Name, Verifier PAN, EVC Code, Verification Mode, and Barcode Hash string.

## Target Contract Schema (`itr-output-reff.json`)

The parser **MUST** output JSON strictly adhering to the schema structure defined in `itr-output-reff.json`.

```json
{
  "_meta": { "ocr_used": false, "source": "text_layer" },
  "assessee_info": {
    "pan": "FVKPK7079H",
    "name": "ABHISHEK KUMAR",
    "address": "...",
    "status": "Individual",
    "assessment_year": "2026-27",
    "financial_year": "2025-26"
  },
  "return_details": {
    "form_number": "ITR-4",
    "filed_u_s": "139(1)-On or before due date",
    "acknowledgement_number": "418491990140826",
    "date_of_filing": "14-Aug-2026"
  },
  "taxable_income_and_tax_details": {
    "total_income": 464060,
    "net_tax_payable": 0,
    "taxes_paid": 0,
    "tax_payable_or_refundable": 0
  },
  "verification_details": {
    "electronically_transmitted_on": "14-Aug-2026 14:02:07",
    "ip_address": "223.188.47.82",
    "verified_by": "ABHISHEK KUMAR",
    "verifier_pan": "FVKPK7079H",
    "verification_date": "17-Aug-2026",
    "evc_code": "8G5X9FXKNY",
    "verification_mode": "Bank Account Prevalidation mode",
    "barcode_hash": "FVKPK7079H04418491990140826a075ab0fa65bfeb62e866ecada47e8ea1b11b412"
  }
}
```

## Validation Rules & Invariants

1. **AY / FY Check**: `Financial Year` start year must equal `Assessment Year` start year minus 1 year.
2. **PAN Match**: Verifier PAN in electronic verification block must match Assessee PAN.
3. **Acknowledgement Number Consistency**: Header `Acknowledgement Number` must match `e-Filing Acknowledgement Number`.
