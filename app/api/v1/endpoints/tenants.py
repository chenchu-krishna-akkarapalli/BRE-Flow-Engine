import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.core.security import derive_password_hash, generate_salt
from app.db.models.tenant import TenantModel, TenantStatusHistoryModel
from app.db.models.user import UserModel

# Router for channel tenant onboarding and lifecycle management
router = APIRouter()

# Tenant self-serve registration payload
class TenantSignupRequest(BaseModel):
    name: str = Field(..., min_length=2, description="Channel partner trade name")
    code: str = Field(..., min_length=2, description="Unique tenant slug code")
    contact_email: str = Field(..., description="Primary administrator email")
    contact_phone: str = Field(..., description="Primary administrator phone")
    channel_type: str = Field(default="DSA", description="Channel type classification")
    cibil_overlay: int = Field(default=10, description="Minimum credit score overlay")

# Tenant entity response contract
class TenantResponse(BaseModel):
    id: str = Field(..., description="Tenant primary key UUID")
    name: str = Field(..., description="Trade name")
    code: str = Field(..., description="Tenant code")
    tenant_uuid: Optional[str] = Field(None, description="Dynamic routing UUID")
    channel_type: Optional[str] = Field(None, description="Channel type classification")
    contact_email: Optional[str] = Field(None, description="Contact email")
    contact_phone: Optional[str] = Field(None, description="Contact phone")
    status: str = Field(..., description="Lifecycle status")
    is_active: bool = Field(default=True, description="Active status flag")

    class Config:
        from_attributes = True

# Provisions new channel partner tenant in pending state
@router.post("/signup", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def signup_tenant(
    payload: TenantSignupRequest,
    db: AsyncSession = Depends(get_db),
):
    normalized_code = payload.code.lower().strip().replace(" ", "-")
    tenant_uuid_val = f"tenant-{normalized_code}" if not normalized_code.startswith("tenant-") else normalized_code

    # Check for existing code or uuid
    stmt = select(TenantModel).where(
        or_(TenantModel.code == normalized_code, TenantModel.tenant_uuid == tenant_uuid_val)
    )
    res = await db.execute(stmt)
    existing = res.scalars().first()
    if existing:
        return existing

    new_tenant = TenantModel(
        id=str(uuid.uuid4()),
        name=payload.name.strip(),
        code=normalized_code,
        tenant_uuid=tenant_uuid_val,
        status="pending",
        channel_type=payload.channel_type,
        cibil_overlay=payload.cibil_overlay,
        contact_email=payload.contact_email.strip().lower(),
        contact_phone=payload.contact_phone.strip(),
        is_active=False,
    )
    db.add(new_tenant)
    await db.flush()

    history = TenantStatusHistoryModel(
        tenant_id=new_tenant.id,
        previous_status="none",
        new_status="pending",
        changed_by="self_registration",
        reason=f"Partner onboarding registration request: {payload.name}",
    )
    db.add(history)
    await db.commit()
    await db.refresh(new_tenant)
    return new_tenant

# Retrieves pending channel onboarding applications (visible to Super Admin & Regional Director)
@router.get("/pending-approvals", response_model=List[TenantResponse])
async def get_pending_channel_approvals(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "REGIONAL_DIRECTOR")),
):
    stmt = (
        select(TenantModel)
        .where(TenantModel.status.in_(["pending", "pending_approval"]))
        .order_by(TenantModel.created_at.desc())
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())

# Approves and activates a channel partner (invocable by Super Admin or Regional Director)
@router.post("/{tenant_uuid}/approve", response_model=TenantResponse)
async def approve_channel_tenant(
    tenant_uuid: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "REGIONAL_DIRECTOR")),
):
    stmt = select(TenantModel).where(
        or_(
            TenantModel.tenant_uuid == tenant_uuid,
            TenantModel.id == tenant_uuid,
            TenantModel.code == tenant_uuid,
        )
    )
    res = await db.execute(stmt)
    tenant = res.scalars().first()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Tenant '{tenant_uuid}' not found.")

    tenant.status = "active"
    tenant.is_active = True

    # Automatically provision initial Channel Admin user account for this newly approved channel
    admin_email = tenant.contact_email or f"channel.admin@{tenant.code}.com"
    user_stmt = select(UserModel).where(UserModel.username == admin_email)
    user_res = await db.execute(user_stmt)
    existing_user = user_res.scalars().first()

    if not existing_user:
        user_salt = generate_salt(16)
        pwd_hash = derive_password_hash("FlowBRE@2026!", user_salt)
        new_channel_admin = UserModel(
            username=admin_email,
            email=admin_email,
            full_name=f"{tenant.name} Admin",
            salt=user_salt,
            password_hash=pwd_hash,
            role="CHANNEL_ADMIN",
            tenant_id=tenant.id,
            is_active=True,
        )
        db.add(new_channel_admin)

    # Record status change history
    actor = current_user.get("username") or current_user.get("role") or "SUPER_ADMIN"
    history = TenantStatusHistoryModel(
        tenant_id=tenant.id,
        previous_status="pending",
        new_status="active",
        changed_by=actor,
        reason=f"Approved by {current_user.get('role', 'LEADERSHIP')}",
    )
    db.add(history)

    await db.commit()
    await db.refresh(tenant)
    return tenant

# Rejects a channel onboarding request
@router.post("/{tenant_uuid}/reject", response_model=TenantResponse)
async def reject_channel_tenant(
    tenant_uuid: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "REGIONAL_DIRECTOR")),
):
    stmt = select(TenantModel).where(
        or_(
            TenantModel.tenant_uuid == tenant_uuid,
            TenantModel.id == tenant_uuid,
            TenantModel.code == tenant_uuid,
        )
    )
    res = await db.execute(stmt)
    tenant = res.scalars().first()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Tenant '{tenant_uuid}' not found.")

    tenant.status = "rejected"
    tenant.is_active = False

    actor = current_user.get("username") or current_user.get("role") or "SUPER_ADMIN"
    history = TenantStatusHistoryModel(
        tenant_id=tenant.id,
        previous_status="pending",
        new_status="rejected",
        changed_by=actor,
        reason=f"Rejected by {current_user.get('role', 'LEADERSHIP')}",
    )
    db.add(history)

    await db.commit()
    await db.refresh(tenant)
    return tenant

# Lists all channels visible according to caller hierarchy
@router.get("", response_model=List[TenantResponse])
async def list_tenants(
    status_filter: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles(
        "SUPER_ADMIN", "REGIONAL_DIRECTOR", "OPERATIONS_HEAD", "ACCOUNTS_HEAD",
        "AREA_MANAGER", "TEAM_LEADER", "SALES_MANAGER", "CHANNEL_ADMIN"
    )),
):
    stmt = select(TenantModel)
    if status_filter:
        stmt = stmt.where(TenantModel.status == status_filter)
    elif current_user.get("role") not in ("SUPER_ADMIN", "REGIONAL_DIRECTOR"):
        stmt = stmt.where(TenantModel.status == "active")
    stmt = stmt.order_by(TenantModel.created_at.desc())
    res = await db.execute(stmt)
    return list(res.scalars().all())

# Retrieves tenant profile details
@router.get("/{tenant_uuid}", response_model=TenantResponse)
async def get_tenant_by_uuid(
    tenant_uuid: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    stmt = select(TenantModel).where(
        or_(
            TenantModel.tenant_uuid == tenant_uuid,
            TenantModel.id == tenant_uuid,
            TenantModel.code == tenant_uuid,
        )
    )
    res = await db.execute(stmt)
    tenant = res.scalars().first()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Tenant '{tenant_uuid}' not found.")
    return tenant
