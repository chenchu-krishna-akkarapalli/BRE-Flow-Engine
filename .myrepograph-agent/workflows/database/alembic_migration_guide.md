# Database Migration & Connection Pooling Workflow (`alembic_migration_guide.md`)

Workflow for database schema migrations, PostgreSQL Row-Level Security (RLS) enforcement, and SQLAlchemy asyncpg connection pool tuning.

---

## 🎯 1. Anti-Assumption & Fact Verification
- Verify table definitions against `app/models.py` (`application`, `rule_execution`, `audit_log`).
- Enforce RLS policy checking `SET LOCAL app.current_tenant_id = :tenant_id`.

---

## ⚡ 2. Performance SLA Gate
- **Connection Pool Config**: `pool_size=20`, `max_overflow=10`, `pool_recycle=3600`, `pool_pre_ping=True`.
- **CRUD Transaction SLA**: **`< 80 ms`**.
