from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

# Commission disbursement computation request
class CommissionCalculationRequest(BaseModel):
    application_id: str = Field(..., description="Target application identifier")
    disbursed_amount: float = Field(..., gt=0.0, description="Final disbursed loan amount in INR")
    bank_code: str = Field(..., description="Disbursing bank institution code")
    commission_rate_bps: int = Field(default=50, ge=0, description="Agreed commission in basis points")

# Commission payout sign-off request
class CommissionPayoutApprovalRequest(BaseModel):
    ledger_id: str = Field(..., description="Commission ledger entry ID")
    decision: str = Field(..., description="Approval status: APPROVED or REJECTED")
    approval_notes: Optional[str] = Field(None, description="Accounts head audit remarks")
    transaction_reference: Optional[str] = Field(None, description="Bank disbursement transaction reference")

# Commission ledger record response contract
class CommissionLedgerEntryResponse(BaseModel):
    id: str = Field(..., description="Commission ledger record ID")
    tenant_id: str = Field(..., description="Beneficiary channel partner tenant ID")
    application_id: str = Field(..., description="Disbursed loan application UUID")
    user_id: Optional[str] = Field(None, description="Originating sales agent or partner user ID")
    bank_code: str = Field(..., description="Disbursing lender bank code")
    disbursed_amount: float = Field(..., description="Total disbursed facility in INR")
    commission_rate_bps: int = Field(..., description="Applied commission rate in bps")
    commission_amount: float = Field(..., description="Calculated payout amount in INR")
    status: str = Field(..., description="Payout status: PENDING, APPROVED, PAID, REJECTED")
    approved_by: Optional[str] = Field(None, description="Accounts head approver user ID")
    created_at: datetime = Field(..., description="Ledger inception timestamp")

# Aggregate commission performance summary
class CommissionSummaryResponse(BaseModel):
    total_disbursed_amount: float = Field(default=0.0, description="Sum of disbursed loan volumes in INR")
    total_commission_payable: float = Field(default=0.0, description="Aggregate pending commission payable in INR")
    total_commission_paid: float = Field(default=0.0, description="Aggregate settled commission volume in INR")
    pending_payout_count: int = Field(default=0, description="Number of ledgers awaiting Accounts Head sign-off")
