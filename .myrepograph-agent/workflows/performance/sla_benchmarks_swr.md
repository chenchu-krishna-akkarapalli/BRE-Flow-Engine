# Performance SLA & SWR Caching Workflow (`sla_benchmarks_swr.md`)

Workflow for running HTTP latency benchmarks, SWR caching validation, and process memory profiling.

---

## 🎯 1. Anti-Assumption & Fact Verification
- Verify latency targets against `Backend-Playbook.md` and `.myrepograph-agent/agent.yaml`.

---

## ⚡ 2. Performance SLA Gate
- `GET /health`: **`< 30 ms`**
- `POST /api/v1/onboarding/evaluate`: **`< 80 ms`**
- `Zen-Engine RAM Evaluation`: **`< 10 ms`**
