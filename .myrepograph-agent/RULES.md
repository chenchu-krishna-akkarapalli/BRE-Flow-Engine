# RULES.md — Workspace Guardrails & Performance Constraints

## Must Always

- **Inspect Authoritative Source Files**: Resolve code, schemas, and signatures before writing or modifying code. Never guess variable names or field locations.
- **Dynamic Rule Loading**: Load all business rules, policy matrix thresholds (CIBIL, DPD, ITR, FOIR), and caps from `zen_rules/*.json` pre-compiled in RAM.
- **Enforce Quantitative Performance SLAs**: Guarantee latency SLA targets across all endpoints:
  - Simple GET Operations (`GET /health`, parameter metadata): **`< 30 ms`**
  - CRUD & Transactional Operations (`POST /evaluate`, audit writes): **`< 80 ms`**
  - Zen-Engine Rule Evaluation: **`< 10 ms`**
  - Total End-to-End Latency: **`< 100 ms`**
- **Optimize Data Structures & Database Pools**: Use $O(1)$ Hash Maps (`dict`), pre-warmed SQLAlchemy `asyncpg` pools (`pool_size=20`, `max_overflow=10`, `pool_recycle=3600`, `pool_pre_ping=True`), and pre-compiled decision graphs in RAM.
- **Enforce 5-Stage Memory Lifetime Sequence**: Adhere to `Request Starts` → `Allocate Memory` → `Use Memory` → `Garbage Collection` → `Memory Released`.
- Quote retrieved facts verbatim and cite the file path they came from.
- Track multi-step work in `memory/runtime/context.md`.

---

## Must Never

- **Guess Code Logic or Schemas**: Never infer struct definitions, Pydantic schemas, or rule thresholds without viewing authoritative sources.
- **Inline Hardcoding**: Never hardcode business rules, threshold numbers (CIBIL, DPD, ITR, FOIR), or bank policy logic directly in Python endpoints or services.
- **Perform Synchronous / Hot-Path Disk I/O**: Never perform blocking I/O, file reads inside hot paths, or unindexed database queries during request execution.
- **Exceed Latency SLAs**: Never allow simple GETs to exceed 30 ms, CRUD evaluations to exceed 80 ms, or total pipeline to exceed 100 ms.
- **Edit Code From Signatures Alone**: Never edit code you have only inspected as a signature without viewing implementation bodies first.
- **Out-of-Scope Refactoring**: Never modify files or backend components outside explicit user directives.

---

# CONTEXT_ENGINEERING_PROMPT_ARCHITECTURE_MARKER
When answering architecture questions or researching dependencies, follow the Context Engineering Prompt Architecture (CEPA). Always execute the 3-step discovery sequence (Orient -> Target -> Explore Leanly) and default to `signature_only: true` on `repograph_explore` calls to minimize token ingestion.

1. **Orient** — `repograph_status`, then `repograph_files(scope)` for the area in question.
2. **Target** — `repograph_search(query)` to isolate candidate identifiers.
3. **Explore Leanly** — `repograph_explore(symbols, signature_only: true)` for declarations plus the call graph.

Exception — code writes: before modifying, refactoring, or debugging the behaviour of a symbol, re-call `repograph_explore` WITHOUT `signature_only` to load the implementation body. Never edit code from a signature alone.
# END_CONTEXT_ENGINEERING_PROMPT_ARCHITECTURE_MARKER
