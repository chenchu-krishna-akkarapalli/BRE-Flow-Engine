"use client";

import { use, useState, useMemo, useEffect } from "react";
import {
  Activity,
  ChevronDown,
  Lock,
  Mail,
  Network,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  useRoleHierarchyStore,
  TenantUser,
} from "@/store/useRoleHierarchyStore";
import CorporateSalesTree from "@/components/CorporateSalesTree";
import { useAuthStore } from "@/store/useAuthStore";

export default function TenantAssignmentsPage({
  params,
}: {
  params: Promise<{ tenantUuid: string }>;
}) {
  const { tenantUuid } = use(params);
  const { role: currentAuthRole, user: currentAuthUser, tenantUuid: currentAuthTenantUuid } = useAuthStore();
  const {
    roles,
    users,
    getTierLevel,
    getRoleByKey,
    getParentRole,
    fetchUsers,
    addUser,
    updateUser,
    deleteUser,
    canAssignRole,
    canSeeUser,
    canManageUser,
    resetToDefaults,
  } = useRoleHierarchyStore();

  const isChannelUser = currentAuthRole === "CHANNEL_ADMIN" || currentAuthRole === "TRANSACTIONAL_USER";
  const channelUserTenant = currentAuthUser?.tenant_id || currentAuthTenantUuid;

  // The effective tenant being inspected/managed
  const effectiveTenantUuid = (isChannelUser && channelUserTenant) ? channelUserTenant : tenantUuid;

  useEffect(() => {
    if (effectiveTenantUuid) {
      fetchUsers(effectiveTenantUuid);
    }
  }, [effectiveTenantUuid, fetchUsers]);

  // Synchronize when a channel or user is approved in another tab or view
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("flowbre_approval_sync");
      bc.onmessage = () => {
        if (effectiveTenantUuid) fetchUsers(effectiveTenantUuid);
      };
    } catch {}
    const onStorage = (e: StorageEvent) => {
      if (e.key === "flowbre_approval_sync") {
        if (effectiveTenantUuid) fetchUsers(effectiveTenantUuid);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      if (bc) bc.close();
      window.removeEventListener("storage", onStorage);
    };
  }, [effectiveTenantUuid, fetchUsers]);

  const [activeTab, setActiveTab] = useState<"roster" | "tree">("roster");
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");

  // Modals state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<TenantUser | null>(null);

  const isMainTenant =
    !isChannelUser && (
      effectiveTenantUuid === "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f" ||
      effectiveTenantUuid === "boi-channel-north" ||
      effectiveTenantUuid === "platform"
    );

  // Roles available for assignment based on role hierarchy
  const assignableRoles = useMemo(() => {
    if (!isMainTenant) {
      // In partner sub-tenants, ONLY Transactional User (Loan Officer) is assignable
      return roles.filter((r) => r.roleKey === "TRANSACTIONAL_USER");
    }
    // In Main Tenant, corporate management roles are assignable (TRANSACTIONAL_USER and CHANNEL_ADMIN excluded)
    return roles
      .filter((r) => r.roleKey !== "TRANSACTIONAL_USER" && r.roleKey !== "CHANNEL_ADMIN")
      .filter((r) => canAssignRole(currentAuthRole || "SUPER_ADMIN", r.roleKey))
      .sort((a, b) => a.tierLevel - b.tierLevel);
  }, [roles, isMainTenant, currentAuthRole, canAssignRole]);

  // Roles available when editing an existing member in user management
  const editableRoles = useMemo(() => {
    if (!isMainTenant) {
      return roles.filter(
        (r) =>
          r.roleKey === "TRANSACTIONAL_USER" ||
          (editingUser && r.roleKey === editingUser.role)
      );
    }
    return roles
      .filter(
        (r) =>
          (r.roleKey !== "TRANSACTIONAL_USER" && r.roleKey !== "CHANNEL_ADMIN") ||
          (editingUser && r.roleKey === editingUser.role)
      )
      .sort((a, b) => a.tierLevel - b.tierLevel);
  }, [roles, isMainTenant, editingUser]);

  // User form state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState(assignableRoles[0]?.roleKey || "TEAM_LEADER");
  const [newStatus, setNewStatus] = useState<"ACTIVE">("ACTIVE");

  // Sync newRole whenever assignableRoles changes
  useEffect(() => {
    if (assignableRoles.length > 0 && !assignableRoles.some((r) => r.roleKey === newRole)) {
      setNewRole(assignableRoles[0].roleKey);
    }
  }, [assignableRoles, newRole]);

  // Filter users by strict tenancy isolation, RBAC visibility, search term, and department
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // 1. Strict Tenancy Isolation
      if (isChannelUser) {
        // A Channel Admin or Transactional User can ONLY EVER see staff within their own channel
        const isSelf = !!(currentAuthUser?.email && u.email?.toLowerCase() === currentAuthUser.email.toLowerCase());
        const uTenant = (u.tenantId || "").toLowerCase();
        const targetTenant = (channelUserTenant || effectiveTenantUuid || "").toLowerCase();
        const strippedTarget = targetTenant.startsWith("tenant-") ? targetTenant.replace("tenant-", "") : targetTenant;

        const matchesTenant =
          uTenant === targetTenant ||
          uTenant === strippedTarget ||
          uTenant === `tenant-${strippedTarget}`;

        if (!isSelf && !matchesTenant) {
          return false;
        }

        // Channel partners only contain CHANNEL_ADMIN and TRANSACTIONAL_USER
        if (u.role !== "CHANNEL_ADMIN" && u.role !== "TRANSACTIONAL_USER") {
          return false;
        }
      } else if (!isMainTenant) {
        // Sub-tenant view (e.g. Super Admin inspecting an approved partner channel)
        const uTenant = (u.tenantId || "").toLowerCase();
        const targetTenant = (effectiveTenantUuid || "").toLowerCase();
        const strippedTarget = targetTenant.startsWith("tenant-") ? targetTenant.replace("tenant-", "") : targetTenant;

        const matchesTenant =
          uTenant === targetTenant ||
          uTenant === strippedTarget ||
          uTenant === `tenant-${strippedTarget}`;

        if (!matchesTenant) {
          return false;
        }
        if (u.role !== "CHANNEL_ADMIN" && u.role !== "TRANSACTIONAL_USER") {
          return false;
        }
      } else {
        // Main Tenant (Corporate platform view)
        // Transactional users (loan officers) belong strictly to partner sub-tenants
        if (u.role === "TRANSACTIONAL_USER") {
          return false;
        }
        // Channel admins of other sub-tenants must not be shown in internal corporate staff
        const uTenant = u.tenantId || "";
        const isInternalTenant =
          !uTenant ||
          uTenant === "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f" ||
          uTenant === "boi-channel-north" ||
          uTenant === "platform" ||
          uTenant === "global";
        if (!isInternalTenant && u.role === "CHANNEL_ADMIN") {
          return false;
        }
      }

      // 2. RBAC Visibility rule: cannot see superiors in higher hierarchy tiers
      if (!canSeeUser(currentAuthRole || "SUPER_ADMIN", u.role)) {
        return false;
      }

      // 3. Search filter
      const roleObj = getRoleByKey(u.role);
      const matchesSearch =
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (roleObj?.displayName.toLowerCase() || "").includes(searchTerm.toLowerCase());

      // 4. Department filter
      const matchesDept =
        departmentFilter === "ALL" ||
        (roleObj && roleObj.department.toUpperCase() === departmentFilter.toUpperCase());

      return matchesSearch && matchesDept;
    });
  }, [
    users,
    isChannelUser,
    currentAuthUser,
    channelUserTenant,
    effectiveTenantUuid,
    isMainTenant,
    canSeeUser,
    currentAuthRole,
    getRoleByKey,
    searchTerm,
    departmentFilter,
  ]);

  // Handle add user submission
  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;

    const res = await addUser({
      tenantId: effectiveTenantUuid || tenantUuid || "platform",
      name: newName.trim(),
      email: newEmail.trim(),
      role: newRole,
      status: "ACTIVE",
    });

    if (res && res.success === false) {
      alert(res.error || "Failed to create user in database.");
      return;
    }

    setNewName("");
    setNewEmail("");
    setNewStatus("ACTIVE");
    setIsInviteModalOpen(false);
  };

  // Handle edit user submission
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    await updateUser(editingUser.id, {
      name: editingUser.name,
      role: editingUser.role,
      status: editingUser.status,
    }, tenantUuid);
    setEditingUser(null);
  };

  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-6 px-4 sm:px-6 py-6 animate-fade-in">
      {/* Top Header matching Image 1 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold text-ink font-display tracking-tight">
              User Management & Role Assignments
            </h1>
            <span className="rounded-md bg-brand-500/10 px-2 py-0.5 text-xs font-mono font-bold text-brand-600 border border-brand-500/20">
              {effectiveTenantUuid}
            </span>
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[0.6875rem] font-mono font-bold text-emerald-600 border border-emerald-500/20">
              v2.4 Live
            </span>
          </div>
          <p className="text-xs text-ink-subtle mt-0.5">
            Manage channel team members, RBAC roles, and operational hierarchy.
          </p>
        </div>

        {assignableRoles.length > 0 ? (
          <button
            type="button"
            onClick={() => setIsInviteModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-xs font-bold text-white shadow-glow hover:bg-brand-600 transition-all"
          >
            <Plus size={16} />
            <span>Add New Role</span>
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 border border-line px-4 py-2.5 text-xs font-bold text-ink-subtle cursor-not-allowed"
            title="Your role does not have permission to add subordinate roles."
          >
            <Lock size={14} />
            <span>Role Creation Restricted</span>
          </button>
        )}
      </div>

      {/* Dual-View Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-line pb-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("roster")}
            className={`inline-flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-bold transition-all ${
              activeTab === "roster"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-ink-subtle hover:text-ink"
            }`}
          >
            <Users size={15} />
            <span>User Directory & Roles ({filteredUsers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("tree")}
            className={`inline-flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-bold transition-all ${
              activeTab === "tree"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-ink-subtle hover:text-ink"
            }`}
          >
            <Network size={15} />
            <span>Corporate & Sales Reporting Tree</span>
          </button>
        </div>

        <button
          type="button"
          onClick={resetToDefaults}
          title="Reset to default seed users and roles"
          className="text-[0.6875rem] font-mono text-ink-subtle hover:text-rose-600 transition-colors"
        >
          Reset Defaults
        </button>
      </div>

      {/* TAB 1: User Directory & Roles (Image 1 Table with Resolved Tiers) */}
      {activeTab === "roster" && (
        <div className="flex flex-col gap-4 animate-fade-in">
          {/* Active RBAC Role Scope Alert */}
          {isChannelUser ? (
            <div className="flex items-center justify-between rounded-2xl bg-teal-500/5 border border-teal-500/20 px-4 py-2.5 text-xs text-teal-900">
              <div className="flex items-center gap-2">
                <ShieldCheck size={15} className="text-teal-600 shrink-0" />
                <span>
                  Scoped Channel View as <strong className="font-bold">{currentAuthRole}</strong>: Strictly isolated to your channel partner organization ({effectiveTenantUuid}). All external channel and corporate tenants are hidden.
                </span>
              </div>
              <span className="font-mono text-[0.625rem] font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-md uppercase">
                Channel Isolated
              </span>
            </div>
          ) : currentAuthRole && currentAuthRole !== "SUPER_ADMIN" ? (
            <div className="flex items-center justify-between rounded-2xl bg-amber-500/5 border border-amber-500/20 px-4 py-2.5 text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <ShieldAlert size={15} className="text-amber-600 shrink-0" />
                <span>
                  Scoped View as <strong className="font-bold">{currentAuthRole}</strong>: Superior roles in higher hierarchy are restricted and hidden from your management view.
                </span>
              </div>
              <span className="font-mono text-[0.625rem] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md uppercase">
                Subordinates Only
              </span>
            </div>
          ) : null}

          {/* Search & Department Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex flex-1 items-center gap-3 rounded-2xl border border-line bg-white p-3 shadow-xs w-full">
              <Search size={16} className="text-ink-subtle ml-2" />
              <input
                type="text"
                placeholder="Search by name, email, or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 bg-transparent text-xs text-ink placeholder:text-ink-subtle focus:outline-hidden"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="text-ink-subtle hover:text-ink p-1 text-xs"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="rounded-2xl border border-line bg-white px-3 py-3 text-xs font-bold text-ink focus:outline-hidden shadow-xs"
              >
                <option value="ALL">All Departments</option>
                <option value="SALES">Sales Function</option>
                <option value="CORPORATE">Corporate Leadership</option>
              </select>
            </div>
          </div>

          {/* User Table */}
          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-slate-50 text-[0.6875rem] font-extrabold uppercase tracking-wider text-ink-subtle">
                <tr>
                  <th className="px-5 py-3">Member</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => {
                    const roleNode = getRoleByKey(user.role);
                    const parent = getParentRole(user.role);

                    return (
                      <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="font-bold text-ink">{user.name}</p>
                          <p className="text-[0.6875rem] text-ink-subtle">{user.email}</p>
                        </td>

                        <td className="px-5 py-3.5">
                          <div className="inline-flex flex-col gap-0.5">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[0.6875rem] font-bold border ${
                                roleNode?.department === "CORPORATE"
                                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                  : "bg-brand-500/10 text-brand-600 border-brand-500/20"
                              }`}
                            >
                              <Shield size={12} />
                              {user.role}
                            </span>
                            {parent && (
                              <span className="text-[0.625rem] text-ink-subtle italic">
                                Reports to: {parent.displayName}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[0.625rem] font-bold uppercase ${
                              user.status === "ACTIVE"
                                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                : user.status === "PENDING"
                                ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                : "bg-rose-50 text-rose-600 border border-rose-200"
                            }`}
                          >
                            {user.status || "ACTIVE"}
                          </span>
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => setEditingUser(user)}
                              className="text-xs font-bold text-brand-600 hover:text-brand-700 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteUser(user.id)}
                              className="text-ink-subtle hover:text-rose-600 transition-colors p-1"
                              title="Remove member"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-xs text-ink-subtle">
                      No members match the query "{searchTerm}".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Corporate & Sales Reporting Tree (Image 2) */}
      {activeTab === "tree" && <CorporateSalesTree />}

      {/* Slide-over Drawer: Add New Role with all Hierarchy Roles */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop: Minimal overlay with zero blur so the entire page and table remain 100% visible */}
          <div
            className="fixed inset-0 bg-slate-900/10 transition-opacity animate-fade-in"
            onClick={() => setIsInviteModalOpen(false)}
          />

          {/* Right-side Floating Card Drawer */}
          <div className="fixed top-3 right-3 bottom-3 z-50 flex h-[calc(100vh-1.5rem)] w-full max-w-[460px] flex-col rounded-3xl bg-white border border-slate-200/90 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.22)] animate-drawer-in overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 border border-teal-200/60 text-teal-600 shadow-2xs">
                  <UserPlus size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-slate-900 font-display">
                      Add New Role
                    </h2>
                    <span className="rounded-full bg-teal-100/80 px-2 py-0.5 text-[0.625rem] font-bold text-teal-800 font-mono">
                      RBAC
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Assign user roles aligned with reporting hierarchy.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleInviteUser} className="flex-1 flex flex-col justify-between overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4.5">
                <div>
                  <label className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <User size={13} className="text-slate-400" />
                      Full Name
                    </span>
                    <span className="text-[0.625rem] font-normal text-slate-400">Required</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kulkarni"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-teal-500 focus:ring-3 focus:ring-teal-500/10 focus:outline-hidden transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Mail size={13} className="text-slate-400" />
                      Work Email
                    </span>
                    <span className="text-[0.625rem] font-normal text-slate-400">Corporate Domain</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. ramesh.kulkarni@finsol.in"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-teal-500 focus:ring-3 focus:ring-teal-500/10 focus:outline-hidden transition-all font-medium"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <Shield size={13} className="text-teal-600" />
                      Assigned Role
                    </label>
                    <span className="rounded-full bg-teal-50 border border-teal-200/60 px-2 py-0.5 text-[0.625rem] font-mono font-bold text-teal-700">
                      Tier Aligned
                    </span>
                  </div>
                  <div className="relative">
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 pr-9 text-xs text-slate-900 focus:bg-white focus:border-teal-500 focus:ring-3 focus:ring-teal-500/10 focus:outline-hidden transition-all font-mono font-medium cursor-pointer"
                    >
                      {assignableRoles.map((r) => (
                        <option key={r.id} value={r.roleKey}>
                          {r.displayName} ({r.department})
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-3.5 top-3.5 text-slate-400" />
                  </div>
                  <p className="text-[0.625rem] text-slate-400 mt-1.5 leading-relaxed">
                    Select any leadership, regional, or sales function role (e.g. Regional Director, Operations Head).
                  </p>
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                    <Activity size={13} className="text-slate-400" />
                    Account Status
                  </label>
                  <div className="flex items-center justify-between rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-3.5 py-2.5 text-xs font-bold text-emerald-800">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span>ACTIVE &bull; Instant Provisioning</span>
                    </div>
                    <span className="text-[0.625rem] font-mono text-emerald-700 font-medium">Auto-Enabled</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50/40 via-white to-slate-50 p-4 text-[0.6875rem] text-slate-600 space-y-1.5 shadow-2xs">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-teal-600" />
                    <span>Governance &amp; Privilege Enforcement</span>
                  </div>
                  <p className="text-slate-500 leading-relaxed">
                    All assigned roles will immediately inherit permission scopes, telemetry visibility, and digital underwriting thresholds.
                  </p>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 backdrop-blur-sm">
                <span className="text-[0.6875rem] font-mono text-slate-400">
                  Click outside to close
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-teal-600/20 hover:bg-teal-700 transition-all cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Create Role</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slide-over Drawer: Edit Team Member */}
      {editingUser && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop: Minimal overlay with zero blur */}
          <div
            className="fixed inset-0 bg-slate-900/10 transition-opacity animate-fade-in"
            onClick={() => setEditingUser(null)}
          />

          {/* Right-side Floating Card Drawer */}
          <div className="fixed top-3 right-3 bottom-3 z-50 flex h-[calc(100vh-1.5rem)] w-full max-w-[460px] flex-col rounded-3xl bg-white border border-slate-200/90 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.22)] animate-drawer-in overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 border border-teal-200/60 text-teal-600 shadow-2xs">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-slate-900 font-display">
                      Edit Role &amp; Status
                    </h2>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.625rem] font-bold text-slate-600 font-mono">
                      Active Member
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{editingUser.name} &bull; {editingUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="rounded-full p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUpdateUser} className="flex-1 flex flex-col justify-between overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4.5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <Shield size={13} className="text-teal-600" />
                      Assigned Role
                    </label>
                    <span className="rounded-full bg-teal-50 border border-teal-200/60 px-2 py-0.5 text-[0.625rem] font-mono font-bold text-teal-700">
                      Tier Aligned
                    </span>
                  </div>
                  <div className="relative">
                    <select
                      value={editingUser.role}
                      onChange={(e) =>
                        setEditingUser({ ...editingUser, role: e.target.value })
                      }
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 pr-9 text-xs text-slate-900 focus:bg-white focus:border-teal-500 focus:ring-3 focus:ring-teal-500/10 focus:outline-hidden transition-all font-mono font-medium cursor-pointer"
                    >
                      {editableRoles.map((r) => (
                        <option key={r.id} value={r.roleKey}>
                          {r.displayName} ({r.department})
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-3.5 top-3.5 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                    <Activity size={13} className="text-slate-400" />
                    Account Status
                  </label>
                  <div className="relative">
                    <select
                      value={editingUser.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE"}
                      onChange={(e) =>
                        setEditingUser({
                          ...editingUser,
                          status: e.target.value as "ACTIVE" | "SUSPENDED",
                        })
                      }
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 pr-9 text-xs text-slate-900 focus:bg-white focus:border-teal-500 focus:ring-3 focus:ring-teal-500/10 focus:outline-hidden transition-all font-bold cursor-pointer"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-3.5 top-3.5 text-slate-400" />
                  </div>
                </div>

                <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-slate-50 p-4 text-[0.6875rem] text-slate-600 space-y-1.5 shadow-2xs">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span>⚡ Instant Role Propagation</span>
                  </div>
                  <p className="text-slate-500 leading-relaxed">
                    Updating permissions takes effect across all real-time approval pipelines, session tokens, and audit logs immediately.
                  </p>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 backdrop-blur-sm">
                <span className="text-[0.6875rem] font-mono text-slate-400">
                  Click outside to close
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-teal-600/20 hover:bg-teal-700 transition-all cursor-pointer"
                  >
                    <ShieldCheck size={14} />
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
