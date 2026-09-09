import logging
import secrets
import string
import uuid
from datetime import datetime
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
    created_at: Optional[datetime] = Field(None, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")

    class Config:
        from_attributes = True

# Channel approval audit history response model
class TenantApprovalHistoryItem(BaseModel):
    id: str = Field(..., description="History record UUID")
    tenant_id: str = Field(..., description="Tenant UUID")
    channel_name: str = Field(..., description="Channel partner trade name")
    channel_code: str = Field(..., description="Unique tenant slug code")
    tenant_uuid: Optional[str] = Field(None, description="Dynamic routing UUID")
    channel_type: Optional[str] = Field(None, description="Channel classification")
    contact_email: Optional[str] = Field(None, description="Contact email")
    contact_phone: Optional[str] = Field(None, description="Contact phone")
    previous_status: str = Field(..., description="Status before transition")
    new_status: str = Field(..., description="Status after transition")
    changed_by: Optional[str] = Field(None, description="Actor who performed the change")
    reason: Optional[str] = Field(None, description="Justification note")
    created_at: Optional[datetime] = Field(None, description="Audit timestamp")

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

    # Ensure a corresponding Channel Admin user account is registered in an inactive state
    admin_email = payload.contact_email.strip().lower()
    user_stmt = select(UserModel).where(
        or_(UserModel.username == admin_email, UserModel.email == admin_email)
    )
    user_res = await db.execute(user_stmt)
    existing_user = user_res.scalars().first()

    user_salt = generate_salt(16)
    pwd_hash = derive_password_hash("FlowBRE@2026!", user_salt)

    if not existing_user:
        new_channel_admin = UserModel(
            username=admin_email,
            email=admin_email,
            full_name=f"{payload.name.strip()} Admin",
            role="CHANNEL_ADMIN",
            tenant_id=new_tenant.id,
            is_active=False,
            password_hash=pwd_hash,
            salt=user_salt,
        )
        db.add(new_channel_admin)
    else:
        existing_user.tenant_id = new_tenant.id
        existing_user.is_active = False
        existing_user.password_hash = pwd_hash
        existing_user.salt = user_salt

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

# Retrieves all approved, active channel partners
@router.get("/approved", response_model=List[TenantResponse])
async def get_approved_channels(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "REGIONAL_DIRECTOR")),
):
    stmt = (
        select(TenantModel)
        .where(TenantModel.status == "active", TenantModel.is_active == True)
        .order_by(TenantModel.updated_at.desc())
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())

# Retrieves all channel onboarding approval and lifecycle history (visible to Super Admin & Regional Director)
@router.get("/approval-history", response_model=List[TenantApprovalHistoryItem])
async def get_channel_approval_history(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "REGIONAL_DIRECTOR")),
):
    stmt = (
        select(
            TenantStatusHistoryModel.id,
            TenantStatusHistoryModel.tenant_id,
            TenantModel.name.label("channel_name"),
            TenantModel.code.label("channel_code"),
            TenantModel.tenant_uuid,
            TenantModel.channel_type,
            TenantModel.contact_email,
            TenantModel.contact_phone,
            TenantStatusHistoryModel.previous_status,
            TenantStatusHistoryModel.new_status,
            TenantStatusHistoryModel.changed_by,
            TenantStatusHistoryModel.reason,
            TenantStatusHistoryModel.created_at,
        )
        .join(TenantModel, TenantModel.id == TenantStatusHistoryModel.tenant_id)
        .order_by(TenantStatusHistoryModel.created_at.desc())
    )
    res = await db.execute(stmt)
    rows = res.mappings().all()
    return [TenantApprovalHistoryItem(**row) for row in rows]

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
    user_stmt = select(UserModel).where(
        or_(UserModel.username == admin_email, UserModel.email == admin_email)
    )
    user_res = await db.execute(user_stmt)
    existing_user = user_res.scalars().first()

    # Testing phase fixed password
    generated_password = "FlowBRE@2026!"

    user_salt = generate_salt(16)
    pwd_hash = derive_password_hash(generated_password, user_salt)

    if not existing_user:
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
    else:
        existing_user.is_active = True
        existing_user.salt = user_salt
        existing_user.password_hash = pwd_hash
        existing_user.tenant_id = tenant.id
        existing_user.role = "CHANNEL_ADMIN"

    should_send_credentials = True

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

    # Asynchronously dispatch credentials email to the channel admin via Celery & Resend/SMTP
    if should_send_credentials:
        try:
            from app.worker.tasks.notification_tasks import send_channel_admin_credentials_task
            send_channel_admin_credentials_task.delay(
                to_email=admin_email,
                channel_name=tenant.name,
                username=admin_email,
                password=generated_password,
            )
            logging.getLogger(__name__).info(
                "Enqueued credentials email for approved channel admin '%s' (%s)", admin_email, tenant.name
            )
        except Exception as queue_err:
            logging.getLogger(__name__).error(
                "Failed to queue channel admin credentials email to %s: %s", admin_email, queue_err
            )

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

    # Deactivate associated channel admin user
    admin_email = tenant.contact_email or f"channel.admin@{tenant.code}.com"
    user_stmt = select(UserModel).where(
        or_(UserModel.username == admin_email, UserModel.email == admin_email)
    )
    user_res = await db.execute(user_stmt)
    existing_user = user_res.scalars().first()
    if existing_user:
        existing_user.is_active = False

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
