from typing import Any, Dict
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.core.security import create_access_token

router = APIRouter()


class TokenRequest(BaseModel):
    client_id: str = Field(..., json_schema_extra={"example": "partner_bank_app"})
    client_secret: str = Field(..., json_schema_extra={"example": "secret_key"})


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int = 1440


@router.post("/token", response_model=TokenResponse)
async def issue_token(payload: TokenRequest):
    """Issues JWT Bearer token for authorized partner API access."""
    if not payload.client_id or not payload.client_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )

    token = create_access_token(subject=payload.client_id)
    return TokenResponse(access_token=token)
