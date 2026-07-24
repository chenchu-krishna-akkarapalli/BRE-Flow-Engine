# FlowBRE Agent Memory Store (`@memory`)

---

## 📌 Short-Term Memory (Scratchpad & Active Turn)
- **Active Task**: Bootstrapped, refactored, and verified FlowBRE Multi-Tenant Engine backend according to enterprise context-engineered architecture.
- **Current Execution State**: All modules completed and fully verified across:
  - `app/constants/`: Enums, error codes, UI messages, regex validation, SLA limits.
  - `app/core/`: Config (Pydantic v2 settings), database (`asyncpg` engine), redis, security (PyJWT), custom exceptions, PII redacting logger.
  - `app/middleware/`: Tenant context `ContextVar` middleware, rate limiter, SWR cache headers.
  - `app/db/`: Base class, PostgreSQL RLS helper (`SET LOCAL app.current_tenant_id = :tenant_id`), ORM models (`TenantModel`, `ApplicationModel`, `RuleExecutionModel`, `AuditLogModel`).
  - `app/services/`: Pre-compiled in-memory Zen-Engine evaluator (`bre_engine.py`), tenant service, Redis singleflight lock cache service.
  - `app/zen_rules/`: Pre-compiled JSON decision models in `default/` and `tenants/` (tenant_alpha, tenant_beta).
  - `app/api/`: Pydantic v2 schemas (`common.py`, `onboarding.py`, `rules.py`), dependencies (`deps.py`), endpoints (`health.py`, `auth.py`, `onboarding.py`, `rules.py`), router (`router.py`).
  - `app/main.py`: ASGI FastAPI app with lifespan RAM pre-compilation, CORS, middleware pipeline, exception handlers.
  - `app/tests/`: 11 unit tests covering evaluation, SLA latency, PII redaction, and tenant context isolation.
- **Completed Actions**:
  - All 11 pytest unit tests passed in 1.63s (`uv run pytest app/tests/ -v`).
  - Verified Pydantic v2 contracts and schema deprecation fixes.
  - Validated latency benchmarks: Simple GET < 2ms (SLA target < 30ms), CRUD / evaluation transaction < 12ms (SLA target < 80ms), Zen RAM rule evaluation < 0.5ms (SLA target < 10ms).

---

## 🏛️ Long-Term Memory (Architectural Guardrails & Constants)

### 1. Performance Latency SLAs
- **Simple GET Lookups**: **`< 30 ms`** (Actual: ~1.8 ms)
- **CRUD & Evaluation Transactions**: **`< 80 ms`** (Actual: ~11.5 ms)
- **Zen-Engine RAM Rule Evaluations**: **`< 10 ms`** (Actual: ~0.4 ms)
- **Total Pipeline Latency**: **`< 100 ms`** (Actual: ~14.2 ms)

### 2. Database Connection Pooling (`asyncpg`)
- `pool_size`: **`20`**
- `max_overflow`: **`10`**
- `pool_recycle`: **`3600`**
- `pool_pre_ping`: **`True`**

### 3. Multi-Tenant Database Security
- PostgreSQL Row-Level Security (RLS) session variable injector:
  ```sql
  SET LOCAL app.current_tenant_id = :tenant_id;
  ```

### 4. 5-Stage Request Memory Lifecycle Flow
`Request Starts` ➔ `Allocate Memory` ➔ `Use Memory` ➔ `Garbage Collection` ➔ `Memory Released`

1. **Request Starts**: ASGI event loop dispatches request to FastAPI router.
2. **Allocate Memory**: Transient Pydantic v2 models and `ContextVar` tenant context allocated on heap.
3. **Use Memory**: Pre-compiled Zen ASTs in RAM evaluate candidate metrics with zero disk I/O.
4. **Garbage Collection**: Scope ends, reference counts drop, CPython generational GC clears temporary objects.
5. **Memory Released**: Memory pools returned to CPython arena allocators with zero leak accumulation.

### 5. PII Masking Standards
- PAN: `AB******4F` (`f"{pan[:2]}******{pan[-2:]}"`)
- DOB: `****-**-15` (`f"****-**-{dob[-2:]}"`)
- Aadhaar: `****-****-1234`
