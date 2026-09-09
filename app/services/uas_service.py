import hashlib
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import RAW_NAVIGATION_SCHEMA, SYSTEM_ROLES_DEFINITION
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.redis import get_redis
from app.core.security import (
    create_access_token,
    create_refresh_token,
    derive_password_hash,
    generate_salt,
    verify_challenge_proof,
    verify_token,
)
from app.db.models.role import NavigationNodeModel, PermissionModel, RoleModel, RolePermissionModel, UserRoleModel
from app.db.models.tenant import TenantModel
from app.db.models.user import UserModel, UserSessionModel
from app.db.repositories.tenant_repository import TenantRepository
from app.db.repositories.user_repository import UserRepository

# In-memory fallback dictionary for nonces when Redis is offline
_in_memory_nonces: Dict[str, tuple[str, float]] = {}

# Generates auto-generated role navigation nodes dynamically scoped to tenant from schema
def build_role_navigation_nodes(role: str, tenant_uuid: str) -> List[Dict[str, Any]]:
    is_platform = not tenant_uuid or tenant_uuid == "platform"
    result: List[Dict[str, Any]] = []

    for group in RAW_NAVIGATION_SCHEMA:
        filtered_items = []
        for item in group["items"]:
            if role != "SUPER_ADMIN" and role not in item["roles"]:
                continue

            if "global_path" in item:
                href = item["global_path"]
            else:
                path = item["path"].strip("/")
                if is_platform:
                    href = f"/{path}" if path else "/"
                else:
                    href = f"/{tenant_uuid}/{path}" if path else f"/{tenant_uuid}"

            nav_node = {
                "name": item["name"],
                "href": href,
                "icon": item["icon"],
                "badge": item.get("badge"),
                "badgeType": item.get("badgeType"),
            }
            filtered_items.append(nav_node)

        if filtered_items:
            result.append({
                "title": group["title"],
                "items": filtered_items,
            })

    return result

