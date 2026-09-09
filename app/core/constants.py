from typing import Any, Dict, List

# Standard Platform and Tenant RBAC Role Constants
ROLE_SUPER_ADMIN = "SUPER_ADMIN"
ROLE_OPERATIONS_HEAD = "OPERATIONS_HEAD"
ROLE_ACCOUNTS_HEAD = "ACCOUNTS_HEAD"
ROLE_REGIONAL_DIRECTOR = "REGIONAL_DIRECTOR"
ROLE_AREA_MANAGER = "AREA_MANAGER"
ROLE_TEAM_LEADER = "TEAM_LEADER"
ROLE_SALES_MANAGER = "SALES_MANAGER"
ROLE_CHANNEL_ADMIN = "CHANNEL_ADMIN"
ROLE_TRANSACTIONAL_USER = "TRANSACTIONAL_USER"
ROLE_DB_ADMIN = "DB_ADMIN"
ROLE_SOC_ANALYST = "SOC_ANALYST"

# Governance Level Constants
GOVERNANCE_PLATFORM = "PLATFORM"
GOVERNANCE_TENANT = "TENANT"

# System Default Enterprise Roles Metadata
SYSTEM_ROLES_DEFINITION = [
    (ROLE_SUPER_ADMIN, "Super Admin (Platform Owner)", GOVERNANCE_PLATFORM, 1),
    (ROLE_OPERATIONS_HEAD, "Operations Head", GOVERNANCE_PLATFORM, 2),
    (ROLE_ACCOUNTS_HEAD, "Accounts Head", GOVERNANCE_PLATFORM, 3),
    (ROLE_REGIONAL_DIRECTOR, "Regional Director", GOVERNANCE_PLATFORM, 4),
    (ROLE_DB_ADMIN, "Database Administrator", GOVERNANCE_PLATFORM, 4),
    (ROLE_SOC_ANALYST, "Security Operations Analyst", GOVERNANCE_PLATFORM, 4),
    (ROLE_AREA_MANAGER, "Area Manager", GOVERNANCE_TENANT, 5),
    (ROLE_TEAM_LEADER, "Team Leader", GOVERNANCE_TENANT, 5),
    (ROLE_SALES_MANAGER, "Sales Manager", GOVERNANCE_TENANT, 5),
    (ROLE_CHANNEL_ADMIN, "Channel Partner Admin", GOVERNANCE_TENANT, 5),
    (ROLE_TRANSACTIONAL_USER, "Transactional Loan Officer", GOVERNANCE_TENANT, 6),
]

# Sales and Corporate Hierarchy Ancestry Mapping
HIERARCHY_ANCESTORS_MAP: Dict[str, List[str]] = {
    ROLE_SUPER_ADMIN: [],
    ROLE_REGIONAL_DIRECTOR: [ROLE_SUPER_ADMIN],
    ROLE_OPERATIONS_HEAD: [ROLE_SUPER_ADMIN],
    ROLE_ACCOUNTS_HEAD: [ROLE_SUPER_ADMIN],
    ROLE_AREA_MANAGER: [ROLE_SUPER_ADMIN, ROLE_REGIONAL_DIRECTOR],
    ROLE_TEAM_LEADER: [ROLE_SUPER_ADMIN, ROLE_REGIONAL_DIRECTOR, ROLE_AREA_MANAGER],
    ROLE_SALES_MANAGER: [ROLE_SUPER_ADMIN, ROLE_REGIONAL_DIRECTOR, ROLE_AREA_MANAGER, ROLE_TEAM_LEADER],
    ROLE_CHANNEL_ADMIN: [ROLE_SUPER_ADMIN, ROLE_REGIONAL_DIRECTOR, ROLE_AREA_MANAGER, ROLE_TEAM_LEADER, ROLE_SALES_MANAGER],
    ROLE_TRANSACTIONAL_USER: [ROLE_SUPER_ADMIN, ROLE_REGIONAL_DIRECTOR, ROLE_AREA_MANAGER, ROLE_TEAM_LEADER, ROLE_SALES_MANAGER, ROLE_CHANNEL_ADMIN],
    ROLE_DB_ADMIN: [ROLE_SUPER_ADMIN],
    ROLE_SOC_ANALYST: [ROLE_SUPER_ADMIN],
}

