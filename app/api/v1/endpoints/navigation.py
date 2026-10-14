import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant, security_bearer
from app.core.database import get_db
from app.core.security import verify_token
from app.db.models.module import (
    ModuleCatalogModel,
    TenantModuleEntitlementModel,
    RoleModulePermissionModel,
)
from app.api.schemas.navigation import (
    NavigationModulesResponse,
    NavModuleItem,
    NavSectionGroup,
    ModuleCatalogItem,
    ModuleCatalogCreate,
    ModuleCatalogUpdate,
    RolePermissionMatrixItem,
    RolePermissionMatrixUpdateRequest,
    TenantModuleEntitlementItem,
    TenantModuleToggleRequest,
)

router = APIRouter()

# Canonical platform module catalog with tier depth and role entitlement rules (fallback specification)
MODULE_CATALOG = [
    # Section 1: Portal Navigation
    {
        "code": "DASHBOARD",
        "name": "Dashboard",
        "route_template": "/{tenant}/dashboard",
        "icon": "LayoutDashboard",
        "section_key": "PORTAL_NAV",
        "section_title": "Portal Navigation",
        "badge": None,
        "badge_type": None,
        "allowed_roles": ["SUPER_ADMIN", "REGIONAL_DIRECTOR", "OPERATIONS_HEAD", "ACCOUNTS_HEAD", "AREA_MANAGER", "TEAM_LEADER", "SALES_MANAGER", "CHANNEL_ADMIN", "TRANSACTIONAL_USER"],
        "min_tier": 6,
    },
    {
        "code": "ONBOARDING",
        "name": "Onboarding Wizard",
        "route_template": "/{tenant}",
        "icon": "FileText",
        "section_key": "PORTAL_NAV",
        "section_title": "Portal Navigation",
        "badge": "Steps 1–6",
        "badge_type": "brand",
        "allowed_roles": ["SUPER_ADMIN", "REGIONAL_DIRECTOR", "OPERATIONS_HEAD", "ACCOUNTS_HEAD", "AREA_MANAGER", "TEAM_LEADER", "SALES_MANAGER", "CHANNEL_ADMIN", "TRANSACTIONAL_USER"],
        "min_tier": 6,
    },
    {
        "code": "USER_MANAGEMENT",
        "name": "User Management",
        "route_template": "/{tenant}/assignments",
        "icon": "Users",
        "section_key": "PORTAL_NAV",
        "section_title": "Portal Navigation",
        "badge": None,
        "badge_type": None,
        "allowed_roles": ["SUPER_ADMIN", "REGIONAL_DIRECTOR", "OPERATIONS_HEAD", "ACCOUNTS_HEAD", "AREA_MANAGER", "TEAM_LEADER", "SALES_MANAGER", "CHANNEL_ADMIN"],
        "min_tier": 5,
    },
    {
        "code": "ANALYTICS",
        "name": "Analytics",
        "route_template": "/{tenant}/telemetry",
        "icon": "BarChart3",
        "section_key": "PORTAL_NAV",
        "section_title": "Portal Navigation",
        "badge": None,
        "badge_type": None,
        "allowed_roles": ["SUPER_ADMIN", "REGIONAL_DIRECTOR", "OPERATIONS_HEAD", "ACCOUNTS_HEAD", "AREA_MANAGER", "TEAM_LEADER", "SALES_MANAGER"],
        "min_tier": 4,
    },

    # Section 2: Operations & Sales
    {
        "code": "PIPELINE",
        "name": "Sales Pipeline",
        "route_template": "/{tenant}/pipeline",
        "icon": "GitPullRequest",
        "section_key": "OPERATIONS_SALES",
        "section_title": "Operations & Sales",
        "badge": None,
        "badge_type": None,
        "allowed_roles": ["SUPER_ADMIN", "REGIONAL_DIRECTOR", "AREA_MANAGER", "TEAM_LEADER", "SALES_MANAGER", "CHANNEL_ADMIN", "TRANSACTIONAL_USER"],
        "min_tier": 6,
    },
    {
        "code": "APPROVALS",
        "name": "Approvals",
        "route_template": "/{tenant}/approvals",
        "icon": "CheckCircle",
        "section_key": "OPERATIONS_SALES",
        "section_title": "Operations & Sales",
        "badge": "Underwriting",
        "badge_type": "emerald",
        "allowed_roles": ["SUPER_ADMIN", "REGIONAL_DIRECTOR", "OPERATIONS_HEAD", "AREA_MANAGER"],
        "min_tier": 1,
    },
    {
        "code": "COMMISSIONS",
        "name": "Commissions",
        "route_template": "/{tenant}/commissions",
        "icon": "CreditCard",
        "section_key": "OPERATIONS_SALES",
        "section_title": "Operations & Sales",
        "badge": None,
        "badge_type": None,
        "allowed_roles": ["SUPER_ADMIN", "REGIONAL_DIRECTOR", "ACCOUNTS_HEAD", "AREA_MANAGER", "TEAM_LEADER", "SALES_MANAGER", "CHANNEL_ADMIN"],
        "min_tier": 5,
    },
    {
        "code": "REGIONAL_HIERARCHY",
        "name": "Regional Hierarchy",
        "route_template": "/{tenant}/regional",
        "icon": "MapPin",
        "section_key": "OPERATIONS_SALES",
        "section_title": "Operations & Sales",
        "badge": None,
        "badge_type": None,
        "allowed_roles": ["SUPER_ADMIN", "REGIONAL_DIRECTOR", "AREA_MANAGER", "TEAM_LEADER", "SALES_MANAGER"],
        "min_tier": 4,
    },

    # Section 3: Platform Oversight (Application Owners)
    {
        "code": "PLATFORM_OVERVIEW",
        "name": "Platform Overview",
        "route_template": "/platform/dashboard",
        "icon": "Crown",
        "section_key": "PLATFORM_GOVERNANCE",
        "section_title": "Platform Oversight (Application Owners)",
        "badge": "Owner",
        "badge_type": "amber",
        "allowed_roles": ["SUPER_ADMIN", "OPERATIONS_HEAD"],
        "min_tier": 1,
    },
    {
        "code": "LOGS",
        "name": "Live Logs & Audit",
        "route_template": "/{tenant}/logs",
        "icon": "Activity",
        "section_key": "PLATFORM_GOVERNANCE",
        "section_title": "Platform Oversight (Application Owners)",
        "badge": "Live",
        "badge_type": "amber",
        "allowed_roles": ["SUPER_ADMIN", "OPERATIONS_HEAD", "ACCOUNTS_HEAD", "REGIONAL_DIRECTOR", "AREA_MANAGER", "CHANNEL_ADMIN"],
        "min_tier": 1,
    },
    {
        "code": "DB_HEALTH",
        "name": "Database Health",
        "route_template": "/platform/db-health",
        "icon": "Activity",
        "section_key": "PLATFORM_GOVERNANCE",
        "section_title": "Platform Oversight (Application Owners)",
        "badge": None,
        "badge_type": None,
        "allowed_roles": ["SUPER_ADMIN", "OPERATIONS_HEAD", "DB_ADMIN"],
        "min_tier": 1,
    },
    {
        "code": "CYBER_CELL",
        "name": "Cyber Security Cell",
        "route_template": "/platform/cyber-cell",
        "icon": "ShieldAlert",
        "section_key": "PLATFORM_GOVERNANCE",
        "section_title": "Platform Oversight (Application Owners)",
        "badge": "SOC",
        "badge_type": "rose",
        "allowed_roles": ["SUPER_ADMIN", "OPERATIONS_HEAD", "SOC_ANALYST"],
        "min_tier": 1,
    },
    {
        "code": "BILLING",
        "name": "Platform Billing",
        "route_template": "/platform/billing",
        "icon": "DollarSign",
        "section_key": "PLATFORM_GOVERNANCE",
        "section_title": "Platform Oversight (Application Owners)",
        "badge": None,
        "badge_type": None,
        "allowed_roles": ["SUPER_ADMIN", "ACCOUNTS_HEAD"],
        "min_tier": 1,
    },
]

