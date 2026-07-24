# Short-Term Context — Active Checklists

Working state for the current task. Kept here rather than in the context window so long sessions do not carry their own history as ballast.

## Current task

- [x] Extracted all 62 columns from `Bank_Eligibility_Matrix_v1.xlsx` (`decision table` sheet).
- [x] Integrated canonical `BANK_MATRIX_RULES` mapping into `app/services/bre_engine.py` covering all 8 partner banks (`BOI`, `INDIAN_BANK`, `IOB`, `BOB`, `BOM`, `HDFC`, `AXIS`, `KOTAK`).
- [x] Implemented multi-bank CIBIL floors, DPD thresholds, write-off ceilings, NRI stay limits, age floors/ceilings, and ITR rules.
- [x] Verified PII redaction and 5-stage request memory lifecycle (`del safe_log_payload`).
- [x] Ran automated test suite (`11/11 PASSED`).
- [x] Verified live container execution: CIBIL 680 evaluates BOM `true`, other 7 banks `false` in `10.63 ms`.

## Open questions

_none_
