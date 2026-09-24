# Database Production Runbook

## Recovery objectives

- Initial target RPO: 5 minutes.
- Initial target RTO: 30 minutes.
- The production PostgreSQL provider must retain encrypted automated backups and WAL for point-in-time recovery.
- A successful backup job is not proof of recoverability; run and record a restore drill at least quarterly.

## Local backup and restore drill

Create a restricted custom-format backup:

```sh
scripts/backup_database.sh /absolute/secure/path/flowbre.dump
```

Restore it into a disposable database, validate Alembic revision and tenant data, then remove the disposable database:

```sh
scripts/verify_database_restore.sh /absolute/secure/path/flowbre.dump
```

The verification script refuses the source database name and only accepts a target ending in `_restore_verify`.

## Production PITR acceptance gate

Before production launch, capture evidence that the managed provider can:

1. Restore the cluster to a requested timestamp within the RPO window.
2. Bring the restored cluster online within the RTO window.
3. Validate `alembic_version`, tenant counts, RLS policies, and application health.
4. Rotate application and migration credentials after the drill.
5. Record restore duration, recovered timestamp, row-count checks, and any data loss.

Logical dumps support portability and local drills; they do not replace WAL-based PITR.

## Availability and connection budget

- Deploy PostgreSQL across at least two availability zones with automatic primary failover.
- Point the application at the provider's failover-aware writer endpoint, not an instance hostname.
- Keep `/api/v1/health` as liveness and use `/api/v1/ready` for traffic readiness.
- Current Compose budgets each of four web workers for up to 10 connections and each of four Celery workers for up to 4 connections: approximately 56 runtime connections before administrative headroom.
- Keep migration, monitoring, emergency, and provider connections outside the runtime allocation. Increase pools only from measured wait time and database capacity.
