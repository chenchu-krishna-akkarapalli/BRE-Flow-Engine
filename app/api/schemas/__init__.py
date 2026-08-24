# Clean schema exports for presentation and gateway serialization
from app.api.schemas.common import APIResponse, ErrorDetail
from app.api.schemas.auth import (
    AuthTokenResponse,
    ChallengeRequest,
    ChallengeResponse,
    TokenRefreshRequest,
    UserSessionInfo,
    VerifyChallengeRequest,
)
from app.api.schemas.documents import (
    CibilExtractionResponse,
    CoiExtractionResponse,
    DocumentExtractionResponse,
    OcrExtractionResponse,
    PayslipExtractionResponse,
)
from app.api.schemas.onboarding import (
    CreditBureauPayload,
    OnboardingEvaluationRequest,
    OnboardingEvaluationResponse,
    RejectionReasonDetail,
)
from app.api.schemas.pipeline import (
    PipelineLeadAssignmentRequest,
    PipelineLeadCreateRequest,
    PipelineLeadResponse,
    PipelineStageTransitionRequest,
    PipelineSummaryResponse,
)
from app.api.schemas.approvals import (
    ApprovalDecisionRequest,
    ApprovalQueueItemResponse,
    ExceptionWaiverRequest,
)
from app.api.schemas.commissions import (
    CommissionCalculationRequest,
    CommissionLedgerEntryResponse,
    CommissionPayoutApprovalRequest,
    CommissionSummaryResponse,
)
from app.api.schemas.regional import (
    RegionalBranchCreateRequest,
    RegionalBranchResponse,
    RegionalBranchUpdateRequest,
    RegionalPerformanceSummaryResponse,
)
from app.api.schemas.telemetry import (
    SlaAlertResponse,
    SlaMetricsSummaryResponse,
    TelemetryLogResponse,
    TelemetrySearchRequest,
)

__all__ = [
    "APIResponse",
    "ErrorDetail",
    "ChallengeRequest",
    "ChallengeResponse",
    "VerifyChallengeRequest",
    "AuthTokenResponse",
    "TokenRefreshRequest",
    "UserSessionInfo",
    "DocumentExtractionResponse",
    "CibilExtractionResponse",
    "PayslipExtractionResponse",
    "CoiExtractionResponse",
    "OcrExtractionResponse",
    "CreditBureauPayload",
    "OnboardingEvaluationRequest",
    "OnboardingEvaluationResponse",
    "RejectionReasonDetail",
    "PipelineLeadCreateRequest",
    "PipelineStageTransitionRequest",
    "PipelineLeadAssignmentRequest",
    "PipelineLeadResponse",
    "PipelineSummaryResponse",
    "ApprovalDecisionRequest",
    "ExceptionWaiverRequest",
    "ApprovalQueueItemResponse",
    "CommissionCalculationRequest",
    "CommissionPayoutApprovalRequest",
    "CommissionLedgerEntryResponse",
    "CommissionSummaryResponse",
    "RegionalBranchCreateRequest",
    "RegionalBranchUpdateRequest",
    "RegionalBranchResponse",
    "RegionalPerformanceSummaryResponse",
    "TelemetrySearchRequest",
    "TelemetryLogResponse",
    "SlaAlertResponse",
    "SlaMetricsSummaryResponse",
]