ALL_SYSTEM_ROLES = [
    "SUPER_ADMIN",
    "REGIONAL_DIRECTOR",
    "OPERATIONS_HEAD",
    "ACCOUNTS_HEAD",
    "AREA_MANAGER",
    "TEAM_LEADER",
    "SALES_MANAGER",
    "CHANNEL_ADMIN",
    "TRANSACTIONAL_USER",
    "DB_ADMIN",
    "SOC_ANALYST",
]


async def resolve_effective_role(role_override: Optional[str], auth_header: Optional[any]) -> str:
    if role_override:
        return role_override.upper()
    if auth_header and hasattr(auth_header, "credentials") and auth_header.credentials:
        payload = verify_token(auth_header.credentials)
        if payload and "role" in payload:
            return str(payload["role"]).upper()
    return "SUPER_ADMIN"


@router.get("/modules", response_model=NavigationModulesResponse)
async def get_user_navigation_modules(
    role: Optional[str] = Query(None, description="Active role key override for simulation"),
    tenant_id: str = Depends(get_current_tenant),
    auth: Optional[any] = Depends(security_bearer),
    db: AsyncSession = Depends(get_db),
):
    """
    Dynamically resolves navigation sections and module items for the active user session.
    Reads active modules from database catalog, respects tenant entitlements, and filters by role capabilities.
    """
    user_role = await resolve_effective_role(role, auth)
    prefix = tenant_id if tenant_id and tenant_id != "platform" else ""

    sections_map = {}

    try:
        # 1. Query database catalog
        stmt_mods = select(ModuleCatalogModel).where(ModuleCatalogModel.is_active == True).order_by(ModuleCatalogModel.sort_order.asc())
        res_mods = await db.execute(stmt_mods)
        db_modules = res_mods.scalars().all()

        if db_modules and len(db_modules) > 0:
            # Load tenant entitlements for this tenant
            stmt_tent = select(TenantModuleEntitlementModel).where(TenantModuleEntitlementModel.tenant_id == tenant_id)
            res_tent = await db.execute(stmt_tent)
            tenant_entitlements = {te.module_code.upper(): te for te in res_tent.scalars().all()}

            # Load role permissions for this role
            stmt_perm = select(RoleModulePermissionModel).where(RoleModulePermissionModel.role_key == user_role)
            res_perm = await db.execute(stmt_perm)
            role_permissions = {rp.module_code.upper(): rp for rp in res_perm.scalars().all()}

            for mod in db_modules:
                code_upper = mod.code.upper()

                # Check tenant entitlement override
                if code_upper in tenant_entitlements:
                    te = tenant_entitlements[code_upper]
                    if not te.is_enabled:
                        continue
                    display_name = te.custom_name or mod.name
                else:
                    display_name = mod.name

                # Check role permission
                if code_upper in role_permissions:
                    rp = role_permissions[code_upper]
                    if not rp.can_view:
                        continue
                    can_create = rp.can_create
                    can_edit = rp.can_edit
                    can_approve = rp.can_approve
                else:
                    if user_role != "SUPER_ADMIN":
                        continue
                    can_create = True
                    can_edit = True
                    can_approve = True

                sec_key = mod.section_key
                if sec_key not in sections_map:
                    sections_map[sec_key] = {
                        "title": mod.section_title,
                        "section_key": sec_key,
                        "items": [],
                    }

                resolved_path = mod.route_template.replace("{tenant}", prefix).replace("//", "/")
                if not resolved_path.startswith("/"):
                    resolved_path = "/" + resolved_path

                sections_map[sec_key]["items"].append(
                    NavModuleItem(
                        code=mod.code,
                        name=display_name,
                        path=resolved_path,
                        icon=mod.icon_name,
                        badge=mod.badge,
                        badge_type=mod.badge_type,
                        can_create=can_create,
                        can_edit=can_edit,
                        can_approve=can_approve,
                    )
                )

            ordered_sections = [
                NavSectionGroup(**sec) for sec in sections_map.values() if len(sec["items"]) > 0
            ]
            if ordered_sections:
                return NavigationModulesResponse(tenant_id=tenant_id, role=user_role, sections=ordered_sections)

    except Exception:
        # Fall through to robust canonical fallback
        pass

    # 2. Canonical Static Fallback
    for mod in MODULE_CATALOG:
        if user_role not in mod["allowed_roles"]:
            continue

        sec_key = mod["section_key"]
        if sec_key not in sections_map:
            sections_map[sec_key] = {
                "title": mod["section_title"],
                "section_key": sec_key,
                "items": [],
            }

        resolved_path = mod["route_template"].replace("{tenant}", prefix).replace("//", "/")
        if not resolved_path.startswith("/"):
            resolved_path = "/" + resolved_path

        sections_map[sec_key]["items"].append(
            NavModuleItem(
                code=mod["code"],
                name=mod["name"],
                path=resolved_path,
                icon=mod["icon"],
                badge=mod["badge"],
                badge_type=mod["badge_type"],
                can_create=user_role in ["SUPER_ADMIN", "REGIONAL_DIRECTOR", "AREA_MANAGER", "CHANNEL_ADMIN", "TRANSACTIONAL_USER"],
                can_edit=user_role in ["SUPER_ADMIN", "REGIONAL_DIRECTOR", "AREA_MANAGER", "CHANNEL_ADMIN"],
                can_approve=user_role in ["SUPER_ADMIN", "REGIONAL_DIRECTOR", "OPERATIONS_HEAD"],
            )
        )

    ordered_sections = [
        NavSectionGroup(**sec) for sec in sections_map.values() if len(sec["items"]) > 0
    ]

    return NavigationModulesResponse(
        tenant_id=tenant_id,
        role=user_role,
        sections=ordered_sections,
    )


