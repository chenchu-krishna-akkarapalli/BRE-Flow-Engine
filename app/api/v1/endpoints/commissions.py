from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_tenant, get_current_user, require_roles
from app.api.schemas.commissions import (
    CommissionCalculationRequest,
    CommissionLedgerEntryResponse,
    CommissionPayoutApprovalRequest,
    CommissionSummaryResponse,
)

# Router for partner commissions and disbursement accounting
router = APIRouter()

# Computes partner commission based on disbursed volume
@router.post("/calculate", response_model=CommissionLedgerEntryResponse)
async def calculate_commission(
    payload: CommissionCalculationRequest,
    tenant_id: str = Depends(get_current_tenant),
    current_user: dict = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    payout = payload.disbursed_amount * (payload.commission_rate_bps / 10000.0)
    return CommissionLedgerEntryResponse(
        id="com-sample-1234",
        tenant_id=tenant_id,
        application_id=payload.application_id,
        bank_code=payload.bank_code,
        disbursed_amount=payload.disbursed_amount,
        commission_rate_bps=payload.commission_rate_bps,
        commission_amount=payout,
        status="PENDING",
        created_at=now,
    )

# Lists commission ledger entries for tenant
@router.get("/ledgers", response_model=List[CommissionLedgerEntryResponse])
async def list_commission_ledgers(
    status_filter: Optional[str] = Query(None),
    tenant_id: str = Depends(get_current_tenant),
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "ACCOUNTS_HEAD", "CHANNEL_ADMIN")),
):
    return []

# Authorizes commission disbursement payout
@router.post("/ledgers/{ledger_id}/approve")
async def approve_commission_payout(
    ledger_id: str,
    payload: CommissionPayoutApprovalRequest,
    tenant_id: str = Depends(get_current_tenant),
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "ACCOUNTS_HEAD")),
):
    return {"ledger_id": ledger_id, "status": payload.decision}

# Returns financial ledger volume totals
@router.get("/summary", response_model=CommissionSummaryResponse)
async def get_commission_summary(
    tenant_id: str = Depends(get_current_tenant),
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "ACCOUNTS_HEAD", "CHANNEL_ADMIN")),
):
    return CommissionSummaryResponse(
        total_disbursed_amount=0.0,
        total_commission_payable=0.0,
        total_commission_paid=0.0,
        pending_payout_count=0,
    )
