"""Initial database schema with multi-tenant tables: tenant, application, rule_execution, audit_log

Revision ID: 0001
Revises: 
Create Date: 2026-07-23
"""
from typing import Sequence, Union
from datetime import datetime, timezone
from alembic import op
import sqlalchemy as sa

revision: str = '0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Tenant Registry Table
    tenant_table = op.create_table(
        'tenant',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('code', sa.String(length=64), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    op.create_index('idx_tenant_code', 'tenant', ['code'])

    # Seed initial tenants so foreign keys validate cleanly
    now = datetime.now(timezone.utc)
    op.bulk_insert(
        tenant_table,
        [
            {
                'id': '00000000-0000-0000-0000-000000000000',
                'name': 'Default Tenant',
                'code': 'default',
                'is_active': True,
                'created_at': now,
                'updated_at': now,
            },
            {
                'id': 'tenant_alpha',
                'name': 'Tenant Alpha',
                'code': 'tenant_alpha',
                'is_active': True,
                'created_at': now,
                'updated_at': now,
            },
            {
                'id': 'tenant_beta',
                'name': 'Tenant Beta',
                'code': 'tenant_beta',
                'is_active': True,
                'created_at': now,
                'updated_at': now,
            },
        ]
    )

    # Application State Table
    op.create_table(
        'application',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('tenant_id', sa.String(length=64), nullable=False),
        sa.Column('entity_type', sa.String(length=32), nullable=False),
        sa.Column('applicant_name', sa.String(length=128), nullable=True),
        sa.Column('selected_bank', sa.String(length=32), nullable=False),
        sa.Column('cibil_score', sa.Integer(), nullable=False),
        sa.Column('dpd_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('write_off_amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('status', sa.String(length=32), nullable=False),
        sa.Column('payload_hash', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenant.id'])
    )
    op.create_index('idx_app_tenant', 'application', ['tenant_id'])
    op.create_index('idx_app_status', 'application', ['status'])

    # Rule Execution Audit Trail Table
    op.create_table(
        'rule_execution',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('application_id', sa.String(length=64), nullable=False),
        sa.Column('tenant_id', sa.String(length=64), nullable=False),
        sa.Column('bank_code', sa.String(length=32), nullable=False),
        sa.Column('eligible', sa.Boolean(), nullable=False),
        sa.Column('rejection_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('execution_time_ms', sa.Float(), nullable=False),
        sa.Column('rejection_reasons_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['application_id'], ['application.id']),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenant.id'])
    )
    op.create_index('idx_rule_exec_app', 'rule_execution', ['application_id'])
    op.create_index('idx_rule_exec_tenant', 'rule_execution', ['tenant_id'])

    # Administrative Security Audit Log Table
    op.create_table(
        'audit_log',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('tenant_id', sa.String(length=64), nullable=False),
        sa.Column('action', sa.String(length=64), nullable=False),
        sa.Column('performed_by', sa.String(length=128), nullable=True),
        sa.Column('details_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenant.id'])
    )
    op.create_index('idx_audit_tenant', 'audit_log', ['tenant_id'])

def downgrade() -> None:
    op.drop_table('audit_log')
    op.drop_table('rule_execution')
    op.drop_table('application')
    op.drop_table('tenant')
