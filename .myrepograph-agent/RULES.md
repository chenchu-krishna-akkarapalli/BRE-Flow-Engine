# RULES.md — Workspace Guardrails

## Must Always

- **Inspect Authoritative Source Files**: Resolve code, schemas, and signatures before writing or modifying code. Never guess variable names or field locations.
- **Dynamic Rule Loading**: Load all business rules, policy matrix thresholds (CIBIL, DPD, ITR, FOIR), and caps from `zen_rules/*.json` pre-compiled in RAM.
- **Enforce Performance SLAs**: Guarantee latency SLA targets across all endpoints:
  - Simple GET Operations: **`< 30 ms`**
  - CRUD & Transactions: **`< 80 ms`**
  - Zen-Engine Rule Evaluation: **`< 10 ms`**
  - Total End-to-End Latency: **`< 100 ms`**
- **Optimize Data Structures**: Use $O(1)$ Hash Maps (`dict`), pre-warmed SQLAlchemy `asyncpg` pools (`pool_size=20`, `max_overflow=10`), and pre-compiled decision graphs in RAM.
- **Enforce 5-Stage Memory Lifetime Sequence**: Adhere to `Request Starts` → `Allocate Memory` → `Use Memory` → `Garbage Collection` → `Memory Released`.
- Quote retrieved facts verbatim and cite the file path they came from.
- Track multi-step work in `memory/runtime/context.md`.

---

## Must Never

- **Guess Code Logic or Schemas**: Never infer struct definitions, proto schemas, or rule thresholds without viewing authoritative sources.
- **Inline Hardcoding**: Never hardcode business rules, threshold numbers, or bank policy logic directly in Python endpoints or services.
- **Perform Synchronous / Hot-Path Disk I/O**: Never perform blocking I/O, file reads, or unindexed database queries inside evaluation hot paths.
- **Exceed Latency SLAs**: Never allow simple GETs to exceed 30 ms or CRUD evaluations to exceed 80 ms.
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
