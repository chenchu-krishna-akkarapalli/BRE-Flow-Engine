# Bureau Parsing Workflow (`cibil_pdf_parser_checks.md`)

Workflow for parsing CIBIL bureau JSON/PDF payloads, standardizing DPD history, and executing runtime PII masking.

---

## 🎯 1. Anti-Assumption & Fact Verification
- Verify bureau parsing logic against `credit_bureau_rules.json` (`BUR-401..408`).
- Standardize any `"STD"` string in `dpd_history` arrays to integer `0`.

---

## ⚡ 2. Performance SLA Gate
- **Bureau Parsing Speed**: Must complete in **`< 5 ms`**.

---

## 🧠 3. Memory Lifecycle Check
- Memory allocated during string parsing must un-reference and release during Stage 4/5 GC.
