# Agents

Agent roles for this workspace and the context each one is allowed to load.

## Roles

| Agent | Purpose | Context budget |
| :--- | :--- | :--- |
| *coordinator* (default) | Plans work, delegates, inspects authoritative files, enforces SLAs | Manifest + signatures |
| `agents/fact-checker` | Verifies claims, schemas, SLAs, and memory safety against indexed graph | Signatures only |

---

## 🎯 Workspace Governance Pillars & Execution Directives

All agents operating in this workspace must strictly comply with the following architectural directives:

1. **Anti-Assumption & Zero Inline Hardcoding**:
   - Never guess or infer schemas, variable names, or rule thresholds without inspecting source files.
   - Zero inline hardcoding of business rules or policy thresholds (CIBIL, DPD, ITR, FOIR)—all rules must load dynamically from `zen_rules/*.json`.
2. **Performance SLA Guardrails**:
   - **Simple GET Operations**: `< 30 ms`
   - **CRUD & Transactional Operations**: `< 80 ms`
   - **Zen-Engine Rule Evaluation**: `< 10 ms`
   - **Total End-to-End Latency**: **`< 100 ms`**
3. **Data Structure Optimization Strategy**:
   - Use $O(1)$ Hash Maps (`dict`), pre-warmed SQLAlchemy `asyncpg` connection pools (`pool_size=20`, `max_overflow=10`), and pre-compiled Zen-Engine JSON decision graphs in RAM. Zero per-request hot-path disk I/O.
4. **Memory Allocation & Request Lifecycle Flow**:
   - Enforce the 5-stage request memory flow:
     `Request Starts` → `Allocate Memory` → `Use Memory` → `Garbage Collection` → `Memory Released`.

---

## The Seven-Piece Context Stack

Partition what you put in front of the model; when a turn goes wrong you want to know which layer was wrong.

1. **Instructions** — `RULES.md` (guardrails, SLA targets, memory lifecycle flow)
2. **User Input** — the task, one paragraph
3. **Retrieved Facts** — verbatim `repograph_explore` output, never paraphrased
4. **Tools** — the `repograph_*` schemas
5. **Short-term Notes** — `memory/runtime/context.md`, kept *outside* the window
6. **Long-term Memory** — `knowledge/`, loaded selectively
7. **Output Format** — the schema you require back

Only layer 3 scales with repository size. Every token worth saving is saved there, which is what the discovery sequence in `RULES.md` optimizes.