@router.get("/catalog", response_model=List[ModuleCatalogItem])
async def list_module_catalog(db: AsyncSession = Depends(get_db)):
    """Lists all modules in the dynamic platform module catalog."""
    stmt = select(ModuleCatalogModel).order_by(ModuleCatalogModel.sort_order.asc())
    res = await db.execute(stmt)
    mods = res.scalars().all()

    if not mods:
        # Return canonical modules specification
        return [
            ModuleCatalogItem(
                id=str(idx + 1),
                code=m["code"],
                name=m["name"],
                route_template=m["route_template"],
                icon_name=m["icon"],
                section_key=m["section_key"],
                section_title=m["section_title"],
                badge=m["badge"],
                badge_type=m["badge_type"],
                min_tier_level=m["min_tier"],
                is_core=m["code"] in ["DASHBOARD", "ONBOARDING"],
                is_active=True,
                sort_order=idx + 1,
                description=f"Dynamic module: {m['name']}",
            )
            for idx, m in enumerate(MODULE_CATALOG)
        ]

    return [
        ModuleCatalogItem(
            id=m.id,
            code=m.code,
            name=m.name,
            route_template=m.route_template,
            icon_name=m.icon_name,
            section_key=m.section_key,
            section_title=m.section_title,
            badge=m.badge,
            badge_type=m.badge_type,
            min_tier_level=m.min_tier_level,
            is_core=m.is_core,
            is_active=m.is_active,
            sort_order=m.sort_order,
            description=m.description,
        )
        for m in mods
    ]


