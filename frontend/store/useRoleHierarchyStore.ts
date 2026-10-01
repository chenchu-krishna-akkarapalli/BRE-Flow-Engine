import { create } from "zustand";

export type DepartmentType = "CORPORATE" | "SALES" | string;

export interface RoleHierarchyNode {
  id: string;
  tenantId: string;
  roleKey: string;
  displayName: string;
  department: DepartmentType;
  parentRoleKey: string | null;
  tierLevel: number;
  isSystemRole: boolean;
  description?: string;
  allowedSubordinates: string[];
  validationConstraints?: string[];
  createdAt: string;
  updatedAt: string;
}

export type UserStatus = "ACTIVE" | "SUSPENDED" | "PENDING";

export interface TenantUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: string;
  status: UserStatus;
  hierarchyTier?: number;
}

export const SEED_ROLES: RoleHierarchyNode[] = [
  {
    id: "role-super-admin",
    tenantId: "global",
    roleKey: "SUPER_ADMIN",
    displayName: "Super Admin (Company Director)",
    department: "CORPORATE",
    parentRoleKey: null,
    tierLevel: 0,
    isSystemRole: true,
    description: "Top-level corporate director. Full system permissions and oversight of all regional, operational, and accounts activities.",
    allowedSubordinates: ["REGIONAL_DIRECTOR", "OPERATIONS_HEAD", "ACCOUNTS_HEAD"],
    validationConstraints: [
      "Strict corporate operations assignment.",
      "Root node of the organization tree.",
    ],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "role-regional-director",
    tenantId: "global",
    roleKey: "REGIONAL_DIRECTOR",
    displayName: "Regional Director",
    department: "SALES",
    parentRoleKey: "SUPER_ADMIN",
    tierLevel: 1,
    isSystemRole: true,
    description: "Tier 1 Parallel Head of Sales. Direct supervisor of Area Managers, responsible for regional sales targets and performance.",
    allowedSubordinates: ["AREA_MANAGER"],
    validationConstraints: [
      "Multi-region branch oversight.",
      "Regional quota authorization.",
    ],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "role-operations-head",
    tenantId: "global",
    roleKey: "OPERATIONS_HEAD",
    displayName: "Operations Head",
    department: "CORPORATE",
    parentRoleKey: "SUPER_ADMIN",
    tierLevel: 1,
    isSystemRole: true,
    description: "Tier 1 Parallel Head of Operations. Oversees platform processes, workflows, OCR configurations, and regional operations.",
    allowedSubordinates: [],
    validationConstraints: [
      "Credit committee policy matrix governance.",
      "SLA budget authorization.",
    ],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "role-accounts-head",
    tenantId: "global",
    roleKey: "ACCOUNTS_HEAD",
    displayName: "Accounts Head",
    department: "CORPORATE",
    parentRoleKey: "SUPER_ADMIN",
    tierLevel: 1,
    isSystemRole: true,
    description: "Tier 1 Parallel Head of Accounts. Manages financial ledgers, disbursements, billing, and transactional audit trails.",
    allowedSubordinates: [],
    validationConstraints: [
      "Disbursement ledger reconciliation.",
      "Financial audit log integrity.",
    ],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "role-area-manager",
    tenantId: "global",
    roleKey: "AREA_MANAGER",
    displayName: "Area Manager",
    department: "SALES",
    parentRoleKey: "REGIONAL_DIRECTOR",
    tierLevel: 2,
    isSystemRole: true,
    description: "Sales Tier 2. Supervises regional Team Leaders. Coordinates localized marketing and loan origination activities.",
    allowedSubordinates: ["TEAM_LEADER"],
    validationConstraints: [
      "Branch target alignment.",
      "Origination pipeline audit.",
    ],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "role-team-leader",
    tenantId: "global",
    roleKey: "TEAM_LEADER",
    displayName: "Team Leader",
    department: "SALES",
    parentRoleKey: "AREA_MANAGER",
    tierLevel: 3,
    isSystemRole: true,
    description: "Sales Tier 3. Manages localized Sales Managers. Coordinates application review pipelines and queues.",
    allowedSubordinates: ["SALES_MANAGER"],
    validationConstraints: [
      "Queue triage enforcement.",
      "Underwriting escalation review.",
    ],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "role-sales-manager",
    tenantId: "global",
    roleKey: "SALES_MANAGER",
    displayName: "Sales Manager",
    department: "SALES",
    parentRoleKey: "TEAM_LEADER",
    tierLevel: 4,
    isSystemRole: true,
    description: "Sales Tier 4. Direct manager of Channel Partners. Provides support and onboarding assistance for registered channels.",
    allowedSubordinates: ["CHANNEL_ADMIN"],
    validationConstraints: [
      "Channel partner onboarding validation.",
      "Partner SLA monitoring.",
    ],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "role-channel-admin",
    tenantId: "global",
    roleKey: "CHANNEL_ADMIN",
    displayName: "Channel Partner (Admin)",
    department: "SALES",
    parentRoleKey: "SALES_MANAGER",
    tierLevel: 5,
    isSystemRole: true,
    description: "Sales Tier 5. Channel-level administrator with full tenant permissions to configure rules, users, and submit applications.",
    allowedSubordinates: ["TRANSACTIONAL_USER"],
    validationConstraints: [
      "Strict corporate operations assignment.",
      "Channel tenant workspace governance.",
    ],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "role-transactional-user",
    tenantId: "global",
    roleKey: "TRANSACTIONAL_USER",
    displayName: "Transactional User",
    department: "SALES",
    parentRoleKey: "CHANNEL_ADMIN",
    tierLevel: 6,
    isSystemRole: true,
    description: "Sales Tier 6. Frontline loan officer and transactional agent. Manages 6-step applicant onboarding, document uploads, and instant evaluations.",
    allowedSubordinates: [],
    validationConstraints: [
      "Applicant onboarding submission.",
      "Document upload verification.",
    ],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
];

export const INITIAL_USERS: TenantUser[] = [
  // Bank of India Channel (Main Tenant: e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f)
  { id: "c7cddd4d-cd05-477e-8389-f710df69e883", tenantId: "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f", name: "Ratan Tata", email: "ratan-tata@gmail.com", role: "SUPER_ADMIN", status: "ACTIVE" },
  { id: "ab7e16a4-ea04-4eb1-98a0-7e1508322b6e", tenantId: "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f", name: "Super Admin", email: "super.admin@flowbre.com", role: "SUPER_ADMIN", status: "ACTIVE" },
  { id: "08024c02-11b9-47df-afb4-2d0059c4b43d", tenantId: "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f", name: "Vikram Malhotra", email: "regional.director@flowbre.com", role: "REGIONAL_DIRECTOR", status: "ACTIVE" },
  { id: "c65b877d-e2ae-42cc-b072-2d9ced159a9a", tenantId: "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f", name: "Ananya Sharma", email: "ops.head@flowbre.com", role: "OPERATIONS_HEAD", status: "ACTIVE" },
  { id: "24c5093e-f61d-479c-9484-ba7a774f983b", tenantId: "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f", name: "Rajesh Mehta", email: "accounts.head@flowbre.com", role: "ACCOUNTS_HEAD", status: "ACTIVE" },
  { id: "837758f4-6668-45c7-87ef-e3091640818f", tenantId: "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f", name: "Suresh Raina", email: "area.manager@boi.com", role: "AREA_MANAGER", status: "ACTIVE" },
  { id: "a8579566-b1e8-4391-8ef9-24512b739c1a", tenantId: "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f", name: "Amit Patel", email: "team.leader@boi.com", role: "TEAM_LEADER", status: "ACTIVE" },
  { id: "81d1e20b-f41d-44b1-a633-4f1f8ba5e601", tenantId: "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f", name: "Priya Singh", email: "sales.manager@boi.com", role: "SALES_MANAGER", status: "ACTIVE" },

  // Apex FinTech Punjab (Partner Sub-Tenant: 681cc219-8f42-4c7c-bc29-377a40c750b8)
  { id: "b33b6e13-ed18-48ef-b618-e4a5358edd6c", tenantId: "681cc219-8f42-4c7c-bc29-377a40c750b8", name: "Harpreet Singh", email: "partner@apex-punjab.in", role: "CHANNEL_ADMIN", status: "ACTIVE" },
  { id: "916e5a5d-3760-4ccd-831a-617790289270", tenantId: "681cc219-8f42-4c7c-bc29-377a40c750b8", name: "Simran Kaur", email: "simran.k@apex-punjab.in", role: "TRANSACTIONAL_USER", status: "ACTIVE" },
  { id: "e9a4d601-4064-491d-9ee9-b4961b78bd1c", tenantId: "681cc219-8f42-4c7c-bc29-377a40c750b8", name: "Gurpreet Gill", email: "gurpreet.g@apex-punjab.in", role: "TRANSACTIONAL_USER", status: "ACTIVE" },
];

const ROLES_STORAGE_KEY = "flowbre_dynamic_roles_v2";
const USERS_STORAGE_KEY = "flowbre_users_v7_clean";

interface RoleHierarchyState {
  roles: RoleHierarchyNode[];
  users: TenantUser[];
  selectedRoleId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchUsers: (tenantUuid: string) => Promise<void>;
  getUsersForTenant: (tenantUuid: string) => TenantUser[];
  selectRole: (roleId: string | null) => void;
  getRoleByKey: (roleKey: string) => RoleHierarchyNode | undefined;
  getTierLevel: (roleKey: string) => number;
  getParentRole: (roleKey: string) => RoleHierarchyNode | undefined;
  getChildRoles: (roleKey: string) => RoleHierarchyNode[];
  canAssignRole: (actorRoleKey: string | null, targetRoleKey: string) => boolean;
  canSeeUser: (actorRoleKey: string | null, targetRoleKey: string) => boolean;
  canManageUser: (actorRoleKey: string | null, targetRoleKey: string) => boolean;

  // Mutations
  addRole: (params: {
    roleKey: string;
    displayName: string;
    department: DepartmentType;
    parentRoleKey: string | null;
    description?: string;
    validationConstraints?: string[];
  }) => { success: boolean; error?: string };

  updateRole: (
    roleKey: string,
    updates: Partial<Omit<RoleHierarchyNode, "id" | "roleKey" | "isSystemRole">>
  ) => { success: boolean; error?: string };

  deleteRole: (roleKey: string) => { success: boolean; error?: string };

  addUser: (user: Omit<TenantUser, "id">) => Promise<{ success: boolean; error?: string }>;
  updateUser: (id: string, updates: Partial<TenantUser>, tenantUuid?: string) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (id: string, tenantUuid?: string) => Promise<{ success: boolean; error?: string }>;

  resetToDefaults: () => void;
}

// Recalculates tier levels across tree
function computeTiers(nodes: RoleHierarchyNode[]): RoleHierarchyNode[] {
  const nodeMap = new Map<string, RoleHierarchyNode>();
  nodes.forEach((n) => nodeMap.set(n.roleKey, { ...n }));

  // Helper function to resolve tier
  function resolveTier(roleKey: string, visited: Set<string>): number {
    if (visited.has(roleKey)) return 99; // Cycle prevention fallback
    visited.add(roleKey);

    const node = nodeMap.get(roleKey);
    if (!node || !node.parentRoleKey) return 0;

    const parentNode = nodeMap.get(node.parentRoleKey);
    if (!parentNode) return 1;

    return resolveTier(node.parentRoleKey, visited) + 1;
  }

  // Update nodes with recalculated tiers
  return nodes.map((node) => {
    if (node.roleKey === "SUPER_ADMIN") {
      return { ...node, tierLevel: 0 };
    }
    const tier = resolveTier(node.roleKey, new Set<string>());
    return { ...node, tierLevel: tier };
  });
}

function loadSavedRoles(): RoleHierarchyNode[] {
  if (typeof window === "undefined") return SEED_ROLES;
  try {
    const raw = localStorage.getItem(ROLES_STORAGE_KEY);
    if (!raw) return SEED_ROLES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return computeTiers(parsed);
    }
  } catch (err) {
    console.error("Failed to load saved roles:", err);
  }
  return SEED_ROLES;
}

