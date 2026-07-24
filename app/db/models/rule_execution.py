from typing import Optional
from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class RuleExecutionModel(Base):
    __tablename__ = "rule_execution"

    application_id: Mapped[str] = mapped_column(String(64), ForeignKey("application.id"), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String(64), ForeignKey("tenant.id"), nullable=False, index=True)
    bank_code: Mapped[str] = mapped_column(String(32), nullable=False)
    eligible: Mapped[bool] = mapped_column(Boolean, nullable=False)
    rejection_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    execution_time_ms: Mapped[float] = mapped_column(Float, nullable=False)
    rejection_reasons_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
