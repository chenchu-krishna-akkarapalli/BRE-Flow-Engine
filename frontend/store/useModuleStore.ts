import { create } from "zustand";

export interface DynamicNavItem {
  code: string;
  name: string;
  href: string;
  icon: string;
  badge?: string;
  badgeType?: "brand" | "emerald" | "amber" | "rose" | "warning" | "success" | "neutral" | "danger";
  canCreate?: boolean;
  canEdit?: boolean;
  canApprove?: boolean;
}

export interface DynamicNavSection {
  title: string;
  sectionKey: string;
  items: DynamicNavItem[];
}

export interface CatalogModuleItem {
  id?: string;
  code: string;
  name: string;
  route_template: string;
  icon_name: string;
  section_key: string;
  section_title: string;
  badge?: string;
  badge_type?: string;
  min_tier_level: number;
  is_core: boolean;
  is_active: boolean;
  sort_order: number;
  description?: string;
}

export interface RolePermissionMatrixItem {
  role_key: string;
  module_code: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_approve: boolean;
}

export interface TenantModuleEntitlementItem {
  tenant_id: string;
  module_code: string;
  is_enabled: boolean;
  custom_name?: string;
}

interface ModuleStoreState {
  sections: DynamicNavSection[];
  catalog: CatalogModuleItem[];
  matrix: RolePermissionMatrixItem[];
  tenantEntitlements: TenantModuleEntitlementItem[];
  activeRole: string | null;
  activeTenant: string | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Actions
  fetchModules: (role: string | null, tenantUuid: string | null, force?: boolean) => Promise<void>;
  fetchCatalog: () => Promise<void>;
  fetchMatrix: () => Promise<void>;
  fetchTenantEntitlements: (tenantId: string) => Promise<void>;
  saveMatrix: (permissions: RolePermissionMatrixItem[]) => Promise<boolean>;
  createCatalogModule: (item: Partial<CatalogModuleItem>) => Promise<boolean>;
  updateCatalogModule: (code: string, item: Partial<CatalogModuleItem>) => Promise<boolean>;
  deleteCatalogModule: (code: string) => Promise<boolean>;
  toggleTenantModule: (tenantId: string, code: string, isEnabled: boolean, customName?: string) => Promise<boolean>;

  hasModule: (code: string) => boolean;
  canPerform: (code: string, action: "view" | "create" | "edit" | "approve") => boolean;
}

