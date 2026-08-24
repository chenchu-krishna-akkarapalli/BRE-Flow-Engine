from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

# Regional sales branch provisioning payload
class RegionalBranchCreateRequest(BaseModel):
    branch_code: str = Field(..., min_length=2, max_length=32, description="Unique regional branch code")
    name: str = Field(..., min_length=2, max_length=128, description="Branch territory or city name")
    region: str = Field(..., description="Geographic zone: NORTH, SOUTH, EAST, WEST, CENTRAL")
    state: str = Field(..., description="Operating state jurisdiction")
    area_manager_id: Optional[str] = Field(None, description="Assigned Area Manager user UUID")
    monthly_target_amount: float = Field(default=0.0, ge=0.0, description="Monthly loan disbursement quota in INR")

# Regional branch target and territory update payload
class RegionalBranchUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, description="Updated branch label")
    area_manager_id: Optional[str] = Field(None, description="Reassigned Area Manager user UUID")
    monthly_target_amount: Optional[float] = Field(None, ge=0.0, description="Updated disbursement target")
    is_active: Optional[bool] = Field(None, description="Branch operational status")

# Regional branch details response contract
class RegionalBranchResponse(BaseModel):
    id: str = Field(..., description="Branch record identifier")
    tenant_id: Optional[str] = Field(None, description="Bound channel partner tenant ID")
    branch_code: str = Field(..., description="Unique alphanumeric branch identifier")
    name: str = Field(..., description="Branch name")
    region: str = Field(..., description="Geographic macro region")
    state: str = Field(..., description="Operating state")
    area_manager_id: Optional[str] = Field(None, description="Assigned Area Manager user UUID")
    monthly_target_amount: float = Field(default=0.0, description="Monthly disbursement target in INR")
    is_active: bool = Field(default=True, description="Active status flag")
    created_at: datetime = Field(..., description="Branch setup timestamp")

# Regional hierarchy performance summary
class RegionalPerformanceSummaryResponse(BaseModel):
    region: str = Field(..., description="Geographical territory")
    branch_count: int = Field(default=0, description="Active branches in territory")
    total_target_amount: float = Field(default=0.0, description="Sum of regional monthly targets in INR")
    achieved_disbursement_amount: float = Field(default=0.0, description="Current achieved volume in INR")
    target_achievement_percentage: float = Field(default=0.0, description="Percentage quota attainment")
