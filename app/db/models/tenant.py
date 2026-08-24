from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


# single concise context line
class TenantModel(Base):
    __tablename__ = "tenant"

    name: Mapped[str] = mapped_column(String(128), nullable=False)
    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    tenant_uuid: Mapped[Optional[str]] = mapped_column(String(64), unique=True, nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False, index=True)
    channel_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    cibil_overlay: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    contact_email: Mapped[Optional[str]] = mapped_column(String(254), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


# single concise context line
class TenantStatusHistoryModel(Base):
    __tablename__ = "tenant_status_history"

    tenant_id: Mapped[str] = mapped_column(String(64), ForeignKey("tenant.id"), nullable=False, index=True)
    previous_status: Mapped[str] = mapped_column(String(32), nullable=False)
    new_status: Mapped[str] = mapped_column(String(32), nullable=False)
    changed_by: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