// Canonical static fallback for zero-downtime offline resilience
function getCanonicalSections(role: string | null, tenantUuid: string | null): DynamicNavSection[] {
  const prefix = tenantUuid && tenantUuid !== "platform" ? `/${tenantUuid}` : "";
  const userRole = (role || "SUPER_ADMIN").toUpperCase();

  const isSuperAdmin = userRole === "SUPER_ADMIN";
  const isParallelHead = ["REGIONAL_DIRECTOR", "OPERATIONS_HEAD", "ACCOUNTS_HEAD"].includes(userRole);
  const isAreaManager = userRole === "AREA_MANAGER";
  const isTeamLeader = userRole === "TEAM_LEADER";
  const isSalesManager = userRole === "SALES_MANAGER";
  const isChannelAdmin = userRole === "CHANNEL_ADMIN";

  // Section 1: Portal Navigation
  const portalItems: DynamicNavItem[] = [
    { code: "DASHBOARD", name: "Dashboard", href: `${prefix}/dashboard` || "/dashboard", icon: "LayoutDashboard" },
    { code: "ONBOARDING", name: "Onboarding Wizard", href: prefix || "/", icon: "FileText", badge: "Steps 1–6", badgeType: "brand" },
  ];

  // User management: available to Channel Admin and above
  if (isSuperAdmin || isParallelHead || isAreaManager || isTeamLeader || isSalesManager || isChannelAdmin) {
    portalItems.push({
      code: "USER_MANAGEMENT",
      name: "User Management",
      href: `${prefix}/assignments` || "/assignments",
      icon: "Users",
    });
  }

  // Analytics: available to Sales Manager and above
  if (isSuperAdmin || isParallelHead || isAreaManager || isTeamLeader || isSalesManager) {
    portalItems.push({
      code: "ANALYTICS",
      name: "Analytics",
      href: `${prefix}/telemetry` || "/telemetry",
      icon: "BarChart3",
    });
  }

  // Section 2: Operations & Sales
  const opsItems: DynamicNavItem[] = [];

  // Pipeline: Sales Manager and above
  if (isSuperAdmin || userRole === "REGIONAL_DIRECTOR" || isAreaManager || isTeamLeader || isSalesManager) {
    opsItems.push({
      code: "PIPELINE",
      name: "Sales Pipeline",
      href: `${prefix}/pipeline` || "/pipeline",
      icon: "GitPullRequest",
    });
  }

  // Approvals: Operations Head, Regional Director, Super Admin
  if (isSuperAdmin || userRole === "REGIONAL_DIRECTOR" || userRole === "OPERATIONS_HEAD" || isAreaManager) {
    opsItems.push({
      code: "APPROVALS",
      name: "Approvals",
      href: `${prefix}/approvals` || "/approvals",
      icon: "CheckCircle",
      badge: "Underwriting",
      badgeType: "emerald",
      canApprove: true,
    });
  }

  // Commissions: Channel Admin and above
  if (isSuperAdmin || userRole === "REGIONAL_DIRECTOR" || userRole === "ACCOUNTS_HEAD" || isAreaManager || isTeamLeader || isSalesManager || isChannelAdmin) {
    opsItems.push({
      code: "COMMISSIONS",
      name: "Commissions",
      href: `${prefix}/commissions` || "/commissions",
      icon: "CreditCard",
    });
  }

  // Regional Hierarchy: Area Manager, Regional Director, Super Admin
  if (isSuperAdmin || userRole === "REGIONAL_DIRECTOR" || isAreaManager || isTeamLeader || isSalesManager) {
    opsItems.push({
      code: "REGIONAL_HIERARCHY",
      name: "Regional Hierarchy",
      href: `${prefix}/regional` || "/regional",
      icon: "MapPin",
    });
  }

  // Section 3: Platform Oversight
  const governanceItems: DynamicNavItem[] = [];
  const defaultPlatformUuid = "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f";
  const platformUuid = tenantUuid && tenantUuid !== "platform" ? tenantUuid : defaultPlatformUuid;

  if (isSuperAdmin || userRole === "OPERATIONS_HEAD" || userRole === "ACCOUNTS_HEAD" || userRole === "DB_ADMIN" || userRole === "SOC_ANALYST") {
    if (isSuperAdmin || userRole === "OPERATIONS_HEAD") {
      governanceItems.push({
        code: "PLATFORM_OVERVIEW",
        name: "Platform Overview",
        href: `/${platformUuid}/platformoverview`,
        icon: "Crown",
        badge: "Owner",
        badgeType: "amber",
      });
    }

    if (isSuperAdmin || userRole === "OPERATIONS_HEAD" || userRole === "ACCOUNTS_HEAD") {
      governanceItems.push({
        code: "LOGS",
        name: "Live Logs & Audit",
        href: `${prefix}/logs` || "/logs",
        icon: "Activity",
        badge: "Live",
        badgeType: "amber",
      });
    }

    if (isSuperAdmin || userRole === "OPERATIONS_HEAD" || userRole === "DB_ADMIN") {
      governanceItems.push({
        code: "DB_HEALTH",
        name: "Database Health",
        href: "/platform/db-health",
        icon: "Activity",
      });
    }

    if (isSuperAdmin || userRole === "OPERATIONS_HEAD" || userRole === "SOC_ANALYST") {
      governanceItems.push({
        code: "CYBER_CELL",
        name: "Cyber Security Cell",
        href: "/platform/cyber-cell",
        icon: "ShieldAlert",
        badge: "SOC",
        badgeType: "rose",
      });
    }

    if (isSuperAdmin || userRole === "ACCOUNTS_HEAD") {
      governanceItems.push({
        code: "BILLING",
        name: "Platform Billing",
        href: "/platform/billing",
        icon: "DollarSign",
      });
    }

    // Dynamic Module Manager link for Super Admins
    if (isSuperAdmin) {
      governanceItems.push({
        code: "MODULE_MANAGER",
        name: "Dynamic Module Manager",
        href: "/platform/modules",
        icon: "Sliders",
        badge: "Admin",
        badgeType: "brand",
      });
    }
  }

  const sections: DynamicNavSection[] = [
    { title: "Portal Navigation", sectionKey: "PORTAL_NAV", items: portalItems },
  ];

  if (opsItems.length > 0) {
    sections.push({ title: "Operations & Sales", sectionKey: "OPERATIONS_SALES", items: opsItems });
  }

  if (governanceItems.length > 0) {
    sections.push({ title: "Platform Oversight (Application Owners)", sectionKey: "PLATFORM_GOVERNANCE", items: governanceItems });
  }

  return sections;
}

