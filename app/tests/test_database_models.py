from datetime import datetime, timezone
import pytest

from app.db.base_class import Base
from app.db.models import (
    ApplicationModel,
    ApprovalQueueModel,
    AuditLogModel,
    CommissionLedgerModel,
    DocumentRecordModel,
    NavigationNodeModel,
    PermissionModel,
    PipelineLeadModel,
    RegionalBranchModel,
    RoleModel,
    RolePermissionModel,
    RuleExecutionModel,
    SlaAlertModel,
    TelemetryLogModel,
    TenantModel,
    TenantStatusHistoryModel,
    UserModel,
    UserRoleAssignmentHistoryModel,
    UserRoleModel,
    UserSessionModel,
)

# Verifies that all enterprise domain models are registered with SQLAlchemy metadata
def test_all_enterprise_models_registered_in_metadata():
    table_names = set(Base.metadata.tables.keys())
    expected_tables = {
        "tenant",
        "tenant_status_history",
        "user_account",
        "user_session",
        "role",
        "permission",
        "role_permission",
        "user_role",
        "user_role_assignment",
        "navigation_node",
        "application",
        "rule_execution",
        "audit_log",
        "telemetry_log",
        "sla_alert",
        "pipeline_lead",
        "approval_queue",
        "commission_ledger",
        "regional_branch",
        "document_record",
    }
    assert expected_tables.issubset(table_names), f"Missing tables: {expected_tables - table_names}"

# Verifies tenant model instantiation
def test_tenant_model_instantiation():
    tenant = TenantModel(
        name="Bank of India North DSA",
        code="tenant-boi-north",
        tenant_uuid="boi-uuid-101",
        status="active",
        channel_type="DSA",
        cibil_overlay=10,
        contact_email="ops@boi-dsa.in",
        contact_phone="9876543210",
        is_active=True,
    )
    assert tenant.name == "Bank of India North DSA"
    assert tenant.status == "active"
    assert tenant.cibil_overlay == 10

# Verifies tenant status history model
def test_tenant_status_history_instantiation():
    history = TenantStatusHistoryModel(
        tenant_id="tenant-123",
        previous_status="pending",
        new_status="approved",
        changed_by="super_admin_01",
        reason="KYC documents verified successfully",
    )
    assert history.tenant_id == "tenant-123"
    assert history.new_status == "approved"

# Verifies user and session model instantiation
def test_user_and_session_instantiation():
    user = UserModel(
        tenant_id="tenant-123",
        username="rajesh.sharma@finsol.in",
        email="rajesh.sharma@finsol.in",
        role="SALES_MANAGER",
        is_active=True,
        is_mfa_enabled=True,
    )
    assert user.role == "SALES_MANAGER"
    assert user.is_mfa_enabled is True

    session = UserSessionModel(
        user_id="user-123",
        tenant_id="tenant-123",
        session_token_hash="hash-abc-123",
        ip_address="103.21.124.5",
        user_agent="Mozilla/5.0",
        is_revoked=False,
        expires_at=datetime.now(timezone.utc),
    )
    assert session.user_id == "user-123"
    assert session.is_revoked is False

# Verifies role, permissions, and navigation node instantiation
def test_role_and_rbac_instantiation():
    role = RoleModel(
        name="OPERATIONS_HEAD",
        display_name="Operations Head",
        governance_level="PLATFORM",
        hierarchy_tier=2,
        is_system_role=True,
        navigation_schema={"sections": []},
    )
    assert role.name == "OPERATIONS_HEAD"
    assert role.governance_level == "PLATFORM"
    assert role.navigation_schema == {"sections": []}

    nav_node = NavigationNodeModel(
        role_name="CHANNEL_ADMIN",
        section_title="Portal Navigation",
        item_name="Dashboard",
        path="dashboard",
        icon="LayoutDashboard",
        sort_order=1,
    )
    assert nav_node.role_name == "CHANNEL_ADMIN"
    assert nav_node.icon == "LayoutDashboard"

    perm = PermissionModel(
        code="applications:evaluate",
        name="Evaluate Applications",
        module="ONBOARDING",
        description="Permission to invoke the BRE evaluation endpoint",
    )
    assert perm.code == "applications:evaluate"

    role_perm = RolePermissionModel(
        role_id="role-123",
        permission_id="perm-123",
    )
    assert role_perm.role_id == "role-123"

    user_role = UserRoleModel(
        user_id="user-123",
        role_id="role-123",
        tenant_id="tenant-123",
        is_primary=True,
        assigned_by="super_admin_01",
    )
    assert user_role.is_primary is True

    assignment = UserRoleAssignmentHistoryModel(
        tenant_id="tenant-123",
        target_user_id="user-123",
        action="ASSIGNED",
        role_name="OPERATIONS_HEAD",
        assigned_by_user_id="user-super-1",
        reason="Promoted to Operations Head",
    )
    assert assignment.action == "ASSIGNED"

