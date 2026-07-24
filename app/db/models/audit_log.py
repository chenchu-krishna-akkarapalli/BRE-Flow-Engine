from typing import Optional
from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class AuditLogModel(Base):
    __tablename__ = "audit_log"

    tenant_id: Mapped[str] = mapped_column(String(64), ForeignKey("tenant.id"), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    performed_by: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    details_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
