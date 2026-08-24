from typing import Any, Dict, Optional

from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.db.models.application import JSONDocument


# single concise context line
class CommissionLedgerModel(Base):
    __tablename__ = "commission_ledger"

    tenant_id: Mapped[str] = mapped_column(String(64), ForeignKey("tenant.id"), nullable=False, index=True)
    application_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("application.id"), nullable=True, index=True)
    beneficiary_user_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("user_account.id"), nullable=True, index=True)
    disbursed_loan_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    commission_rate_pct: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    commission_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    payout_status: Mapped[str] = mapped_column(String(32), default="CALCULATED", nullable=False, index=True)
    approved_by: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    payout_reference: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    details_document: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONDocument, nullable=True)
