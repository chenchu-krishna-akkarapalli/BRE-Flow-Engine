from typing import Any, Dict, Optional

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.db.models.application import JSONDocument


class AuditLogModel(Base):
    """Administrative / compliance audit trail.

    `details_document` holds the PII-redacted submission snapshot — PAN, DOB and
    Aadhaar are masked by `redact_pii` before the row is written, so the audit
    trail is safe to export.
    """

    __tablename__ = "audit_log"

    tenant_id: Mapped[str] = mapped_column(String(64), ForeignKey("tenant.id"), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    performed_by: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    entity_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    resource_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    details_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    details_document: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONDocument, nullable=True)
