import importlib.util
from pathlib import Path
from unittest.mock import patch


MIGRATION_PATH = (
    Path(__file__).parents[2]
    / "alembic"
    / "versions"
    / "0010_additional_tenant_row_level_security.py"
)


def _load_migration():
    spec = importlib.util.spec_from_file_location("migration_0010", MIGRATION_PATH)
    assert spec and spec.loader
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    return migration


def test_upgrade_enables_forced_rls_and_creates_policy_for_each_table():
    migration = _load_migration()

    with patch.object(migration.op, "execute") as execute:
        migration.upgrade()

    statements = [call.args[0] for call in execute.call_args_list]
    for table in migration.TENANT_TABLES:
        assert f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY' in statements
        assert f'ALTER TABLE "{table}" FORCE ROW LEVEL SECURITY' in statements
        policy = next(
            statement
            for statement in statements
            if f'CREATE POLICY "{table}_tenant_isolation"' in statement
        )
        assert "current_setting('app.current_tenant_id', true)" in policy
        assert "WITH CHECK" in policy


def test_downgrade_removes_policy_and_disables_rls_for_each_table():
    migration = _load_migration()

    with patch.object(migration.op, "execute") as execute:
        migration.downgrade()

    statements = [call.args[0] for call in execute.call_args_list]
    for table in migration.TENANT_TABLES:
        assert f'DROP POLICY IF EXISTS "{table}_tenant_isolation" ON "{table}"' in statements
        assert f'ALTER TABLE "{table}" NO FORCE ROW LEVEL SECURITY' in statements
        assert f'ALTER TABLE "{table}" DISABLE ROW LEVEL SECURITY' in statements
