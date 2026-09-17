"""Create dynamic module catalog, tenant entitlements, and role module permissions tables.

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-18
"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Initial 14 platform modules seed specification
INITIAL_MODULES = [
    {
        "code": "DASHBOARD",
        "name": "Dashboard",
        "route_template": "/{tenant}/dashboard",
        "icon_name": "LayoutDashboard",
        "section_key": "PORTAL_NAV",
        "section_title": "Portal Navigation",
        "badge": None,
        "badge_type": None,
        "min_tier_level": 6,
        "is_core": True,
        "sort_order": 1,
        "description": "Executive and operational KPI summary dashboard with status cards and metrics.",
        "allowed_roles": [
            "SUPER_ADMIN", "REGIONAL_DIRECTOR", "OPERATIONS_HEAD", "ACCOUNTS_HEAD",
            "AREA_MANAGER", "TEAM_LEADER", "SALES_MANAGER", "CHANNEL_ADMIN", "TRANSACTIONAL_USER",
            "DB_ADMIN", "SOC_ANALYST"
        ],
    },
    {
        "code": "ONBOARDING",
        "name": "Onboarding Wizard",
        "route_template": "/{tenant}",
        "icon_name": "FileText",
        "section_key": "PORTAL_NAV",
        "section_title": "Portal Navigation",
        "badge": "Steps 1–6",
        "badge_type": "brand",
        "min_tier_level": 6,
        "is_core": True,
        "sort_order": 2,
        "description": "Multi-step applicant intake wizard for loan onboarding and instant bureau evaluation.",
        "allowed_roles": [
            "SUPER_ADMIN", "REGIONAL_DIRECTOR", "OPERATIONS_HEAD", "ACCOUNTS_HEAD",
            "AREA_MANAGER", "TEAM_LEADER", "SALES_MANAGER", "CHANNEL_ADMIN", "TRANSACTIONAL_USER"
        ],
    },
    {
        "code": "USER_MANAGEMENT",
        "name": "User Management",
        "route_template": "/{tenant}/assignments",
        "icon_name": "Users",
        "section_key": "PORTAL_NAV",
        "section_title": "Portal Navigation",
        "badge": None,
        "badge_type": None,
        "min_tier_level": 5,
        "is_core": False,
        "sort_order": 3,
        "description": "User assignments, team roster configuration, and role delegation.",
        "allowed_roles": [
            "SUPER_ADMIN", "REGIONAL_DIRECTOR", "OPERATIONS_HEAD", "ACCOUNTS_HEAD",
            "AREA_MANAGER", "TEAM_LEADER", "SALES_MANAGER", "CHANNEL_ADMIN"
        ],
    },
    {
        "code": "ANALYTICS",
        "name": "Analytics",
        "route_template": "/{tenant}/telemetry",
        "icon_name": "BarChart3",
        "section_key": "PORTAL_NAV",
        "section_title": "Portal Navigation",
        "badge": None,
        "badge_type": None,
        "min_tier_level": 4,
        "is_core": False,
        "sort_order": 4,
        "description": "Rules evaluation pass rates, rejection distributions, and bank API response SLAs.",
        "allowed_roles": [
            "SUPER_ADMIN", "REGIONAL_DIRECTOR", "OPERATIONS_HEAD", "ACCOUNTS_HEAD",
            "AREA_MANAGER", "TEAM_LEADER", "SALES_MANAGER"
        ],
    },
    {
        "code": "SETTINGS",
        "name": "Settings",
        "route_template": "/{tenant}/configurator",
        "icon_name": "Sliders",
        "section_key": "PORTAL_NAV",
        "section_title": "Portal Navigation",
        "badge": None,
        "badge_type": None,
        "min_tier_level": 5,
        "is_core": False,
        "sort_order": 5,
        "description": "Global configurations, policy matrices, CIBIL overlays, and scoring thresholds.",
        "allowed_roles": [
            "SUPER_ADMIN", "REGIONAL_DIRECTOR", "OPERATIONS_HEAD", "ACCOUNTS_HEAD",
            "AREA_MANAGER", "CHANNEL_ADMIN"
        ],
    },
    {
        "code": "PIPELINE",
        "name": "Sales Pipeline",
        "route_template": "/{tenant}/pipeline",
        "icon_name": "GitPullRequest",
        "section_key": "OPERATIONS_SALES",
        "section_title": "Operations & Sales",
        "badge": None,
        "badge_type": None,
        "min_tier_level": 6,
        "is_core": False,
        "sort_order": 6,
        "description": "Loan origination funnel tracking across all active lead stages.",
        "allowed_roles": [
            "SUPER_ADMIN", "REGIONAL_DIRECTOR", "AREA_MANAGER", "TEAM_LEADER",
            "SALES_MANAGER", "CHANNEL_ADMIN", "TRANSACTIONAL_USER"
        ],
    },
    {
        "code": "APPROVALS",
        "name": "Approvals",
        "route_template": "/{tenant}/approvals",
        "icon_name": "CheckCircle",
        "section_key": "OPERATIONS_SALES",
        "section_title": "Operations & Sales",
        "badge": "Underwriting",
        "badge_type": "emerald",
        "min_tier_level": 1,
        "is_core": False,
        "sort_order": 7,
        "description": "Credit underwriting review queue for policy deviations and manual sign-offs.",
        "allowed_roles": ["SUPER_ADMIN", "REGIONAL_DIRECTOR", "OPERATIONS_HEAD", "AREA_MANAGER"],
    },
    {
        "code": "COMMISSIONS",
        "name": "Commissions",
        "route_template": "/{tenant}/commissions",
        "icon_name": "CreditCard",
        "section_key": "OPERATIONS_SALES",
        "section_title": "Operations & Sales",
        "badge": None,
        "badge_type": None,
        "min_tier_level": 5,
        "is_core": False,
        "sort_order": 8,
        "description": "Disbursement-linked channel partner commission ledgers and payout calculations.",
        "allowed_roles": [
            "SUPER_ADMIN", "REGIONAL_DIRECTOR", "ACCOUNTS_HEAD", "AREA_MANAGER",
            "TEAM_LEADER", "SALES_MANAGER", "CHANNEL_ADMIN"
        ],
    },
    {
        "code": "REGIONAL_HIERARCHY",
        "name": "Regional Hierarchy",
        "route_template": "/{tenant}/regional",
        "icon_name": "MapPin",
        "section_key": "OPERATIONS_SALES",
        "section_title": "Operations & Sales",
        "badge": None,
        "badge_type": None,
        "min_tier_level": 4,
        "is_core": False,
        "sort_order": 9,
        "description": "Hierarchical territory reporting view from Regional Directors down to Field Agents.",
        "allowed_roles": [
            "SUPER_ADMIN", "REGIONAL_DIRECTOR", "AREA_MANAGER", "TEAM_LEADER", "SALES_MANAGER"
        ],
    },
    {
        "code": "PLATFORM_OVERVIEW",
        "name": "Platform Overview",
        "route_template": "/platform/dashboard",
        "icon_name": "Crown",
        "section_key": "PLATFORM_GOVERNANCE",
        "section_title": "Platform Oversight (Application Owners)",
        "badge": "Owner",
        "badge_type": "amber",
        "min_tier_level": 1,
        "is_core": False,
        "sort_order": 10,
        "description": "Global multi-tenant platform health, aggregate volumes, and tenant provisioning oversight.",
        "allowed_roles": ["SUPER_ADMIN", "OPERATIONS_HEAD"],
    },
    {
        "code": "LOGS",
        "name": "Live Logs & Audit",
        "route_template": "/{tenant}/logs",
        "icon_name": "Activity",
        "section_key": "PLATFORM_GOVERNANCE",
        "section_title": "Platform Oversight (Application Owners)",
        "badge": "Live",
        "badge_type": "amber",
        "min_tier_level": 1,
        "is_core": False,
        "sort_order": 11,
        "description": "Real-time streaming rule engine execution telemetry and system audit events.",
        "allowed_roles": [
            "SUPER_ADMIN", "OPERATIONS_HEAD", "ACCOUNTS_HEAD", "REGIONAL_DIRECTOR",
            "AREA_MANAGER", "CHANNEL_ADMIN"
        ],
    },
    {
        "code": "DB_HEALTH",
        "name": "Database Health",
        "route_template": "/platform/db-health",
        "icon_name": "Activity",
        "section_key": "PLATFORM_GOVERNANCE",
        "section_title": "Platform Oversight (Application Owners)",
        "badge": None,
        "badge_type": None,
        "min_tier_level": 1,
        "is_core": False,
        "sort_order": 12,
        "description": "PostgreSQL database connection pool metrics, migration status, and query latencies.",
        "allowed_roles": ["SUPER_ADMIN", "OPERATIONS_HEAD", "DB_ADMIN"],
    },
    {
        "code": "CYBER_CELL",
        "name": "Cyber Security Cell",
        "route_template": "/platform/cyber-cell",
        "icon_name": "ShieldAlert",
        "section_key": "PLATFORM_GOVERNANCE",
        "section_title": "Platform Oversight (Application Owners)",
        "badge": "SOC",
        "badge_type": "rose",
        "min_tier_level": 1,
        "is_core": False,
        "sort_order": 13,
        "description": "SOC dashboard tracking security events, rate-limit triggers, and anomalous IP behavior.",
        "allowed_roles": ["SUPER_ADMIN", "OPERATIONS_HEAD", "SOC_ANALYST"],
    },
    {
        "code": "BILLING",
        "name": "Platform Billing",
        "route_template": "/platform/billing",
        "icon_name": "DollarSign",
        "section_key": "PLATFORM_GOVERNANCE",
        "section_title": "Platform Oversight (Application Owners)",
        "badge": None,
        "badge_type": None,
        "min_tier_level": 1,
        "is_core": False,
        "sort_order": 14,
        "description": "Platform SaaS subscription management, API usage billing, and tenant invoices.",
        "allowed_roles": ["SUPER_ADMIN", "ACCOUNTS_HEAD"],
    },
]


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    # 1. Create module_catalog table
    if "module_catalog" not in tables:
        op.create_table(
            "module_catalog",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("code", sa.String(64), unique=True, nullable=False, index=True),
            sa.Column("name", sa.String(128), nullable=False),
            sa.Column("route_template", sa.String(256), nullable=False),
            sa.Column("icon_name", sa.String(64), nullable=False),
            sa.Column("section_key", sa.String(64), nullable=False, index=True),
            sa.Column("section_title", sa.String(128), nullable=False),
            sa.Column("badge", sa.String(64), nullable=True),
            sa.Column("badge_type", sa.String(32), nullable=True),
            sa.Column("min_tier_level", sa.Integer(), server_default="6", nullable=False),
            sa.Column("is_core", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    # 2. Create tenant_module_entitlement table
    if "tenant_module_entitlement" not in tables:
        op.create_table(
            "tenant_module_entitlement",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
            sa.Column("module_code", sa.String(64), nullable=False, index=True),
            sa.Column("is_enabled", sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column("custom_name", sa.String(128), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.UniqueConstraint("tenant_id", "module_code", name="uq_tenant_module"),
        )

    # 3. Create role_module_permission table
    if "role_module_permission" not in tables:
        op.create_table(
            "role_module_permission",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("role_key", sa.String(64), nullable=False, index=True),
            sa.Column("module_code", sa.String(64), nullable=False, index=True),
            sa.Column("can_view", sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column("can_create", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.Column("can_edit", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.Column("can_approve", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.UniqueConstraint("role_key", "module_code", name="uq_role_module_permission"),
        )

    # 4. Seed initial modules and role permissions
    module_catalog_table = sa.table(
        "module_catalog",
        sa.column("id", sa.String),
        sa.column("code", sa.String),
        sa.column("name", sa.String),
        sa.column("route_template", sa.String),
        sa.column("icon_name", sa.String),
        sa.column("section_key", sa.String),
        sa.column("section_title", sa.String),
        sa.column("badge", sa.String),
        sa.column("badge_type", sa.String),
        sa.column("min_tier_level", sa.Integer),
        sa.column("is_core", sa.Boolean),
        sa.column("is_active", sa.Boolean),
        sa.column("sort_order", sa.Integer),
        sa.column("description", sa.Text),
    )

    role_perm_table = sa.table(
        "role_module_permission",
        sa.column("id", sa.String),
        sa.column("role_key", sa.String),
        sa.column("module_code", sa.String),
        sa.column("can_view", sa.Boolean),
        sa.column("can_create", sa.Boolean),
        sa.column("can_edit", sa.Boolean),
        sa.column("can_approve", sa.Boolean),
    )

    for mod in INITIAL_MODULES:
        mod_id = str(uuid.uuid4())
        op.execute(
            module_catalog_table.insert().values(
                id=mod_id,
                code=mod["code"],
                name=mod["name"],
                route_template=mod["route_template"],
                icon_name=mod["icon_name"],
                section_key=mod["section_key"],
                section_title=mod["section_title"],
                badge=mod["badge"],
                badge_type=mod["badge_type"],
                min_tier_level=mod["min_tier_level"],
                is_core=mod["is_core"],
                is_active=True,
                sort_order=mod["sort_order"],
                description=mod["description"],
            )
        )

        for role_key in mod["allowed_roles"]:
            perm_id = str(uuid.uuid4())
            can_create = role_key in ["SUPER_ADMIN", "REGIONAL_DIRECTOR", "AREA_MANAGER", "CHANNEL_ADMIN", "TRANSACTIONAL_USER"] and mod["code"] in ["ONBOARDING", "USER_MANAGEMENT", "PIPELINE"]
            can_edit = role_key in ["SUPER_ADMIN", "REGIONAL_DIRECTOR", "AREA_MANAGER", "CHANNEL_ADMIN"] and mod["code"] in ["SETTINGS", "USER_MANAGEMENT", "PIPELINE"]
            can_approve = role_key in ["SUPER_ADMIN", "REGIONAL_DIRECTOR", "OPERATIONS_HEAD"] and mod["code"] == "APPROVALS"

            op.execute(
                role_perm_table.insert().values(
                    id=perm_id,
                    role_key=role_key,
                    module_code=mod["code"],
                    can_view=True,
                    can_create=can_create,
                    can_edit=can_edit,
                    can_approve=can_approve,
                )
            )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    if "role_module_permission" in tables:
        op.drop_table("role_module_permission")
    if "tenant_module_entitlement" in tables:
        op.drop_table("tenant_module_entitlement")
    if "module_catalog" in tables:
        op.drop_table("module_catalog")
