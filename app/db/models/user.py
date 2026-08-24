from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


# single concise context line
class UserModel(Base):
    __tablename__ = "user_account"

    tenant_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("tenant.id"), nullable=True, index=True)
    username: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, nullable=False, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    full_name: Mapped[Optional[str]] = mapped_column(String(180), nullable=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    salt: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    role: Mapped[str] = mapped_column(String(64), default="TRANSACTIONAL_USER", nullable=False, index=True)
    token_version: Mapped[int] = mapped_column(default=1, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    mfa_secret: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


# single concise context line
class UserSessionModel(Base):
    __tablename__ = "user_session"

    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("user_account.id"), nullable=False, index=True)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("tenant.id"), nullable=True, index=True)
    session_token_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
