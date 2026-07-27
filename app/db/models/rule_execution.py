from typing import Any, Dict, Optional

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.db.models.application import JSONDocument


class RuleExecutionModel(Base):
    """Per-evaluation audit record: which matrix the verdict came from, what it
    decided, and how long it took. One row per evaluated application."""

    __tablename__ = "rule_execution"

    application_id: Mapped[str] = mapped_column(String(64), ForeignKey("application.id"), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String(64), ForeignKey("tenant.id"), nullable=False, index=True)
    bank_code: Mapped[str] = mapped_column(String(32), nullable=False)
    eligible: Mapped[bool] = mapped_column(Boolean, nullable=False)
    rejection_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    executed_rules_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    execution_time_ms: Mapped[float] = mapped_column(Float, nullable=False)
    rejection_reasons_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Full 8-bank verdict map, so a rejected applicant's alternatives are
    # reconstructable from the audit trail without re-running the engine.
    bank_eligibility_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONDocument, nullable=True)
