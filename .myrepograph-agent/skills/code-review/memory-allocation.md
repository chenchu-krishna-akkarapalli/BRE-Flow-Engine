# Memory Lifetime & Dynamic Allocation Architecture for FlowBRE Engine

## 1. Memory Lifetime Lifecycle Flowchart

To consistently satisfy FlowBRE's target performance SLAs (**Simple - GET < 30 ms**, **CRUD Operations < 80 ms**, **Zen-Engine < 10 ms**, **Total End-to-End < 100 ms**), memory management across the FastAPI and CPython execution stack follows a deterministic 5-stage lifecycle flow:

```
Memory Lifetime
Request Starts → Allocate Memory → Use Memory → Garbage Collection → Memory Released
```

---

## 2. 5-Stage FastAPI / CPython Memory Analysis

### 📥 Stage 1: Request Starts
- **FastAPI / ASGI Processing**: The ASGI web server (Uvicorn / Gunicorn worker) receives an incoming HTTP request on an event loop thread.
- **Route Dispatch**: FastAPI matches the request path (`GET /health` or `POST /api/v1/onboarding/evaluate`).
- **SLA Objective**: Trigger rapid execution dispatch, spending $< 1\text{ ms}$ on routing.

### 📦 Stage 2: Allocate Memory
- **CPython Private Heap**: The CPython memory manager allocates space in a **private heap** exclusively reserved for Python objects (Small Object Allocator `PyObject_Malloc` for objects $\le 512$ bytes).
- **Request Pydantic Models**: Incoming JSON payloads are deserialized into Pydantic v2 schemas (`OnboardingEvaluationRequest`), instantiating transient field strings, integers, and nested lists.
- **Heap Overhead Control**: Pre-compiling Zen-Engine JSON decision graphs in RAM at startup prevents per-request heap allocation spikes.

### ⚙️ Stage 3: Use Memory
- **Execution & Reference Counting**: Zen-Engine Rust core evaluates candidate parameters against rules in RAM. Each created variable or reference increments Python's internal reference count (`ob_refcnt`).
- **Target SLA Performance**:
  - **Simple GET Requests (< 30 ms)**: Served directly from in-memory LRU cache or pre-allocated hash maps without hitting database layers.
  - **CRUD Operations (< 80 ms)**: Executed in Rust RAM core; evaluated state and audit log objects are passed to SQLAlchemy `asyncpg` (`pool_size=20`, `max_overflow=10`) for single-transaction persistence.

### 🧹 Stage 4: Garbage Collection
- **Immediate Reference Counting Cleanup**: When the API response is returned and the endpoint function frame terminates, local variable scopes close. Reference counts for temporary Pydantic models and intermediate dicts drop to zero, prompting CPython to immediately deallocate memory blocks.
- **Generational Mark-and-Sweep (GC)**: To handle potential circular references (e.g., cross-referencing rule nodes), CPython's generational GC sweeps Generation 0, 1, and 2 buckets. By keeping rule nodes acyclic, GC pause overhead is completely avoided during request evaluation.

### 🔓 Stage 5: Memory Released
- **Arena & Pool Recycling**: Deallocated object memory is returned to CPython's memory arena pools (`pymalloc`), preventing process RSS (Resident Set Size) memory growth.
- **SLA Protection**: Rapid memory release guarantees predictable, repeatable performance latency across thousands of concurrent onboarding applications.

---

## 3. Dynamic Memory Allocation vs. Low-Latency Performance

Because FastAPI runs on CPython, dynamic memory allocation carries reference count overhead (every object tracks data type, value, and reference count).

By structuring the FlowBRE Engine around pre-loaded RAM decision graphs and lightweight request models:
1. **Per-Request Heap Allocation** is kept minimal during **Stage 2 (Allocate)**.
2. **Reference Counting** cleans up $> 99\%$ of short-lived evaluation objects during **Stage 4 (Garbage Collection)** without triggering blocking mark-and-sweep pauses.
3. **Memory Release** during **Stage 5 (Memory Released)** ensures that server instances reliably maintain **Simple - GET < 30 ms** and **CRUD Operations < 80 ms** SLAs under sustained load.