# Verifies telemetry and SLA alert model instantiation
def test_telemetry_and_sla_alert_instantiation():
    telemetry = TelemetryLogModel(
        trace_id="req-98f1c8b3",
        tenant_id="tenant-123",
        endpoint="/api/v1/onboarding/evaluate/form",
        method="POST",
        status_code=200,
        latency_ms=78.4,
        sla_threshold_ms=80.0,
        sla_breach=False,
        action="EVALUATE_APPLICATION",
        telemetry_document={"test_key": "val"},
    )
    assert telemetry.latency_ms == 78.4
    assert telemetry.sla_breach is False

    alert = SlaAlertModel(
        trace_id="req-slow-123",
        tenant_id="tenant-123",
        endpoint="/api/v1/onboarding/evaluate/form",
        method="POST",
        latency_ms=450.2,
        threshold_ms=400.0,
        status="NEW",
        notified_super_admin=True,
    )
    assert alert.latency_ms == 450.2
    assert alert.notified_super_admin is True

# Verifies pipeline and underwriting approval queue models
def test_pipeline_and_approval_instantiation():
    lead = PipelineLeadModel(
        tenant_id="tenant-123",
        application_id="app-123",
        assigned_to_user_id="usr-123",
        stage="UNDERWRITING",
        loan_type="Auto Loan",
        requested_amount=1500000.0,
        priority="HIGH",
    )
    assert lead.stage == "UNDERWRITING"
    assert lead.priority == "HIGH"

    approval = ApprovalQueueModel(
        tenant_id="tenant-123",
        application_id="app-123",
        reviewer_id="usr-ops-1",
        decision="CONDITIONAL_APPROVAL",
        exception_category="FOIR_OVERRIDE",
        comments="Approved with additional co-applicant guarantee",
        approved_amount=1400000.0,
    )
    assert approval.decision == "CONDITIONAL_APPROVAL"
    assert approval.approved_amount == 1400000.0

# Verifies commission ledger, regional hierarchy, and document records
def test_commission_regional_document_instantiation():
    commission = CommissionLedgerModel(
        tenant_id="tenant-123",
        application_id="app-123",
        beneficiary_user_id="usr-agent-1",
        disbursed_loan_amount=1000000.0,
        commission_rate_pct=1.5,
        commission_amount=15000.0,
        payout_status="CALCULATED",
    )
    assert commission.commission_amount == 15000.0

    branch = RegionalBranchModel(
        tenant_id="tenant-123",
        region_name="North",
        area_name="Delhi NCR",
        branch_code="BR-DEL-01",
        branch_name="Delhi Connaught Place Branch",
        target_monthly_volume=50000000.0,
        is_active=True,
    )
    assert branch.branch_code == "BR-DEL-01"

    doc = DocumentRecordModel(
        tenant_id="tenant-123",
        application_id="app-123",
        document_type="cibil",
        filename="cibil_report_01.pdf",
        file_size_bytes=1048576,
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        extraction_status="SUCCESS",
        extracted_data_json={"cibil_score": 750},
    )
    assert doc.document_type == "cibil"
    assert doc.sha256_hash.startswith("e3b0c44")
