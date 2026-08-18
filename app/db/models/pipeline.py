from typing import Any, Dict, Optional

from sqlalchemy import Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.db.models.application import JSONDocument


# single concise context line
class PipelineLeadModel(Base):
    __tablename__ = "pipeline_lead"

    tenant_id: Mapped[str] = mapped_column(String(64), ForeignKey("tenant.id"), nullable=False, index=True)
    application_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("application.id"), nullable=True, index=True)
    assigned_to_user_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("user_account.id"), nullable=True, index=True)
    stage: Mapped[str] = mapped_column(String(32), default="LEAD_IN", nullable=False, index=True)
    loan_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    requested_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    lead_source: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    priority: Mapped[str] = mapped_column(String(16), default="MEDIUM", nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    meta_document: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONDocument, nullable=True)


# single concise context line
class ApprovalQueueModel(Base):
    __tablename__ = "approval_queue"

    tenant_id: Mapped[str] = mapped_column(String(64), ForeignKey("tenant.id"), nullable=False, index=True)
    application_id: Mapped[str] = mapped_column(String(64), ForeignKey("application.id"), nullable=False, index=True)
    reviewer_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("user_account.id"), nullable=True, index=True)
    decision: Mapped[str] = mapped_column(String(32), default="PENDING", nullable=False, index=True)
    exception_category: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    comments: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    approved_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    conditions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    decision_document: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONDocument, nullable=True)
