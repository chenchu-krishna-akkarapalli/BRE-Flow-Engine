from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import RAW_NAVIGATION_SCHEMA
from app.db.models.role import NavigationNodeModel, PermissionModel, RoleModel, RolePermissionModel
from app.db.models.tenant import TenantModel
from app.db.models.user import UserModel, UserSessionModel
from app.db.repositories.base_repository import BaseRepository

# Repository for UAS user account queries, RBAC permissions, and credential verification
class UserRepository(BaseRepository[UserModel]):
    def __init__(self, db: AsyncSession):
        super().__init__(UserModel, db)

    # Looks up user account by unique username or verified email address
    async def get_by_identifier(self, identifier: str) -> Optional[UserModel]:
        stmt = select(UserModel).where(
            or_(UserModel.username == identifier, UserModel.email == identifier)
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    # Looks up user account along with bound tenant and RBAC role definition
    async def get_user_with_context(
        self,
        identifier: str,
    ) -> Tuple[Optional[UserModel], Optional[TenantModel], Optional[RoleModel]]:
        user = await self.get_by_identifier(identifier)
        if not user:
            return None, None, None

        tenant: Optional[TenantModel] = None
        if user.tenant_id:
            tenant_stmt = select(TenantModel).where(TenantModel.id == user.tenant_id)
            tenant_res = await self.db.execute(tenant_stmt)
            tenant = tenant_res.scalars().first()

        role_stmt = select(RoleModel).where(RoleModel.name == user.role)
        role_res = await self.db.execute(role_stmt)
        role = role_res.scalars().first()

        return user, tenant, role

    # Queries all granular permission codes mapped to a specific role in PostgreSQL
    async def get_permissions_for_role(self, role_name: str) -> List[str]:
        stmt = (
            select(PermissionModel.code)
            .join(RolePermissionModel, RolePermissionModel.permission_id == PermissionModel.id)
            .join(RoleModel, RoleModel.id == RolePermissionModel.role_id)
            .where(RoleModel.name == role_name)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # Retrieves dynamic role navigation items from PostgreSQL database with fallback to constants
    async def get_navigation_nodes_for_role(
        self,
        role_name: str,
        tenant_uuid: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        # Resolve effective tenant UUID for tenant-scoped route hrefs
        effective_uuid = tenant_uuid
        if not effective_uuid or effective_uuid == "platform":
            stmt_t = select(TenantModel).where(TenantModel.is_active == True).order_by(TenantModel.created_at.asc())
            res_t = await self.db.execute(stmt_t)
            first_t = res_t.scalars().first()
            if first_t and first_t.tenant_uuid:
                effective_uuid = first_t.tenant_uuid
            else:
                effective_uuid = "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f"

        # 1. Query persistent NavigationNodeModel entries from database
        stmt = (
            select(NavigationNodeModel)
            .where(or_(NavigationNodeModel.role_name == role_name, NavigationNodeModel.role_name == "*"))
            .order_by(NavigationNodeModel.sort_order.asc())
        )
        res = await self.db.execute(stmt)
        db_nodes = list(res.scalars().all())

        if db_nodes and all(hasattr(n, "is_global") for n in db_nodes):
            sections_map: Dict[str, List[Dict[str, Any]]] = {}
            for node in db_nodes:
                if getattr(node, "is_global", False):
                    href = getattr(node, "path", "")
                else:
                    path = getattr(node, "path", "").strip("/")
                    href = f"/{effective_uuid}/{path}" if path else f"/{effective_uuid}"

                item = {
                    "name": getattr(node, "item_name", ""),
                    "href": href,
                    "icon": getattr(node, "icon", "Zap"),
                    "badge": getattr(node, "badge", None),
                    "badgeType": getattr(node, "badge_type", None),
                }
                sections_map.setdefault(getattr(node, "section_title", "Navigation"), []).append(item)

            return [{"title": title, "items": items} for title, items in sections_map.items()]

        # 2. Query RoleModel.navigation_schema JSON override from PostgreSQL
        role_stmt = select(RoleModel).where(RoleModel.name == role_name)
        role_res = await self.db.execute(role_stmt)
        role_model = role_res.scalars().first()
        if role_model and hasattr(role_model, "navigation_schema") and role_model.navigation_schema and "sections" in role_model.navigation_schema:
            return role_model.navigation_schema["sections"]

        # 3. Fallback to centralized constant schema definition
        result: List[Dict[str, Any]] = []
        for group in RAW_NAVIGATION_SCHEMA:
            filtered_items = []
            for item in group["items"]:
                if role_name != "SUPER_ADMIN" and role_name not in item["roles"]:
                    continue

                if "global_path" in item:
                    href = item["global_path"]
                else:
                    path = item["path"].strip("/")
                    href = f"/{effective_uuid}/{path}" if path else f"/{effective_uuid}"

                filtered_items.append({
                    "name": item["name"],
                    "href": href,
                    "icon": item["icon"],
                    "badge": item.get("badge"),
                    "badgeType": item.get("badgeType"),
                })

            if filtered_items:
                result.append({
                    "title": group["title"],
                    "items": filtered_items,
                })

        return result

    # Registers new active user session token hash in database
    async def create_session(self, session: UserSessionModel) -> UserSessionModel:
        self.db.add(session)
        await self.db.flush()
        return session

    # Updates user last login timestamp in PostgreSQL
    async def update_last_login(self, user_id: str) -> None:
        user = await self.get_by_id(user_id)
        if user:
            user.last_login_at = datetime.now(timezone.utc)
            await self.db.flush()
