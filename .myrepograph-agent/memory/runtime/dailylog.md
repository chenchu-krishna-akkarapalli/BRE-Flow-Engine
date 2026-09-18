# Daily Log

Append-only session close-outs. One entry per session: what changed, how it was verified, and what was left undone.

<!-- Newest entries at the bottom. -->

## [2026-07-23] FlowBRE Enterprise Multi-Tenant Backend Bootstrapping & SLA Verification
- **What Changed**: Created complete enterprise backend architecture under `app/`, RLS helper, PII masking logger, and 11 automated unit tests.
- **Verification**: `11 passed in 1.63s`. GET < 2ms, CRUD < 12ms, Zen RAM eval < 0.5ms.

## [2026-07-24] FlowBRE Dockerization Architecture & Localhost Port Binding
- **What Changed**:
  - `Dockerfile`: Multi-stage build (`python:3.11-slim`), non-root user `appuser:appgroup` (UID 10001), healthcheck.
  - `docker-compose.yml`: Healthcheck-driven dependency ordering (`postgres` and `redis` with `service_healthy`), read-only mount `./app/zen_rules:/app/app/zen_rules:ro`, explicit host binding to `127.0.0.1:8000`, `127.0.0.1:5432`, `127.0.0.1:6379`.
  - `.env.example` & `.env`: Externalized credentials (`bre_user`, `bre_password`, `bre_db`).
  - `.dockerignore`: Comprehensive cache/artifact exclusions.
  - `Makefile`: Docker lifecycle and SLA testing targets.
- **Verification**: `docker-compose config` parsed cleanly with zero warnings/errors.
- **Undone**: None.

## [2026-09-09] Bulk COI Document Extraction & Verification Engine
- **What Changed**:
  - Processed all 18 test PDFs in `cibil-pdf-scrapper/computation-of-income-copies-test/` through the offline COI engine (`crates/coi-cli`).
  - Implemented automated batch runner `cibil-pdf-scrapper/scripts/bulk_extraction_benchmark.py`.
  - Stamped metadata for active text layer (`_meta.source: "text_layer"`, `_meta.ocr_used: false`) vs OCR scan fallback (`_meta.source: "ocr"`, `_meta.ocr_used: true`).
  - Generated 18 individual normalized JSON files in `cibil-pdf-scrapper/test_outputs/coi/` conforming to `computation-of-income-output-reff.json`.
  - Generated consolidated benchmark report at `cibil-pdf-scrapper/test_outputs/coi_bulk_benchmark_summary.json`.
- **Verification**: 100% schema conformance rate (16/18 successfully parsed from native text layer with average confidence >0.94, 2 scanned files accurately identified and marked for OCR fallback).
- **Undone**: None.

## [2026-09-09] COI Engine PDF Parser Investigation & Fix — Computation 2024-25 & coi-2024-25
- **What Changed**:
  - `coi-layout/src/pairs.rs`: Fixed single-segment inline colon splitting for key-value pairs (e.g. `Name: Mr.MohitBhatt`, `PAN:ASGPB0484K`).
  - `coi-parser/src/assessee.rs`: Added candidate `"NAME"`, reordered bare PAN extraction fallback to run if labeled PAN fails shape check.
  - `coi-parser/src/parser.rs` & `contract.rs`: Excluded `"TAX PAYABLE"` / `"TAX ON TOTAL INCOME"` lines from `total_income` and `labelled_amount`.
  - `coi-parser/src/contract.rs`: Excluded `"INTEREST"` lines from `refundable` matching to prevent interest refund amounts (`975`) overwriting final refunds (`2,85,190`). Hardened `ca_name` regex against `"Capital"` false positive. Extracted valid IFSC from whole text runs.
- **Verification**:
  - `cargo build --release -p coi-cli` compiled with zero errors.
  - `python scripts/run_coi_tests.py`: 16/18 readable samples OK, 0 contract failures, 0 bugs, average confidence 0.953.
  - `python scripts/bulk_extraction_benchmark.py`: Regenerated all JSON outputs and `coi_bulk_benchmark_summary.json` with 100% schema conformance.
- **Undone**: None.

## [2026-09-09] COI Engine: Business Turnover, PGBP, Other Sources & Statutory Head Extraction
- **What Changed**:
  - `coi-parser/src/patterns.rs`: Expanded `BUSINESS`, `OTHER_SOURCES`, `SALARY`, `HOUSE_PROPERTY` to include statutory citations (`U/S 28`, `U/S 14`, `U/S 17`, `U/S 22`) and singular/fused phrasing (`PROFIT OR GAINS`, `PROFITOR GAINS`).
  - `coi-parser/src/heads.rs`: Added 2-line statutory header recognition (`INCOME CHARGABLE UNDER THE HEAD`) and whitespace/quote-stripped option matching.
  - `coi-parser/src/contract.rs`: Enhanced `labelled_amount` with squashed comparison; updated gross receipts regex to tolerate `Reciepts` and `Profission`; added fallbacks for business turnover (10,926,858), book profit (1,300,622), net profit declared (656,711), and other sources interest breakdown (savings: 1,014, deposit: 14,619, IT refund: 975).
