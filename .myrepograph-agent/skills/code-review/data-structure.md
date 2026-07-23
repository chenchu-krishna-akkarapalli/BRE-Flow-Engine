# Data Structure Optimization Strategy for FlowBRE Engine

This document outlines the data structure selection and optimization strategy engineered specifically to meet FlowBRE's strict performance SLA latency benchmarks:
- **Simple - GET Requests**: **< 30 ms** (Health endpoints, parameter metadata, pincode lookups)
- **Full BRE / Application CRUD Operations**: **< 80 ms** (Rule evaluation, application state persistence, audit logging)

---

## 1. Memory Lifetime Lifecycle Flow

Data structure selection directly impacts memory consumption and garbage collection overhead across the 5-stage request lifecycle:

```
Memory Lifetime
Request Starts
      ↓
Allocate Memory
      ↓
  Use Memory
      ↓
Garbage Collection
      ↓
Memory Released
```

- **Request Starts**: Incoming HTTP request triggers route parsing.
- **Allocate Memory**: Transient payload objects and Pydantic models are allocated on CPython's private heap.
- **Use Memory**: $O(1)$ Hash Table lookups and dynamic arrays process candidate parameters against compiled decision rules in RAM.
- **Garbage Collection**: Request scope terminates, reference counts drop to 0, and generational GC sweeps unreferenced objects.
- **Memory Released**: Memory is returned to CPython arena pools, ensuring zero heap memory accumulation.

---

## 2. Core Data Structure Optimization Strategy

To guarantee **< 30 ms GET** and **< 80 ms CRUD** response times, FlowBRE enforces targeted data structure patterns:

### 🚀 1. Hash Tables (Python Dictionaries & Sets) — $O(1)$ Lookups
- **Use Case**: In-memory rule lookup tables, bank policy matrix thresholds, parameter mapping dictionaries, and pre-compiled Zen-Engine graph references.
- **SLA Impact**: Delivers instantaneous $O(1)$ average-time complexity for parameter evaluation.
- **Heap Allocation Minimization**: Utilizing pre-allocated hash maps eliminates per-request dictionary creation. Reusing stagnant lookup structures during the `Use Memory` stage prevents CPython heap fragmentations and eliminates generational GC pauses, keeping GET operations under **30 ms** and CRUD operations under **80 ms**.

### ⚡ 2. Dynamic Arrays (Python Lists & Tuples) — Contiguous RAM Cache
- **Use Case**: DPD history lists (`dpd_history`), sequential evaluation rule chains, and batch audit log buffers.
- **SLA Impact**: Pre-sized dynamic arrays provide cache-locality advantages with $O(1)$ amortized append times.
- **Optimization**: Immutable tuples are preferred over dynamic lists for fixed parameter sets (e.g., entity types, module IDs), reducing object memory header overhead from 56 bytes to 40 bytes per collection.

### 🧠 3. In-Memory Caching (LRU Cache & Redis Key-Value Store)
- **Use Case**: Pincode-to-City/State mapping (64k entries) and bank policy matrix configurations.
- **SLA Impact**: Bypasses external disk I/O and DB queries completely, resolving simple GET lookups in **< 30 ms**.
- **Strategy**: In-process `@lru_cache(maxsize=1024)` backed by a Redis secondary cache ensures sub-millisecond data retrieval.

---

## 3. Algorithmic Complexity & SLA Alignment

| Data Structure | Operation | Time Complexity | Memory Impact | Target SLA Alignment |
|---|---|---|---|---|
| **Hash Table** | Rule / Bank Parameter Lookup | $O(1)$ | Low (Shared pre-compiled RAM) | **Simple GET < 30 ms** |
| **LRU Cache** | Pincode / Metadata Resolution | $O(1)$ | Bounded (Fixed cache budget) | **Simple GET < 30 ms** |
| **Dynamic Array** | Bureau DPD Array Scanning | $O(N)$ ($N \le 36$) | Minimal (Contiguous allocation) | **CRUD < 80 ms** |
| **B-Tree Index** | Postgres Audit Log Insertion | $O(\log N)$ | DB Buffer Pool Managed | **CRUD < 80 ms** |

---

## 4. Heap Allocation & Garbage Collection Safety Guidelines

1. **Avoid Per-Request Re-Compilation**: Never parse JSON rule files inside an endpoint handler. Pre-compile into RAM at application boot so `Allocate Memory` costs $O(1)$ per request.
2. **Minimize Object Creation**: Pass scalar values or lightweight Pydantic v2 slots instead of instantiating deep nested object trees during evaluation.
3. **Prompt Reference Cleanup**: Ensure intermediate evaluation dicts drop out of scope immediately after evaluation so reference counting triggers instant cleanup without waiting for full generational GC sweeps.