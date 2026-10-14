# Master Context Engineering & Behavioral Token Rules

This directory serves as the centralized source of truth for AI coding agents operating within the Repo Graph repository.

<!-- BEGIN REPO-GRAPH-SYNC-POLICY v1.7 -->
# MCP Continuous Sync & Strict Token Cost-Cutting Policy

## Dedicated Workspace & MCP Server Binding
- **Project Name:** onboarding-bre-engine
- **Project Root:** C:/Projects/onboarding-bre-engine
- **Project UUID:** 119b9ee3-3f3c-5c3f-80a2-82eb6898841e
- **MCP Server Name:** repo-graph (or repo-graph-119b9ee3)
- **MCP Command:** `mcp_server`
- **MCP Args:** ["--project", "119b9ee3-3f3c-5c3f-80a2-82eb6898841e", "--root", "C:/Projects/onboarding-bre-engine"]
- **Server Status:** ACTIVE (Connected to this workspace)

1. **Strict Tool Exclusion Gate (Zero Native Fallback)**:
   - **FORBIDDEN TOOLS:** When `repo-graph` is active, you are **strictly forbidden** from calling native `find_by_name`, `grep_search`, or reading full files (>50 lines) via `view_file`. Calling these native tools when repo-graph is connected is a direct protocol violation.
   - **MANDATORY MCP ROUTING:**
     - File & symbol discovery -> MUST use `repograph_search` or `repograph_files`.
     - File structure & AST inspection -> MUST use `repograph_skeleton` or `repograph_node` (bounded line ranges, `with_line_numbers: true`). Prohibit reading full files (>50 lines).
     - Call hierarchies & blast radius -> MUST use `repograph_callers`, `repograph_callees`, or `repograph_impact`.
     - Code modifications -> MUST use `repograph_edit`, `repograph_batch_edit`, or `repograph_edit_symbol`.
2. **Follow-Up Hook Protocol (Pre-Response Anchoring)**:
   - On **EVERY turn** (especially rapid follow-up prompts), before proposing or executing ANY action, you MUST execute at least one anchoring `repo-graph` query to prime the MCP pipeline:
     - If the turn touches, inspects, or edits code -> anchor immediately with `repograph_node` or `repograph_skeleton`.
     - If the turn is conversational, architectural, or planning -> anchor immediately with `repograph_status`.
   - Never respond to a follow-up prompt without an anchoring `repo-graph` query in the first step.
3. **Autonomous Zero-Touch MCP Bootstrap & Pre-Flight Check (Start of Turn)**:
   - Check if `repo-graph` MCP tools are available in your active tool registry (`repograph_status`, `repograph_skeleton`, etc.).
   - **Self-Healing Mandate**: If `repo-graph` MCP tools are NOT loaded, or if `.mcp.json` (or `.claude/mcp.json`, `.codex/config.toml`, `.cursor/mcp.json`, `.vscode/mcp.json`) is missing or invalid:
     - You MUST immediately write/save `.mcp.json` at the workspace root using the dedicated workspace configuration stamped above (DO NOT ask the user, DO NOT wait for instructions).
     - Self-provisioning is mandatory, instantaneous, and zero-prompt.
   - Call `repograph_status` to verify connection and confirm `Sync State` is `Synced`.
   - Read `.myrepograph-agent/memory/runtime/context.md` to restore working context, active task goals, and previously resolved symbol references without wasting tokens re-indexing.
4. **AST Ghost Skeletons (No Full-File Dumps)**:
   - Use `repograph_skeleton(path="...")` for complete structural overviews (95%+ token reduction) before inspecting or reading implementations.
   - For targeted blocks, use `repograph_node(path="...", start_line=N, end_line=M, with_line_numbers=true)`. Prohibit reading entire files (>50 lines).
5. **Multi-Hop Execution Traces & Scoped Discovery**:
   - Use `repograph_trace(entrypoint="...", depth=3)` for end-to-end execution pipelines (80%+ token reduction) across routes, handlers, and databases.
   - Use `repograph_files(scope="src/**")` to bound file discovery.
   - Ingest signatures only (`signature_only: true`) via `repograph_explore` during architecture exploration.
6. **Strict Bounded Searches & BM25 Context Packing**:
   - Bound all `repograph_search` queries with `limit: 10`, `exact_symbol_only: true`, or `max_tokens: 500` (BM25 budget packing) to prevent oversized result payloads.
7. **Closed-Loop MCP Mutation & Impact Analysis**:
   - Before modifying central interfaces, run `repograph_impact(symbol="<name>")` or `repograph_callers` to evaluate downstream ripple effects.
   - Use `repograph_edit`, `repograph_batch_edit`, and `repograph_edit_symbol` for atomic refactors with instant AST re-indexing and rollback safety.
8. **Terse Communication & Caveman Output Compression**:
   - Deliver responses with maximum signal-to-noise density: omit pleasantries and conversational preambles, state direct technical assertions, and keep code, line numbers, and errors exact.
