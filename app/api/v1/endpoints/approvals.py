from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_tenant, get_current_user, require_roles
from app.api.schemas.approvals import (
    ApprovalDecisionRequest,
    ApprovalQueueItemResponse,
    ExceptionWaiverRequest,
)

# Router for credit underwriting and policy exception review
router = APIRouter()

# Retrieves pending underwriting approval queue items
@router.get("/queue", response_model=List[ApprovalQueueItemResponse])
async def get_approval_queue(
    status_filter: Optional[str] = Query(default="PENDING_REVIEW"),
    tenant_id: str = Depends(get_current_tenant),
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "REGIONAL_DIRECTOR", "OPERATIONS_HEAD")),
):
    return []

# Records credit underwriter sign-off decision
@router.post("/queue/{queue_id}/decision")
async def record_underwriting_decision(
    queue_id: str,
    payload: ApprovalDecisionRequest,
    tenant_id: str = Depends(get_current_tenant),
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "REGIONAL_DIRECTOR", "OPERATIONS_HEAD")),
):
    return {"queue_id": queue_id, "decision": payload.decision, "status": "RECORDED"}

# Submits policy rule exception waiver for approval
@router.post("/queue/{queue_id}/waiver")
async def request_policy_waiver(
    queue_id: str,
    payload: ExceptionWaiverRequest,
    tenant_id: str = Depends(get_current_tenant),
    current_user: dict = Depends(get_current_user),
):
    return {"queue_id": queue_id, "rule_id": payload.rule_id, "waiver_status": "SUBMITTED"}
