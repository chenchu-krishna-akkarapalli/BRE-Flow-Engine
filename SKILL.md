---
name: flowbre-rule-engine
description: Use this skill whenever a task touches the FlowBRE onboarding Business Rule Engine — adding, editing, removing, or testing a BRE parameter/rule, changing a bank's policy thresholds (CIBIL, FOIR, DPD, write-off tolerance), modifying zen_rules/*.json, or reconciling Rules.md with the executable rule sets. Trigger on mentions of "BRE rule", "zen_rules", "bank policy", "eligibility rule", "DPD", "FOIR", "CIBIL threshold", or a rule ID like DEM-###, EMP-SAL-###, EMP-SE-###, BUR-###, BANK-###, RES-###, ENT-###, COAPP-###, EXB-###.
---

# FlowBRE Rule Engine Skill

Procedure for safely changing the onboarding eligibility logic without
breaking the < 100 ms latency SLA or desynchronizing the spec from the code.

## When to use this skill

- Adding a new eligibility parameter (new module-9 style requirement).
- Changing a threshold for one or all 8 partner banks (BOI, Indian Bank,
  IOB, BOB, BOM, HDFC, AXIS, Kotak).
- Fixing a bug in DPD/write-off/FOIR evaluation logic.
- Adding a new partner bank to the policy matrix.
- Writing or updating test fixtures for the evaluator.

Do **not** use this skill for frontend-only changes to
`flowbre_onboarding_rule_engine.html` that don't affect backend eligibility
logic — just edit the HTML directly.

## Step-by-step procedure

### 1. Locate the rule family

| If the rule is about... | Edit this file |
|---|---|
| Age, NRI status, marital status, residence/office/guarantor | `zen_rules/applicant_eligibility.json` |
| Employer type, tenure, salary, FOIR, rental income, ITR, business entity | `zen_rules/employment_income_rules.json` |
| CIBIL score, DPD, write-offs, currently-overdue, loan enquiries | `zen_rules/credit_bureau_rules.json` |
| Per-bank thresholds, car-loan co-existence, existing account holder | `zen_rules/bank_policy_matrix.json` |
| Co-applicant age/income for family relations | `zen_rules/co_applicant_rules.json` |

### 2. Update `Rules.md` first

Add or edit the row in the relevant table in `Rules.md` **before** touching
JSON:
- Assign the next sequential rule ID in that family's numbering block (never
  reuse or renumber an existing ID — see `CLAUDE.md §3`).
- Write the exact condition/threshold and the exact rejection-reason string
  that will be surfaced to the applicant.
- If the change affects a specific bank only, note that explicitly instead
  of silently changing the global default.

### 3. Mirror the change into the JSON rule file

- Keep the `"id"` field identical to the `Rules.md` rule ID.
- Keep condition expressions in the same style already used in that file
  (flat boolean expressions over the `evaluation_input` object described in
  `Backend-Playbook.md §5`).
- If the new rule needs a field that isn't in `evaluation_input` yet, add it
  to both `app/api/v1/schemas/onboarding.py` and the `evaluation_input` dict
  inside `app/services/bre_engine.py` — a rule can't read a field the
  service doesn't pass in.

### 4. Check bank-matrix consistency

If you touched `bank_policy_matrix.json`, verify all 8 banks still have a
complete block (`min_cibil_score`, `allow_write_offs`, `max_write_off_amount`,
`strict_zero_dpd`, `allow_existing_car_loan`, `max_foir_ratio`). A bank
missing a field will fall through to an undefined threshold at evaluation
time — this is a silent bug, not a valid "use the default" state.

### 5. Test before shipping

Every rule change needs, at minimum:
- **One passing fixture**: an applicant profile that clears the new/changed
  rule.
- **One rejecting fixture**: a profile that trips it, with the expected
  `rule_id` and `message` in `rejection_summary`.
- **Full 8-bank sweep**: run the same applicant profile with `selected_bank`
  set to each of the 8 codes and confirm `bank_eligibility` differs only
  where the policy matrix says it should.
- **Latency & Performance SLA Checks**: Verify API endpoint performance against required target SLAs:
  - **Simple GET Requests**: Verify `GET /health` or parameter lookups execute in **< 30 ms**.
  - **CRUD Operations**: Verify full application evaluation (`POST /evaluate`) and audit log writes complete in **< 80 ms**.
  - **Rule evaluation budget**: Confirm `execution_time_ms` in the evaluation response stays under the 10 ms rule-evaluation budget (`Backend-Playbook.md §8`). A rule calling an external API inside `bre_engine.py` is prohibited.
- **Memory Safety & Lifecycle Checks**: Perform post-execution memory safety checks to verify that temporary request objects clean up cleanly post-garbage collection according to the 5-stage flow (`Request Starts` → `Allocate Memory` → `Use Memory` → `Garbage Collection` → `Memory Released`). Ensure zero uncollected circular references or heap object leaks across evaluation iterations.

### 6. Update parameter coverage count

If you added or removed a parameter, update the count in `Rules.md §12`
(currently 64 across 9 modules) so the total stays accurate.

## Quick reference: rule ID families

```
DEM-###       Demographics & entity (age, NRI, marital status)
RES-###       Residence, office premises, guarantor
EMP-SAL-2##   Salaried employment & tenure
EMP-SAL-3##   Salaried income, rental income, FOIR
EMP-SE-3##    Self-employed business & ITR
BUR-###       Credit bureau, DPD, write-offs
ENT-5##       Business entity structure & tax compliance
COAPP-6##     Co-applicant age/income
EXB-7##       Existing banking relationship
BANK-001      Bank-wise policy matrix (not a per-rule ID — one block per bank)
```

## Anti-patterns to avoid

- Hardcoding a bank name or threshold inside `bre_engine.py` instead of
  `bank_policy_matrix.json`.
- Writing a rejection message that doesn't match the one in `Rules.md`.
- Treating "STD" bureau entries as anything other than 0 DPD — this
  conversion happens once, in the bureau parser, not per-rule.
- Adding a rule that silently changes behavior for Indian Bank's
  zero-DPD-tolerance policy without flagging it as a deliberate,
  bank-specific exception in both files.