# Universal Authentication Server (UAS) implementing live database-backed challenge-response
class UASService:
    # Generates a dynamic cryptographic challenge nonce with live database-resolved tenant context
    async def create_challenge(
        self,
        db: AsyncSession,
        username: str,
        tenant_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        user_repo = UserRepository(db)
        user, tenant, role = await user_repo.get_user_with_context(username)

        if not user:
            raise UnauthorizedError(f"User account '{username}' was not found in the database.")

        if not user.is_active:
            raise ForbiddenError(f"User account '{username}' has been deactivated.")

        salt = user.salt
        if not salt:
            salt = generate_salt(16)
            user.salt = salt
            await db.flush()

        if not tenant:
            stmt_t = select(TenantModel).where(TenantModel.is_active == True).order_by(TenantModel.created_at.asc())
            res_t = await db.execute(stmt_t)
            t_cand = res_t.scalars().first()
            if isinstance(t_cand, TenantModel):
                tenant = t_cand

        tenant_uuid = getattr(tenant, "tenant_uuid", None) or getattr(tenant, "id", None) or "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f"
        tenant_name = getattr(tenant, "name", None) or getattr(role, "display_name", None) or "Bank of India Channel"

        nonce_id = str(uuid.uuid4())
        nonce = secrets.token_hex(32)
        redis_key = f"nonce:{user.id}:{nonce_id}"
        _in_memory_nonces[redis_key] = (nonce, time.time() + 60)

        try:
            redis = await get_redis()
            if redis:
                await redis.set(redis_key, nonce, ex=60)
        except Exception:
            pass

        challenge_type = "MFA_PROMPT" if user.is_mfa_enabled else "ARGON2_PROOF"
        return {
            "nonce_id": nonce_id,
            "nonce": nonce,
            "salt": salt,
            "challenge_type": challenge_type,
            "tenant_uuid": tenant_uuid,
            "tenant_name": tenant_name,
            "role": user.role,
            "email": user.email,
            "expires_in_seconds": 60,
        }

    # Atomically verifies cryptographic challenge proof and issues live database-scoped JWT with role_nodes
    async def verify_challenge(
        self,
        db: AsyncSession,
        username: str,
        nonce_id: str,
        proof_signature: str,
        tenant_id: Optional[str] = None,
        mfa_code: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Dict[str, Any]:
        user_repo = UserRepository(db)
        user, tenant, role = await user_repo.get_user_with_context(username)

        if not user:
            raise UnauthorizedError(f"User account '{username}' was not found in the database.")

        if not user.is_active:
            raise ForbiddenError("User account has been deactivated.")

        redis_key = f"nonce:{user.id}:{nonce_id}"
        expected_nonce: Optional[str] = None

        try:
            redis = await get_redis()
            if redis:
                cached_val = await redis.get(redis_key)
                if cached_val:
                    expected_nonce = cached_val if isinstance(cached_val, str) else cached_val.decode("utf-8")
                    await redis.delete(redis_key)
        except Exception:
            pass

        if not expected_nonce and redis_key in _in_memory_nonces:
            stored_nonce, expiry = _in_memory_nonces.pop(redis_key)
            if time.time() <= expiry:
                expected_nonce = stored_nonce

        if not expected_nonce:
            raise UnauthorizedError("Authentication challenge expired or invalid nonce.")

        if not user.password_hash:
            raise UnauthorizedError("User credentials not configured in database.")

        is_valid = verify_challenge_proof(user.password_hash, expected_nonce, proof_signature)
        if not is_valid:
            raise UnauthorizedError("Cryptographic challenge proof verification failed.")

        if not tenant:
            stmt_t = select(TenantModel).where(TenantModel.is_active == True).order_by(TenantModel.created_at.asc())
            res_t = await db.execute(stmt_t)
            t_cand = res_t.scalars().first()
            if isinstance(t_cand, TenantModel):
                tenant = t_cand

        tenant_uuid = getattr(tenant, "tenant_uuid", None) or getattr(tenant, "id", None) or "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f"
        await user_repo.update_last_login(user.id)

        role_permissions = await user_repo.get_permissions_for_role(user.role)
        role_nodes = await user_repo.get_navigation_nodes_for_role(user.role, tenant_uuid)

        access_token = create_access_token(
            subject=user.id,
            tenant_uuid=tenant_uuid,
            role=user.role,
            permissions=role_permissions,
        )
        refresh_token = create_refresh_token(subject=user.id)

        session_hash = hashlib.sha256(access_token.encode("utf-8")).hexdigest()
        new_session = UserSessionModel(
            user_id=user.id,
            tenant_id=user.tenant_id,
            session_token_hash=session_hash,
            ip_address=ip_address,
            user_agent=user_agent,
            is_revoked=False,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=1440),
        )
        await user_repo.create_session(new_session)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in_minutes": 1440,
            "tenant_uuid": tenant_uuid,
            "user_id": user.id,
            "username": user.username,
            "role": user.role,
            "permissions": role_permissions,
            "role_nodes": role_nodes,
        }

    # Refreshes expired access token by re-querying live database state and generating role_nodes
    async def refresh_token(self, db: AsyncSession, refresh_token_str: str) -> Dict[str, Any]:
        payload = verify_token(refresh_token_str)
        if not payload or payload.get("type") != "refresh":
            raise UnauthorizedError("Invalid or expired refresh token.")

        user_id = payload.get("sub")
        user_repo = UserRepository(db)
        user = await user_repo.get_by_id(user_id)

        if not user or not user.is_active:
            raise UnauthorizedError("User account no longer active in database.")

        tenant: Optional[TenantModel] = None
        if user.tenant_id:
            tenant_repo = TenantRepository(db)
            tenant = await tenant_repo.get_by_id(user.tenant_id)
        else:
            stmt_t = select(TenantModel).where(TenantModel.is_active == True).order_by(TenantModel.created_at.asc())
            res_t = await db.execute(stmt_t)
            t_cand = res_t.scalars().first()
            if isinstance(t_cand, TenantModel):
                tenant = t_cand

        tenant_uuid = getattr(tenant, "tenant_uuid", None) or getattr(tenant, "id", None) or "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f"
        role_permissions = await user_repo.get_permissions_for_role(user.role)
        role_nodes = await user_repo.get_navigation_nodes_for_role(user.role, tenant_uuid)

        new_access_token = create_access_token(
            subject=user.id,
            tenant_uuid=tenant_uuid,
            role=user.role,
            permissions=role_permissions,
        )
        return {
            "access_token": new_access_token,
            "token_type": "bearer",
            "expires_in_minutes": 1440,
            "tenant_uuid": tenant_uuid,
            "user_id": user.id,
            "username": user.username,
            "role": user.role,
            "permissions": role_permissions,
            "role_nodes": role_nodes,
        }

    # Seeds initial platform governance roles, navigation nodes, and bootstrap accounts in PostgreSQL
    async def seed_default_users(self, db: AsyncSession) -> None:
        for name, display_name, gov_level, tier in SYSTEM_ROLES_DEFINITION:
            res = await db.execute(select(RoleModel).where(RoleModel.name == name))
            if not res.scalars().first():
                db.add(RoleModel(
                    name=name,
                    display_name=display_name,
                    governance_level=gov_level,
                    hierarchy_tier=tier,
                    is_system_role=True,
                ))
        await db.flush()

        # Seed NavigationNodeModel entries into PostgreSQL for all roles
        for group in RAW_NAVIGATION_SCHEMA:
            section_title = group["title"]
            for item in group["items"]:
                is_global = "global_path" in item
                path_val = item["global_path"] if is_global else item["path"]
                for role_key in item["roles"]:
                    stmt = select(NavigationNodeModel).where(
                        NavigationNodeModel.role_name == role_key,
                        NavigationNodeModel.section_title == section_title,
                        NavigationNodeModel.item_name == item["name"],
                    )
                    res = await db.execute(stmt)
                    if not res.scalars().first():
                        db.add(NavigationNodeModel(
                            role_name=role_key,
                            section_title=section_title,
                            item_name=item["name"],
                            path=path_val,
                            icon=item["icon"],
                            badge=item.get("badge"),
                            badge_type=item.get("badgeType"),
                            is_global=is_global,
                            sort_order=item.get("sort_order", 0),
                        ))
        await db.flush()

        tenant_res = await db.execute(select(TenantModel).where(TenantModel.code == "boi-channel-north"))
        boi_tenant = tenant_res.scalars().first()
        if not boi_tenant:
            tenant_uuid_val = "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f"
            boi_tenant = TenantModel(
                id=tenant_uuid_val,
                name="Bank of India Channel",
                code="boi-channel-north",
                tenant_uuid=tenant_uuid_val,
                status="active",
                channel_type="DSA",
                is_active=True,
            )
            db.add(boi_tenant)
            await db.flush()

        default_users = [
            ("super.admin@flowbre.com", "super.admin@flowbre.com", "Super Admin", "SUPER_ADMIN", boi_tenant.id),
            ("regional.director@flowbre.com", "regional.director@flowbre.com", "Regional Director", "REGIONAL_DIRECTOR", boi_tenant.id),
            ("ops.head@flowbre.com", "ops.head@flowbre.com", "Operations Head", "OPERATIONS_HEAD", boi_tenant.id),
            ("accounts.head@flowbre.com", "accounts.head@flowbre.com", "Accounts Head", "ACCOUNTS_HEAD", boi_tenant.id),
            ("area.manager@boi.com", "area.manager@boi.com", "Area Manager", "AREA_MANAGER", boi_tenant.id),
            ("team.leader@boi.com", "team.leader@boi.com", "Team Leader", "TEAM_LEADER", boi_tenant.id),
            ("sales.manager@boi.com", "sales.manager@boi.com", "Sales Manager", "SALES_MANAGER", boi_tenant.id),
            ("channel.admin@boi.com", "channel.admin@boi.com", "Channel Admin BOI", "CHANNEL_ADMIN", boi_tenant.id),
            ("agent.john@boi.com", "agent.john@boi.com", "Loan Officer John", "TRANSACTIONAL_USER", boi_tenant.id),
        ]

        default_password = "FlowBRE@2026!"
        for username, email, full_name, role_name, tenant_id_val in default_users:
            user_res = await db.execute(select(UserModel).where(UserModel.username == username))
            if not user_res.scalars().first():
                user_salt = generate_salt(16)
                pwd_hash = derive_password_hash(default_password, user_salt)
                new_user = UserModel(
                    username=username,
                    email=email,
                    full_name=full_name,
                    salt=user_salt,
                    password_hash=pwd_hash,
                    role=role_name,
                    tenant_id=tenant_id_val,
                    is_active=True,
                )
                db.add(new_user)
        await db.flush()

uas_service = UASService()
