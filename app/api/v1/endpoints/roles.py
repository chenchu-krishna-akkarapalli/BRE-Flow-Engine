from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_tenant, get_current_user, require_roles
from app.api.schemas.role import (
    RoleHierarchyNodeCreate,
    RoleHierarchyNodeResponse,
)

router = APIRouter()

# In-memory seed registry aligned with Corporate & Sales reporting tree (Image 2)
CANONICAL_ROLES = [
    {
        "id": "role-super-admin",
        "tenant_id": "global",
        "role_key": "SUPER_ADMIN",
        "display_name": "Super Admin (Company Director)",
        "department": "CORPORATE",
        "parent_role_key": None,
        "tier_level": 0,
        "is_system_role": True,
        "description": "Top-level corporate director. Full system permissions and oversight of all regional, operational, and accounts activities.",
        "allowed_subordinates": ["REGIONAL_DIRECTOR", "OPERATIONS_HEAD", "ACCOUNTS_HEAD"],
        "validation_constraints": [
            "Strict corporate operations assignment.",
            "Root node of the organization tree.",
        ],
        "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "updated_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
    },
    {
        "id": "role-regional-director",
        "tenant_id": "global",
        "role_key": "REGIONAL_DIRECTOR",
        "display_name": "Regional Director",
        "department": "SALES",
        "parent_role_key": "SUPER_ADMIN",
        "tier_level": 1,
        "is_system_role": True,
        "description": "Tier 1 Parallel Head of Sales. Direct supervisor of Area Managers, responsible for regional sales targets and performance.",
        "allowed_subordinates": ["AREA_MANAGER"],
        "validation_constraints": [
            "Multi-region branch oversight.",
            "Regional quota authorization.",
        ],
        "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "updated_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
    },
    {
        "id": "role-operations-head",
        "tenant_id": "global",
        "role_key": "OPERATIONS_HEAD",
        "display_name": "Operations Head",
        "department": "CORPORATE",
        "parent_role_key": "SUPER_ADMIN",
        "tier_level": 1,
        "is_system_role": True,
        "description": "Tier 1 Parallel Head of Operations. Oversees platform processes, workflows, OCR configurations, and regional operations.",
        "allowed_subordinates": [],
        "validation_constraints": [
            "Credit committee policy matrix governance.",
            "SLA budget authorization.",
        ],
        "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "updated_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
    },
    {
        "id": "role-accounts-head",
        "tenant_id": "global",
        "role_key": "ACCOUNTS_HEAD",
        "display_name": "Accounts Head",
        "department": "CORPORATE",
        "parent_role_key": "SUPER_ADMIN",
        "tier_level": 1,
        "is_system_role": True,
        "description": "Tier 1 Parallel Head of Accounts. Manages financial ledgers, disbursements, billing, and transactional audit trails.",
        "allowed_subordinates": [],
        "validation_constraints": [
            "Disbursement ledger reconciliation.",
            "Financial audit log integrity.",
        ],
        "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "updated_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
    },
    {
        "id": "role-area-manager",
        "tenant_id": "global",
        "role_key": "AREA_MANAGER",
        "display_name": "Area Manager",
        "department": "SALES",
        "parent_role_key": "REGIONAL_DIRECTOR",
        "tier_level": 2,
        "is_system_role": True,
        "description": "Sales Tier 2. Supervises regional Team Leaders. Coordinates localized marketing and loan origination activities.",
        "allowed_subordinates": ["TEAM_LEADER"],
        "validation_constraints": [
            "Branch target alignment.",
            "Origination pipeline audit.",
        ],
        "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "updated_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
    },
    {
        "id": "role-team-leader",
        "tenant_id": "global",
        "role_key": "TEAM_LEADER",
        "display_name": "Team Leader",
        "department": "SALES",
        "parent_role_key": "AREA_MANAGER",
        "tier_level": 3,
        "is_system_role": True,
        "description": "Sales Tier 3. Manages localized Sales Managers. Coordinates application review pipelines and queues.",
        "allowed_subordinates": ["SALES_MANAGER"],
        "validation_constraints": [
            "Queue triage enforcement.",
            "Underwriting escalation review.",
        ],
        "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "updated_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
    },
    {
        "id": "role-sales-manager",
        "tenant_id": "global",
        "role_key": "SALES_MANAGER",
        "display_name": "Sales Manager",
        "department": "SALES",
        "parent_role_key": "TEAM_LEADER",
        "tier_level": 4,
        "is_system_role": True,
        "description": "Sales Tier 4. Direct manager of Channel Partners. Provides support and onboarding assistance for registered channels.",
        "allowed_subordinates": ["CHANNEL_ADMIN"],
        "validation_constraints": [
            "Channel partner onboarding validation.",
            "Partner SLA monitoring.",
        ],
        "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "updated_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
    },
    {
        "id": "role-channel-admin",
        "tenant_id": "global",
        "role_key": "CHANNEL_ADMIN",
        "display_name": "Channel Partner (Admin)",
        "department": "SALES",
        "parent_role_key": "SALES_MANAGER",
        "tier_level": 5,
        "is_system_role": True,
        "description": "Sales Tier 5. Channel-level administrator with full tenant permissions to configure rules, users, and submit applications.",
        "allowed_subordinates": ["TRANSACTIONAL_USER"],
        "validation_constraints": [
            "Strict corporate operations assignment.",
            "Channel tenant workspace governance.",
        ],
        "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "updated_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
    },
    {
        "id": "role-transactional-user",
        "tenant_id": "global",
        "role_key": "TRANSACTIONAL_USER",
        "display_name": "Transactional User",
        "department": "SALES",
        "parent_role_key": "CHANNEL_ADMIN",
        "tier_level": 6,
        "is_system_role": True,
        "description": "Sales Tier 6. Frontline loan officer and transactional agent. Manages 6-step applicant onboarding, document uploads, and instant evaluations.",
        "allowed_subordinates": [],
        "validation_constraints": [
            "Applicant onboarding submission.",
            "Document upload verification.",
        ],
        "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "updated_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
    },
]

