from typing import Any, Dict, Optional

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.db.models.application import JSONDocument


# single concise context line
class TelemetryLogModel(Base):
    __tablename__ = "telemetry_log"

    trace_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("tenant.id"), nullable=True, index=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    username: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    user_role: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    endpoint: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    method: Mapped[str] = mapped_column(String(16), nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, nullable=False)
    latency_ms: Mapped[float] = mapped_column(Float, nullable=False)
    sla_threshold_ms: Mapped[float] = mapped_column(Float, nullable=False)
    sla_breach: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    action: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    resource_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    resource_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    payload_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    behavior_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    telemetry_document: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONDocument, nullable=True)


# single concise context line
class SlaAlertModel(Base):
    __tablename__ = "sla_alert"

    trace_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("tenant.id"), nullable=True, index=True)
    endpoint: Mapped[str] = mapped_column(String(256), nullable=False)
    method: Mapped[str] = mapped_column(String(16), nullable=False)
    latency_ms: Mapped[float] = mapped_column(Float, nullable=False)
    threshold_ms: Mapped[float] = mapped_column(Float, default=400.0, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="NEW", nullable=False)
    notified_super_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    alert_payload: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONDocument, nullable=True)
