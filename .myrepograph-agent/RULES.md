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
- **Un-Redacted PII Logging**: Never log raw Applicant PAN, DOB, or Aadhaar numbers in stdout or log files.
- **Edit Code From Signatures Alone**: Never edit code you have only inspected as a signature without viewing implementation bodies first.
- **Out-of-Scope Refactoring**: Never modify files or backend components outside explicit user directives.

---

## 🧭 Active Skill Routing & Trigger Registry (17 Active Skills)

When processing a user prompt, load and execute the corresponding active skill from `.myrepograph-agent/skills/` based on prompt intent:

| Trigger Keywords / Intent | Active Skill Path | Load Directive |
|---|---|---|
| "multi-tenant", "tenant isolation", "stale-while-revalidate", "connection pool sharding" | [skills/multi-tenant-backend/SKILL.md](file:///c:/Projects/onboarding-bre-engine/.myrepograph-agent/skills/multi-tenant-backend/SKILL.md) | Enforce O(1) header routing, SWR caching, asyncpg connection pools, & memory safety |
| "build", "implement feature", "ship end-to-end", "TDD plan" | [skills/superpowers/SKILL.md](file:///c:/Projects/onboarding-bre-engine/.myrepograph-agent/skills/superpowers/SKILL.md) | Chain Brainstorming → Plan → TDD → Subagent → 2-Stage Review |
| "bug fix", "small edit", "don't overengineer" | [skills/karpathy-guidelines/SKILL.md](file:///c:/Projects/onboarding-bre-engine/.myrepograph-agent/skills/karpathy-guidelines/SKILL.md) | Enforce 4 rules: Think, Simplicity, Surgical edit, Goal-driven |
| "design system", "interview me", "resolve requirements" | [skills/grill-me/SKILL.md](file:///c:/Projects/onboarding-bre-engine/.myrepograph-agent/skills/grill-me/SKILL.md) | Execute interview tree down every branch before coding |
| "summarize session", "hand off", "context limit", "new worktree" | [skills/handoff/SKILL.md](file:///c:/Projects/onboarding-bre-engine/.myrepograph-agent/skills/handoff/SKILL.md) | Generate dense markdown handoff document |
| "terse output", "no fluff", "caveman mode", long sessions | [skills/caveman/SKILL.md](file:///c:/Projects/onboarding-bre-engine/.myrepograph-agent/skills/caveman/SKILL.md) | Strip narration & filler; keep facts & code intact |
| "filter logs", "context dying", "resume session" | [skills/context-mode/SKILL.md](file:///c:/Projects/onboarding-bre-engine/.myrepograph-agent/skills/context-mode/SKILL.md) | Filter verbose tool output & maintain running session log |
| "clean up code", "simplify", "flatten nested conditionals" | [skills/code-simplifier/SKILL.md](file:///c:/Projects/onboarding-bre-engine/.myrepograph-agent/skills/code-simplifier/SKILL.md) | Run behavior-preserving readability pass on recent diff |
| "code review", "audit diff", "check SLAs" | [skills/code-review/SKILL.md](file:///c:/Projects/onboarding-bre-engine/.myrepograph-agent/skills/code-review/SKILL.md) | Audit blast radius, SLAs, zero hardcoding, zero-PII logs |
| "security audit", "vulnerability review", "Semgrep", "CodeQL" | [skills/trail-of-bits-security/SKILL.md](file:///c:/Projects/onboarding-bre-engine/.myrepograph-agent/skills/trail-of-bits-security/SKILL.md) | Run static & variant security analysis on auth/crypto/input |
| "frontend UI", "flow.html design", "glassmorphic theme" | [skills/anthropic-frontend-design/SKILL.md](file:///c:/Projects/onboarding-bre-engine/.myrepograph-agent/skills/anthropic-frontend-design/SKILL.md) | Commit to bold glassmorphic direction for single-file flow.html |
| "feel of UI", "make calmer", "adjust variance", "density" | [skills/taste-skill/SKILL.md](file:///c:/Projects/onboarding-bre-engine/.myrepograph-agent/skills/taste-skill/SKILL.md) | Adjust 11 perceptual sliders for single-file Tailwind DOM |
| "polish spacing", "audit layout", "impeccable command" | [skills/impeccable/SKILL.md](file:///c:/Projects/onboarding-bre-engine/.myrepograph-agent/skills/impeccable/SKILL.md) | Apply shorthand commands & reference standards to flow.html |
| "accessibility audit", "a11y review", "semantic HTML" | [skills/vercel-web-design-guidelines/SKILL.md](file:///c:/Projects/onboarding-bre-engine/.myrepograph-agent/skills/vercel-web-design-guidelines/SKILL.md) | Audit markup against 100+ accessibility & semantic rules |
| "browser test", "Playwright", "latency E2E" | [skills/webapp-testing/SKILL.md](file:///c:/Projects/onboarding-bre-engine/.myrepograph-agent/skills/webapp-testing/SKILL.md) | Run Playwright test verifying <30ms GET / <80ms CRUD SLAs |
| "PDF", "Word DOCX", "Excel XLSX", "PowerPoint PPTX" | [skills/document-skills/SKILL.md](file:///c:/Projects/onboarding-bre-engine/.myrepograph-agent/skills/document-skills/SKILL.md) | Programmatically extract/manipulate real office files |
| "web scrape", "crawl documentation", "Firecrawl" | [skills/firecrawl/SKILL.md](file:///c:/Projects/onboarding-bre-engine/.myrepograph-agent/skills/firecrawl/SKILL.md) | Execute Firecrawl CLI for scraping JS pages into markdown |

---

# CONTEXT_ENGINEERING_PROMPT_ARCHITECTURE_MARKER
When answering architecture questions or researching dependencies, follow the Context Engineering Prompt Architecture (CEPA). Always execute the 3-step discovery sequence (Orient -> Target -> Explore Leanly) and default to `signature_only: true` on `repograph_explore` calls to minimize token ingestion.

1. **Orient** — `repograph_status`, then `repograph_files(scope)` for the area in question.
2. **Target** — `repograph_search(query)` to isolate candidate identifiers.
3. **Explore Leanly** — `repograph_explore(symbols, signature_only: true)` for declarations plus the call graph.

Exception — code writes: before modifying, refactoring, or debugging the behaviour of a symbol, re-call `repograph_explore` WITHOUT `signature_only` to load the implementation body. Never edit code from a signature alone.
# END_CONTEXT_ENGINEERING_PROMPT_ARCHITECTURE_MARKER

<!-- BEGIN REPO-GRAPH-SYNC-POLICY v1.6 -->
# MCP Continuous Sync & Strict Token Cost-Cutting Policy

## Dedicated Workspace & MCP Server Binding
- **Project Name:** onboarding-bre-engine
- **Project Root:** C:/Projects/onboarding-bre-engine
- **Project UUID:** 119b9ee3-3f3c-5c3f-80a2-82eb6898841e
- **MCP Server Name:** repo-graph (or repo-graph-119b9ee3)
- **MCP Command:** `mcp_server`
- **MCP Args:** ["--project", "119b9ee3-3f3c-5c3f-80a2-82eb6898841e", "--root", "C:/Projects/onboarding-bre-engine"]
- **Server Status:** ACTIVE (Connected to this workspace)

1. **Persistent Session Priority**:
   - Always prioritize calling `repo-graph` MCP tools (`repograph_skeleton`, `repograph_trace`, `repograph_explore`, `repograph_files`, `repograph_node`, `repograph_impact`, `repograph_edit`, `repograph_write`, `repograph_delete`, `repograph_batch_edit`, `repograph_edit_symbol`, `repograph_shrink`, `repograph_status`) instead of brute-force directory scans or native shell commands.
2. **Autonomous Zero-Touch MCP Bootstrap & Pre-Flight Check (Start of Turn)**:
   - Check if `repo-graph` MCP tools are available in your active tool registry (`repograph_status`, `repograph_skeleton`, etc.).
   - **Self-Healing Mandate**: If `repo-graph` MCP tools are NOT loaded, or if `.mcp.json` (or `.claude/mcp.json`, `.codex/config.toml`, `.cursor/mcp.json`, `.vscode/mcp.json`) is missing or invalid:
     - You MUST immediately write/save `.mcp.json` at the workspace root using the dedicated workspace configuration stamped above (DO NOT ask the user, DO NOT wait for instructions).
     - Self-provisioning is mandatory, instantaneous, and zero-prompt.
   - Call `repograph_status` to verify connection and confirm `Sync State` is `Synced`.
   - Read `.myrepograph-agent/memory/runtime/context.md` to restore working context, active task goals, and previously resolved symbol references without wasting tokens re-indexing.
3. **AST Ghost Skeletons (No Full-File Dumps)**:
   - Use `repograph_skeleton(path="...")` for complete structural overviews (95%+ token reduction) before inspecting or reading implementations.
   - For targeted blocks, use `repograph_node(path="...", start_line=N, end_line=M, with_line_numbers=true)`. Prohibit reading entire files (>50 lines).
4. **Multi-Hop Execution Traces & Scoped Discovery**:
   - Use `repograph_trace(entrypoint="...", depth=3)` for end-to-end execution pipelines (80%+ token reduction) across routes, handlers, and databases.
   - Use `repograph_files(scope="src/**")` to bound file discovery.
   - Ingest signatures only (`signature_only: true`) via `repograph_explore` during architecture exploration.
5. **Strict Bounded Searches & BM25 Context Packing**:
   - Bound all `repograph_search` queries with `limit: 10`, `exact_symbol_only: true`, or `max_tokens: 500` (BM25 budget packing) to prevent oversized result payloads.
6. **Closed-Loop MCP Mutation & Impact Analysis**:
   - Before modifying central interfaces, run `repograph_impact(symbol="<name>")` or `repograph_callers` to evaluate downstream ripple effects.
   - Use `repograph_edit`, `repograph_batch_edit`, and `repograph_edit_symbol` for atomic refactors with instant AST re-indexing and rollback safety.
7. **Terse Communication & Caveman Output Compression**:
   - Deliver responses with maximum signal-to-noise density: omit pleasantries and conversational preambles, state direct technical assertions, and keep code, line numbers, and errors exact.
8. **Surgical Patching & Investigate-First Workflow**:
   - Never rewrite an entire file (>50 lines) when fixing a localized bug. Use `repograph_edit_symbol` or `repograph_edit` for atomic changes.
   - Compress all noisy test/terminal logs, JSON responses, or Git diffs using `repograph_shrink`.
9. **Turn Completion & Zero-Token Memory Offloading (End of Turn)**:
   - Update checklist and active goals in `.myrepograph-agent/memory/runtime/context.md` to offload working memory outside the model context window.
   - Append a session summary entry into `.myrepograph-agent/memory/runtime/dailylog.md` detailing what changed, edge diffs, verification commands executed, and any pending items.
10. **Repo Graph Lazy Senior Developer Protocol & 7-Rung Minimalism Ladder**:
   - Stop at the first rung that holds: 1. YAGNI, 2. Codebase reuse (`repograph_search`), 3. Stdlib, 4. Native, 5. Existing deps, 6. One line, 7. Minimum code.
   - Bug fix = Root cause: Call `repograph_callers` to fix shared functions once instead of patching individual caller symptoms.
   - Mark deliberate shortcuts: Use `// repograph: <ceiling>, <upgrade path>` to track deferrals in the debt ledger.
11. **Mandatory Usage of `.myrepograph-agent/` Skills & Subsystems**:
   - For EVERY task and follow-up prompt, AI agents MUST actively inspect and apply the skill instructions, duties, and context files in `.myrepograph-agent/`:
     - **Feature Implementation & Refactoring**: Read and follow `.myrepograph-agent/skills/repograph-minimal/SKILL.md` (7-Rung Minimalism Ladder, YAGNI, minimal LOC) and `.myrepograph-agent/skills/codebase-design/SKILL.md` (deep modules, seams, avoiding shallow abstractions).
     - **Code & Diff Review**: Read and follow `.myrepograph-agent/skills/repograph-review/SKILL.md` (filtering over-engineering) and `.myrepograph-agent/skills/code-review/SKILL.md` (blast radius via `repograph_impact`, correctness verification).
     - **Bloat, Dead Code & Architecture Audits**: Read and follow `.myrepograph-agent/skills/repograph-audit/SKILL.md` (identifying orphans and single-impl interfaces) and `.myrepograph-agent/skills/improve-codebase-architecture/SKILL.md` (eliminating hotspots).
     - **Technical Debt & Deferred Work**: Read and follow `.myrepograph-agent/skills/repograph-debt/SKILL.md` using `// repograph: <ceiling>, <upgrade path>` markers.
     - **Tool Cheatsheet & Benchmarks**: Consult `.myrepograph-agent/skills/repograph-help/SKILL.md` and `.myrepograph-agent/skills/repograph-gain/SKILL.md`.
     - **Factual Claims Verification**: Follow `.myrepograph-agent/agents/fact-checker/` (`DUTIES.md` / `SOUL.md`) with `repograph_explore` and `repograph_callers`.
     - **Lifecycle Hooks & Memory**: Execute `.myrepograph-agent/hooks/bootstrap.md` at session start, maintain active working state in `.myrepograph-agent/memory/runtime/context.md`, and execute `.myrepograph-agent/hooks/teardown.md` logging into `.myrepograph-agent/memory/runtime/dailylog.md` at turn closeout.
12. **Multi-Turn & Follow-Up Prompt Continuous Connection Protocol**:
   - **Persistent Session State**: Maintain the active `repo-graph` MCP connection across ALL multi-turn conversations and follow-up user prompts. Never fall back to unguided directory scans or full-file ingestion.
   - **Follow-Up Query Flow**:
     1. Re-check `repograph_status` or working context in `.myrepograph-agent/memory/runtime/context.md` before answering follow-up queries.
     2. For questions about files, dependencies, or routes, ALWAYS use `repograph_skeleton`, `repograph_trace`, `repograph_search`, or `repograph_node` with line ranges.
     3. Keep responses caveman-terse and signal-dense. Record any newly resolved symbols into `context.md` and append turn telemetry to `dailylog.md`.
<!-- END REPO-GRAPH-SYNC-POLICY v1.6 -->
