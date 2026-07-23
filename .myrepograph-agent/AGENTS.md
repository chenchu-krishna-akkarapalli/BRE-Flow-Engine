# AGENTS.md — Workspace Agent Roles & Governance Architecture

Agent roles for this workspace, context budgets, and mandatory architectural guardrails aligned with [Backend-Playbook.md](file:///c:/Projects/onboarding-bre-engine/Backend-Playbook.md).

---

## 1. Agent Roles & Context Budget Matrix

| Agent Role | Primary Purpose | Allowed Context Budget | Mandatory Architectural Alignment |
| :--- | :--- | :--- | :--- |
| **`coordinator`** *(default)* | Architectural planning, task delegation, multi-file code editing | Manifest + signatures + full implementation bodies for edited symbols | Strictly enforces SLAs (`GET < 30 ms`, `CRUD < 80 ms`), $O(1)$ data structures, and memory flow |
| **`agents/fact-checker`** | Audits claims, schema fidelity, SLA benchmarks, and memory safety against indexed graph | Signatures only + `repograph_*` tools | Verifies zero inline rule hardcoding and 5-stage Memory Lifetime compliance |

---

## 2. Mandatory Workspace Governance Pillars

Every agent executing in this workspace must strictly obey the following four core governance pillars:

### 🎯 Pillar 1: Anti-Assumption & Zero Inline Hardcoding
- **No Guesses or Hallucinations**: Never infer missing schemas, variable names, rule thresholds, or file paths without inspecting authoritative source files (`zen_rules/*.json`, `app/api/v1/schemas/`, `Backend-Playbook.md`).
- **Zero Inline Hardcoding**: All business rules, thresholds (CIBIL, DPD, ITR, FOIR), and policy caps must be loaded dynamically from `zen_rules/*.json` or pre-compiled into RAM—never hardcoded inline inside Python services or API endpoint handlers.
- **Strict Scope Boundaries**: Prohibit out-of-scope refactoring or modifying files outside explicit user instructions.

### ⚡ Pillar 2: Performance SLA Guardrails
All execution specs and generated code must align with strict API latency targets:
- **Simple GET Operations**: **`< 30 ms`** (Health checks `GET /health`, pincode lookups, parameter metadata)
- **CRUD & Transactional Operations**: **`< 80 ms`** (Onboarding evaluation `POST /evaluate`, state updates, audit log writes)
- **Zen-Engine Rule Evaluation**: **`< 10 ms`** (Rust core RAM execution of pre-compiled decision graphs)
- **Total End-to-End Latency SLA**: **`< 100 ms`** (Combined network, serialization, evaluation, and persistence pipeline)

### 🧠 Pillar 3: Data Structure Selection Guidance
- **$O(1)$ Hash Maps**: Enforce $O(1)$ Python dictionaries (`dict`) and sets (`set`) for in-memory parameter lookups and policy matrix evaluation.
- **Pre-Warmed Connection Pools**: Configure SQLAlchemy `asyncpg` engine with `pool_size=20`, `max_overflow=10`, `pool_recycle=3600`, `pool_pre_ping=True`.
- **Zero Hot-Path Synchronous Disk I/O**: Disallow file reading, synchronous I/O, or unindexed database queries during request execution hot paths.

### 🔄 Pillar 4: Memory Allocation & Request Lifecycle
Enforce the explicit 5-stage request memory lifecycle across all agent execution specs:

```
Memory Lifetime
Request Starts → Allocate Memory → Use Memory → Garbage Collection → Memory Released
```

1. **Request Starts**: ASGI event loop dispatches request to endpoint handler ($< 1\text{ ms}$).
2. **Allocate Memory**: Transient Pydantic v2 schemas and payload contexts allocated on CPython private heap.
3. **Use Memory**: $O(1)$ Hash Maps and Rust RAM decision graphs evaluate metrics without per-request compilation.
4. **Garbage Collection**: Scope closes upon response return; reference counts drop to zero and generational GC sweeps unreferenced circular references.
5. **Memory Released**: Allocated pools returned to CPython arena allocators (`pymalloc`), preventing process RSS growth.

---

## 3. The Seven-Piece Context Stack

Partition what you put in front of the model; when a turn goes wrong you want to know which layer was wrong.

1. **Instructions** — `RULES.md` (guardrails, SLA targets, memory lifecycle flow)
2. **User Input** — the task, one paragraph
3. **Retrieved Facts** — verbatim `repograph_explore` output, never paraphrased
4. **Tools** — the `repograph_*` schemas
5. **Short-term Notes** — `memory/runtime/context.md`, kept *outside* the window
6. **Long-term Memory** — `knowledge/`, loaded selectively
7. **Output Format** — the schema you require back
