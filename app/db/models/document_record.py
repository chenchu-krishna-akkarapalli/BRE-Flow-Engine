from typing import Any, Dict, Optional

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.db.models.application import JSONDocument


# single concise context line
class DocumentRecordModel(Base):
    __tablename__ = "document_record"

    tenant_id: Mapped[str] = mapped_column(String(64), ForeignKey("tenant.id"), nullable=False, index=True)
    application_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("application.id"), nullable=True, index=True)
    document_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    filename: Mapped[str] = mapped_column(String(256), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    extraction_status: Mapped[str] = mapped_column(String(32), default="SUCCESS", nullable=False)
    extracted_data_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONDocument, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
