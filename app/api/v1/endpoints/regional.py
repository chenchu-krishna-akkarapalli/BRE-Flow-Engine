from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_tenant, get_current_user, require_roles
from app.api.schemas.regional import (
    RegionalBranchCreateRequest,
    RegionalBranchResponse,
    RegionalBranchUpdateRequest,
    RegionalPerformanceSummaryResponse,
)

# Router for regional hierarchy and sales territory administration
router = APIRouter()

# Provisions new regional sales branch
@router.post("/branches", response_model=RegionalBranchResponse, status_code=status.HTTP_201_CREATED)
async def create_regional_branch(
    payload: RegionalBranchCreateRequest,
    tenant_id: str = Depends(get_current_tenant),
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "REGIONAL_DIRECTOR")),
):
    now = datetime.now(timezone.utc)
    return RegionalBranchResponse(
        id="brn-sample-1234",
        tenant_id=tenant_id,
        branch_code=payload.branch_code,
        name=payload.name,
        region=payload.region,
        state=payload.state,
        area_manager_id=payload.area_manager_id,
        monthly_target_amount=payload.monthly_target_amount,
        is_active=True,
        created_at=now,
    )

# Lists all registered branches in the region
@router.get("/branches", response_model=List[RegionalBranchResponse])
async def list_regional_branches(
    region: Optional[str] = Query(None),
    tenant_id: str = Depends(get_current_tenant),
    current_user: dict = Depends(get_current_user),
):
    return []

# Returns aggregate regional quota attainment metrics
@router.get("/summary", response_model=List[RegionalPerformanceSummaryResponse])
async def get_regional_summary(
    tenant_id: str = Depends(get_current_tenant),
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "REGIONAL_DIRECTOR", "AREA_MANAGER")),
):
    return []
