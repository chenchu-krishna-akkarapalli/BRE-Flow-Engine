# 🚀 FlowBRE Master Developer & Agent Guidance (`CLAUDE.md`)

Welcome to **FlowBRE (Flow Business Rules Engine)**. This document provides core architectural directives, command references, coding standards, and compliance rules for developer pair programming and automated coding agents.

---

## 🛠️ CLI Command Reference

### Local Development
```bash
# Run local ASGI development server (hot-reloading enabled)
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Copy environment template
cp .env.example .env
```

### Automated Testing & SLA Verification
```bash
# Run complete test suite via uv (11/11 tests)
uv run --with fastapi --with uvicorn --with pydantic --with pydantic-settings --with sqlalchemy --with asyncpg --with redis --with pytest --with httpx --with pyjwt pytest app/tests/ -v

# Run single test module
uv run --with fastapi --with uvicorn --with pydantic --with pydantic-settings --with sqlalchemy --with asyncpg --with redis --with pytest --with httpx --with pyjwt pytest app/tests/test_bre_engine.py -v

# Execute via Makefile shortcuts
make test
make check-sla
```

### Container Orchestration (Docker Compose)
```bash
# Build and start container stack (Postgres on 127.0.0.1:5435, Redis on 127.0.0.1:6379, FastAPI on 127.0.0.1:8000)
docker-compose up -d --build

# Check status & liveness healthchecks
docker-compose ps

# Stop container stack
docker-compose down

# Tail application logs
docker-compose logs -f --tail=100
```

### Async Database Migrations (Alembic)
```bash
# Execute migrations inside running web container
docker-compose exec web alembic upgrade head

# Generate a new migration revision
alembic revision --autogenerate -m "describe_migration_changes"

# Upgrade local database offline
alembic upgrade head
```

---

## 🏛️ Architectural Directives & Non-Negotiables

1. **Zero Hot-Path Disk I/O**:
   - Zen-Engine JDM decision trees (`app/zen_rules/`) MUST be compiled into memory during lifespan boot.
   - Hot-path requests evaluate strictly in RAM (`< 0.5 ms` evaluation latency). Never perform disk reads inside API route handlers.

2. **PostgreSQL Row-Level Security (RLS)**:
   - All tenant queries MUST set session state via:
     `SELECT set_config('app.current_tenant_id', :tenant_id, true)`
   - Never issue multi-tenant queries without explicitly running `set_tenant_rls_context(db, tenant_id)`.

3. **Connection Pool Bounds**:
   - SQLAlchemy Async Engine pool limits: `pool_size=20`, `max_overflow=10`, `pool_pre_ping=True`, `pool_recycle=3600`.
   - Never instantiate ad-hoc engine pools outside `app/core/database.py`.

4. **5-Stage Request Memory Lifecycle**:
   - `Request Starts`: Instantiate request object and Pydantic validation.
   - `Allocate Memory`: Bind tenant ContextVar to request async task.
   - `Use Memory`: Evaluate payload against compiled RAM AST decision trees.
   - `Garbage Collection`: Close and flush database sessions in teardown.
   - `Memory Released`: Event loop frees request-scoped objects back to runtime heap.

---

## 🔒 PII Security & Logging Standards

All user-identifiable data MUST be redacted prior to logging:

* **PAN Format**: `AB******4F` (`redact_pii()`)
* **Date of Birth**: `****-**-15`
* **Aadhaar ID**: `****-****-1234`
* Never log raw request bodies containing unredacted credit bureau responses or tax documentation.

---

## 📐 Python Coding Style Guide

* **Typing & Validation**: Use Python 3.11+ syntax, strict type hints (`typing` module), and Pydantic v2 `BaseModel` / `BaseSettings`.
* **Async Core**: Use `async`/`await` for all DB, Redis, and I/O tasks. Do not call blocking sync operations on the main event loop.
* **Error Handling**: Throw custom domain exceptions defined in `app/core/exceptions.py`. Never swallow runtime exceptions silently or return generic fallback 0s.
* **Constants**: Load business constants, messages, error codes, and regexes strictly from `app/constants/` — zero inline hardcoding.

---

## ⏱️ SLA Latency Ceilings

| Operation | SLA Budget | Action if Exceeded |
|---|---|---|
| Simple GET (`/health`) | `< 30.0 ms` | Reject commit / Profile ASGI middleware |
| Zen RAM Rules Eval | `< 10.0 ms` | Optimize JDM AST expression nodes |
| CRUD Evaluation & Audit Log | `< 80.0 ms` | Optimize SQL index / Async DB flush batching |
| Total Round-Trip Ceiling | `< 100.0 ms` | Full trace analysis required |

---

## ✅ Pre-Commit Developer Checklist

Before submitting code or merging pull requests, ensure the following pass cleanly:

- [ ] All 11 unit tests pass (`make test` or `uv run pytest app/tests/ -v`).
- [ ] No unredacted PII is output in `logger.info()` or exception traces.
- [ ] `docker-compose config` parses without syntax warnings.
- [ ] New database model changes are captured in Alembic migrations (`alembic upgrade head`).
- [ ] Evaluation latency remains within SLA thresholds (`< 80 ms` CRUD, `< 10 ms` RAM rules).
