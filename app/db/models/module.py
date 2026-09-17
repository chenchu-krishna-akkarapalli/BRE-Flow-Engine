from typing import Optional
from sqlalchemy import Boolean, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base

# Database model representing the platform module catalog
class ModuleCatalogModel(Base):
    __tablename__ = "module_catalog"

    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    route_template: Mapped[str] = mapped_column(String(256), nullable=False)
    icon_name: Mapped[str] = mapped_column(String(64), nullable=False)
    section_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    section_title: Mapped[str] = mapped_column(String(128), nullable=False)
    badge: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    badge_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    min_tier_level: Mapped[int] = mapped_column(Integer, default=6, nullable=False)
    is_core: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

# Database model tracking tenant-specific activation of modules
class TenantModuleEntitlementModel(Base):
    __tablename__ = "tenant_module_entitlement"
    __table_args__ = (UniqueConstraint("tenant_id", "module_code", name="uq_tenant_module"),)

    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    module_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    custom_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

# Database model mapping role keys to granular module capabilities
class RoleModulePermissionModel(Base):
    __tablename__ = "role_module_permission"
    __table_args__ = (UniqueConstraint("role_key", "module_code", name="uq_role_module_permission"),)

    role_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    module_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    can_view: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    can_create: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_edit: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_approve: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
