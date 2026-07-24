from typing import Optional
from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class ApplicationModel(Base):
    __tablename__ = "application"

    tenant_id: Mapped[str] = mapped_column(String(64), ForeignKey("tenant.id"), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False)
    applicant_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    selected_bank: Mapped[str] = mapped_column(String(32), nullable=False)
    cibil_score: Mapped[int] = mapped_column(Integer, nullable=False)
    dpd_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    write_off_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    payload_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
