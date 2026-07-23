# CLAUDE.md — FlowBRE Onboarding & Business Rule Engine

This file orients Claude (or any agent) working in this repository. Read this
first, then `Backend-Playbook.md` and `Rules.md` before touching code or rule
files.

## 1. What this project is

FlowBRE is a loan-onboarding platform with two halves:

1. **Frontend onboarding flow** (`flowbre_onboarding_rule_engine.html`) — a
   multi-step, branching form (Individual vs. Company, Salaried vs.
   Self-Employed) plus a Bureau/BRE simulator and a 64-parameter policy
   matrix inspector.
2. **Backend BRE service** (`app/`) — FastAPI + PostgreSQL + Zen-Engine that
   evaluates a submitted application against JSON decision rules and returns
   an eligibility verdict per partner bank, in **under 100 ms end-to-end**.

The business logic evaluates **64 parameters across 9 functional modules**
(Credit Bureau, Demographics, Residence, Employment, Income, Tax/ITR,
Business Entity, Co-Applicant, Existing Banking) for **8 partner banks**:
BOI, Indian Bank, IOB, BOB, BOM, HDFC, AXIS, Kotak.

## 2. Source-of-truth documents (read in this order)

| File | Purpose |
|---|---|
| `Rules.md` | The canonical rule specification — every rule ID, condition, threshold, and rejection message. **Never hand-edit `zen_rules/*.json` without updating `Rules.md` first**, and vice versa — they must stay in sync. |
| `Backend-Playbook.md` | Architecture, folder layout, dependency pins, latency SLA, Docker/Compose setup. |
| `SKILL.md` | Step-by-step procedure for adding, changing, or testing a rule in this engine. Follow it whenever a task involves `zen_rules/`. |
| `zen_rules/*.json` | The executable rule sets loaded by Zen-Engine at service boot. |

## 3. Non-negotiable constraints

- **Latency SLA: < 100 ms total** per `/api/v1/onboarding/evaluate` call
  (rule eval < 10 ms, DB txn < 15 ms, network/serialization < 30 ms). Any
  change that adds synchronous I/O, blocking calls, or per-request disk
  reads inside the hot path is a regression — flag it, don't silently ship it.
- **Rule IDs are stable identifiers.** Never renumber or reuse an existing
  rule ID (`DEM-###`, `EMP-SAL-###`, `EMP-SE-###`, `BUR-###`, `BANK-###`,
  `RES-###`, `ENT-###`, `COAPP-###`, `EXB-###`). Deprecate instead of delete;
  add new IDs for new logic.
- **Every rule change must update three places together**: `Rules.md`
  (human-readable spec), the relevant `zen_rules/*.json` file (executable),
  and the rejection-reason string surfaced to the applicant.
- **DPD parsing convention**: `"STD"` in bureau data always maps to `0` DPD.
  Indian Bank enforces zero-tolerance DPD (`> 0` days = reject); all other
  banks use the `> 90` day threshold unless `Rules.md` says otherwise for
  that bank.
- **PII handling**: PAN, Aadhaar, DOB, and bureau report data are sensitive.
  Never log raw payloads containing these fields; use `app/core/logging.py`
  redaction helpers. Never write sample PII into test fixtures — use
  obviously-fake values (e.g. `PAN: AAAAA0000A`).

## 4. Repository layout

See `Backend-Playbook.md §1` for the full annotated tree. Quick map:

```
onboarding-bre-engine/
├── app/
│   ├── api/v1/endpoints/      # onboarding.py, rules.py, bureau.py, health.py
│   ├── services/               # bre_engine.py, bureau_parser.py, pincode_service.py
│   ├── db/models/               # application.py, rule_execution.py, audit_log.py
│   └── zen_rules/                # executable JSON decision/rule sets
├── requirements/                # base.in / base.txt, compile script
├── alembic/                     # migrations
├── Rules.md                     # canonical rule spec
├── Backend-Playbook.md          # architecture & ops playbook
├── SKILL.md                     # how to safely modify the rule engine
└── flowbre_onboarding_rule_engine.html  # standalone frontend prototype
```

## 5. Common tasks & where they live

| Task | Files to touch |
|---|---|
| Add a new BRE parameter/rule | `Rules.md` → `zen_rules/<relevant>.json` → `SKILL.md` test checklist |
| Change a bank's policy threshold | `zen_rules/bank_policy_matrix.json` + `Rules.md §4` |
| Add a new API field | `app/api/v1/schemas/onboarding.py` → `app/services/bre_engine.py` evaluation_input mapping |
| Change onboarding UX/branching | `flowbre_onboarding_rule_engine.html` (frontend prototype) |
| Add a migration | `alembic/versions/` via `alembic revision --autogenerate` |

## 6. Build & run

```bash
bash requirements/scripts/compile_requirements.sh   # compile base.in -> base.txt
docker-compose up --build -d                        # start API + Postgres
curl http://localhost:8000/api/v1/health             # health check
open http://localhost:8000/docs                      # interactive API docs
```

## 7. Testing expectations

- Every new/changed rule needs at least one **pass** and one **reject**
  fixture in the evaluator test suite (see `SKILL.md §Testing`).
- Run the full 8-bank matrix against each of the four preset scenarios
  (Ideal Salaried, Low-Tenure Salaried, Self-Employed edge case, High-DPD
  reject) before merging changes to `zen_rules/`.
- Confirm `execution_time_ms` returned by `/evaluate` stays under the
  budget in `Backend-Playbook.md §8` after any rule-engine change.

## 8. What NOT to do

- Don't inline business thresholds (age, CIBIL score, FOIR %, ITR minimums)
  directly in Python — they belong in `zen_rules/*.json` so they can change
  without a redeploy.
- Don't add a new partner bank without adding its full policy block to
  `bank_policy_matrix.json` **and** the bank-eligibility map in the output
  schema (`Rules.md §5`).
- Don't collapse the two ITR checks (current-year vs. previous-year) into
  one rule — banks read them independently.