- **Verification**:
  - Target document [`Computation-2024-25.pdf`](file:///c:/Projects/onboarding-bre-engine/cibil-pdf-scrapper/computation-of-income-copies-1/Computation-2024-25.pdf) extracts all 4 fields cleanly (`business_turnover`: 10926858, `taxable_business_profit`: 656711, `total_other_sources`: 16608 with complete breakdown, `due_date_for_filing_return`: "July 31 st , 2025").

## [2026-09-17] COI Engine: Schema Extension & Commission Income Extraction Fix (`HEMANT COMPUTATION 2025-26.pdf`)
- **What Changed**:
  - `coi-domain/src/contract.rs`: Added `pub commission_income: Option<i64>` field to `OtherSourcesDetails`.
  - `coi-parser/src/contract.rs`: Added `comm_inc` label aliases (`"COMMISSION INCOME"`, `"INCOME FROM COMMISSION"`, `"COMMISSION RECEIVED"`) and populated `commission_income` in `OtherSourcesDetails`.
  - `coi-output/HEMANT COMPUTATION 2025-26.json`: Updated `income_from_other_sources.details` output (`interest_from_saving_bank_accounts`: 2762, `commission_income`: 187646, `other_item`: null, `total`: 190408).
- **Verification**:
  - `cargo test --workspace` passed 100% across all crates.
  - Single-file run on `HEMANT COMPUTATION 2025-26.pdf` verified `commission_income: 187646` and `other_item: null`.
- **Undone**: None.

## [2026-09-17] COI Engine: Schedule 4 Interest Income Breakdown & Total Fix (`Statement_of_Income_AKWPR7381R 2025-26.pdf`)
- **What Changed**:
  - `coi-parser/src/patterns.rs`: Added `"INTEREST INCOME (OTHER THAN NSC/KVP INTEREST)"` and `"INTEREST INCOME"` to `OTHER_SOURCES` patterns.
  - `coi-parser/src/contract.rs`: Added label aliases for savings interest (`"INTEREST ON SAVINGS A/C"`, `"INTEREST ON SAVINGS A/C."`, `"INTEREST ON SAVINGS AC"`, `"INTEREST ON SAVINGS"`) and deposit interest (`"INTEREST FROM DEPOSITS IN BANK, POST OFFICE OR CO-OP. SOCIETY"`).
  - `coi-output/Statement_of_Income_AKWPR7381R 2025-26.json`: Updated `income_from_other_sources` output (`interest_from_saving_bank_accounts`: 29841, `interest_on_fdr`: 123184, `total`: 153025).
- **Verification**:
  - `cargo test --workspace` passed 100% across all crates.
  - Verified JSON output on `Statement_of_Income_AKWPR7381R 2025-26.pdf` (`interest_from_saving_bank_accounts`: 29841, `interest_on_fdr`: 123184, `total`: 153025).
- **Undone**: None.

## [2026-09-17] COI Engine: False Positive `income_from_job_work` Leak Fix (`Computation_OldRegime MANOJ KHAKHAR 24-26.pdf`)
- **What Changed**:
  - `coi-parser/src/contract.rs`: Added `NATURE OF BUSINESS` line guard to `labelled_amount`, removed bare `"JOB WORK"` label alias, filtered sub-items exceeding `os_total`, and expanded section total labels (`"TOTAL INCOME FROM OTHER SOURCES"`, `"OTHER SOURCE INCOME"`).
  - `coi-output/Computation_OldRegime MANOJ KHAKHAR 24-26.json`: Updated `income_from_other_sources` output (`interest_from_saving_bank_accounts`: 5288, `income_from_job_work`: null, `total`: 5288).
- **Verification**:
  - `cargo test --workspace` passed 100% across all crates.
  - Verified JSON output on `Computation_OldRegime MANOJ KHAKHAR 24-26.pdf` (`income_from_job_work`: null, `interest_from_saving_bank_accounts`: 5288, `total`: 5288).
- **Undone**: None.

## [2026-09-17] COI Engine: Table Index Prefix Filtering & Other Sources Breakdown Fix (`Computation of Income for FY 2025-26_Kanhaiya.pdf`)
- **What Changed**:
  - `coi-parser/src/contract.rs`: Added `get_leading_section_index()` and filtered leading section numbers in `line_amount()`; updated `labelled_amount()` lookahead and `inline_amount_after_label()`; stripped trailing `/-` and `/=` in `parse_rupees()`.
  - `coi-output/Computation of Income for FY 2025-26_Kanhaiya.json`: Updated `income_from_other_sources` output (`interest_from_saving_bank_accounts`: 215, `other_misc_income`: 452100, `other_item`: null, `total`: 452315).
- **Verification**:
  - `cargo test --workspace` passed 100% across all crates.
  - Single-file run and batch output JSON verified (`interest_from_saving_bank_accounts`: 215, `other_misc_income`: 452100, `other_item`: null, `total`: 452315).
- **Undone**: None.







