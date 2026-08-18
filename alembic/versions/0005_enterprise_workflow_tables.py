"""Create enterprise workflow and RBAC role tables based on live workflow specification.

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# single concise context line
def upgrade() -> None:
    # 1. Enhance tenant table
    op.add_column("tenant", sa.Column("tenant_uuid", sa.String(64), nullable=True))
    op.add_column("tenant", sa.Column("status", sa.String(32), server_default="pending", nullable=False))
    op.add_column("tenant", sa.Column("channel_type", sa.String(64), nullable=True))
    op.add_column("tenant", sa.Column("cibil_overlay", sa.Integer(), server_default="0", nullable=False))
    op.add_column("tenant", sa.Column("contact_email", sa.String(254), nullable=True))
    op.add_column("tenant", sa.Column("contact_phone", sa.String(16), nullable=True))
    op.create_index("ix_tenant_tenant_uuid", "tenant", ["tenant_uuid"], unique=True)
    op.create_index("ix_tenant_status", "tenant", ["status"])

    # 2. Tenant status history
    op.create_table(
        "tenant_status_history",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), sa.ForeignKey("tenant.id"), nullable=False, index=True),
        sa.Column("previous_status", sa.String(32), nullable=False),
        sa.Column("new_status", sa.String(32), nullable=False),
        sa.Column("changed_by", sa.String(128), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 3. User account
    op.create_table(
        "user_account",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), sa.ForeignKey("tenant.id"), nullable=True, index=True),
        sa.Column("username", sa.String(128), unique=True, nullable=False, index=True),
        sa.Column("email", sa.String(254), unique=True, nullable=False, index=True),
        sa.Column("phone", sa.String(16), nullable=True),
        sa.Column("full_name", sa.String(180), nullable=True),
        sa.Column("password_hash", sa.String(256), nullable=True),
        sa.Column("salt", sa.String(128), nullable=True),
        sa.Column("role", sa.String(64), server_default="TRANSACTIONAL_USER", nullable=False, index=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("is_mfa_enabled", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("mfa_secret", sa.String(128), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 4. User session
    op.create_table(
        "user_session",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(64), sa.ForeignKey("user_account.id"), nullable=False, index=True),
        sa.Column("tenant_id", sa.String(64), sa.ForeignKey("tenant.id"), nullable=True, index=True),
        sa.Column("session_token_hash", sa.String(128), unique=True, nullable=False, index=True),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("user_agent", sa.String(256), nullable=True),
        sa.Column("is_revoked", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 5. Role table
    op.create_table(
        "role",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("name", sa.String(64), unique=True, nullable=False, index=True),
        sa.Column("display_name", sa.String(128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("governance_level", sa.String(32), server_default="TENANT", nullable=False),
        sa.Column("hierarchy_tier", sa.Integer(), server_default="6", nullable=False),
        sa.Column("is_system_role", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 6. Permission table
    op.create_table(
        "permission",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("code", sa.String(64), unique=True, nullable=False, index=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("module", sa.String(64), nullable=False, index=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 7. Role Permission mapping
    op.create_table(
        "role_permission",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("role_id", sa.String(64), sa.ForeignKey("role.id"), nullable=False, index=True),
        sa.Column("permission_id", sa.String(64), sa.ForeignKey("permission.id"), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),
    )

    # 8. User Role mapping
    op.create_table(
        "user_role",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(64), sa.ForeignKey("user_account.id"), nullable=False, index=True),
        sa.Column("role_id", sa.String(64), sa.ForeignKey("role.id"), nullable=False, index=True),
        sa.Column("tenant_id", sa.String(64), sa.ForeignKey("tenant.id"), nullable=True, index=True),
        sa.Column("is_primary", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("assigned_by", sa.String(128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "role_id", name="uq_user_role"),
    )

    # 9. User Role Assignment History
    op.create_table(
        "user_role_assignment",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), sa.ForeignKey("tenant.id"), nullable=True, index=True),
        sa.Column("target_user_id", sa.String(64), sa.ForeignKey("user_account.id"), nullable=False, index=True),
        sa.Column("action", sa.String(32), nullable=False),
        sa.Column("role_name", sa.String(64), nullable=False),
        sa.Column("assigned_by_user_id", sa.String(64), sa.ForeignKey("user_account.id"), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 10. Telemetry log
    op.create_table(
        "telemetry_log",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("trace_id", sa.String(64), nullable=False, index=True),
        sa.Column("tenant_id", sa.String(64), sa.ForeignKey("tenant.id"), nullable=True, index=True),
        sa.Column("user_id", sa.String(64), nullable=True, index=True),
        sa.Column("username", sa.String(128), nullable=True),
        sa.Column("user_role", sa.String(64), nullable=True),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("user_agent", sa.String(256), nullable=True),
        sa.Column("endpoint", sa.String(256), nullable=False, index=True),
        sa.Column("method", sa.String(16), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("latency_ms", sa.Float(), nullable=False),
        sa.Column("sla_threshold_ms", sa.Float(), nullable=False),
        sa.Column("sla_breach", sa.Boolean(), server_default=sa.false(), nullable=False, index=True),
        sa.Column("action", sa.String(64), nullable=True),
        sa.Column("resource_type", sa.String(64), nullable=True),
        sa.Column("resource_id", sa.String(64), nullable=True),
        sa.Column("payload_hash", sa.String(64), nullable=True),
        sa.Column("behavior_summary", sa.Text(), nullable=True),
        sa.Column("telemetry_document", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 11. SLA Alert
    op.create_table(
        "sla_alert",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("trace_id", sa.String(64), nullable=False, index=True),
        sa.Column("tenant_id", sa.String(64), sa.ForeignKey("tenant.id"), nullable=True, index=True),
        sa.Column("endpoint", sa.String(256), nullable=False),
        sa.Column("method", sa.String(16), nullable=False),
        sa.Column("latency_ms", sa.Float(), nullable=False),
        sa.Column("threshold_ms", sa.Float(), server_default="400.0", nullable=False),
        sa.Column("status", sa.String(32), server_default="NEW", nullable=False),
        sa.Column("notified_super_admin", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("alert_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 12. Pipeline lead
    op.create_table(
        "pipeline_lead",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), sa.ForeignKey("tenant.id"), nullable=False, index=True),
        sa.Column("application_id", sa.String(64), sa.ForeignKey("application.id"), nullable=True, index=True),
        sa.Column("assigned_to_user_id", sa.String(64), sa.ForeignKey("user_account.id"), nullable=True, index=True),
        sa.Column("stage", sa.String(32), server_default="LEAD_IN", nullable=False, index=True),
        sa.Column("loan_type", sa.String(32), nullable=True),
        sa.Column("requested_amount", sa.Float(), nullable=True),
        sa.Column("lead_source", sa.String(64), nullable=True),
        sa.Column("priority", sa.String(16), server_default="MEDIUM", nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("meta_document", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 13. Approval queue
    op.create_table(
        "approval_queue",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), sa.ForeignKey("tenant.id"), nullable=False, index=True),
        sa.Column("application_id", sa.String(64), sa.ForeignKey("application.id"), nullable=False, index=True),
        sa.Column("reviewer_id", sa.String(64), sa.ForeignKey("user_account.id"), nullable=True, index=True),
        sa.Column("decision", sa.String(32), server_default="PENDING", nullable=False, index=True),
        sa.Column("exception_category", sa.String(64), nullable=True),
        sa.Column("comments", sa.Text(), nullable=True),
        sa.Column("approved_amount", sa.Float(), nullable=True),
        sa.Column("conditions", sa.Text(), nullable=True),
        sa.Column("decision_document", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 14. Commission ledger
    op.create_table(
        "commission_ledger",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), sa.ForeignKey("tenant.id"), nullable=False, index=True),
        sa.Column("application_id", sa.String(64), sa.ForeignKey("application.id"), nullable=True, index=True),
        sa.Column("beneficiary_user_id", sa.String(64), sa.ForeignKey("user_account.id"), nullable=True, index=True),
        sa.Column("disbursed_loan_amount", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("commission_rate_pct", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("commission_amount", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("payout_status", sa.String(32), server_default="CALCULATED", nullable=False, index=True),
        sa.Column("approved_by", sa.String(128), nullable=True),
        sa.Column("payout_reference", sa.String(128), nullable=True),
        sa.Column("details_document", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 15. Regional branch
    op.create_table(
        "regional_branch",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), sa.ForeignKey("tenant.id"), nullable=False, index=True),
        sa.Column("region_name", sa.String(128), nullable=True, index=True),
        sa.Column("area_name", sa.String(128), nullable=True, index=True),
        sa.Column("branch_code", sa.String(64), nullable=True, index=True),
        sa.Column("branch_name", sa.String(180), nullable=True),
        sa.Column("manager_user_id", sa.String(64), sa.ForeignKey("user_account.id"), nullable=True),
        sa.Column("target_monthly_volume", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 16. Document record
    op.create_table(
        "document_record",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), sa.ForeignKey("tenant.id"), nullable=False, index=True),
        sa.Column("application_id", sa.String(64), sa.ForeignKey("application.id"), nullable=True, index=True),
        sa.Column("document_type", sa.String(32), nullable=False, index=True),
        sa.Column("filename", sa.String(256), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("sha256_hash", sa.String(64), nullable=False, index=True),
        sa.Column("extraction_status", sa.String(32), server_default="SUCCESS", nullable=False),
        sa.Column("extracted_data_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


# single concise context line
def downgrade() -> None:
    op.drop_table("document_record")
    op.drop_table("regional_branch")
    op.drop_table("commission_ledger")
    op.drop_table("approval_queue")
    op.drop_table("pipeline_lead")
    op.drop_table("sla_alert")
    op.drop_table("telemetry_log")
    op.drop_table("user_role_assignment")
    op.drop_table("user_role")
    op.drop_table("role_permission")
    op.drop_table("permission")
    op.drop_table("role")
    op.drop_table("user_session")
    op.drop_table("user_account")
    op.drop_table("tenant_status_history")

    op.drop_index("ix_tenant_status", table_name="tenant")
    op.drop_index("ix_tenant_tenant_uuid", table_name="tenant")
    op.drop_column("tenant", "contact_phone")
    op.drop_column("tenant", "contact_email")
    op.drop_column("tenant", "cibil_overlay")
    op.drop_column("tenant", "channel_type")
    op.drop_column("tenant", "status")
    op.drop_column("tenant", "tenant_uuid")
