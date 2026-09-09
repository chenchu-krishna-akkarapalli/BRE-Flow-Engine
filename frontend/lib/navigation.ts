import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  Sliders,
  GitPullRequest,
  CheckCircle,
  CreditCard,
  MapPin,
  ShieldAlert,
  Activity,
  DollarSign,
  type LucideIcon,
} from "lucide-react";

export type RoleKey =
  | "SUPER_ADMIN"
  | "REGIONAL_DIRECTOR"
  | "OPERATIONS_HEAD"
  | "ACCOUNTS_HEAD"
  | "AREA_MANAGER"
  | "TEAM_LEADER"
  | "SALES_MANAGER"
  | "CHANNEL_ADMIN"
  | "TRANSACTIONAL_USER"
  | "DB_ADMIN"
  | "SOC_ANALYST";

export interface NavItem {
  name: string;
  href: (tenantUuid: string) => string;
  icon: LucideIcon;
  badge?: string;
  badgeType?: "brand" | "emerald" | "amber" | "rose";
  roles: RoleKey[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const ROLE_LABELS: Record<RoleKey, { title: string; category: "Platform Owner" | "Tenant Scoped"; badgeClass: string }> = {
  SUPER_ADMIN: { title: "Super Admin (Company Director)", category: "Platform Owner", badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  OPERATIONS_HEAD: { title: "Operations Head", category: "Platform Owner", badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  ACCOUNTS_HEAD: { title: "Accounts Head", category: "Platform Owner", badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  REGIONAL_DIRECTOR: { title: "Regional Director", category: "Platform Owner", badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  DB_ADMIN: { title: "Database Admin (DB_ADMIN)", category: "Platform Owner", badgeClass: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" },
  SOC_ANALYST: { title: "Cyber Security Cell (SOC_ANALYST)", category: "Platform Owner", badgeClass: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
  AREA_MANAGER: { title: "Area Manager (Tier 2)", category: "Tenant Scoped", badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  TEAM_LEADER: { title: "Team Leader (Tier 3)", category: "Tenant Scoped", badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  SALES_MANAGER: { title: "Sales Manager (Tier 4)", category: "Tenant Scoped", badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  CHANNEL_ADMIN: { title: "Channel Partner Admin (Tier 5)", category: "Tenant Scoped", badgeClass: "bg-brand-500/10 text-brand-600 border-brand-500/20" },
  TRANSACTIONAL_USER: { title: "Transactional User / Loan Officer", category: "Tenant Scoped", badgeClass: "bg-sky-500/10 text-sky-600 border-sky-500/20" },
};

export const PORTAL_NAVIGATION_SCHEMA: NavGroup[] = [
  {
    title: "Portal Navigation",
    items: [
      {
        name: "Dashboard",
        href: (uuid) => `/${uuid}/dashboard`,
        icon: LayoutDashboard,
        roles: [
          "SUPER_ADMIN",
          "REGIONAL_DIRECTOR",
          "OPERATIONS_HEAD",
          "ACCOUNTS_HEAD",
          "AREA_MANAGER",
          "TEAM_LEADER",
          "SALES_MANAGER",
          "CHANNEL_ADMIN",
          "TRANSACTIONAL_USER",
        ],
      },
      {
        name: "Onboarding Wizard",
        href: (uuid) => `/${uuid}`,
        icon: FileText,
        badge: "Steps 1–6",
        badgeType: "brand",
        roles: ["SUPER_ADMIN", "CHANNEL_ADMIN", "TRANSACTIONAL_USER"],
      },
      {
        name: "User Management",
        href: (uuid) => `/${uuid}/assignments`,
        icon: Users,
        roles: ["SUPER_ADMIN", "CHANNEL_ADMIN", "TEAM_LEADER", "SALES_MANAGER"],
      },
      {
        name: "Analytics",
        href: (uuid) => `/${uuid}/telemetry`,
        icon: BarChart3,
        roles: ["SUPER_ADMIN", "REGIONAL_DIRECTOR", "OPERATIONS_HEAD", "ACCOUNTS_HEAD"],
      },
      {
        name: "Settings",
        href: (uuid) => `/${uuid}/configurator`,
        icon: Sliders,
        roles: ["SUPER_ADMIN", "OPERATIONS_HEAD", "CHANNEL_ADMIN"],
      },
    ],
  },
  {
    title: "Operations & Sales",
    items: [
      {
        name: "Pipeline",
        href: (uuid) => `/${uuid}/pipeline`,
        icon: GitPullRequest,
        roles: ["SUPER_ADMIN", "REGIONAL_DIRECTOR", "AREA_MANAGER", "TEAM_LEADER", "SALES_MANAGER"],
      },
      {
        name: "Approvals",
        href: (uuid) => `/${uuid}/approvals`,
        icon: CheckCircle,
        badge: "Underwriting",
        badgeType: "emerald",
        roles: ["SUPER_ADMIN", "REGIONAL_DIRECTOR", "OPERATIONS_HEAD"],
      },
      {
        name: "Commissions",
        href: (uuid) => `/${uuid}/commissions`,
        icon: CreditCard,
        roles: ["SUPER_ADMIN", "ACCOUNTS_HEAD", "CHANNEL_ADMIN"],
      },
      {
        name: "Regional Hierarchy",
        href: (uuid) => `/${uuid}/regional`,
        icon: MapPin,
        roles: ["SUPER_ADMIN", "REGIONAL_DIRECTOR", "AREA_MANAGER"],
      },
    ],
  },
  {
    title: "Platform Oversight (Application Owners)",
    items: [
      {
        name: "Live Logs & Audit",
        href: (uuid) => `/${uuid}/logs`,
        icon: Activity,
        badge: "Live",
        badgeType: "amber",
        roles: ["SUPER_ADMIN", "OPERATIONS_HEAD", "CHANNEL_ADMIN"],
      },
      {
        name: "Database Health",
        href: () => `/platform/db-health`,
        icon: Activity,
        roles: ["SUPER_ADMIN", "DB_ADMIN"],
      },
      {
        name: "Cyber Security Cell",
        href: () => `/platform/cyber-cell`,
        icon: ShieldAlert,
        badge: "SOC",
        badgeType: "rose",
        roles: ["SUPER_ADMIN", "SOC_ANALYST"],
      },
      {
        name: "Platform Billing",
        href: () => `/platform/billing`,
        icon: DollarSign,
        roles: ["SUPER_ADMIN", "ACCOUNTS_HEAD"],
      },
    ],
  },
];

/** Filters navigation items dynamically based on the active user role */
export function getAuthorizedNavigation(role: RoleKey, tenantUuid: string): NavGroup[] {
  return PORTAL_NAVIGATION_SCHEMA.map((group) => ({
    title: group.title,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}
