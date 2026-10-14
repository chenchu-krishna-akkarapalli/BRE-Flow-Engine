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

export type UserStatus = "ACTIVE" | "SUSPENDED";

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
  // Bank of India Channel (e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f)
  { id: "b3567f46-0d4e-41e8-ad32-2f31399195cc", tenantId: "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f", name: "Channel Admin BOI", email: "channel.admin@boi.com", role: "CHANNEL_ADMIN", status: "ACTIVE" },
  { id: "2e0f152f-3a67-4205-8a4e-d5ef0a5e7d69", tenantId: "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f", name: "Sales Manager", email: "sales.manager@boi.com", role: "SALES_MANAGER", status: "ACTIVE" },
  { id: "02c51528-d9e4-4381-9937-f534c480ffbf", tenantId: "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f", name: "Team Leader", email: "team.leader@boi.com", role: "TEAM_LEADER", status: "ACTIVE" },
  { id: "f1f90a08-aea6-49ad-a3ce-ed8829e57f25", tenantId: "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f", name: "Loan Officer John", email: "agent.john@boi.com", role: "TRANSACTIONAL_USER", status: "ACTIVE" },
  { id: "8d481d97-754f-4983-9f6b-2bd2139015d7", tenantId: "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f", name: "Area Manager", email: "area.manager@boi.com", role: "AREA_MANAGER", status: "ACTIVE" },

  // Apex FinTech Punjab (681cc219-8f42-4c7c-bc29-377a40c750b8)
  { id: "239259c5-9381-406e-bd78-2ef0d1544be9", tenantId: "681cc219-8f42-4c7c-bc29-377a40c750b8", name: "Apex FinTech Punjab Admin", email: "partner@apex-punjab.in", role: "CHANNEL_ADMIN", status: "ACTIVE" },

  // sagar (393dca9c-1d29-4976-8a40-6d08c481559b)
  { id: "10fdab36-6a59-4bd4-9e95-d8508bec2fe5", tenantId: "393dca9c-1d29-4976-8a40-6d08c481559b", name: "sagar Admin", email: "sagaranbu16@gmail.com", role: "CHANNEL_ADMIN", status: "ACTIVE" },

  // vidhya (f262420e-bdbc-45c5-bd07-83353c1795fb)
  { id: "def65343-4a88-4cf9-ab82-270c59a557bd", tenantId: "f262420e-bdbc-45c5-bd07-83353c1795fb", name: "iti Admin", email: "vidhyaasagaranbarasan@gmail.com", role: "CHANNEL_ADMIN", status: "ACTIVE" },

  // TCS (686172e9-51db-47c2-ba4f-0448923465f0)
  { id: "cfaff716-e462-4b64-9440-3f0827fed66f", tenantId: "686172e9-51db-47c2-ba4f-0448923465f0", name: "TCS Admin", email: "tcs@gmail.com", role: "CHANNEL_ADMIN", status: "ACTIVE" },

  // HCL (8b04f54c-d45a-4bd3-bac4-f9f33391c2b4)
  { id: "cb41af5e-96ef-4547-8f77-b3a4191a93e6", tenantId: "8b04f54c-d45a-4bd3-bac4-f9f33391c2b4", name: "HCL Admin", email: "hcl@gmail.com", role: "CHANNEL_ADMIN", status: "ACTIVE" },

  // zoho (125047c2-25d9-49a5-990f-6db76fa0c18e)
  { id: "52506272-2868-4a2c-ab44-3c266df793e3", tenantId: "125047c2-25d9-49a5-990f-6db76fa0c18e", name: "zoho Admin", email: "demo@gmail.com", role: "CHANNEL_ADMIN", status: "ACTIVE" },
];

const ROLES_STORAGE_KEY = "flowbre_dynamic_roles_v2";
const USERS_STORAGE_KEY = "flowbre_users_v3";

interface RoleHierarchyState {
  roles: RoleHierarchyNode[];
  users: TenantUser[];
  selectedRoleId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
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

  addUser: (user: Omit<TenantUser, "id">) => void;
  updateUser: (id: string, updates: Partial<TenantUser>) => void;
  deleteUser: (id: string) => void;

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
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) return INITIAL_USERS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const existingIds = new Set(parsed.map((u: TenantUser) => u.id));
      const initialToAdd = INITIAL_USERS.filter((u) => !existingIds.has(u.id));
      const combined = [...parsed, ...initialToAdd];
      const migrated = combined.map((u: TenantUser) => {
        if ((u.status as string) === "INVITED" || (u.status as string) === "NEW") {
          return {
            ...u,
            status: "ACTIVE" as UserStatus,
          };
        }
        return u;
      });
      try {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(migrated));
      } catch (e) {}
      return migrated;
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
      // Super Admin and Regional Director have access to assign all roles
      if (actorRoleKey === "SUPER_ADMIN" || actorRoleKey === "REGIONAL_DIRECTOR") return true;

      const actorTier = get().getTierLevel(actorRoleKey);
      const targetTier = get().getTierLevel(targetRoleKey);

      // Actor can only assign roles strictly lower in hierarchy (higher tier number)
      return targetTier > actorTier;
    },

    canSeeUser: (actorRoleKey: string | null, targetRoleKey: string) => {
      // Super Admin and Regional Director have global platform visibility across all tiers
      if (!actorRoleKey || actorRoleKey === "SUPER_ADMIN" || actorRoleKey === "REGIONAL_DIRECTOR") return true;

      const actorTier = get().getTierLevel(actorRoleKey);
      const targetTier = get().getTierLevel(targetRoleKey);

      // Users CANNOT see superiors in higher hierarchy tiers (lower tier numbers)
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

    addUser: (userData) => {
      const newUser: TenantUser = {
        id: `usr-${Date.now().toString().slice(-4)}`,
        ...userData,
      };
      const updated = [...get().users, newUser];
      set({ users: updated });
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error("Failed to persist users:", e);
        }
      }
    },

    updateUser: (id, updates) => {
      const updated = get().users.map((u) => (u.id === id ? { ...u, ...updates } : u));
      set({ users: updated });
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error("Failed to persist users:", e);
        }
      }
    },

    deleteUser: (id) => {
      const updated = get().users.filter((u) => u.id !== id);
      set({ users: updated });
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error("Failed to persist users:", e);
        }
      }
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
