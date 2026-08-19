from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import get_current_user, require_roles

# Router for channel tenant onboarding and lifecycle management
router = APIRouter()

# Tenant self-serve registration payload
class TenantSignupRequest(BaseModel):
    name: str = Field(..., min_length=2, description="Channel partner trade name")
    code: str = Field(..., min_length=2, description="Unique tenant slug code")
    contact_email: str = Field(..., description="Primary administrator email")
    contact_phone: str = Field(..., description="Primary administrator phone")
    channel_type: str = Field(default="DSA", description="Channel type classification")

# Tenant entity response contract
class TenantResponse(BaseModel):
    id: str = Field(..., description="Tenant primary key UUID")
    name: str = Field(..., description="Trade name")
    code: str = Field(..., description="Tenant code")
    tenant_uuid: str = Field(..., description="Dynamic routing UUID")
    status: str = Field(..., description="Lifecycle status")
    is_active: bool = Field(default=True, description="Active status flag")

# Provisions new channel partner tenant and initial admin
@router.post("/signup", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def signup_tenant(payload: TenantSignupRequest):
    return TenantResponse(
        id="tnt-sample-uuid-1234",
        name=payload.name,
        code=payload.code,
        tenant_uuid="tenant-sample-uuid-1234",
        status="pending",
        is_active=True,
    )

# Retrieves tenant profile details
@router.get("/{tenant_uuid}", response_model=TenantResponse)
async def get_tenant_by_uuid(
    tenant_uuid: str,
    current_user: dict = Depends(get_current_user),
):
    return TenantResponse(
        id="tnt-sample-uuid-1234",
        name="Sample Tenant",
        code="sample-tenant",
        tenant_uuid=tenant_uuid,
        status="active",
        is_active=True,
    )
