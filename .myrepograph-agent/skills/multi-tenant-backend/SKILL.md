---
name: multi-tenant-backend
description: Production-grade multi-tenant backend architecture guidelines for FastAPI, ZenEngine JDM, PostgreSQL RLS, and Redis. Enforces sub-100ms SLAs (GET < 30 ms, CRUD < 80 ms), Catch-All polymorphic routing, Singleflight cache lock, PgBouncer transaction pooling, Redis Pub/Sub JDM hot-reloading, and 5-stage memory lifetime safety across 10,000+ tenant channels.
---

# Multi-Tenant Low-Latency Backend Architecture Guide

High-performance, production-grade architecture patterns engineered to scale multi-channel, multi-tenant applications from 8 to **10,000+ active tenants** while maintaining strict FlowBRE performance SLAs:
- **Simple GET Operations**: **`< 30 ms`**
- **CRUD & Transactions**: **`< 80 ms`**
- **Zen-Engine Rule Evaluations**: **`< 10 ms`**
- **Total End-to-End Latency**: **`< 100 ms`**

---

## 1. Authorized Context Isolation & DB Security Architecture

### JWT Claim Verification & Tenant Binding
Middleware verifies that the client's `X-Tenant-ID` header matches the `tenant_id` claim bound inside the authenticated JWT token signature:
```python
def verify_tenant_auth_claim(request: Request, tenant_id_header: str) -> dict:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="MISSING_BEARER_TOKEN")
    token = auth_header.split(" ")[1]
    payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    if payload.get("tenant_id") != tenant_id_header:
        raise HTTPException(status_code=403, detail="TENANT_CROSS_ACCESS_VIOLATION")
    return payload
```

### Shared Schema PostgreSQL Row-Level Security (RLS)
- **RLS Policy**: `CREATE POLICY tenant_isolation_policy ON onboarding_evaluation_log USING (tenant_id = current_setting('app.current_tenant_id', true));`
- **PgBouncer Pooling**: Configure `pool_mode = transaction` in PgBouncer for 10,000 tenants.
- **Session Checkout Injector**: SQLAlchemy `asyncpg` context session manager executes:
  ```sql
  SET LOCAL app.current_tenant_id = :tenant_id;
  ```

---

## 2. Dynamic Catch-All Polymorphic Routing (Server Cost Control)

Avoid mounting 10,000 route tables by serving requests on a single catch-all dynamic route:
```http
POST /api/v1/channels/{tenant_id}/flow/{step_slug}
```
The handler extracts `{tenant_id}` and `{step_slug}`, resolves the pre-compiled ZenEngine JDM graph from RAM ($O(1)$ lookup in $< 1\text{ ms}$), and passes payload to Rust AST core.

---

## 3. SWR Caching, Singleflight Lock & Hot-Reloading

### Thundering Herd Protection — Redis Singleflight Lock Pattern
Ensures that exactly **ONE worker** evaluates ZenEngine on cache miss while all other concurrent requests wait:
```python
class RedisSingleflight:
    async def execute(self, key: str, fetch_func: Callable, ttl_seconds: int = 60) -> Any:
        cached = await self.redis.get(key)
        if cached:
            return json.loads(cached)

        lock_key = f"lock:{key}"
        acquired = await self.redis.set(lock_key, "locked", nx=True, ex=10)
        if acquired:
            try:
                data = await fetch_func()
                await self.redis.set(key, json.dumps(data), ex=ttl_seconds)
                return data
            finally:
                await self.redis.delete(lock_key)
        else:
            for _ in range(20):
                await asyncio.sleep(0.05)
                cached = await self.redis.get(key)
                if cached:
                    return json.loads(cached)
            return await fetch_func()
```

### Real-Time Invalidation via Redis Pub/Sub
Subscribes to `pubsub:zen_engine:reload`. On rule updates, FastAPI workers update local `TenantRuleRegistry` RAM dictionary in $< 1\text{ ms}$ without worker restarts.

---

## 4. Production Engineering & Circuit Breaker Logic

### Circuit Breaker Fallback
```python
import pybreaker

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

---

## 5. 5-Stage Request Memory Lifecycle

```
Memory Lifetime
Request Starts → Allocate Memory → Use Memory → Garbage Collection → Memory Released
```

1. **Request Starts**: Extract tenant header `X-Tenant-ID` in $< 0.1\text{ ms}$.
2. **Allocate Memory**: Deserialize payload into Pydantic v2 slots on CPython heap.
3. **Use Memory**: Fetch pre-compiled JDM graph from RAM dictionary ($O(1)$ lookup). Execute Rust ZenEngine core ($< 10\text{ ms}$). Perform single-transaction asyncpg write with local RLS tenant setting ($< 80\text{ ms}$).
4. **Garbage Collection**: Scope closes upon JSON response return; object reference counts drop to zero (`ob_refcnt = 0`).
5. **Memory Released**: Allocated memory blocks return to CPython arena allocators (`pymalloc`), keeping process RSS baseline flat.

---

## 6. Anti-Patterns & Risk Controls

- ❌ **DO NOT** execute tenant routing checks via synchronous DB queries per request — always use $O(1)$ RAM hash maps or Redis.
- ❌ **DO NOT** create separate database connection pools per tenant — single shared pre-warmed pool with PgBouncer `transaction` pooling and RLS context setting scales to 10,000+ tenants.
- ❌ **DO NOT** omit `Vary: X-Tenant-ID, Authorization` in response headers — prevents cross-tenant CDN cache bleed.
- ❌ **DO NOT** log un-redacted PII fields (PAN, Aadhaar, DOB).
- ❌ **DO NOT** perform blocking file I/O inside API request hot paths.
