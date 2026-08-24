from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

# Lead origination creation payload
class PipelineLeadCreateRequest(BaseModel):
    applicant_name: str = Field(..., min_length=1, description="Primary applicant legal name")
    contact_phone: Optional[str] = Field(None, description="Applicant contact phone number")
    contact_email: Optional[str] = Field(None, description="Applicant email address")
    loan_type: str = Field(default="Auto Loan", description="Facility type requested")
    requested_amount: float = Field(default=0.0, ge=0.0, description="Requested principal in INR")
    channel_partner_id: Optional[str] = Field(None, description="Originating channel partner tenant ID")
    assigned_user_id: Optional[str] = Field(None, description="Sales manager or agent assigned")
    territory_code: Optional[str] = Field(None, description="Regional branch territory code")

# Lead stage transition mutation request
class PipelineStageTransitionRequest(BaseModel):
    new_stage: str = Field(..., description="Target pipeline workflow stage")
    reason: Optional[str] = Field(None, description="Justification for stage transition")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Contextual payload metadata")

# Lead assignment update payload
class PipelineLeadAssignmentRequest(BaseModel):
    assigned_user_id: str = Field(..., description="Target user ID to assign lead")
    assignment_notes: Optional[str] = Field(None, description="Administrative assignment remarks")

# Pipeline lead detailed response contract
class PipelineLeadResponse(BaseModel):
    id: str = Field(..., description="Lead unique identifier")
    tenant_id: str = Field(..., description="Scoped channel tenant identifier")
    applicant_name: str = Field(..., description="Applicant legal name")
    contact_phone: Optional[str] = Field(None, description="Contact phone")
    contact_email: Optional[str] = Field(None, description="Contact email")
    loan_type: str = Field(..., description="Facility type")
    requested_amount: float = Field(default=0.0, description="Requested loan amount in INR")
    current_stage: str = Field(..., description="Current pipeline lifecycle stage")
    assigned_user_id: Optional[str] = Field(None, description="Assigned owner user ID")
    territory_code: Optional[str] = Field(None, description="Regional branch code")
    application_id: Optional[str] = Field(None, description="Linked onboarding application UUID")
    created_at: datetime = Field(..., description="Origination timestamp")
    updated_at: datetime = Field(..., description="Last modification timestamp")

# Pipeline aggregate stage metrics response
class PipelineSummaryResponse(BaseModel):
    total_leads: int = Field(default=0, description="Total leads across all stages")
    stage_breakdown: Dict[str, int] = Field(default_factory=dict, description="Count of leads per stage")
    total_pipeline_value: float = Field(default=0.0, description="Sum of requested loan amounts in INR")
