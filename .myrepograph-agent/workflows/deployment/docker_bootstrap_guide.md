# Docker Bootstrap & Container Orchestration Workflow (`docker_bootstrap_guide.md`)

Workflow for spinning up Docker containers (PostgreSQL 16, Redis 7) and Uvicorn clustering.

---

## 🎯 1. Anti-Assumption & Fact Verification
- Verify container ports and environment variables against `docker-compose.yml`.

---

## ⚡ 2. Performance SLA Gate
- Uvicorn worker clustering must maintain `< 30 ms` GET and `< 80 ms` CRUD latency under load.
