from typing import AsyncGenerator, Callable, List, Optional
from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import get_redis
from app.core.security import verify_token
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.middleware.tenant_context import get_current_tenant_id

# Reusable HTTP Bearer authentication scheme
security_bearer = HTTPBearer(auto_error=False)

# Extracts and validates current tenant UUID context
async def get_current_tenant(x_tenant_id: str = Header(default="default")) -> str:
    return x_tenant_id or get_current_tenant_id() or "default"

# Validates JWT bearer token claims and user identity
async def get_current_user(auth: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)) -> dict:
    if not auth:
        raise UnauthorizedError("Authorization header missing.")
    token_payload = verify_token(auth.credentials)
    if not token_payload:
        raise UnauthorizedError("Invalid or expired JWT token.")
    return token_payload

# Enforces cryptographic tenant binding between JWT claims and route parameters
async def get_current_authorized_tenant(
    request: Request,
    token_payload: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> str:
    route_tenant_uuid = (
        request.headers.get("X-Tenant-UUID")
        or request.headers.get("X-Tenant-ID")
        or request.path_params.get("tenantUuid")
    )
    token_tenant_uuid = token_payload.get("tenant_uuid")
    user_role = token_payload.get("role", "TRANSACTIONAL_USER")
    governance_level = token_payload.get("governance_level", "TENANT")

    if governance_level == "PLATFORM" or user_role == "SUPER_ADMIN":
        target_tenant = route_tenant_uuid or token_tenant_uuid or "default"
    else:
        if route_tenant_uuid and token_tenant_uuid and route_tenant_uuid != token_tenant_uuid:
            raise ForbiddenError("TENANT_CROSS_ACCESS_VIOLATION: Token context does not match target tenant partition.")
        target_tenant = token_tenant_uuid or route_tenant_uuid or "default"

    try:
        await db.execute(text(f"SET LOCAL app.current_tenant_id = '{target_tenant}';"))
    except Exception:
        pass

    return target_tenant

# RBAC role enforcement dependency factory
def require_roles(*allowed_roles: str) -> Callable:
    async def role_checker(user: dict = Depends(get_current_user)) -> dict:
        user_role = user.get("role")
        if user_role not in allowed_roles and "SUPER_ADMIN" not in allowed_roles:
            if user_role != "SUPER_ADMIN":
                raise ForbiddenError(f"Role '{user_role}' lacks required permissions.")
        return user
    return role_checker

# Granular functional permission enforcement dependency factory
def require_permissions(*required_permissions: str) -> Callable:
    async def permission_checker(user: dict = Depends(get_current_user)) -> dict:
        user_permissions = set(user.get("permissions", []))
        if user.get("role") == "SUPER_ADMIN":
            return user
        if not set(required_permissions).issubset(user_permissions):
            raise ForbiddenError("User lacks required functional permissions.")
        return user
    return permission_checker
