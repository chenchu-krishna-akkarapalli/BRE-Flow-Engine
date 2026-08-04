# FlowBRE — Developer & Agent Manual

Core directives, commands, and standards for the **FlowBRE (Flow Business Rules Engine)** repo. This file is always in context; everything here is stated once and referenced elsewhere.

---

## Agent Skill Index & Token Budget

20 skills live in `.myrepograph-agent/skills/<name>/SKILL.md`, totalling **~14,000 tokens**. Loading all of them burns context before any work begins and buries the task-relevant guidance in noise.

### Loading rules

1. **Never load all 20.** A typical task needs **1–3 skills**. Loading more than 4 requires a stated reason.
2. **Read the frontmatter `description` first.** Every description states exactly when its skill applies — that is the routing key. Load the body only after the description matches the task.
3. **Load on demand, not upfront.** Do not preload skills "in case they're useful" at session start. Load when you reach the work that needs them.
4. **Backend and frontend skills are mutually exclusive** within one task. A UI task does not load `multi-tenant-backend`; a database task does not load `ui_ux_design` or `frontend-principles`.
5. **Do not restate skill content back into context.** Report the decision you made, not the skill you read.

### Routing map

| Task | Load | Do NOT load |
|---|---|---|
| Onboarding wizard UI, forms, steps | `ui_ux_design` + `frontend-principles` | backend, workflow skills |
| Concrete padding / radius / grid values | `Rules` (with `ui_ux_design`) | — |
| `flow.html` single-file UI work | `anthropic-frontend-design`, `impeccable`, `taste-skill` | `frontend-principles` (Next.js-specific) |
| a11y / semantic markup audit | `vercel-web-design-guidelines` | — |
| DB, RLS, tenancy, caching, API layer | `multi-tenant-backend` | all frontend skills |
| Reviewing a diff | `code-review` | — |
| Refactor / simplification pass | `code-simplifier` | — |
| Security review | `trail-of-bits-security` | — |
| Browser / E2E testing | `webapp-testing` | — |
| Planning a non-trivial feature | `grill-me` (design interview) **or** `superpowers` (full lifecycle) | both together |
| Ending / transferring a long session | `handoff` | — |
| Long session drowning in tool output | `context-mode` | — |
| PDF / DOCX / XLSX / PPTX files | `document-skills` | — |
| Web scraping / crawling | `firecrawl` | — |
| General coding discipline | `karpathy-guidelines` | — |
| Explain something plainly | `caveman` | — |

### Cost reference

| Skill | ~Tokens | Skill | ~Tokens |
|---|---|---|---|
| `ui_ux_design` | 3000 | `context-mode` | 580 |
| `frontend-principles` | 1930 | `handoff` | 580 |
| `multi-tenant-backend` | 960 | `anthropic-frontend-design` | 520 |
| `Rules` | 730 | `taste-skill` | 480 |
| `document-skills` | 720 | `code-review` | 480 |
| `firecrawl` | 650 | `caveman` | 480 |
| `grill-me` | 610 | `webapp-testing` | 435 |
| `trail-of-bits-security` | 380 | `code-simplifier` | 370 |
| `karpathy-guidelines` | 340 | `superpowers` | 290 |
| `vercel-web-design-guidelines` | 270 | `impeccable` | 225 |

Frontend wizard work (`ui_ux_design` + `frontend-principles` + `Rules`) costs ~5,660 tokens — the most expensive legitimate combination. Everything else should land under 2,000.

### Editing skills

Keep skill files at instruction density: schemas, parameters, commands, thresholds, code. No "When to use this" sections (the frontmatter `description` serves that purpose), no restating the SLAs or memory lifecycle defined below, no narrative rationale that does not change a decision.

---

## Performance SLAs

Referenced by skills and reviews; defined only here.

| Operation | Budget | On breach |
|---|---|---|
| Simple GET (`/health`) | `< 30 ms` | Profile ASGI middleware |
| Zen RAM rules eval | `< 10 ms` | Optimize JDM AST expression nodes |
| CRUD evaluation + audit log | `< 80 ms` | Optimize SQL index / batch async flush |
| Total round trip | `< 100 ms` | Full trace analysis |

Frontend compile targets are separate and live in `frontend-principles`: sub-30 ms page transitions are bought by prefetch and bundle size, **not** by compiler speed. TypeScript 7.0's ~10x native (Go) compiler accelerates `tsc --noEmit`, CI, and IntelliSense — it does not touch HMR, because Turbopack/SWC strip types rather than check them.

## 5-Stage Request Memory Lifecycle

1. **Request Starts** — instantiate request object, Pydantic validation.
2. **Allocate Memory** — bind tenant ContextVar to the request async task.
3. **Use Memory** — evaluate payload against compiled RAM AST decision trees.
4. **Garbage Collection** — close and flush DB sessions in teardown.
5. **Memory Released** — event loop returns request-scoped objects to the heap.

---

## Architectural Non-Negotiables

1. **Zero hot-path disk I/O.** Zen-Engine JDM trees (`app/zen_rules/`) compile into memory during lifespan boot. Route handlers never read from disk.
2. **PostgreSQL RLS on every tenant query.** Set session state via `SELECT set_config('app.current_tenant_id', :tenant_id, true)` — always through `set_tenant_rls_context(db, tenant_id)`.
3. **Connection pool bounds.** `pool_size=20`, `max_overflow=10`, `pool_pre_ping=True`, `pool_recycle=3600`. Never instantiate pools outside `app/core/database.py`.
4. **Bank policy is code, not config.** `BANK_MATRIX_RULES` in `app/services/bre_engine.py` is the source of truth, derived from `app/zen_rules/Bank_Eligibility_Matrix_v1.xlsx`. Rule changes ship as code changes, and `app/tests/test_bank_matrix_conformance.py` fails if the two drift.