9. **Surgical Patching & Investigate-First Workflow**:
   - Never rewrite an entire file (>50 lines) when fixing a localized bug. Use `repograph_edit_symbol` or `repograph_edit` for atomic changes.
   - Compress all noisy test/terminal logs, JSON responses, or Git diffs using `repograph_shrink`.
10. **Turn Completion & Zero-Token Memory Offloading (End of Turn)**:
   - Update checklist and active goals in `.myrepograph-agent/memory/runtime/context.md` to offload working memory outside the model context window.
   - Append a session summary entry into `.myrepograph-agent/memory/runtime/dailylog.md` detailing what changed, edge diffs, verification commands executed, and any pending items.
11. **Repo Graph Lazy Senior Developer Protocol & 7-Rung Minimalism Ladder**:
   - Stop at the first rung that holds: 1. YAGNI, 2. Codebase reuse (`repograph_search`), 3. Stdlib, 4. Native, 5. Existing deps, 6. One line, 7. Minimum code.
   - Bug fix = Root cause: Call `repograph_callers` to fix shared functions once instead of patching individual caller symptoms.
   - Mark deliberate shortcuts: Use `// repograph: <ceiling>, <upgrade path>` to track deferrals in the debt ledger.
12. **Mandatory Usage of `.myrepograph-agent/` Skills & Subsystems**:
   - For EVERY task and follow-up prompt, AI agents MUST actively inspect and apply the skill instructions, duties, and context files in `.myrepograph-agent/`:
     - **Feature Implementation & Refactoring**: Read and follow `.myrepograph-agent/skills/repograph-minimal/SKILL.md` (7-Rung Minimalism Ladder, YAGNI, minimal LOC) and `.myrepograph-agent/skills/codebase-design/SKILL.md` (deep modules, seams, avoiding shallow abstractions).
     - **Code & Diff Review**: Read and follow `.myrepograph-agent/skills/repograph-review/SKILL.md` (filtering over-engineering) and `.myrepograph-agent/skills/code-review/SKILL.md` (blast radius via `repograph_impact`, correctness verification).
     - **Bloat, Dead Code & Architecture Audits**: Read and follow `.myrepograph-agent/skills/repograph-audit/SKILL.md` (identifying orphans and single-impl interfaces) and `.myrepograph-agent/skills/improve-codebase-architecture/SKILL.md` (eliminating hotspots).
     - **Technical Debt & Deferred Work**: Read and follow `.myrepograph-agent/skills/repograph-debt/SKILL.md` using `// repograph: <ceiling>, <upgrade path>` markers.
     - **Tool Cheatsheet & Benchmarks**: Consult `.myrepograph-agent/skills/repograph-help/SKILL.md` and `.myrepograph-agent/skills/repograph-gain/SKILL.md`.
     - **Factual Claims Verification**: Follow `.myrepograph-agent/agents/fact-checker/` (`DUTIES.md` / `SOUL.md`) with `repograph_explore` and `repograph_callers`.
     - **Lifecycle Hooks & Memory**: Execute `.myrepograph-agent/hooks/bootstrap.md` at session start, maintain active working state in `.myrepograph-agent/memory/runtime/context.md`, and execute `.myrepograph-agent/hooks/teardown.md` logging into `.myrepograph-agent/memory/runtime/dailylog.md` at turn closeout.
13. **Multi-Turn & Follow-Up Prompt Continuous Connection Protocol**:
   - **Persistent Session State**: Maintain the active `repo-graph` MCP connection across ALL multi-turn conversations and follow-up user prompts. Never fall back to unguided directory scans or full-file ingestion.
   - **Follow-Up Query Flow**:
     1. Re-check `repograph_status` or working context in `.myrepograph-agent/memory/runtime/context.md` before answering follow-up queries.
     2. For questions about files, dependencies, or routes, ALWAYS use `repograph_skeleton`, `repograph_trace`, `repograph_search`, or `repograph_node` with line ranges.
     3. Keep responses caveman-terse and signal-dense. Record any newly resolved symbols into `context.md` and append turn telemetry to `dailylog.md`.
<!-- END REPO-GRAPH-SYNC-POLICY v1.7 -->

# CONTEXT_ENGINEERING_PROMPT_ARCHITECTURE_MARKER
When answering architecture questions or researching dependencies, follow the Context Engineering Prompt Architecture (CEPA). Always execute the 3-step discovery sequence (Orient -> Target -> Explore Leanly) and default to `signature_only: true` on `repograph_explore` calls to minimize token ingestion.

1. **Orient** — `repograph_status`, then `repograph_files(scope)` for the area in question.
2. **Target** — `repograph_search(query)` to isolate candidate identifiers.
3. **Explore Leanly** — `repograph_explore(symbols, signature_only: true)` for declarations plus the call graph.

Exception — code writes: before modifying, refactoring, or debugging the behaviour of a symbol, re-call `repograph_explore` WITHOUT `signature_only` to load the implementation body. Never edit code from a signature alone.
# END_CONTEXT_ENGINEERING_PROMPT_ARCHITECTURE_MARKER
