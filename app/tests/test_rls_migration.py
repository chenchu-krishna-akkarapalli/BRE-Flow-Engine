import importlib.util
from pathlib import Path
from unittest.mock import patch


MIGRATION_PATH = Path(__file__).parents[2] / "alembic" / "versions" / "0009_tenant_row_level_security.py"


def _load_migration():
    spec = importlib.util.spec_from_file_location("migration_0009", MIGRATION_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_upgrade_enables_forces_and_policies_all_strict_tenant_tables() -> None:
    migration = _load_migration()

    with patch.object(migration.op, "execute") as execute:
        migration.upgrade()

    sql = "\n".join(str(call.args[0]) for call in execute.call_args_list)
    for table in migration.TENANT_TABLES:
        assert f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY' in sql
        assert f'ALTER TABLE "{table}" FORCE ROW LEVEL SECURITY' in sql
        assert f'CREATE POLICY "{table}_tenant_isolation" ON "{table}"' in sql
    assert "current_setting('app.current_tenant_id', true)" in sql
    assert "WITH CHECK" in sql


def test_downgrade_removes_policies_and_disables_rls() -> None:
    migration = _load_migration()

    with patch.object(migration.op, "execute") as execute:
        migration.downgrade()

    sql = "\n".join(str(call.args[0]) for call in execute.call_args_list)
    for table in migration.TENANT_TABLES:
        assert f'DROP POLICY IF EXISTS "{table}_tenant_isolation" ON "{table}"' in sql
        assert f'ALTER TABLE "{table}" DISABLE ROW LEVEL SECURITY' in sql