## PII & Logging

Redact before logging, always — PAN `AB******4F`, DOB `****-**-15`, Aadhaar `****-****-1234` (`redact_pii()`). Never log raw request bodies containing bureau responses or tax documents. Raw PAN never reaches the database; only the masked form is persisted.

## Comment Style — single-line only

**Every comment is a single line.** No multi-line block comments, no `/** … */` JSDoc banners, no `"""…"""` prose docstrings that run past one line. Applies to Python, TypeScript, TSX and CSS alike.

```python
# Combined-ITR banks score the two-year total; the per-year floor does not also apply.
```
```ts
// Un-ticking a flag must clear what it guarded, or an unclassified write-off fails closed (BUR-401D).
```

Rationale: every file an agent opens is re-read into context in full. A ten-line rationale block costs those tokens on every read, for the whole session, and dilutes attention across the file — the signal an agent needs is the one line stating *why*, not the essay around it.

Rules:

1. **One line, and it must earn its place.** State the non-obvious *why* — a constraint, a boundary semantic, a rule ID, a bug it prevents. Delete anything restating what the code says.
2. **Two lines maximum, and only when a single line genuinely cannot carry it** (a wire contract, a matrix column mapping). Use consecutive `//` or `#` lines, never a block.
3. **No decorative banners.** `# ---- Section ----` separators are fine; multi-line headers are not.
4. **Do not restate this file.** SLAs, the memory lifecycle and the architectural non-negotiables are defined here once; a comment repeating them is pure cost.
5. **Docstrings**: one line. Where a public function truly needs argument-level detail, put it in the type hints and the constant's own comment, not in prose.

When editing an existing file, collapse any multi-line comment you touch. Do not sweep untouched files just to reformat them.

## Python Style

- Python 3.11+, strict type hints, Pydantic v2 `BaseModel` / `BaseSettings`.
- `async`/`await` for all DB, Redis, and I/O. No blocking calls on the event loop.
- Raise domain exceptions from `app/core/exceptions.py`. Never swallow exceptions or return fallback zeros.
- Constants, messages, error codes, and regexes load from `app/constants/` — zero inline hardcoding.
- Comments follow the single-line rule above.

---

## Commands

```bash
# Dev server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Full suite (374 tests)
uv run --with fastapi --with uvicorn --with pydantic --with pydantic-settings \
  --with sqlalchemy --with asyncpg --with redis --with pytest --with pytest-asyncio \
  --with openpyxl --with reportlab --with httpx --with pyjwt pytest app/tests/ -v

make test          # same, via Makefile
make check-sla     # latency benchmarks only

# Document OCR stack — run with the SAME interpreter that serves the API.
# Exit 0 = real extraction works; exit 1 = uploads return "simulated": true.
.venv/Scripts/python.exe scripts/check_ocr_stack.py   # Windows
.venv/bin/python scripts/check_ocr_stack.py           # Linux / macOS

# Containers — Postgres 127.0.0.1:5435, Redis 6379, FastAPI 8000
docker-compose up -d --build
docker-compose ps
docker-compose logs -f --tail=100
docker-compose down

# Migrations
docker-compose exec web alembic upgrade head
alembic revision --autogenerate -m "describe_changes"
```

## Document OCR (`openbharatocr`)

Extraction needs **two** independent installs. Missing either makes uploads
return `"simulated": true` with no error, so check both before debugging code.

**1. Python packages** — into the interpreter that runs the API, not a different one:

```bash
uv venv --python 3.12          # openbharatocr's OpenCV/numpy wheels stop at 3.12
uv pip install -r requirements.txt
```

**2. Tesseract OCR engine** — an OS binary, not a pip package:

```bash
winget install --id UB-Mannheim.TesseractOCR   # Windows (reopen the shell after)
sudo apt-get install -y tesseract-ocr          # Debian / Ubuntu
brew install tesseract                         # macOS
```

Then start the server with that interpreter — a bare `uvicorn` resolves to whichever
Python is first on PATH, which is the usual cause of unexplained simulated extractions:

```bash
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Set `OCR_REQUIRE_REAL=true` to make a missing stack a loud 422 naming the absent
component, instead of a silent fallback. Leave it off in dev; turn it on wherever a
simulated payload must never be mistaken for a reading of the applicant's card.

Test dependencies that are easy to miss: **`pytest-asyncio`** (without it async tests fail rather than skip), **`openpyxl`** (bank-matrix conformance test + Excel export) and **`reportlab`** (PDF export). The last two are runtime dependencies, not test-only.

```bash
# Frontend (frontend/ — Next.js 16, React 19, Tailwind v4, TypeScript 7)
pnpm run dev        # Turbopack, default in Next 16 — no --turbo flag
pnpm run build
pnpm run typecheck  # tsc --noEmit — the correctness gate
```

**Frontend is on TypeScript 7 (native Go compiler).** Two consequences: `next.config.ts` must keep `experimental.useTypeScriptCli: true` (TS 7 dropped the in-process compiler API Next.js needs), and **`pnpm run lint` does not run** — `typescript-eslint` rejects TS 7 and `eslint-config-next` imports it unconditionally. `pnpm run typecheck` is the gate until typescript-eslint#10940 lands. Do not "fix" lint by downgrading TypeScript without raising it first.

## Pre-Commit Checklist

- [ ] Full suite passes (`make test`).
- [ ] No unredacted PII in logs or exception traces.
- [ ] `docker-compose config` parses cleanly.
- [ ] Model changes captured in an Alembic migration.
- [ ] Latency within SLA (`< 80 ms` CRUD, `< 10 ms` rules eval).
- [ ] Bank policy changes reflected in both the matrix and the conformance test.
