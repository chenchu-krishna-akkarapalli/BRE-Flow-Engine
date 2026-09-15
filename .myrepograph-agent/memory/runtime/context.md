# Short-Term Context — Active Checklists

Working state for the current task. Kept here rather than in the context window so long sessions do not carry their own history as ballast.

## Current task

- [x] Scanned all 18 Computation of Income (COI) PDF files in `cibil-pdf-scrapper/computation-of-income-copies-test/`.
- [x] Processed batch extraction through offline COI Engine (`crates/coi-cli`).
- [x] Fixed single-segment inline colon parsing in `coi-layout/src/pairs.rs` (`Name: Mr.MohitBhatt`, `PAN:ASGPB0484K`).
- [x] Fixed `coi-parser/src/assessee.rs` label matching and fallback bare PAN regex.
- [x] Resolved "Tax Payable on total Income" false positive in `total_income` across `parser.rs` and `contract.rs`.
- [x] Fixed refund collision with interest income in `contract.rs`.
- [x] Hardened CA verification regex against "Capital Gain" false positive in `contract.rs`.
- [x] Fixed `Gross Reciepts from Business & Profission` extraction (10,926,858) and `income_declared_business_turnover` in `contract.rs`.
- [x] Fixed `PROFIT OR GAINS OF BUSINESS OR PROFESSION` and two-line statutory head extraction in `heads.rs`, `patterns.rs`, and `contract.rs` (656,711).
- [x] Fixed `INCOME FROM OTHER SOURCE` breakdown for savings account interest (1,014), deposit interest (14,619), and IT refund interest (975).
- [x] Produced standardized nested JSON documents adhering strictly to `computation-of-income-output-reff.json` and `coi_contract.schema.json` in `cibil-pdf-scrapper/test_outputs/coi/<sanitized_filename>.json`.
- [x] Generated benchmark report summary at `cibil-pdf-scrapper/test_outputs/coi_bulk_benchmark_summary.json` (100% schema conformance, 88.89% direct native extraction, 0 contract failures, average confidence 0.953).
- [x] Fixed `income_from_other_sources` details extraction in `cibil-pdf-scrapper/crates/coi-parser/src/contract.rs` and `coi-output/COMPUTATION A.Y 2025-26.json` (savings interest: 9,740, FDR interest from Deposit 194A: 445,536, IT refund interest: 908, total: 456,184).

## Open questions

_none_