@router.post("/catalog", response_model=ModuleCatalogItem, status_code=status.HTTP_201_CREATED)
async def create_module_catalog_item(
    item: ModuleCatalogCreate,
    db: AsyncSession = Depends(get_db),
):
    """Creates a new dynamic module in the catalog and initializes default role permissions."""
    code_upper = item.code.strip().upper()
    stmt_exist = select(ModuleCatalogModel).where(ModuleCatalogModel.code == code_upper)
    res_exist = await db.execute(stmt_exist)
    if res_exist.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Module with code '{code_upper}' already exists in catalog.",
        )

    new_mod = ModuleCatalogModel(
        code=code_upper,
        name=item.name.strip(),
        route_template=item.route_template.strip(),
        icon_name=item.icon_name.strip(),
        section_key=item.section_key.strip(),
        section_title=item.section_title.strip(),
        badge=item.badge,
        badge_type=item.badge_type,
        min_tier_level=item.min_tier_level,
        is_core=item.is_core,
        is_active=item.is_active,
        sort_order=item.sort_order,
        description=item.description,
    )
    db.add(new_mod)

    # Initialize default role permissions for the new module
    for role_key in ALL_SYSTEM_ROLES:
        is_super = role_key == "SUPER_ADMIN"
        perm = RoleModulePermissionModel(
            role_key=role_key,
            module_code=code_upper,
            can_view=True,
            can_create=is_super,
            can_edit=is_super,
            can_approve=is_super,
        )
        db.add(perm)

    await db.commit()
    await db.refresh(new_mod)

    return ModuleCatalogItem(
        id=new_mod.id,
        code=new_mod.code,
        name=new_mod.name,
        route_template=new_mod.route_template,
        icon_name=new_mod.icon_name,
        section_key=new_mod.section_key,
        section_title=new_mod.section_title,
        badge=new_mod.badge,
        badge_type=new_mod.badge_type,
        min_tier_level=new_mod.min_tier_level,
        is_core=new_mod.is_core,
        is_active=new_mod.is_active,
        sort_order=new_mod.sort_order,
        description=new_mod.description,
    )


