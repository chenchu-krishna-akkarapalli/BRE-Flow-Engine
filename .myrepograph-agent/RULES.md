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
