from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_tenant, get_current_user
from app.api.schemas.pipeline import (
    PipelineLeadAssignmentRequest,
    PipelineLeadCreateRequest,
    PipelineLeadResponse,
    PipelineStageTransitionRequest,
    PipelineSummaryResponse,
)

# Router for sales pipeline and lead workflow tracking
router = APIRouter()

# Originates new applicant lead in the sales pipeline
@router.post("/leads", response_model=PipelineLeadResponse, status_code=status.HTTP_201_CREATED)
async def create_pipeline_lead(
    payload: PipelineLeadCreateRequest,
    tenant_id: str = Depends(get_current_tenant),
    current_user: dict = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    return PipelineLeadResponse(
        id="lead-sample-1234",
        tenant_id=tenant_id,
        applicant_name=payload.applicant_name,
        contact_phone=payload.contact_phone,
        contact_email=payload.contact_email,
        loan_type=payload.loan_type,
        requested_amount=payload.requested_amount,
        current_stage="DRAFT",
        assigned_user_id=payload.assigned_user_id,
        territory_code=payload.territory_code,
        created_at=now,
        updated_at=now,
    )

# Retrieves paginated list of leads for tenant
@router.get("/leads", response_model=List[PipelineLeadResponse])
async def list_pipeline_leads(
    stage: Optional[str] = Query(None),
    limit: int = Query(default=50, le=200),
    tenant_id: str = Depends(get_current_tenant),
    current_user: dict = Depends(get_current_user),
):
    return []

# Returns aggregate pipeline volume summary
@router.get("/summary", response_model=PipelineSummaryResponse)
async def get_pipeline_summary(
    tenant_id: str = Depends(get_current_tenant),
    current_user: dict = Depends(get_current_user),
):
    return PipelineSummaryResponse(total_leads=0, stage_breakdown={}, total_pipeline_value=0.0)
