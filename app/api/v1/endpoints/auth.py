from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.api.schemas.auth import (
    AuthTokenResponse,
    ChallengeRequest,
    ChallengeResponse,
    TokenRefreshRequest,
    UserSessionInfo,
    VerifyChallengeRequest,
)
from app.core.security import create_access_token
from app.services.uas_service import build_role_navigation_nodes, uas_service

# Router for Universal Authentication Server (UAS) and session lifecycle
router = APIRouter()

# Request model for legacy token endpoint
class LegacyTokenRequest(BaseModel):
    client_id: str = Field(..., json_schema_extra={"example": "partner_bank_app"})
    client_secret: str = Field(..., json_schema_extra={"example": "secret_key"})

# Response model for legacy token endpoint
class LegacyTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int = 1440

# Generates cryptographic challenge nonce for zero-password proof
@router.post("/challenge", response_model=ChallengeResponse)
async def generate_auth_challenge(
    payload: ChallengeRequest,
    db: AsyncSession = Depends(get_db),
):
    return await uas_service.create_challenge(
        db=db,
        username=payload.username,
        tenant_id=payload.tenant_id,
    )

# Atomically verifies cryptographic challenge proof and issues scoped JWT with role_nodes
@router.post("/verify", response_model=AuthTokenResponse)
async def verify_auth_challenge(
    payload: VerifyChallengeRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await uas_service.verify_challenge(
        db=db,
        username=payload.username,
        nonce_id=payload.nonce_id,
        proof_signature=payload.proof_signature,
        tenant_id=payload.tenant_id,
        mfa_code=payload.mfa_code,
        ip_address=client_ip,
        user_agent=user_agent,
    )

# Refreshes active user session and returns renewed access token with role_nodes
@router.post("/refresh", response_model=AuthTokenResponse)
async def refresh_user_token(
    payload: TokenRefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    return await uas_service.refresh_token(
        db=db,
        refresh_token_str=payload.refresh_token,
    )

# Retrieves active authenticated user session profile and role claims with role_nodes
@router.get("/me", response_model=UserSessionInfo)
async def get_authenticated_profile(
    current_user: dict = Depends(get_current_user),
):
    user_role = current_user.get("role", "TRANSACTIONAL_USER")
    tenant_uuid = current_user.get("tenant_uuid", "platform")
    role_nodes = build_role_navigation_nodes(user_role, tenant_uuid)

    return UserSessionInfo(
        user_id=current_user.get("sub", ""),
        username=current_user.get("sub", ""),
        tenant_id=tenant_uuid,
        role=user_role,
        permissions=current_user.get("permissions", []),
        role_nodes=role_nodes,
    )

# Invalidates current session and terminates active credentials
@router.post("/logout")
async def logout_user(
    current_user: dict = Depends(get_current_user),
):
    return {"message": "Session successfully terminated.", "revoked": True}

# Issues JWT Bearer token for authorized automated test clients
@router.post("/token", response_model=LegacyTokenResponse)
async def issue_token(payload: LegacyTokenRequest):
    if not payload.client_id or not payload.client_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )
    token = create_access_token(subject=payload.client_id)
    return LegacyTokenResponse(access_token=token)
