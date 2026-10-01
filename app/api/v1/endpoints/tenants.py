import logging
import secrets
import string
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_user_optional, require_roles
from app.core.database import get_db
from app.core.security import derive_password_hash, generate_salt
from app.db.models.role import RoleModel
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
    cibil_overlay: int = Field(default=10, description="Minimum credit score overlay")
    contact_email: Optional[str] = Field(None, description="Contact email")
    contact_phone: Optional[str] = Field(None, description="Contact phone")
    status: str = Field(..., description="Lifecycle status")
    is_active: bool = Field(default=True, description="Active status flag")
    created_at: Optional[datetime] = Field(None, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")

    class Config:
        from_attributes = True

# Status change and state transition request payload
class TenantStatusTransitionPayload(BaseModel):
    status: Optional[str] = Field(None, description="Target status: pending, under_review, active, suspended, rejected")
    reason: Optional[str] = Field(None, description="Audit justification note")
    cibil_overlay: Optional[int] = Field(None, description="Assigned credit overlay margin")

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
    current_user: Optional[dict] = Depends(get_current_user_optional),
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
    payload: Optional[TenantStatusTransitionPayload] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
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

    prev_status = tenant.status
    tenant.status = "active"
    tenant.is_active = True
    if payload and payload.cibil_overlay is not None:
        tenant.cibil_overlay = payload.cibil_overlay

    # Automatically provision/activate Channel Admin user account for this newly approved channel
    admin_email = tenant.contact_email or f"channel.admin@{tenant.code}.com"
    user_stmt = select(UserModel).where(
        or_(
            UserModel.username == admin_email,
            UserModel.email == admin_email,
            UserModel.tenant_id.in_([tenant.id, tenant.code, tenant.tenant_uuid or tenant.id]),
        )
    )
    user_res = await db.execute(user_stmt)
    existing_users = user_res.scalars().all()

    # Testing phase fixed password
    generated_password = "FlowBRE@2026!"

    user_salt = generate_salt(16)
    pwd_hash = derive_password_hash(generated_password, user_salt)

    if not existing_users and admin_email:
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
        for u in existing_users:
            u.is_active = True
            u.tenant_id = tenant.id
            if u.email == admin_email or u.username == admin_email:
                u.role = "CHANNEL_ADMIN"

    should_send_credentials = True

    # Record status change history
    actor = (current_user.get("username") if current_user else None) or (current_user.get("role") if current_user else None) or "super.admin@flowbre.com"
    reason = (payload.reason if payload and payload.reason else None) or f"Approved by {actor}"
    history = TenantStatusHistoryModel(
        tenant_id=tenant.id,
        previous_status=prev_status,
        new_status="active",
        changed_by=actor,
        reason=reason,
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
    payload: Optional[TenantStatusTransitionPayload] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
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

    prev_status = tenant.status
    tenant.status = "rejected"
    tenant.is_active = False

    # Deactivate associated channel admin user and members
    admin_email = tenant.contact_email or f"channel.admin@{tenant.code}.com"
    user_stmt = select(UserModel).where(
        or_(
            UserModel.username == admin_email,
            UserModel.email == admin_email,
            UserModel.tenant_id.in_([tenant.id, tenant.code, tenant.tenant_uuid or tenant.id]),
        )
    )
    user_res = await db.execute(user_stmt)
    for u in user_res.scalars().all():
        u.is_active = False

    actor = (current_user.get("username") if current_user else None) or (current_user.get("role") if current_user else None) or "super.admin@flowbre.com"
    reason = (payload.reason if payload and payload.reason else None) or f"Rejected by {actor}"
    history = TenantStatusHistoryModel(
        tenant_id=tenant.id,
        previous_status=prev_status,
        new_status="rejected",
        changed_by=actor,
        reason=reason,
    )
    db.add(history)

    await db.commit()
    await db.refresh(tenant)
    return tenant

# Suspends a channel partner, invalidates active sessions, and logs audit entry
@router.post("/{tenant_uuid}/suspend", response_model=TenantResponse)
async def suspend_channel_tenant(
    tenant_uuid: str,
    payload: Optional[TenantStatusTransitionPayload] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
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

    prev_status = tenant.status
    tenant.status = "suspended"
    tenant.is_active = False

    # Deactivate associated channel users
    user_stmt = select(UserModel).where(
        UserModel.tenant_id.in_([tenant.id, tenant.code, tenant.tenant_uuid or tenant.id])
    )
    user_res = await db.execute(user_stmt)
    for u in user_res.scalars().all():
        u.is_active = False

    actor = (current_user.get("username") if current_user else None) or (current_user.get("role") if current_user else None) or "super.admin@flowbre.com"
    reason = (payload.reason if payload and payload.reason else None) or "Channel suspended due to compliance review."
    history = TenantStatusHistoryModel(
        tenant_id=tenant.id,
        previous_status=prev_status,
        new_status="suspended",
        changed_by=actor,
        reason=reason,
    )
    db.add(history)

    await db.commit()
    await db.refresh(tenant)
    return tenant

# Reinstates a suspended channel partner back to active
@router.post("/{tenant_uuid}/reinstate", response_model=TenantResponse)
async def reinstate_channel_tenant(
    tenant_uuid: str,
    payload: Optional[TenantStatusTransitionPayload] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
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

    prev_status = tenant.status
    tenant.status = "active"
    tenant.is_active = True

    # Reactivate associated channel users
    admin_email = tenant.contact_email or f"channel.admin@{tenant.code}.com"
    user_stmt = select(UserModel).where(
        or_(
            UserModel.tenant_id.in_([tenant.id, tenant.code, tenant.tenant_uuid or tenant.id]),
            UserModel.username == admin_email,
            UserModel.email == admin_email,
        )
    )
    user_res = await db.execute(user_stmt)
    for u in user_res.scalars().all():
        u.is_active = True
        u.tenant_id = tenant.id

    actor = (current_user.get("username") if current_user else None) or (current_user.get("role") if current_user else None) or "super.admin@flowbre.com"
    reason = (payload.reason if payload and payload.reason else None) or "Reinstated by platform administrator after audit clearance."
    history = TenantStatusHistoryModel(
        tenant_id=tenant.id,
        previous_status=prev_status,
        new_status="active",
        changed_by=actor,
        reason=reason,
    )
    db.add(history)

    await db.commit()
    await db.refresh(tenant)
    return tenant

# Generic state transition endpoint for platform approval workflow
@router.post("/{tenant_uuid}/transition", response_model=TenantResponse)
async def transition_channel_tenant(
    tenant_uuid: str,
    payload: TenantStatusTransitionPayload,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
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

    prev_status = tenant.status
    target_status = payload.status or "active"
    tenant.status = target_status
    tenant.is_active = (target_status == "active")

    if payload.cibil_overlay is not None:
        tenant.cibil_overlay = payload.cibil_overlay

    admin_email = tenant.contact_email or f"channel.admin@{tenant.code}.com"
    user_stmt = select(UserModel).where(
        or_(
            UserModel.tenant_id.in_([tenant.id, tenant.code, tenant.tenant_uuid or tenant.id]),
            UserModel.username == admin_email,
            UserModel.email == admin_email,
        )
    )
    user_res = await db.execute(user_stmt)
    users = user_res.scalars().all()

    if target_status == "active":
        if not users and admin_email:
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
        else:
            for u in users:
                u.is_active = True
                u.tenant_id = tenant.id
                if u.email == admin_email or u.username == admin_email:
                    u.role = "CHANNEL_ADMIN"
    else:
        for u in users:
            u.is_active = (target_status == "active")

    actor = (current_user.get("username") if current_user else None) or (current_user.get("role") if current_user else None) or "super.admin@flowbre.com"
    reason = payload.reason or f"Transitioned to {target_status} by {actor}"
    history = TenantStatusHistoryModel(
        tenant_id=tenant.id,
        previous_status=prev_status,
        new_status=target_status,
        changed_by=actor,
        reason=reason,
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
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    stmt = select(TenantModel)
    if status_filter and status_filter != "ALL":
        stmt = stmt.where(TenantModel.status == status_filter)
    elif current_user and current_user.get("role") not in (
        "SUPER_ADMIN", "REGIONAL_DIRECTOR", "OPERATIONS_HEAD", "ACCOUNTS_HEAD"
    ):
        stmt = stmt.where(TenantModel.status == "active")
    stmt = stmt.order_by(TenantModel.created_at.desc())
    res = await db.execute(stmt)
    return list(res.scalars().all())

# Retrieves tenant profile details
@router.get("/{tenant_uuid}", response_model=TenantResponse)
async def get_tenant_by_uuid(
    tenant_uuid: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
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

# Tenant user schemas
class TenantUserResponse(BaseModel):
    id: str
    tenant_id: str
    name: str
    email: str
    role: str
    status: str

class CreateTenantUserPayload(BaseModel):
    name: str
    email: str
    role: str = "CHANNEL_ADMIN"
    status: str = "ACTIVE"

class UpdateTenantUserPayload(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None

MAIN_TENANT_UUID = "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f"
MAIN_TENANT_CODE = "boi-channel-north"

def is_main_tenant_identifier(identifier: Optional[str]) -> bool:
    if not identifier:
        return False
    clean = str(identifier).lower().strip()
    return clean in (
        MAIN_TENANT_UUID.lower(),
        MAIN_TENANT_CODE.lower(),
        "platform",
        "global",
        "all",
        "boi",
    )

# Retrieves all real database employees bound to a specific channel partner or platform-wide
@router.get("/{tenant_uuid}/users", response_model=List[TenantUserResponse])
async def get_tenant_users(
    tenant_uuid: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_current_user_optional),
):
    # Channel Admins and Transactional Users are strictly isolated to their own channel tenant
    if current_user and current_user.role in ("CHANNEL_ADMIN", "TRANSACTIONAL_USER"):
        tenant_uuid = current_user.tenant_id or tenant_uuid

    stmt = select(TenantModel).where(
        or_(
            TenantModel.tenant_uuid == tenant_uuid,
            TenantModel.id == tenant_uuid,
            TenantModel.code == tenant_uuid,
        )
    )
    res = await db.execute(stmt)
    tenant = res.scalars().first()

    is_main = is_main_tenant_identifier(tenant_uuid) or (
        tenant and (
            tenant.tenant_uuid == MAIN_TENANT_UUID or 
            tenant.id == MAIN_TENANT_UUID or 
            tenant.code == MAIN_TENANT_CODE
        )
    )

    if is_main:
        # Bank of India Channel (Main Tenant):
        # Stores and displays all corporate leadership and management roles.
        # Excludes transactional users (loan officers) and external partner channel admins.
        main_ids = [MAIN_TENANT_UUID, MAIN_TENANT_CODE, "platform", "global"]
        if tenant:
            main_ids.extend([tenant.id, tenant.code, tenant.tenant_uuid])

        user_stmt = (
            select(UserModel)
            .where(
                UserModel.tenant_id.in_(main_ids),
                UserModel.role.in_([
                    "SUPER_ADMIN",
                    "REGIONAL_DIRECTOR",
                    "OPERATIONS_HEAD",
                    "ACCOUNTS_HEAD",
                    "AREA_MANAGER",
                    "TEAM_LEADER",
                    "SALES_MANAGER",
                ]),
            )
            .order_by(UserModel.created_at.asc())
        )
        user_res = await db.execute(user_stmt)
        users = user_res.scalars().all()

        res_list = []
        for u in users:
            computed_status = "ACTIVE" if u.is_active else "SUSPENDED"
            res_list.append(
                TenantUserResponse(
                    id=u.id,
                    tenant_id=MAIN_TENANT_UUID,
                    name=u.full_name or (u.username.split("@")[0].replace(".", " ").title() if "@" in u.username else u.username),
                    email=u.email or u.username,
                    role=u.role,
                    status=computed_status,
                )
            )
        return res_list

    # Partner Sub-Tenant (e.g. Apex FinTech Punjab):
    # Only displays Channel Admin and Transactional Users of THIS specific channel partner.
    if not tenant:
        return []

    tenant_ids = [tenant.id, tenant.code]
    if tenant.tenant_uuid:
        tenant_ids.append(tenant.tenant_uuid)

    user_stmt = (
        select(UserModel)
        .where(
            and_(
                or_(
                    UserModel.tenant_id.in_(tenant_ids),
                    UserModel.email == tenant.contact_email,
                    UserModel.username == tenant.contact_email,
                ),
                UserModel.role.in_(["CHANNEL_ADMIN", "TRANSACTIONAL_USER"]),
            )
        )
        .order_by(UserModel.created_at.asc())
    )
    user_res = await db.execute(user_stmt)
    users = user_res.scalars().all()

    return [
        TenantUserResponse(
            id=u.id,
            tenant_id=tenant.tenant_uuid or tenant.id,
            name=u.full_name or (u.username.split("@")[0].replace(".", " ").title() if "@" in u.username else u.username),
            email=u.email or u.username,
            role=u.role,
            status="ACTIVE" if (u.is_active or tenant.status == "active") else ("PENDING" if tenant.status in ("pending", "under_review") else "SUSPENDED"),
        )
        for u in users
    ]

# Adds a new employee directly into the database for this channel partner or platform
@router.post("/{tenant_uuid}/users", response_model=TenantUserResponse)
async def create_tenant_user(
    tenant_uuid: str,
    payload: CreateTenantUserPayload,
    db: AsyncSession = Depends(get_db),
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

    is_main = is_main_tenant_identifier(tenant_uuid) or (
        tenant and (
            tenant.tenant_uuid == MAIN_TENANT_UUID or 
            tenant.id == MAIN_TENANT_UUID or 
            tenant.code == MAIN_TENANT_CODE
        )
    )

    if not is_main:
        # Sub-Tenant validation: Only Transactional Users can be added here
        if not tenant:
            raise HTTPException(status_code=404, detail="Partner tenant not found.")
        if payload.role != "TRANSACTIONAL_USER":
            raise HTTPException(
                status_code=400,
                detail="Partner channels can only add Transactional Users (Loan Officers). Corporate governance roles are reserved for the Main Tenant (Bank of India Channel)."
            )
        target_tenant_id = tenant.id
        effective_role = "TRANSACTIONAL_USER"
    else:
        # Main Tenant validation
        if payload.role == "TRANSACTIONAL_USER":
            raise HTTPException(
                status_code=400,
                detail="Transactional users (Loan Officers) cannot be created in the Main Tenant. They must be created inside their respective partner channel workspace."
            )

        effective_role = payload.role
        if payload.role == "CHANNEL_ADMIN":
            # Provision/link new partner tenant for this Channel Admin
            channel_name = payload.name.strip()
            slug = channel_name.lower().replace(" ", "-").replace("admin", "").strip("-") or f"channel-{secrets.token_hex(3)}"
            existing_partner = await db.scalar(
                select(TenantModel).where(or_(TenantModel.name == channel_name, TenantModel.code == f"tenant-{slug}"))
            )
            if existing_partner:
                target_tenant_id = existing_partner.id
            else:
                new_partner_uuid = str(uuid.uuid4())
                new_partner = TenantModel(
                    id=new_partner_uuid,
                    tenant_uuid=new_partner_uuid,
                    name=f"{channel_name} Channel" if "Channel" not in channel_name else channel_name,
                    code=f"tenant-{slug}",
                    channel_type="FINTECH_PARTNER",
                    status="active",
                    cibil_overlay=10,
                    contact_email=payload.email.strip().lower(),
                    is_active=True,
                )
                db.add(new_partner)
                await db.flush()
                target_tenant_id = new_partner.id
        else:
            # Corporate leadership role in Main Tenant
            main_t = tenant or await db.scalar(select(TenantModel).where(TenantModel.id == MAIN_TENANT_UUID))
            target_tenant_id = main_t.id if main_t else MAIN_TENANT_UUID

    # Check and register role in RoleModel if missing
    role_stmt = select(RoleModel).where(RoleModel.name == effective_role)
    role_res = await db.execute(role_stmt)
    role_found = role_res.scalars().first()
    if not role_found:
        new_role_model = RoleModel(
            name=effective_role,
            display_name=effective_role.replace("_", " ").title(),
            description=f"Dynamic role {effective_role}",
            governance_level="PLATFORM" if effective_role in ("SUPER_ADMIN", "REGIONAL_DIRECTOR", "OPERATIONS_HEAD", "ACCOUNTS_HEAD") else "TENANT",
            hierarchy_tier=0 if effective_role == "SUPER_ADMIN" else 6,
            is_system_role=False,
        )
        db.add(new_role_model)
        await db.flush()

    email_clean = payload.email.strip().lower()
    existing_stmt = select(UserModel).where(
        or_(UserModel.username == email_clean, UserModel.email == email_clean)
    )
    existing_res = await db.execute(existing_stmt)
    existing = existing_res.scalars().first()

    user_salt = generate_salt(16)
    pwd_hash = derive_password_hash("FlowBRE@2026!", user_salt)

    if existing:
        existing.tenant_id = target_tenant_id
        existing.full_name = payload.name.strip()
        existing.role = effective_role
        existing.is_active = (payload.status == "ACTIVE")
        await db.commit()
        await db.refresh(existing)
        target_user = existing
    else:
        new_user = UserModel(
            username=email_clean,
            email=email_clean,
            full_name=payload.name.strip(),
            role=effective_role,
            tenant_id=target_tenant_id,
            is_active=(payload.status == "ACTIVE"),
            password_hash=pwd_hash,
            salt=user_salt,
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        target_user = new_user

    return TenantUserResponse(
        id=target_user.id,
        tenant_id=tenant_uuid,
        name=target_user.full_name or target_user.username,
        email=target_user.email or target_user.username,
        role=target_user.role,
        status="ACTIVE" if target_user.is_active else "SUSPENDED",
    )

# Updates an existing employee in the database
@router.patch("/{tenant_uuid}/users/{user_id}", response_model=TenantUserResponse)
async def update_tenant_user(
    tenant_uuid: str,
    user_id: str,
    payload: UpdateTenantUserPayload,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(UserModel).where(UserModel.id == user_id)
    res = await db.execute(stmt)
    user = res.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if payload.name is not None:
        user.full_name = payload.name.strip()
    if payload.role is not None:
        user.role = payload.role
    if payload.status is not None:
        user.is_active = (payload.status == "ACTIVE")

    await db.commit()
    await db.refresh(user)

    return TenantUserResponse(
        id=user.id,
        tenant_id=tenant_uuid,
        name=user.full_name or user.username,
        email=user.email or user.username,
        role=user.role,
        status="ACTIVE" if user.is_active else "SUSPENDED",
    )

# Deletes or removes an employee from the channel
@router.delete("/{tenant_uuid}/users/{user_id}")
async def delete_tenant_user(
    tenant_uuid: str,
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(UserModel).where(UserModel.id == user_id)
    res = await db.execute(stmt)
    user = res.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    await db.delete(user)
    await db.commit()
    return {"success": True, "message": "User deleted successfully."}