# Mutable runtime storage for dynamic additions
DYNAMIC_ROLES: List[dict] = list(CANONICAL_ROLES)


@router.get("", response_model=List[RoleHierarchyNodeResponse])
async def list_roles(
    tenant_id: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
):
    """
    Returns all active role hierarchy nodes.
    Supports filtering by department.
    """
    results = DYNAMIC_ROLES
    if department and department.upper() != "ALL":
        results = [r for r in results if r["department"].upper() == department.upper()]
    return results


@router.post("", response_model=RoleHierarchyNodeResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    payload: RoleHierarchyNodeCreate,
    current_user: dict = Depends(require_roles("SUPER_ADMIN")),
):
    """
    Super Admin endpoint to ingest a new dynamic role.
    Calculates tier depth based on parent reporting node and prevents circular graphs.
    """
    formatted_key = payload.role_key.strip().upper().replace(" ", "_")

    # Duplicate check
    for existing in DYNAMIC_ROLES:
        if existing["role_key"] == formatted_key:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Role '{formatted_key}' already exists in the hierarchy.",
            )

    # Parent validation & Tier depth calculation
    parent_tier = 0
    if payload.parent_role_key:
        parent_node = next(
            (r for r in DYNAMIC_ROLES if r["role_key"] == payload.parent_role_key.upper()),
            None,
        )
        if not parent_node:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parent role '{payload.parent_role_key}' not found.",
            )
        parent_tier = parent_node["tier_level"]

    calculated_tier = parent_tier + 1 if payload.parent_role_key else 1
    now = datetime.now(timezone.utc)

    new_node = {
        "id": f"role-{int(now.timestamp())}",
        "tenant_id": "global",
        "role_key": formatted_key,
        "display_name": payload.display_name.strip(),
        "department": payload.department.upper(),
        "parent_role_key": payload.parent_role_key,
        "tier_level": calculated_tier,
        "is_system_role": False,
        "description": payload.description or f"Custom role under {payload.parent_role_key}",
        "allowed_subordinates": [],
        "validation_constraints": payload.validation_constraints or [
            "Dynamic tenant constraint check.",
            "Organizational reporting compliance.",
        ],
        "created_at": now,
        "updated_at": now,
    }

    # Update parent subordinates
    if payload.parent_role_key:
        for r in DYNAMIC_ROLES:
            if r["role_key"] == payload.parent_role_key and formatted_key not in r["allowed_subordinates"]:
                r["allowed_subordinates"].append(formatted_key)

    DYNAMIC_ROLES.append(new_node)
    return new_node
