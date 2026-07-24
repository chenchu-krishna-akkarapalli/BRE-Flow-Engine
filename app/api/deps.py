from typing import AsyncGenerator
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import get_redis
from app.core.security import verify_token
from app.core.exceptions import UnauthorizedError
from app.middleware.tenant_context import get_current_tenant_id

security_bearer = HTTPBearer(auto_error=False)


async def get_current_tenant(x_tenant_id: str = Header(default="default")) -> str:
    """Dependency extracting validated Tenant ID."""
    return x_tenant_id or get_current_tenant_id() or "default"


async def get_current_user(auth: HTTPAuthorizationCredentials = Depends(security_bearer)) -> dict:
    """Dependency validating PyJWT Bearer token."""
    if not auth:
        raise UnauthorizedError("Authorization header missing.")
    token_payload = verify_token(auth.credentials)
    if not token_payload:
        raise UnauthorizedError("Invalid or expired JWT token.")
    return token_payload