@router.put("/catalog/{code}", response_model=ModuleCatalogItem)
async def update_module_catalog_item(
    code: str,
    item: ModuleCatalogUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Updates properties of an existing dynamic module in the catalog."""
    code_upper = code.strip().upper()
    stmt = select(ModuleCatalogModel).where(ModuleCatalogModel.code == code_upper)
    res = await db.execute(stmt)
    mod = res.scalars().first()
    if not mod:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Module '{code_upper}' was not found in the catalog.",
        )

    update_data = item.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(mod, field, val)

    await db.commit()
    await db.refresh(mod)

    return ModuleCatalogItem(
        id=mod.id,
        code=mod.code,
        name=mod.name,
        route_template=mod.route_template,
        icon_name=mod.icon_name,
        section_key=mod.section_key,
        section_title=mod.section_title,
        badge=mod.badge,
        badge_type=mod.badge_type,
        min_tier_level=mod.min_tier_level,
        is_core=mod.is_core,
        is_active=mod.is_active,
        sort_order=mod.sort_order,
        description=mod.description,
    )


@router.delete("/catalog/{code}")
async def delete_module_catalog_item(
    code: str,
    hard: bool = Query(False, description="Permanently delete the module and its permissions"),
    db: AsyncSession = Depends(get_db),
):
    """Deactivates or permanently deletes a module from the dynamic catalog."""
    code_upper = code.strip().upper()
    stmt = select(ModuleCatalogModel).where(ModuleCatalogModel.code == code_upper)
    res = await db.execute(stmt)
    mod = res.scalars().first()
    if not mod:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Module '{code_upper}' not found.",
        )

    if mod.is_core:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Core system module '{code_upper}' cannot be deleted.",
        )

    if hard:
        await db.execute(delete(RoleModulePermissionModel).where(RoleModulePermissionModel.module_code == code_upper))
        await db.execute(delete(TenantModuleEntitlementModel).where(TenantModuleEntitlementModel.module_code == code_upper))
        await db.delete(mod)
        await db.commit()
        return {"message": f"Module '{code_upper}' permanently deleted."}

    mod.is_active = False
    await db.commit()
    return {"message": f"Module '{code_upper}' successfully deactivated."}



@router.get("/matrix", response_model=List[RolePermissionMatrixItem])
async def get_role_permission_matrix(db: AsyncSession = Depends(get_db)):
    """Returns the full role-to-module permission entitlement matrix."""
    stmt = select(RoleModulePermissionModel)
    res = await db.execute(stmt)
    perms = res.scalars().all()

    if not perms:
        # Generate default matrix from catalog specification
        defaults = []
        for mod in MODULE_CATALOG:
            for role_key in ALL_SYSTEM_ROLES:
                can_view = role_key in mod["allowed_roles"]
                can_create = role_key in ["SUPER_ADMIN", "REGIONAL_DIRECTOR", "AREA_MANAGER", "CHANNEL_ADMIN", "TRANSACTIONAL_USER"] and mod["code"] in ["ONBOARDING", "USER_MANAGEMENT", "PIPELINE"]
                can_edit = role_key in ["SUPER_ADMIN", "REGIONAL_DIRECTOR", "AREA_MANAGER", "CHANNEL_ADMIN"] and mod["code"] in ["USER_MANAGEMENT", "PIPELINE"]
                can_approve = role_key in ["SUPER_ADMIN", "REGIONAL_DIRECTOR", "OPERATIONS_HEAD"] and mod["code"] == "APPROVALS"
                defaults.append(
                    RolePermissionMatrixItem(
                        role_key=role_key,
                        module_code=mod["code"],
                        can_view=can_view,
                        can_create=can_create,
                        can_edit=can_edit,
                        can_approve=can_approve,
                    )
                )
        return defaults

    return [
        RolePermissionMatrixItem(
            role_key=p.role_key,
            module_code=p.module_code,
            can_view=p.can_view,
            can_create=p.can_create,
            can_edit=p.can_edit,
            can_approve=p.can_approve,
        )
        for p in perms
    ]


@router.post("/matrix")
async def update_role_permission_matrix(
    payload: RolePermissionMatrixUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Batch updates or creates role-to-module capabilities in the permission matrix."""
    count = 0
    for item in payload.permissions:
        stmt = select(RoleModulePermissionModel).where(
            RoleModulePermissionModel.role_key == item.role_key,
            RoleModulePermissionModel.module_code == item.module_code,
        )
        res = await db.execute(stmt)
        record = res.scalars().first()

        if record:
            record.can_view = item.can_view
            record.can_create = item.can_create
            record.can_edit = item.can_edit
            record.can_approve = item.can_approve
        else:
            new_record = RoleModulePermissionModel(
                role_key=item.role_key,
                module_code=item.module_code,
                can_view=item.can_view,
                can_create=item.can_create,
                can_edit=item.can_edit,
                can_approve=item.can_approve,
            )
            db.add(new_record)
        count += 1

    await db.commit()
    return {"message": f"Successfully updated {count} role module permissions."}


@router.get("/tenants/{tenant_id}/modules", response_model=List[TenantModuleEntitlementItem])
async def get_tenant_modules(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Retrieves tenant-specific module enablement and custom name overrides."""
    stmt = select(TenantModuleEntitlementModel).where(TenantModuleEntitlementModel.tenant_id == tenant_id)
    res = await db.execute(stmt)
    records = res.scalars().all()
    return [
        TenantModuleEntitlementItem(
            tenant_id=r.tenant_id,
            module_code=r.module_code,
            is_enabled=r.is_enabled,
            custom_name=r.custom_name,
        )
        for r in records
    ]


@router.put("/tenants/{tenant_id}/modules/{code}", response_model=TenantModuleEntitlementItem)
async def toggle_tenant_module(
    tenant_id: str,
    code: str,
    payload: TenantModuleToggleRequest,
    db: AsyncSession = Depends(get_db),
):
    """Enables/disables a module or applies a custom display name for a specific tenant."""
    code_upper = code.strip().upper()
    stmt = select(TenantModuleEntitlementModel).where(
        TenantModuleEntitlementModel.tenant_id == tenant_id,
        TenantModuleEntitlementModel.module_code == code_upper,
    )
    res = await db.execute(stmt)
    record = res.scalars().first()

    if record:
        record.is_enabled = payload.is_enabled
        if payload.custom_name is not None:
            record.custom_name = payload.custom_name
    else:
        record = TenantModuleEntitlementModel(
            tenant_id=tenant_id,
            module_code=code_upper,
            is_enabled=payload.is_enabled,
            custom_name=payload.custom_name,
        )
        db.add(record)

    await db.commit()
    await db.refresh(record)

    return TenantModuleEntitlementItem(
        tenant_id=record.tenant_id,
        module_code=record.module_code,
        is_enabled=record.is_enabled,
        custom_name=record.custom_name,
    )
