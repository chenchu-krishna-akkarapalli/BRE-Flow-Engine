from app.db.models.tenant import TenantModel, TenantStatusHistoryModel
from app.db.models.application import ApplicationModel
from app.db.models.rule_execution import RuleExecutionModel
from app.db.models.audit_log import AuditLogModel
from app.db.models.user import UserModel, UserSessionModel
from app.db.models.role import (
    RoleModel,
    PermissionModel,
    RolePermissionModel,
    UserRoleModel,
    UserRoleAssignmentHistoryModel,
    NavigationNodeModel,
)
from app.db.models.telemetry import TelemetryLogModel, SlaAlertModel
from app.db.models.pipeline import PipelineLeadModel, ApprovalQueueModel
from app.db.models.commission import CommissionLedgerModel
from app.db.models.regional import RegionalBranchModel
from app.db.models.document_record import DocumentRecordModel

# Exports all database entity models for metadata registration
__all__ = [
    "TenantModel",
    "TenantStatusHistoryModel",
    "ApplicationModel",
    "RuleExecutionModel",
    "AuditLogModel",
    "UserModel",
    "UserSessionModel",
    "RoleModel",
    "PermissionModel",
    "RolePermissionModel",
    "UserRoleModel",
    "UserRoleAssignmentHistoryModel",
    "NavigationNodeModel",
    "TelemetryLogModel",
    "SlaAlertModel",
    "PipelineLeadModel",
    "ApprovalQueueModel",
    "CommissionLedgerModel",
    "RegionalBranchModel",
    "DocumentRecordModel",
]
