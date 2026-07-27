---
name: multi-tenant-backend
description: Multi-tenant FastAPI backend architecture — PostgreSQL RLS tenant isolation, JWT claim binding, PgBouncer transaction pooling, catch-all polymorphic routing, Redis singleflight + Pub/Sub invalidation, circuit breakers, and the 5-stage request memory lifecycle. Load for database, tenancy, caching, or API-layer work.
---

# Multi-Tenant Low-Latency Backend

Patterns for scaling to 10,000+ tenants within the FlowBRE SLAs (see CLAUDE.md § Performance SLAs).

## 1. Tenant isolation

**JWT claim binding** — the `X-Tenant-ID` header must match the signed token claim:

```python
def verify_tenant_auth_claim(request: Request, tenant_id_header: str) -> dict:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="MISSING_BEARER_TOKEN")
    payload = jwt.decode(auth_header.split(" ")[1], JWT_SECRET, algorithms=["HS256"])
    if payload.get("tenant_id") != tenant_id_header:
        raise HTTPException(status_code=403, detail="TENANT_CROSS_ACCESS_VIOLATION")
    return payload
```

**Shared-schema PostgreSQL RLS** — mandatory on every tenant-scoped table:

```sql
CREATE POLICY tenant_isolation_policy ON onboarding_evaluation_log
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Injected on every session checkout, inside the transaction:
SET LOCAL app.current_tenant_id = :tenant_id;
```

PgBouncer: `pool_mode = transaction`. One shared pre-warmed pool for all tenants — never per-tenant pools.

## 2. Catch-all polymorphic routing

One dynamic route instead of 10,000 mounted route tables:

```http
POST /api/v1/channels/{tenant_id}/flow/{step_slug}
```

Handler resolves the pre-compiled JDM graph from a RAM dict (O(1), < 1ms) and passes the payload to the Rust AST core.

## 3. Caching & invalidation

**Redis singleflight** — exactly one worker evaluates on cache miss; the rest wait:

```python
class RedisSingleflight:
    async def execute(self, key: str, fetch_func: Callable, ttl_seconds: int = 60) -> Any:
        cached = await self.redis.get(key)
        if cached:
            return json.loads(cached)
        lock_key = f"lock:{key}"
        if await self.redis.set(lock_key, "locked", nx=True, ex=10):
            try:
                data = await fetch_func()
                await self.redis.set(key, json.dumps(data), ex=ttl_seconds)
                return data
            finally:
                await self.redis.delete(lock_key)
        for _ in range(20):
            await asyncio.sleep(0.05)
            if cached := await self.redis.get(key):
                return json.loads(cached)
        return await fetch_func()
```

**Pub/Sub invalidation** — subscribe to `pubsub:zen_engine:reload`; workers refresh the local `TenantRuleRegistry` RAM dict in < 1ms with no restart.

## 4. Circuit breaker

```python
zen_engine_breaker = pybreaker.CircuitBreaker(fail_max=5, reset_timeout=30)

class ZenEngineWrapper:
    @zen_engine_breaker
    def evaluate(self, jdm_graph: dict, payload: dict) -> dict:
        return zenengine_rust.evaluate(jdm_graph, payload)

    def evaluate_safe(self, jdm_graph: dict, payload: dict) -> dict:
        try:
            return self.evaluate(jdm_graph, payload)
        except pybreaker.CircuitBreakerError:
            return {"result": "MANUAL_REVIEW", "version": "fallback_v1.0"}
```

## 5. Anti-patterns

- Tenant routing via synchronous per-request DB queries — use O(1) RAM maps or Redis.
- Per-tenant connection pools — one shared pool + PgBouncer transaction mode + RLS context.
- Omitting `Vary: X-Tenant-ID, Authorization` — causes cross-tenant CDN cache bleed.
- Logging unredacted PII (PAN, Aadhaar, DOB).
- Blocking file I/O in a request hot path.
