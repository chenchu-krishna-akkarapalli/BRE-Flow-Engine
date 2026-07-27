"""Polymorphic onboarding form storage: entity-type columns on application,
JSONB detail documents, and enriched rule_execution / audit_log audit trails.

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '0002'
down_revision: Union[str, None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (column, type, nullable, server_default) added to `application` for the
# 5-step wizard payload. Entity-specific leftovers live in entity_detail_json.
APPLICATION_COLUMNS = [
    # Identity (step 1)
    ('pan_masked', sa.String(length=16), True, None),
    ('contact_email', sa.String(length=254), True, None),
    ('contact_phone', sa.String(length=16), True, None),
    ('is_nri', sa.Boolean(), False, 'false'),
    # Address (step 2)
    ('pincode', sa.String(length=6), True, None),
    ('city_name', sa.String(length=128), True, None),
    ('state_name', sa.String(length=128), True, None),
    ('resident_details', sa.String(length=32), True, None),
    # Occupation & business (step 3)
    ('profile_type', sa.String(length=32), True, None),
    ('occupation', sa.String(length=32), True, None),
    ('property_status', sa.String(length=48), True, None),
    ('guarantor_provided', sa.Boolean(), False, 'false'),
    ('business_establishment_date', sa.String(length=10), True, None),
    ('current_itr_amount', sa.Float(), True, None),
    ('prev_itr_amount', sa.Float(), True, None),
    # Banking, bureau & loan (step 4)
    ('loan_type', sa.String(length=32), True, None),
    ('existing_account_bank', sa.String(length=32), True, None),
    ('existing_car_loan_bank', sa.String(length=32), True, None),
    ('cibil_pl_score', sa.Integer(), True, None),
    ('max_dpd_days', sa.Integer(), False, '0'),
    ('loan_enquiry_count', sa.Integer(), False, '0'),
    ('currently_outstanding', sa.Float(), False, '0.0'),
    ('write_off_type', sa.String(length=16), True, None),
    # Co-applicant (step 5)
    ('co_applicant_age_relation', sa.String(length=32), True, None),
    ('co_applicant_income_relation', sa.String(length=32), True, None),
    # Verdict & polymorphic detail
    ('overall_eligible', sa.Boolean(), True, None),
    ('entity_detail_json', postgresql.JSONB(astext_type=sa.Text()), True, None),
]


def upgrade() -> None:
    for name, column_type, nullable, server_default in APPLICATION_COLUMNS:
        op.add_column(
            'application',
            sa.Column(name, column_type, nullable=nullable, server_default=server_default),
        )

    # applicant_name widens to hold registered company / HUF names.
    op.alter_column(
        'application',
        'applicant_name',
        existing_type=sa.String(length=128),
        type_=sa.String(length=180),
        existing_nullable=True,
    )

    op.create_index('idx_app_entity_type', 'application', ['entity_type'])
    op.create_index('idx_app_profile_type', 'application', ['profile_type'])

    op.add_column(
        'rule_execution',
        sa.Column('executed_rules_count', sa.Integer(), nullable=False, server_default='0'),
    )
    op.add_column(
        'rule_execution',
        sa.Column('bank_eligibility_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )

    op.add_column('audit_log', sa.Column('entity_type', sa.String(length=32), nullable=True))
    op.add_column('audit_log', sa.Column('resource_id', sa.String(length=64), nullable=True))
    op.add_column(
        'audit_log',
        sa.Column('details_document', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.create_index('idx_audit_action', 'audit_log', ['action'])
    op.create_index('idx_audit_resource', 'audit_log', ['resource_id'])


def downgrade() -> None:
    op.drop_index('idx_audit_resource', table_name='audit_log')
    op.drop_index('idx_audit_action', table_name='audit_log')
    op.drop_column('audit_log', 'details_document')
    op.drop_column('audit_log', 'resource_id')
    op.drop_column('audit_log', 'entity_type')

    op.drop_column('rule_execution', 'bank_eligibility_json')
    op.drop_column('rule_execution', 'executed_rules_count')

    op.drop_index('idx_app_profile_type', table_name='application')
    op.drop_index('idx_app_entity_type', table_name='application')
    op.alter_column(
        'application',
        'applicant_name',
        existing_type=sa.String(length=180),
        type_=sa.String(length=128),
        existing_nullable=True,
    )
    for name, _type, _nullable, _default in reversed(APPLICATION_COLUMNS):
        op.drop_column('application', name)
