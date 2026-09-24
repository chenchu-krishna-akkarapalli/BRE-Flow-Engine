"""Enforce tenant isolation on tenant-owned business tables.

Revision ID: 0009
Revises: 0008
Create Date: 2026-09-23
"""
from typing import Sequence, Union

from alembic import op


revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TENANT_TABLES = (
    "application",
    "rule_execution",
    "audit_log",
    "document_record",
)


def _tenant_expression() -> str:
    current_tenant = "current_setting('app.current_tenant_id', true)"
    return f"""(
        tenant_id = {current_tenant}
        OR EXISTS (
            SELECT 1
            FROM tenant AS rls_tenant
            WHERE rls_tenant.id = {current_tenant}
              AND tenant_id IN (rls_tenant.code, COALESCE(rls_tenant.tenant_uuid, ''))
        )
    )"""


def upgrade() -> None:
    expression = _tenant_expression()
    for table in TENANT_TABLES:
        policy = f"{table}_tenant_isolation"
        op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY')
        op.execute(f'ALTER TABLE "{table}" FORCE ROW LEVEL SECURITY')
        op.execute(
            f'''CREATE POLICY "{policy}" ON "{table}"
                FOR ALL
                USING {expression}
                WITH CHECK {expression}'''
        )


def downgrade() -> None:
    for table in reversed(TENANT_TABLES):
        policy = f"{table}_tenant_isolation"
        op.execute(f'DROP POLICY IF EXISTS "{policy}" ON "{table}"')
        op.execute(f'ALTER TABLE "{table}" NO FORCE ROW LEVEL SECURITY')
        op.execute(f'ALTER TABLE "{table}" DISABLE ROW LEVEL SECURITY')
