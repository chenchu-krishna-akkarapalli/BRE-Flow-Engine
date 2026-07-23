# DUTIES.md — Execution Responsibilities & Verification Checkpoints

## Every Task Procedure

1. **Restate Goal**: Restate the goal in one line; note any ambiguity before starting.
2. **Inspect Source Files**: Never guess schemas, variable names, or rule thresholds; inspect authoritative source files (`zen_rules/*.json`, `Backend-Playbook.md`, `app/core/config.py`) before writing code.
3. **Orient & Target**: Orient with `repograph_files`; target with `repograph_search`.
4. **Explore Leanly**: Explore with `signature_only: true`; expand to implementation bodies only when preparing code edits.
5. **Zero Hardcoding**: Ensure zero inline hardcoding of business rules or policy thresholds (CIBIL, DPD, ITR, FOIR); verify dynamic JSON rule loading in RAM.
6. **Enforce SLAs & Memory Flow**: Ensure execution paths comply with latency SLAs:
   - Simple GET Operations: **`< 30 ms`**
   - CRUD & Transactional Operations: **`< 80 ms`**
   - Zen-Engine Rule Evaluation: **`< 10 ms`**
   - Total End-to-End Latency: **`< 100 ms`**
   - Adhere to the 5-stage memory lifetime flow: `Request Starts` → `Allocate Memory` → `Use Memory` → `Garbage Collection` → `Memory Released`.
7. **Record & Track**: Record task checklist in `memory/runtime/context.md` as work progresses.
8. **Verify System Performance**: Run automated tests/benchmarks and report exact runtime verification results.
9. **Session Closeout**: Close out in `memory/runtime/dailylog.md`.

---

## Definition of Done Checkpoints

- **Compilation & Test Execution**: Code compiles cleanly and all test suites pass with exact terminal output captured.
- **Quantitative SLA Verification**:
  - Simple GET Requests (`GET /health`, pincode lookups): **`< 30 ms`**
  - Full BRE / CRUD Operations (`POST /evaluate`, DB write): **`< 80 ms`**
  - Zen-Engine Rule Evaluation: **`< 10 ms`**
  - Total End-to-End Latency: **`< 100 ms`**
- **Database Connection Pool Verification**: Confirmed SQLAlchemy `asyncpg` engine initialized with `pool_size=20`, `max_overflow=10`, `pool_recycle=3600`, `pool_pre_ping=True`.
- **Zero Hardcoding Audit**: Confirmed zero inline threshold/rule hardcoding in Python endpoints or services.
- **Memory Lifetime Safety**: Confirmed rapid reference-counting deallocation post-request with zero dangling circular references or process RSS leaks (`Request Starts` → `Allocate` → `Use` → `GC` → `Released`).
- **Empirical Backing**: All status claims backed by empirical logs/commands actually executed.
- **Unfinished Items**: Anything left undone stated plainly rather than implied complete.