// Module fetch state tracking for in-flight deduplication and session caching
let activeFetchPromise: Promise<void> | null = null;
let activeFetchKey: string | null = null;
let lastFetchedKey: string | null = null;

export const useModuleStore = create<ModuleStoreState>((set, get) => {
  return {
    sections: getCanonicalSections(null, null),
    catalog: [],
    matrix: [],
    tenantEntitlements: [],
    activeRole: null,
    activeTenant: null,
    isLoading: false,
    isSaving: false,
    error: null,

    fetchModules: async (role: string | null, tenantUuid: string | null, force: boolean = false) => {
      const requestKey = `${(role || "SUPER_ADMIN").toUpperCase()}:${tenantUuid || "default"}`;

      // Skip redundant fetch if exact same role & tenant was already fetched and not forced
      if (!force && lastFetchedKey === requestKey && get().sections.length > 0) {
        return;
      }

      // In-flight singleflight deduplication: reuse running promise if same request is already pending
      if (activeFetchPromise && activeFetchKey === requestKey) {
        return activeFetchPromise;
      }

      activeFetchKey = requestKey;
      activeFetchPromise = (async () => {
        set({ isLoading: true, error: null, activeRole: role, activeTenant: tenantUuid });

        try {
          const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
          const tenantParam = tenantUuid || "default";
          const roleQuery = role ? `?role=${encodeURIComponent(role)}` : "";

          const res = await fetch(`${apiBase}/api/v1/navigation/modules${roleQuery}`, {
            headers: {
              "X-Tenant-ID": tenantParam,
            },
          });

          if (res.ok) {
            const data = await res.json();
            if (data.sections && Array.isArray(data.sections) && data.sections.length > 0) {
              const dynamicSections: DynamicNavSection[] = data.sections.map((sec: any) => ({
                title: sec.title,
                sectionKey: sec.section_key,
                items: sec.items.map((it: any) => ({
                  code: it.code,
                  name: it.name,
                  href: it.path,
                  icon: it.icon,
                  badge: it.badge,
                  badgeType: it.badge_type,
                  canCreate: it.can_create,
                  canEdit: it.can_edit,
                  canApprove: it.can_approve,
                })),
              }));

              // If super admin, make sure dynamic module manager is in platform governance
              if ((role || "SUPER_ADMIN").toUpperCase() === "SUPER_ADMIN") {
                const govSection = dynamicSections.find((s) => s.sectionKey === "PLATFORM_GOVERNANCE");
                if (govSection && !govSection.items.some((it) => it.code === "MODULE_MANAGER")) {
                  govSection.items.push({
                    code: "MODULE_MANAGER",
                    name: "Dynamic Module Manager",
                    href: "/platform/modules",
                    icon: "Sliders",
                    badge: "Admin",
                    badgeType: "brand",
                  });
                }
              }

              lastFetchedKey = requestKey;
              set({ sections: dynamicSections, isLoading: false });
              return;
            }
          }
        } catch (err) {
          console.warn("[useModuleStore] Dynamic API fetch skipped, using resolved fallback schema:", err);
        }

        // Safe fallback resolution
        lastFetchedKey = requestKey;
        const fallback = getCanonicalSections(role, tenantUuid);
        set({ sections: fallback, isLoading: false });
      })().finally(() => {
        activeFetchPromise = null;
        activeFetchKey = null;
      });

      return activeFetchPromise;
    },

    fetchCatalog: async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
        const res = await fetch(`${apiBase}/api/v1/navigation/catalog`);
        if (res.ok) {
          const data = await res.json();
          set({ catalog: data });
        }
      } catch (err) {
        console.error("Failed to fetch module catalog:", err);
      }
    },

    fetchMatrix: async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
        const res = await fetch(`${apiBase}/api/v1/navigation/matrix`);
        if (res.ok) {
          const data = await res.json();
          set({ matrix: data });
        }
      } catch (err) {
        console.error("Failed to fetch role permission matrix:", err);
      }
    },

    fetchTenantEntitlements: async (tenantId: string) => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
        const res = await fetch(`${apiBase}/api/v1/navigation/tenants/${tenantId}/modules`);
        if (res.ok) {
          const data = await res.json();
          set({ tenantEntitlements: data });
        }
      } catch (err) {
        console.error("Failed to fetch tenant entitlements:", err);
      }
    },

    saveMatrix: async (permissions: RolePermissionMatrixItem[]) => {
      set({ isSaving: true });
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
        const res = await fetch(`${apiBase}/api/v1/navigation/matrix`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ permissions }),
        });
        if (res.ok) {
          set({ matrix: permissions, isSaving: false });
          // Re-sync current navigation
          const { activeRole, activeTenant, fetchModules } = get();
          await fetchModules(activeRole, activeTenant, true);
          return true;
        }
      } catch (err) {
        console.error("Failed to save permission matrix:", err);
      }
      set({ isSaving: false });
      return false;
    },

    createCatalogModule: async (item: Partial<CatalogModuleItem>) => {
      set({ isSaving: true });
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
        const res = await fetch(`${apiBase}/api/v1/navigation/catalog`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        });
        if (res.ok) {
          const created = await res.json();
          const current = get().catalog;
          set({ catalog: [...current, created], isSaving: false });
          const { activeRole, activeTenant, fetchModules } = get();
          await fetchModules(activeRole, activeTenant, true);
          return true;
        }
      } catch (err) {
        console.error("Failed to create module:", err);
      }
      set({ isSaving: false });
      return false;
    },

    updateCatalogModule: async (code: string, item: Partial<CatalogModuleItem>) => {
      set({ isSaving: true });
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
        const res = await fetch(`${apiBase}/api/v1/navigation/catalog/${code}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        });
        if (res.ok) {
          const updated = await res.json();
          const current = get().catalog;
          set({
            catalog: current.map((m) => (m.code === code ? updated : m)),
            isSaving: false,
          });
          const { activeRole, activeTenant, fetchModules } = get();
          await fetchModules(activeRole, activeTenant, true);
          return true;
        }
      } catch (err) {
        console.error("Failed to update module:", err);
      }
      set({ isSaving: false });
      return false;
    },

    deleteCatalogModule: async (code: string) => {
      set({ isSaving: true });
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
        const res = await fetch(`${apiBase}/api/v1/navigation/catalog/${code}?hard=true`, {
          method: "DELETE",
        });
        if (res.ok) {
          const current = get().catalog;
          set({
            catalog: current.filter((m) => m.code !== code),
            isSaving: false,
          });
          const { activeRole, activeTenant, fetchModules } = get();
          await fetchModules(activeRole, activeTenant, true);
          return true;
        }
      } catch (err) {
        console.error("Failed to delete module:", err);
      }
      set({ isSaving: false });
      return false;
    },

    toggleTenantModule: async (tenantId: string, code: string, isEnabled: boolean, customName?: string) => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
        const res = await fetch(`${apiBase}/api/v1/navigation/tenants/${tenantId}/modules/${code}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_enabled: isEnabled, custom_name: customName }),
        });
        if (res.ok) {
          const { fetchTenantEntitlements, activeRole, activeTenant, fetchModules } = get();
          await fetchTenantEntitlements(tenantId);
          await fetchModules(activeRole, activeTenant, true);
          return true;
        }
      } catch (err) {
        console.error("Failed to toggle tenant module:", err);
      }
      return false;
    },

    hasModule: (code: string) => {
      const { sections } = get();
      return sections.some((sec) => sec.items.some((item) => item.code.toUpperCase() === code.toUpperCase()));
    },

    canPerform: (code: string, action: "view" | "create" | "edit" | "approve") => {
      const { sections } = get();
      for (const sec of sections) {
        const item = sec.items.find((it) => it.code.toUpperCase() === code.toUpperCase());
        if (item) {
          if (action === "view") return true;
          if (action === "create") return !!item.canCreate;
          if (action === "edit") return !!item.canEdit;
          if (action === "approve") return !!item.canApprove;
        }
      }
      return false;
    },
  };
});
