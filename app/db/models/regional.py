from typing import Optional

from sqlalchemy import Boolean, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


# single concise context line
class RegionalBranchModel(Base):
    __tablename__ = "regional_branch"

    tenant_id: Mapped[str] = mapped_column(String(64), ForeignKey("tenant.id"), nullable=False, index=True)
    region_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    area_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    branch_code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    branch_name: Mapped[Optional[str]] = mapped_column(String(180), nullable=True)
    manager_user_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("user_account.id"), nullable=True)
    target_monthly_volume: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
