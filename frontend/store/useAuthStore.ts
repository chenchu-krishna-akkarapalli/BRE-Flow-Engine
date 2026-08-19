import { create } from "zustand";
import {
  AuthSessionResponse,
  computeChallengeProof,
  fetchAuthenticatedProfile,
  NavGroupNode,
  requestAuthChallenge,
  UserProfile,
  verifyAuthChallenge,
} from "@/lib/uas-client";

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

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  refreshToken: string | null;
  tenantUuid: string | null;
  role: RoleKey | null;
  permissions: string[];
  roleNodes: NavGroupNode[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (username: string, password: string, tenantId?: string) => Promise<AuthSessionResponse>;
  logout: () => void;
  setSession: (session: AuthSessionResponse) => void;
  checkAuth: () => Promise<void>;
  hasRole: (...roles: RoleKey[]) => boolean;
  hasPermission: (permission: string) => boolean;
}

const STORAGE_KEY = "flowbre_auth_session";

function loadInitialSession(): {
  token: string | null;
  refreshToken: string | null;
  tenantUuid: string | null;
  role: RoleKey | null;
  user: UserProfile | null;
  permissions: string[];
  roleNodes: NavGroupNode[];
  isAuthenticated: boolean;
} {
  if (typeof window === "undefined") {
    return {
      token: null,
      refreshToken: null,
      tenantUuid: null,
      role: null,
      user: null,
      permissions: [],
      roleNodes: [],
      isAuthenticated: false,
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        token: null,
        refreshToken: null,
        tenantUuid: null,
        role: null,
        user: null,
        permissions: [],
        roleNodes: [],
        isAuthenticated: false,
      };
    }
    const parsed = JSON.parse(raw);
    return {
      token: parsed.access_token || null,
      refreshToken: parsed.refresh_token || null,
      tenantUuid: parsed.tenant_uuid || null,
      role: (parsed.role as RoleKey) || null,
      user: {
        user_id: parsed.user_id,
        username: parsed.username || parsed.user_id,
        role: parsed.role,
        permissions: parsed.permissions || [],
        role_nodes: parsed.role_nodes || [],
        tenant_id: parsed.tenant_uuid,
      },
      permissions: parsed.permissions || [],
      roleNodes: parsed.role_nodes || [],
      isAuthenticated: Boolean(parsed.access_token),
    };
  } catch {
    return {
      token: null,
      refreshToken: null,
      tenantUuid: null,
      role: null,
      user: null,
      permissions: [],
      roleNodes: [],
      isAuthenticated: false,
    };
  }
}

export const useAuthStore = create<AuthState>((set, get) => {
  const initial = loadInitialSession();

  return {
    user: initial.user,
    token: initial.token,
    refreshToken: initial.refreshToken,
    tenantUuid: initial.tenantUuid,
    role: initial.role,
    permissions: initial.permissions,
    roleNodes: initial.roleNodes,
    isAuthenticated: initial.isAuthenticated,
    isLoading: false,
    error: null,

    login: async (username: string, password: string, tenantId?: string) => {
      set({ isLoading: true, error: null });
      try {
        // Step 1: Challenge
        const challenge = await requestAuthChallenge(username, tenantId);

        // Step 2: Client-side zero-password cryptographic proof calculation
        const proof = await computeChallengeProof(password, challenge.salt, challenge.nonce);

        // Step 3: Verification & Scoped JWT issuance with role_nodes
        const session = await verifyAuthChallenge(username, challenge.nonce_id, proof, tenantId);

        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        }

        set({
          token: session.access_token,
          refreshToken: session.refresh_token || null,
          tenantUuid: session.tenant_uuid || null,
          role: session.role as RoleKey,
          permissions: session.permissions,
          roleNodes: session.role_nodes || [],
          user: {
            user_id: session.user_id,
            username: session.username,
            role: session.role,
            permissions: session.permissions,
            role_nodes: session.role_nodes || [],
            tenant_id: session.tenant_uuid,
          },
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });

        return session;
      } catch (err: any) {
        const msg = err?.message || "Authentication failed.";
        set({ isLoading: false, error: msg });
        throw err;
      }
    },

    logout: () => {
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
      set({
        user: null,
        token: null,
        refreshToken: null,
        tenantUuid: null,
        role: null,
        permissions: [],
        roleNodes: [],
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    },

    setSession: (session: AuthSessionResponse) => {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      }
      set({
        token: session.access_token,
        refreshToken: session.refresh_token || null,
        tenantUuid: session.tenant_uuid || null,
        role: session.role as RoleKey,
        permissions: session.permissions,
        roleNodes: session.role_nodes || [],
        user: {
          user_id: session.user_id,
          username: session.username,
          role: session.role,
          permissions: session.permissions,
          role_nodes: session.role_nodes || [],
          tenant_id: session.tenant_uuid,
        },
        isAuthenticated: true,
      });
    },

    checkAuth: async () => {
      const { token } = get();
      if (!token) return;
      try {
        const profile = await fetchAuthenticatedProfile(token);
        set({
          user: profile,
          role: profile.role as RoleKey,
          permissions: profile.permissions,
          roleNodes: profile.role_nodes || [],
          tenantUuid: profile.tenant_id || null,
          isAuthenticated: true,
        });
      } catch {
        get().logout();
      }
    },

    hasRole: (...roles: RoleKey[]) => {
      const currentRole = get().role;
      if (!currentRole) return false;
      if (currentRole === "SUPER_ADMIN") return true;
      return roles.includes(currentRole);
    },

    hasPermission: (permission: string) => {
      const currentRole = get().role;
      if (currentRole === "SUPER_ADMIN") return true;
      return get().permissions.includes(permission);
    },
  };
});
