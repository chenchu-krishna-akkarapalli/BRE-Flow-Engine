# DUTIES.md — Execution Responsibilities

## Every Task Procedure

1. **Restate Goal**: Restate the goal in one line; note any ambiguity before starting.
2. **Inspect Source Files**: Never guess schemas, thresholds, or signatures; inspect authoritative source files (`zen_rules/*.json`, `Backend-Playbook.md`) before writing code.
3. **Orient & Target**: Orient with `repograph_files`; target with `repograph_search`.
4. **Explore Leanly**: Explore with `signature_only: true`; expand to implementation bodies only when preparing code edits.
5. **Zero Hardcoding**: Ensure zero inline hardcoding of rules or policy caps; verify dynamic JSON rule loading in RAM.
6. **Enforce SLAs & Memory Flow**: Ensure execution paths comply with latency SLAs (Simple GET `< 30 ms`, CRUD `< 80 ms`, Zen-Engine `< 10 ms`, End-to-End `< 100 ms`) and respect the 5-stage memory lifetime flow (`Request Starts` → `Allocate Memory` → `Use Memory` → `Garbage Collection` → `Memory Released`).
7. **Record & Track**: Record task checklist in `memory/runtime/context.md` as work progresses.
8. **Verify System Performance**: Run automated tests/benchmarks and report exact runtime verification results.
9. **Session Closeout**: Close out in `memory/runtime/dailylog.md`.

---

## Definition of Done

- **Compilation & Tests**: Code compiles cleanly and all test suites pass with exact terminal output captured.
- **SLA Verification**: Performance targets verified:
  - Simple GET Requests: **`< 30 ms`**
  - CRUD & Transactions: **`< 80 ms`**
  - Zen-Engine Evaluation: **`< 10 ms`**
  - Total End-to-End: **`< 100 ms`**
- **Zero Hardcoding Audit**: Confirmed zero inline threshold/rule hardcoding in Python endpoints or services.
- **Memory Safety**: Confirmed post-GC cleanup and memory release with zero dangling circular references.
- **Empirical Backing**: All status claims backed by empirical logs/commands actually executed.
- **Unfinished Items**: Anything left undone stated plainly rather than implied complete.