function loadSavedUsers(): TenantUser[] {
  if (typeof window === "undefined") return INITIAL_USERS;
  try {
    // Purge legacy storage keys with obsolete mock/test users
    localStorage.removeItem("flowbre_users_v1");
    localStorage.removeItem("flowbre_users_v2");
    localStorage.removeItem("flowbre_users_v3");
    localStorage.removeItem("flowbre_users_v4");
    localStorage.removeItem("flowbre_users_v5");
    localStorage.removeItem("flowbre_users_v6_clean");

    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) return INITIAL_USERS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.error("Failed to load saved users:", err);
  }
  return INITIAL_USERS;
}

export const useRoleHierarchyStore = create<RoleHierarchyState>((set, get) => {
  return {
    roles: loadSavedRoles(),
    users: loadSavedUsers(),
    selectedRoleId: "role-super-admin",
    isLoading: false,
    error: null,

    selectRole: (roleId) => set({ selectedRoleId: roleId }),

    getRoleByKey: (roleKey: string) => {
      return get().roles.find(
        (r) => r.roleKey.toUpperCase() === roleKey.toUpperCase()
      );
    },

    getTierLevel: (roleKey: string) => {
      const role = get().getRoleByKey(roleKey);
      if (role) return role.tierLevel;
      // Fallback tiers
      if (roleKey === "SUPER_ADMIN") return 0;
      return 6;
    },

    getParentRole: (roleKey: string) => {
      const role = get().getRoleByKey(roleKey);
      if (!role || !role.parentRoleKey) return undefined;
      return get().getRoleByKey(role.parentRoleKey);
    },

    getChildRoles: (roleKey: string) => {
      return get().roles.filter((r) => r.parentRoleKey === roleKey);
    },

    canAssignRole: (actorRoleKey: string | null, targetRoleKey: string) => {
      if (!actorRoleKey) return true; // Default permissive in dev/preview
      // Super Admin has access to assign all roles
      if (actorRoleKey === "SUPER_ADMIN") return true;

      const actorTier = get().getTierLevel(actorRoleKey);
      const targetTier = get().getTierLevel(targetRoleKey);

      // Actor can only assign roles strictly lower in hierarchy (higher tier number)
      return targetTier > actorTier;
    },

    canSeeUser: (actorRoleKey: string | null, targetRoleKey: string) => {
      // Super Admin has global platform visibility across all tiers
      if (!actorRoleKey || actorRoleKey === "SUPER_ADMIN") return true;

      const actorTier = get().getTierLevel(actorRoleKey);
      const targetTier = get().getTierLevel(targetRoleKey);

      // Users CANNOT see superiors in higher hierarchy tiers (lower tier numbers)
      // E.g. Regional Director (Tier 1) cannot see Super Admin (Tier 0)
      // E.g. Area Manager (Tier 2) cannot see Regional Director (Tier 1) or Super Admin (Tier 0)
      if (targetTier < actorTier) {
        return false;
      }

      return true;
    },

    canManageUser: (actorRoleKey: string | null, targetRoleKey: string) => {
      if (!actorRoleKey) return false;
      if (actorRoleKey === "SUPER_ADMIN") return true;

      const actorTier = get().getTierLevel(actorRoleKey);
      const targetTier = get().getTierLevel(targetRoleKey);

      // Users can ONLY edit or delete members with strictly subordinate roles (higher tier number)
      // E.g. Area Manager (Tier 2) can manage Team Leader (Tier 3), Sales Manager (Tier 4), etc.
      // but CANNOT manage peers (Tier 2) or superiors (Tier 1 or Tier 0)
      return targetTier > actorTier;
    },

    addRole: (params) => {
      const formattedKey = params.roleKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
      if (!formattedKey) {
        return { success: false, error: "Role Key is required." };
      }

      const existing = get().roles.find((r) => r.roleKey === formattedKey);
      if (existing) {
        return { success: false, error: `Role '${formattedKey}' already exists.` };
      }

      // Check parent role
      let parentTier = 0;
      if (params.parentRoleKey) {
        const parent = get().getRoleByKey(params.parentRoleKey);
        if (!parent) {
          return { success: false, error: `Parent role '${params.parentRoleKey}' does not exist.` };
        }
        parentTier = parent.tierLevel;
      }

      const calculatedTier = params.parentRoleKey ? parentTier + 1 : 1;

      const newRole: RoleHierarchyNode = {
        id: `role-${Date.now()}`,
        tenantId: "global",
        roleKey: formattedKey,
        displayName: params.displayName.trim() || formattedKey,
        department: params.department || "SALES",
        parentRoleKey: params.parentRoleKey,
        tierLevel: calculatedTier,
        isSystemRole: false,
        description: params.description?.trim() || `Custom role created under ${params.parentRoleKey || "Root"}.`,
        allowedSubordinates: [],
        validationConstraints: params.validationConstraints && params.validationConstraints.length > 0
          ? params.validationConstraints
          : ["Custom tier compliance.", "Dynamic organizational validation."],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Add to tree and recompute tiers
      const updatedRoles = computeTiers([...get().roles, newRole]);

      // Update parent's allowedSubordinates list
      if (params.parentRoleKey) {
        const parentIndex = updatedRoles.findIndex((r) => r.roleKey === params.parentRoleKey);
        if (parentIndex !== -1) {
          const subs = updatedRoles[parentIndex].allowedSubordinates;
          if (!subs.includes(formattedKey)) {
            updatedRoles[parentIndex] = {
              ...updatedRoles[parentIndex],
              allowedSubordinates: [...subs, formattedKey],
            };
          }
        }
      }

      set({ roles: updatedRoles, selectedRoleId: newRole.id });

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(updatedRoles));
        } catch (e) {
          console.error("Failed to persist roles:", e);
        }
      }

      return { success: true };
    },

    updateRole: (roleKey, updates) => {
      const roles = get().roles;
      const index = roles.findIndex((r) => r.roleKey === roleKey);
      if (index === -1) return { success: false, error: "Role not found." };

      // Cycle detection check if parentRoleKey is changing
      if (updates.parentRoleKey && updates.parentRoleKey !== roles[index].parentRoleKey) {
        let currentParent: string | null = updates.parentRoleKey;
        while (currentParent) {
          if (currentParent === roleKey) {
            return { success: false, error: "Circular reporting hierarchy detected!" };
          }
          const pRole = roles.find((r) => r.roleKey === currentParent);
          currentParent = pRole?.parentRoleKey ?? null;
        }
      }

      const updated = [...roles];
      updated[index] = {
        ...updated[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      const recomputed = computeTiers(updated);
      set({ roles: recomputed });

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(recomputed));
        } catch (e) {
          console.error("Failed to persist roles:", e);
        }
      }

      return { success: true };
    },

    deleteRole: (roleKey) => {
      const role = get().getRoleByKey(roleKey);
      if (!role) return { success: false, error: "Role not found." };
      if (role.isSystemRole) {
        return { success: false, error: "Cannot delete core system roles." };
      }

      // Reparent children to this role's parent
      const parentKey = role.parentRoleKey;
      const updatedRoles = get()
        .roles.filter((r) => r.roleKey !== roleKey)
        .map((r) => (r.parentRoleKey === roleKey ? { ...r, parentRoleKey: parentKey } : r));

      const recomputed = computeTiers(updatedRoles);
      set({ roles: recomputed });

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(recomputed));
        } catch (e) {
          console.error("Failed to persist roles:", e);
        }
      }

      return { success: true };
    },

    getUsersForTenant: (tenantUuid: string) => {
      const lower = (tenantUuid || "").toLowerCase();
      const stripped = lower.startsWith("tenant-") ? lower.replace("tenant-", "") : lower;
      return get().users.filter((u) => {
        const uT = (u.tenantId || "").toLowerCase();
        return (
          uT === lower ||
          uT === stripped ||
          uT === `tenant-${stripped}`
        );
      });
    },

    fetchUsers: async (tenantUuid: string) => {
      set({ isLoading: true, error: null });
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
        let token: string | null = null;
        if (typeof window !== "undefined") {
          try {
            const rawSession = localStorage.getItem("flowbre_auth_session");
            if (rawSession) {
              token = JSON.parse(rawSession)?.access_token || null;
            }
          } catch {}
        }
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${apiBase}/api/v1/tenants/${tenantUuid}/users`, { headers });
        if (res.ok) {
          const dbUsers: any[] = await res.json();
          if (Array.isArray(dbUsers)) {
            const normalizedUsers: TenantUser[] = dbUsers.map((u: any) => ({
              id: u.id,
              tenantId: u.tenant_id || tenantUuid,
              name: u.name || u.full_name || u.username || "Team Member",
              email: u.email || "",
              role: u.role || "TRANSACTIONAL_USER",
              status: (u.status as UserStatus) || "ACTIVE",
            }));
            const newIds = new Set(normalizedUsers.map((u) => u.id));
            const newEmails = new Set(normalizedUsers.map((u) => (u.email || "").toLowerCase()).filter(Boolean));
            const lowerTenant = tenantUuid.toLowerCase();
            const strippedTenant = lowerTenant.startsWith("tenant-") ? lowerTenant.replace("tenant-", "") : lowerTenant;

            const otherTenantUsers = get().users.filter((u) => {
              if (newIds.has(u.id)) return false;
              if (u.email && newEmails.has(u.email.toLowerCase())) return false;
              const uT = (u.tenantId || "").toLowerCase();
              if (uT === lowerTenant || uT === strippedTenant || uT === `tenant-${strippedTenant}`) return false;
              return true;
            });
            const merged = [...normalizedUsers, ...otherTenantUsers];
            set({ users: merged, isLoading: false });
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(merged));
              } catch (e) {}
            }
            return;
          }
        }
      } catch (err) {
        console.error("Failed to fetch users from backend:", err);
      }
      set({ isLoading: false });
    },

    addUser: async (userData) => {
      set({ isLoading: true, error: null });
      let dbUser: any = null;
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
        const targetTenant = userData.tenantId || "platform";
        const res = await fetch(`${apiBase}/api/v1/tenants/${targetTenant}/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: userData.name,
            email: userData.email,
            role: userData.role,
            status: userData.status || "ACTIVE",
          }),
        });

        if (res.ok) {
          dbUser = await res.json();
        } else {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.detail || errData.message || "Failed to create user in database";
          set({ isLoading: false, error: errMsg });
          return { success: false, error: errMsg };
        }
      } catch (err: any) {
        console.error("Failed to create user in backend API:", err);
      }

      const newUser: TenantUser = {
        id: dbUser?.id || `usr-${Date.now().toString().slice(-4)}`,
        tenantId: userData.tenantId,
        name: dbUser?.name || userData.name,
        email: dbUser?.email || userData.email,
        role: dbUser?.role || userData.role,
        status: dbUser?.status || userData.status || "ACTIVE",
      };

      const existingWithoutThis = get().users.filter((u) => u.email.toLowerCase() !== userData.email.toLowerCase());
      const updated = [newUser, ...existingWithoutThis];
      set({ users: updated, isLoading: false });
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error("Failed to persist users:", e);
        }
      }
      return { success: true };
    },

    updateUser: async (id, updates, tenantUuid) => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
        const targetTenant = tenantUuid || "platform";
        await fetch(`${apiBase}/api/v1/tenants/${targetTenant}/users/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: updates.name,
            role: updates.role,
            status: updates.status,
          }),
        });
      } catch (err) {
        console.error("Failed to update user in backend:", err);
      }

      const updated = get().users.map((u) => (u.id === id ? { ...u, ...updates } : u));
      set({ users: updated });
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error("Failed to persist users:", e);
        }
      }
      return { success: true };
    },

    deleteUser: async (id, tenantUuid) => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
        const targetTenant = tenantUuid || "platform";
        await fetch(`${apiBase}/api/v1/tenants/${targetTenant}/users/${id}`, {
          method: "DELETE",
        });
      } catch (err) {
        console.error("Failed to delete user in backend:", err);
      }

      const updated = get().users.filter((u) => u.id !== id);
      set({ users: updated });
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error("Failed to persist users:", e);
        }
      }
      return { success: true };
    },

    resetToDefaults: () => {
      const roles = computeTiers(SEED_ROLES);
      set({ roles, users: INITIAL_USERS, selectedRoleId: "role-super-admin" });
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem(ROLES_STORAGE_KEY);
          localStorage.removeItem(USERS_STORAGE_KEY);
        } catch (e) {
          console.error("Failed to reset storage:", e);
        }
      }
    },
  };
});
