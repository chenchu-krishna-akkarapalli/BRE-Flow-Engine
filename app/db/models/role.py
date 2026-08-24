from typing import Any, Dict, Optional

from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base

# Database model for RBAC governance roles with optional JSON navigation schema override
class RoleModel(Base):
    __tablename__ = "role"

    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    governance_level: Mapped[str] = mapped_column(String(32), default="TENANT", nullable=False)
    hierarchy_tier: Mapped[int] = mapped_column(Integer, default=6, nullable=False)
    is_system_role: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    navigation_schema: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

# Database model for individual granular permissions
class PermissionModel(Base):
    __tablename__ = "permission"

    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    module: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

# Database relational join model mapping roles to granular permissions
class RolePermissionModel(Base):
    __tablename__ = "role_permission"
    __table_args__ = (UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),)

    role_id: Mapped[str] = mapped_column(String(64), ForeignKey("role.id"), nullable=False, index=True)
    permission_id: Mapped[str] = mapped_column(String(64), ForeignKey("permission.id"), nullable=False, index=True)

# Database relational join model mapping users to roles
class UserRoleModel(Base):
    __tablename__ = "user_role"
    __table_args__ = (UniqueConstraint("user_id", "role_id", name="uq_user_role"),)

    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("user_account.id"), nullable=False, index=True)
    role_id: Mapped[str] = mapped_column(String(64), ForeignKey("role.id"), nullable=False, index=True)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("tenant.id"), nullable=True, index=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    assigned_by: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

# Database audit history model tracking role assignments
class UserRoleAssignmentHistoryModel(Base):
    __tablename__ = "user_role_assignment"

    tenant_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("tenant.id"), nullable=True, index=True)
    target_user_id: Mapped[str] = mapped_column(String(64), ForeignKey("user_account.id"), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    role_name: Mapped[str] = mapped_column(String(64), nullable=False)
    assigned_by_user_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("user_account.id"), nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

# Database model for persistent role-based navigation nodes
class NavigationNodeModel(Base):
    __tablename__ = "navigation_node"

    role_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    section_title: Mapped[str] = mapped_column(String(128), nullable=False)
    item_name: Mapped[str] = mapped_column(String(128), nullable=False)
    path: Mapped[str] = mapped_column(String(256), nullable=False)
    icon: Mapped[str] = mapped_column(String(64), nullable=False)
    badge: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    badge_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    is_global: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
