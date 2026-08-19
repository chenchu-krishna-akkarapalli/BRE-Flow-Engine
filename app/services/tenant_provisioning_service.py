import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import RAW_NAVIGATION_SCHEMA, SYSTEM_ROLES_DEFINITION
from app.core.exceptions import BadRequestError, NotFoundError
from app.core.security import derive_password_hash, generate_salt
from app.db.models.role import NavigationNodeModel, RoleModel, UserRoleModel
from app.db.models.tenant import TenantModel, TenantStatusHistoryModel
from app.db.models.user import UserModel

# Service managing complete multi-tenant onboarding lifecycle and automated entity provisioning
class TenantProvisioningService:
    # Registers a new tenant channel partner in pending state
    async def signup_tenant(
        self,
        db: AsyncSession,
        channel_name: str,
        channel_code: str,
        channel_type: str = "DSA",
        contact_email: Optional[str] = None,
        contact_phone: Optional[str] = None,
        admin_username: Optional[str] = None,
        admin_password: Optional[str] = None,
        cibil_overlay: int = 0,
    ) -> Dict[str, Any]:
        stmt = select(TenantModel).where(TenantModel.code == channel_code)
        res = await db.execute(stmt)
        if res.scalars().first():
            raise BadRequestError(f"Tenant channel code '{channel_code}' is already registered.")

        tenant_uuid = str(uuid.uuid4())
        tenant = TenantModel(
            name=channel_name,
            code=channel_code,
            tenant_uuid=tenant_uuid,
            status="pending",
            channel_type=channel_type,
            cibil_overlay=cibil_overlay,
            contact_email=contact_email,
            contact_phone=contact_phone,
            is_active=False,
        )
        db.add(tenant)
        await db.flush()

        history = TenantStatusHistoryModel(
            tenant_id=tenant.id,
            previous_status="NEW",
            new_status="pending",
            changed_by="SYSTEM_SIGNUP",
            reason="Self-serve channel registration initiated.",
        )
        db.add(history)

        admin_user = None
        if admin_username and contact_email:
            salt = generate_salt(16)
            pwd_hash = derive_password_hash(admin_password or "Welcome@123", salt)
            admin_user = UserModel(
                tenant_id=tenant.id,
                username=admin_username,
                email=contact_email,
                phone=contact_phone,
                full_name=f"{channel_name} Admin",
                password_hash=pwd_hash,
                salt=salt,
                role="CHANNEL_ADMIN",
                is_active=False,
            )
            db.add(admin_user)

        await db.commit()
        await db.refresh(tenant)

        return {
            "tenant_id": tenant.id,
            "tenant_uuid": tenant.tenant_uuid,
            "status": tenant.status,
            "channel_code": tenant.code,
            "admin_username": admin_username,
            "message": "Tenant registration submitted successfully and is pending review.",
        }

    # Transitions tenant to under_review status
    async def review_tenant(
        self,
        db: AsyncSession,
        tenant_uuid: str,
        reviewer_id: str,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        stmt = select(TenantModel).where(
            (TenantModel.tenant_uuid == tenant_uuid) | (TenantModel.id == tenant_uuid)
        )
        res = await db.execute(stmt)
        tenant = res.scalars().first()
        if not tenant:
            raise NotFoundError(f"Tenant '{tenant_uuid}' was not found.")

        prev_status = tenant.status
        tenant.status = "under_review"

        history = TenantStatusHistoryModel(
            tenant_id=tenant.id,
            previous_status=prev_status,
            new_status="under_review",
            changed_by=reviewer_id,
            reason=reason or "Tenant application claimed for operational review.",
        )
        db.add(history)
        await db.commit()
        await db.refresh(tenant)

        return {
            "tenant_uuid": tenant.tenant_uuid,
            "previous_status": prev_status,
            "current_status": tenant.status,
        }

    # Approves and activates tenant, seeding default navigation nodes and activating admin
    async def approve_and_activate_tenant(
        self,
        db: AsyncSession,
        tenant_uuid: str,
        approver_id: str,
        cibil_overlay: Optional[int] = None,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        stmt = select(TenantModel).where(
            (TenantModel.tenant_uuid == tenant_uuid) | (TenantModel.id == tenant_uuid)
        )
        res = await db.execute(stmt)
        tenant = res.scalars().first()
        if not tenant:
            raise NotFoundError(f"Tenant '{tenant_uuid}' was not found.")

        prev_status = tenant.status
        tenant.status = "active"
        tenant.is_active = True
        if cibil_overlay is not None:
            tenant.cibil_overlay = cibil_overlay

        history = TenantStatusHistoryModel(
            tenant_id=tenant.id,
            previous_status=prev_status,
            new_status="active",
            changed_by=approver_id,
            reason=reason or "Tenant compliance documents approved. Provisioning activated.",
        )
        db.add(history)

        # Activate all initial users for this tenant
        stmt_users = select(UserModel).where(UserModel.tenant_id == tenant.id)
        res_users = await db.execute(stmt_users)
        users = res_users.scalars().all()
        for u in users:
            u.is_active = True

        # Seed default navigation nodes for the tenant
        seeded_count = await self.seed_navigation_nodes_for_tenant(db, tenant.tenant_uuid or tenant.id)

        await db.commit()
        await db.refresh(tenant)

        return {
            "tenant_uuid": tenant.tenant_uuid,
            "previous_status": prev_status,
            "current_status": tenant.status,
            "is_active": tenant.is_active,
            "seeded_navigation_nodes_count": seeded_count,
            "cibil_overlay": tenant.cibil_overlay,
        }

    # Seeds standard navigation nodes for all roles in tenant
    async def seed_navigation_nodes_for_tenant(
        self,
        db: AsyncSession,
        tenant_uuid: str,
    ) -> int:
        count = 0
        for group in RAW_NAVIGATION_SCHEMA:
            section_title = group["title"]
            for idx, item in enumerate(group["items"]):
                for role_name in item["roles"]:
                    if "global_path" in item:
                        full_path = item["global_path"]
                        is_global = True
                    else:
                        path = item.get("path", "").strip("/")
                        full_path = f"/{tenant_uuid}/{path}" if path else f"/{tenant_uuid}"
                        is_global = False

                    node = NavigationNodeModel(
                        role_name=role_name,
                        section_title=section_title,
                        item_name=item["name"],
                        path=full_path,
                        icon=item["icon"],
                        badge=item.get("badge"),
                        badge_type=item.get("badgeType"),
                        is_global=is_global,
                        sort_order=idx,
                    )
                    db.add(node)
                    count += 1
        await db.flush()
        return count

    # Suspends tenant and invalidates all active user sessions
    async def suspend_tenant(
        self,
        db: AsyncSession,
        tenant_uuid: str,
        actor_id: str,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        stmt = select(TenantModel).where(
            (TenantModel.tenant_uuid == tenant_uuid) | (TenantModel.id == tenant_uuid)
        )
        res = await db.execute(stmt)
        tenant = res.scalars().first()
        if not tenant:
            raise NotFoundError(f"Tenant '{tenant_uuid}' was not found.")

        prev_status = tenant.status
        tenant.status = "suspended"
        tenant.is_active = False

        history = TenantStatusHistoryModel(
            tenant_id=tenant.id,
            previous_status=prev_status,
            new_status="suspended",
            changed_by=actor_id,
            reason=reason or "Tenant suspended due to operational directive.",
        )
        db.add(history)

        # Invalidate all user tokens by bumping token_version
        stmt_users = select(UserModel).where(UserModel.tenant_id == tenant.id)
        res_users = await db.execute(stmt_users)
        for u in res_users.scalars().all():
            u.token_version = (u.token_version or 1) + 1

        await db.commit()
        await db.refresh(tenant)

        return {
            "tenant_uuid": tenant.tenant_uuid,
            "previous_status": prev_status,
            "current_status": tenant.status,
            "is_active": tenant.is_active,
            "message": "Tenant successfully suspended and all user sessions invalidated.",
        }

tenant_provisioning_service = TenantProvisioningService()