# Canonical Navigation Schema Definition based on Corporate & Sales Hierarchy
RAW_NAVIGATION_SCHEMA: List[Dict[str, Any]] = [
    {
        "title": "Portal Navigation",
        "items": [
            {
                "name": "Dashboard",
                "path": "dashboard",
                "icon": "LayoutDashboard",
                "roles": [
                    ROLE_SUPER_ADMIN, ROLE_REGIONAL_DIRECTOR, ROLE_OPERATIONS_HEAD, ROLE_ACCOUNTS_HEAD,
                    ROLE_AREA_MANAGER, ROLE_TEAM_LEADER, ROLE_SALES_MANAGER, ROLE_CHANNEL_ADMIN, ROLE_TRANSACTIONAL_USER
                ],
                "sort_order": 1,
            },
            {
                "name": "Onboarding Wizard",
                "path": "",
                "icon": "FileText",
                "badge": "Steps 1–6",
                "badgeType": "brand",
                "roles": [
                    ROLE_SUPER_ADMIN, ROLE_REGIONAL_DIRECTOR, ROLE_AREA_MANAGER, ROLE_TEAM_LEADER,
                    ROLE_SALES_MANAGER, ROLE_CHANNEL_ADMIN, ROLE_TRANSACTIONAL_USER
                ],
                "sort_order": 2,
            },
            {
                "name": "User Management",
                "path": "assignments",
                "icon": "Users",
                "roles": [
                    ROLE_SUPER_ADMIN, ROLE_REGIONAL_DIRECTOR, ROLE_AREA_MANAGER, ROLE_TEAM_LEADER,
                    ROLE_SALES_MANAGER, ROLE_CHANNEL_ADMIN
                ],
                "sort_order": 3,
            },
            {
                "name": "Analytics",
                "path": "telemetry",
                "icon": "BarChart3",
                "roles": [
                    ROLE_SUPER_ADMIN, ROLE_REGIONAL_DIRECTOR, ROLE_OPERATIONS_HEAD, ROLE_ACCOUNTS_HEAD,
                    ROLE_AREA_MANAGER
                ],
                "sort_order": 4,
            },
            {
                "name": "Settings",
                "path": "configurator",
                "icon": "Sliders",
                "roles": [
                    ROLE_SUPER_ADMIN, ROLE_REGIONAL_DIRECTOR, ROLE_OPERATIONS_HEAD, ROLE_AREA_MANAGER,
                    ROLE_TEAM_LEADER, ROLE_SALES_MANAGER, ROLE_CHANNEL_ADMIN
                ],
                "sort_order": 5,
            },
        ],
    },
    {
        "title": "Operations & Sales",
        "items": [
            {
                "name": "Pipeline",
                "path": "pipeline",
                "icon": "GitPullRequest",
                "roles": [
                    ROLE_SUPER_ADMIN, ROLE_REGIONAL_DIRECTOR, ROLE_AREA_MANAGER, ROLE_TEAM_LEADER,
                    ROLE_SALES_MANAGER, ROLE_CHANNEL_ADMIN, ROLE_TRANSACTIONAL_USER
                ],
                "sort_order": 1,
            },
            {
                "name": "Approvals",
                "path": "approvals",
                "icon": "CheckCircle",
                "badge": "Underwriting",
                "badgeType": "emerald",
                "roles": [ROLE_SUPER_ADMIN, ROLE_REGIONAL_DIRECTOR, ROLE_OPERATIONS_HEAD, ROLE_AREA_MANAGER],
                "sort_order": 2,
            },
            {
                "name": "Commissions",
                "path": "commissions",
                "icon": "CreditCard",
                "roles": [
                    ROLE_SUPER_ADMIN, ROLE_REGIONAL_DIRECTOR, ROLE_ACCOUNTS_HEAD, ROLE_AREA_MANAGER,
                    ROLE_TEAM_LEADER, ROLE_SALES_MANAGER, ROLE_CHANNEL_ADMIN
                ],
                "sort_order": 3,
            },
            {
                "name": "Regional Hierarchy",
                "path": "regional",
                "icon": "MapPin",
                "roles": [
                    ROLE_SUPER_ADMIN, ROLE_REGIONAL_DIRECTOR, ROLE_AREA_MANAGER, ROLE_TEAM_LEADER,
                    ROLE_SALES_MANAGER
                ],
                "sort_order": 4,
            },
        ],
    },
    {
        "title": "Platform Oversight (Application Owners)",
        "items": [
            {
                "name": "Live Logs & Audit",
                "path": "logs",
                "icon": "Activity",
                "badge": "Live",
                "badgeType": "amber",
                "roles": [
                    ROLE_SUPER_ADMIN, ROLE_REGIONAL_DIRECTOR, ROLE_OPERATIONS_HEAD, ROLE_AREA_MANAGER,
                    ROLE_CHANNEL_ADMIN
                ],
                "sort_order": 1,
            },
            {
                "name": "Database Health",
                "global_path": "/platform/db-health",
                "icon": "Activity",
                "roles": [ROLE_SUPER_ADMIN, ROLE_DB_ADMIN],
                "sort_order": 2,
            },
            {
                "name": "Cyber Security Cell",
                "global_path": "/platform/cyber-cell",
                "icon": "ShieldAlert",
                "badge": "SOC",
                "badgeType": "rose",
                "roles": [ROLE_SUPER_ADMIN, ROLE_SOC_ANALYST],
                "sort_order": 3,
            },
            {
                "name": "Platform Billing",
                "global_path": "/platform/billing",
                "icon": "DollarSign",
                "roles": [ROLE_SUPER_ADMIN, ROLE_ACCOUNTS_HEAD],
                "sort_order": 4,
            },
        ],
    },
]
