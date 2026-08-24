from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

# Underwriting decision sign-off payload
class ApprovalDecisionRequest(BaseModel):
    decision: str = Field(..., description="Verdict: APPROVED, REJECTED, or CONDITIONAL")
    notes: Optional[str] = Field(None, description="Underwriter rationale notes")
    sanctioned_amount: Optional[float] = Field(None, ge=0.0, description="Approved loan sanction amount")
    interest_rate: Optional[float] = Field(None, ge=0.0, description="Approved annual interest rate percentage")
    stipulations: List[str] = Field(default_factory=list, description="Mandatory pre-disbursement conditions")

# Policy exception waiver submission payload
class ExceptionWaiverRequest(BaseModel):
    rule_id: str = Field(..., description="Policy rule ID being waived (e.g. BUR-402, DEM-102)")
    waiver_reason: str = Field(..., min_length=5, description="Underwriting business justification")
    mitigating_factors: List[str] = Field(default_factory=list, description="Compensating risk factors")
    approver_role: str = Field(default="OPERATIONS_HEAD", description="Required authority tier for approval")

# Underwriting queue item detail response
class ApprovalQueueItemResponse(BaseModel):
    id: str = Field(..., description="Approval queue record identifier")
    tenant_id: str = Field(..., description="Scoped tenant identifier")
    application_id: str = Field(..., description="Associated application identifier")
    applicant_name: str = Field(..., description="Legal name of applicant")
    bank_code: str = Field(..., description="Target bank code")
    requested_amount: float = Field(default=0.0, description="Requested principal amount in INR")
    bre_verdict: str = Field(..., description="Automated BRE recommendation verdict")
    status: str = Field(..., description="Queue status: PENDING_REVIEW, APPROVED, REJECTED")
    assigned_reviewer_id: Optional[str] = Field(None, description="Assigned underwriter user ID")
    rejection_reasons: List[str] = Field(default_factory=list, description="Violated rule descriptions")
    created_at: datetime = Field(..., description="Queue entry creation timestamp")
