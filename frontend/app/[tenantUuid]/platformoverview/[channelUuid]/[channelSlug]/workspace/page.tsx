"use client";

import { use, useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  ExternalLink,
  GitBranch,
  Lock,
  Mail,
  MoreVertical,
  Phone,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TrendingUp,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  getTenantByUuidOrCode,
  INITIAL_TENANTS,
  INITIAL_AUDIT_LOGS,
  TenantRecord,
  TenantLifecycleStatus,
} from "@/lib/tenants-data";
import {
  useRoleHierarchyStore,
  INITIAL_USERS,
  TenantUser,
  UserStatus,
} from "@/store/useRoleHierarchyStore";
import { useAuthStore } from "@/store/useAuthStore";

export default function ChannelWorkspacePage({
  params,
}: {
  params: Promise<{
    tenantUuid: string;
    channelUuid: string;
    channelSlug: string;
  }>;
}) {
  const { tenantUuid, channelUuid, channelSlug } = use(params);
  const { role: currentAuthRole } = useAuthStore();

  // Retrieve channel metadata (fallback if not in mock list)
  const channel: TenantRecord = useMemo(() => {
    const found = getTenantByUuidOrCode(channelUuid) || getTenantByUuidOrCode(channelSlug);
    if (found) return found;
    return {
      id: `t-${channelSlug}`,
      name: channelSlug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      code: channelSlug,
      tenant_uuid: channelUuid,
      channel_type: "DSA",
      status: "active",
      cibil_overlay: 10,
      contact_email: `ops@${channelSlug}.in`,
      contact_phone: "+91 98765 00000",
      evaluation_count_24h: 840,
      mean_latency_ms: 16.2,
      created_at: new Date().toISOString(),
    };
  }, [channelUuid, channelSlug]);

  const [liveChannel, setLiveChannel] = useState<TenantRecord>(channel);

  const fetchLiveTenant = useCallback(async () => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
      const res = await fetch(`${apiBase}/api/v1/tenants/${channelUuid}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.name) {
          setLiveChannel({
            id: data.id,
            name: data.name,
            code: data.code,
            tenant_uuid: data.tenant_uuid || data.id,
            channel_type: data.channel_type || "DSA",
            status: (data.status as TenantLifecycleStatus) || "active",
            cibil_overlay: data.cibil_overlay ?? 10,
            contact_email: data.contact_email || `ops@${data.code}.in`,
            contact_phone: data.contact_phone || "+91 98765 00000",
            evaluation_count_24h: 840,
            mean_latency_ms: 16.2,
            created_at: data.created_at || new Date().toISOString(),
          });
        }
      }
    } catch {}
  }, [channelUuid]);

  useEffect(() => {
    setLiveChannel(channel);
    fetchLiveTenant();
  }, [channelUuid, channel, fetchLiveTenant]);

  // Role hierarchy and user store
  const {
    roles,
    users,
    addUser,
    updateUser,
    deleteUser,
    canAssignRole,
    canManageUser,
    getRoleByKey,
  } = useRoleHierarchyStore();

  // Real database employees state
  const [realUsers, setRealUsers] = useState<TenantUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);

  // Fetch real database employees for this specific channel
  const fetchRealUsers = useCallback(async () => {
    try {
      setIsLoadingUsers(true);
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
      const targetUuid = liveChannel?.tenant_uuid || channelUuid;
      const res = await fetch(`${apiBase}/api/v1/tenants/${targetUuid}/users`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setRealUsers(
            data.map((u: any) => ({
              id: u.id,
              tenantId: u.tenant_id,
              name: u.name,
              email: u.email,
              role: u.role,
              status: u.status as UserStatus,
            }))
          );
          setIsLoadingUsers(false);
          return;
        }
      }
    } catch (err) {
      console.warn("Failed to fetch real channel employees from API, using clean seed:", err);
    }

    // Clean fallback matching this channel
    const fallback = INITIAL_USERS.filter(
      (u) =>
        u.tenantId === liveChannel.tenant_uuid ||
        u.tenantId === liveChannel.id ||
        u.tenantId === liveChannel.code ||
        u.tenantId === channelUuid
    );
    setRealUsers(fallback);
    setIsLoadingUsers(false);
  }, [liveChannel?.tenant_uuid, liveChannel?.id, liveChannel?.code, channelUuid]);

  useEffect(() => {
    fetchRealUsers();
  }, [fetchRealUsers]);

  // Zero-latency cross-tab synchronization via BroadcastChannel and Storage events
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("flowbre_approval_sync");
      bc.onmessage = () => {
        fetchLiveTenant();
        fetchRealUsers();
      };
    } catch {}

    const onStorage = (e: StorageEvent) => {
      if (e.key === "flowbre_approval_sync") {
        fetchLiveTenant();
        fetchRealUsers();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      if (bc) bc.close();
      window.removeEventListener("storage", onStorage);
    };
  }, [fetchLiveTenant, fetchRealUsers]);

  // Active view state
  const [activeTab, setActiveTab] = useState<"employees" | "details" | "audit">("employees");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  // Modal State for adding/inviting employee
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<TenantUser | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("CHANNEL_ADMIN");
  const [formStatus, setFormStatus] = useState<UserStatus>("ACTIVE");

  // Copy helper
  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Filter employees bound strictly to this channel's real database records
  const channelEmployees = useMemo(() => {
    return realUsers.filter((u) => {
      const matchesSearch =
        searchTerm === "" ||
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.role.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [realUsers, searchTerm, roleFilter]);

  // Channel audit entries
  const channelAuditLogs = useMemo(() => {
    return INITIAL_AUDIT_LOGS.filter(
      (a) =>
        a.tenant_uuid === liveChannel.tenant_uuid ||
        a.tenant_name.toLowerCase().includes(liveChannel.name.toLowerCase())
    );
  }, [liveChannel]);

  // Handle create or edit employee with live API sync
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) return;

    const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

    const channelTargetId = liveChannel?.tenant_uuid || channelUuid;

    if (editingUser) {
      try {
        await fetch(`${apiBase}/api/v1/tenants/${channelTargetId}/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            role: formRole,
            status: formStatus,
          }),
        });
      } catch (err) {
        console.error("API error updating user:", err);
      }
      updateUser(editingUser.id, {
        name: formName.trim(),
        role: formRole,
        status: formStatus,
      });
    } else {
      try {
        await fetch(`${apiBase}/api/v1/tenants/${channelTargetId}/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            email: formEmail.trim(),
            role: formRole,
            status: formStatus,
          }),
        });
      } catch (err) {
        console.error("API error creating user:", err);
      }
      addUser({
        tenantId: channelTargetId,
        name: formName.trim(),
        email: formEmail.trim(),
        role: formRole,
        status: formStatus,
      });
    }

    try {
      const bc = new BroadcastChannel("flowbre_approval_sync");
      bc.postMessage({ type: "CHANNEL_USERS_CHANGED", channelId: channelTargetId });
      bc.close();
    } catch {}

    await fetchRealUsers();
    setIsAddUserModalOpen(false);
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormRole("CHANNEL_ADMIN");
    setFormStatus("ACTIVE");
  };

  const handleToggleStatus = async (user: TenantUser) => {
    const nextStatus: UserStatus = user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
    const channelTargetId = liveChannel?.tenant_uuid || channelUuid;
    try {
      await fetch(`${apiBase}/api/v1/tenants/${channelTargetId}/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
    } catch (err) {
      console.error("API error toggling user status:", err);
    }
    updateUser(user.id, { status: nextStatus });
    setRealUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u))
    );
    try {
      const bc = new BroadcastChannel("flowbre_approval_sync");
      bc.postMessage({ type: "CHANNEL_USERS_CHANGED", channelId: channelTargetId });
      bc.close();
    } catch {}
  };

  const handleDeleteUser = async (userId: string) => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
    const channelTargetId = liveChannel?.tenant_uuid || channelUuid;
    try {
      await fetch(`${apiBase}/api/v1/tenants/${channelTargetId}/users/${userId}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("API error deleting user:", err);
    }
    deleteUser(userId);
    setRealUsers((prev) => prev.filter((u) => u.id !== userId));
    try {
      const bc = new BroadcastChannel("flowbre_approval_sync");
      bc.postMessage({ type: "CHANNEL_USERS_CHANGED", channelId: channelTargetId });
      bc.close();
    } catch {}
  };

  const openEditModal = (user: TenantUser) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormRole(user.role);
    setFormStatus(user.status);
    setIsAddUserModalOpen(true);
  };

  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-6 px-4 sm:px-6 py-6 animate-fade-in">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
        <Link
          href={`/${tenantUuid}/platformoverview`}
          className="flex items-center gap-1.5 text-teal-600 hover:text-teal-700 font-bold transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Platform Overview</span>
        </Link>
        <span>/</span>
        <span className="text-slate-400 font-mono text-[0.6875rem]">Channels</span>
        <span>/</span>
        <span className="font-bold text-slate-800">{liveChannel.name}</span>
        <span>/</span>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[0.625rem] text-slate-600 border border-slate-200">
          Workspace
        </span>
      </div>

      {/* Channel Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-600 border border-teal-500/20">
                <Building2 size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl font-extrabold text-slate-900 font-display">
                    {liveChannel.name}
                  </h1>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.625rem] font-bold uppercase border ${
                      liveChannel.status === "active"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : liveChannel.status === "under_review"
                        ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                        : liveChannel.status === "pending"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    }`}
                  >
                    {liveChannel.status}
                  </span>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[0.625rem] font-mono font-bold text-slate-700 border border-slate-200">
                    {liveChannel.channel_type}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap font-mono">
                  <span>Code: <strong>{liveChannel.code}</strong></span>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(liveChannel.tenant_uuid, "channelUuid")}
                    className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-800 transition-colors cursor-pointer"
                    title="Click to copy Channel UUID"
                  >
                    <span>UUID: /{liveChannel.tenant_uuid}</span>
                    {copiedField === "channelUuid" ? (
                      <Check size={12} className="text-emerald-600" />
                    ) : (
                      <Copy size={12} className="text-slate-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href={`/${liveChannel.tenant_uuid}/logs`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-white hover:border-slate-300 transition-all"
            >
              <Activity size={14} />
              <span>Channel Logs</span>
            </Link>
            <button
              type="button"
              onClick={() => {
                setEditingUser(null);
                setFormName("");
                setFormEmail("");
                setFormRole("CHANNEL_ADMIN");
                setFormStatus("ACTIVE");
                setIsAddUserModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition-all cursor-pointer"
            >
              <UserPlus size={14} />
              <span>Add Employee</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100 text-xs">
          <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
            <span className="text-[0.6875rem] font-bold text-slate-400 uppercase tracking-wider">CIBIL Overlay</span>
            <p className="mt-1 font-mono text-base font-extrabold text-slate-900">+{liveChannel.cibil_overlay} pts</p>
            <span className="text-[0.625rem] text-slate-500">Margin on partner banks</span>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
            <span className="text-[0.6875rem] font-bold text-slate-400 uppercase tracking-wider">24h Evaluations</span>
            <p className="mt-1 font-mono text-base font-extrabold text-teal-700">{liveChannel.evaluation_count_24h}</p>
            <span className="text-[0.625rem] text-emerald-600 font-bold flex items-center gap-1">
              <TrendingUp size={11} /> +12% throughput
            </span>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
            <span className="text-[0.6875rem] font-bold text-slate-400 uppercase tracking-wider">Mean Latency</span>
            <p className="mt-1 font-mono text-base font-extrabold text-slate-900">{liveChannel.mean_latency_ms} ms</p>
            <span className="text-[0.625rem] text-emerald-600 font-bold flex items-center gap-1">
              <CheckCircle2 size={11} /> 100% SLA compliant
            </span>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
            <span className="text-[0.6875rem] font-bold text-slate-400 uppercase tracking-wider">Primary Administrator</span>
            <p className="mt-1 text-xs font-bold text-slate-900 truncate">{liveChannel.contact_email}</p>
            <p className="text-[0.625rem] text-slate-400 font-mono truncate">{liveChannel.contact_phone}</p>
          </div>
        </div>
      </div>

      {/* Main Workspace Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("employees")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "employees"
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Users size={16} />
          <span>Channel Employees ({channelEmployees.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("details")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "details"
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Building2 size={16} />
          <span>Channel Profile &amp; Underwriting</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("audit")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "audit"
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Clock size={16} />
          <span>Audit Log History</span>
        </button>
      </div>

      {/* ----------------- TAB 1: CHANNEL EMPLOYEES ----------------- */}
      {activeTab === "employees" && (
        <div className="space-y-4">
          {/* Controls Bar: Search, Filters & View Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={`Search ${liveChannel.name} employees...`}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-800 focus:outline-hidden"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                aria-label="Filter by assigned role"
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:border-slate-800 focus:outline-hidden"
              >
                <option value="ALL">All Roles</option>
                <option value="CHANNEL_ADMIN">Channel Admin</option>
                <option value="TRANSACTIONAL_USER">Transactional User</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingUser(null);
                setFormName("");
                setFormEmail("");
                setFormRole("CHANNEL_ADMIN");
                setFormStatus("ACTIVE");
                setIsAddUserModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-700 transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>Add Employee</span>
            </button>
          </div>

          {/* Table Roster */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
              <div className="overflow-x-auto">
                {channelEmployees.length === 0 ? (
                  <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
                    <Users className="w-10 h-10 text-slate-300" />
                    <h3 className="text-sm font-bold text-slate-700">No employees found for this channel</h3>
                    <p className="text-xs text-slate-400 max-w-sm">
                      No staff members match the current filter or have been provisioned yet for {liveChannel.name}.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingUser(null);
                        setFormName("");
                        setFormEmail("");
                        setFormRole("CHANNEL_ADMIN");
                        setFormStatus("ACTIVE");
                        setIsAddUserModalOpen(true);
                      }}
                      className="mt-2 text-xs font-bold text-teal-600 hover:text-teal-700 cursor-pointer"
                    >
                      + Add first employee
                    </button>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-[0.625rem] font-extrabold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3.5">Employee Name</th>
                        <th className="px-4 py-3.5">Assigned Role</th>
                        <th className="px-4 py-3.5">Account Status</th>
                        <th className="px-4 py-3.5">Channel Bound ID</th>
                        <th className="px-4 py-3.5 text-right font-mono">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {channelEmployees.map((emp) => {
                        const roleObj = getRoleByKey(emp.role);
                        return (
                          <tr key={emp.id} className="transition-colors hover:bg-slate-50/70">
                            {/* Employee Info */}
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 font-bold text-[0.6875rem] text-teal-400">
                                  {emp.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .slice(0, 2)
                                    .join("")
                                    .toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900">{emp.name}</div>
                                  <div className="font-mono text-[0.625rem] text-slate-400">{emp.email}</div>
                                </div>
                              </div>
                            </td>

                            {/* Assigned Role */}
                            <td className="px-4 py-3.5">
                              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-[0.625rem] font-bold text-slate-800 border border-slate-200">
                                <Shield size={11} className="text-teal-600" />
                                {roleObj?.displayName || emp.role.replace("_", " ")}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3.5">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.5625rem] font-bold uppercase border ${
                                  emp.status === "ACTIVE"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : emp.status === "PENDING"
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-rose-50 text-rose-700 border-rose-200"
                                }`}
                              >
                                {emp.status}
                              </span>
                            </td>

                            {/* Channel ID */}
                            <td className="px-4 py-3.5 font-mono text-[0.6875rem] text-slate-500">
                              /{liveChannel.tenant_uuid.slice(0, 12)}...
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditModal(emp)}
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[0.6875rem] font-bold text-slate-700 shadow-xs hover:border-slate-300 hover:text-slate-900 transition-all cursor-pointer"
                                >
                                  Edit Role
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(emp)}
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[0.6875rem] font-bold text-slate-700 shadow-xs hover:border-slate-300 hover:text-slate-900 transition-all cursor-pointer"
                                >
                                  {emp.status === "ACTIVE" ? "Suspend Access" : "Activate Access"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(emp.id)}
                                  className="rounded-lg p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                  title="Remove Employee"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
          </div>
        </div>
      )}

      {/* ----------------- TAB 2: CHANNEL PROFILE & DETAILS ----------------- */}
      {activeTab === "details" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 font-display border-b border-slate-100 pb-3 flex items-center gap-2">
              <Building2 size={16} className="text-teal-600" />
              <span>Channel Registration Parameters</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 font-medium">Channel Name</span>
                <p className="font-bold text-slate-900 text-sm">{liveChannel.name}</p>
              </div>

              <div>
                <span className="text-slate-400 font-medium">Internal Channel Slug</span>
                <p className="font-mono font-bold text-slate-800">{liveChannel.code}</p>
              </div>

              <div>
                <span className="text-slate-400 font-medium">Channel Classification</span>
                <p className="font-bold text-slate-800 mt-0.5">{liveChannel.channel_type}</p>
              </div>

              <div>
                <span className="text-slate-400 font-medium">Registration Date</span>
                <p className="font-mono text-slate-700">{new Date(liveChannel.created_at).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 font-display border-b border-slate-100 pb-3 flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-600" />
              <span>Underwriting &amp; Rule Configurations</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-teal-50/50 border border-teal-200">
                <span className="text-[0.6875rem] font-bold text-teal-800 uppercase tracking-wider">CIBIL Overlay Score Margin</span>
                <p className="font-mono text-xl font-extrabold text-teal-900 mt-1">+{liveChannel.cibil_overlay} points</p>
                <p className="text-[0.6875rem] text-teal-700 mt-1">
                  Applications evaluated for {liveChannel.name} require a credit score threshold elevated by +{liveChannel.cibil_overlay} points over base lender policies.
                </p>
              </div>

              <div>
                <span className="text-slate-400 font-medium">Primary Contact Email</span>
                <p className="font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                  <Mail size={13} className="text-slate-400" />
                  <span>{liveChannel.contact_email}</span>
                </p>
              </div>

              <div>
                <span className="text-slate-400 font-medium">Official Phone</span>
                <p className="font-mono text-slate-800 flex items-center gap-1.5 mt-0.5">
                  <Phone size={13} className="text-slate-400" />
                  <span>{liveChannel.contact_phone}</span>
                </p>
              </div>

              <div>
                <span className="text-slate-400 font-medium">Provisioned Dynamic Nodes</span>
                <p className="font-bold text-emerald-700 mt-0.5">13 Navigation Nodes Active</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- TAB 3: AUDIT HISTORY ----------------- */}
      {activeTab === "audit" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 font-display flex items-center gap-2">
              <Clock size={16} className="text-teal-600" />
              <span>Channel Specific Audit &amp; Transition History</span>
            </h3>
            <span className="text-[0.625rem] font-mono text-slate-400">Immutable Ledger</span>
          </div>

          <div className="space-y-3">
            {channelAuditLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No historical status transitions logged for this channel.</p>
            ) : (
              channelAuditLogs.map((log) => (
                <div key={log.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{log.tenant_name}</span>
                      <span className="inline-flex items-center gap-1 font-mono text-[0.6875rem] text-slate-500">
                        <span className="uppercase font-bold text-slate-500">{log.previous_status}</span>
                        <span>→</span>
                        <span className="uppercase font-bold text-emerald-700">{log.new_status}</span>
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{log.reason}</p>
                    <p className="text-[0.625rem] text-slate-400 mt-0.5">Authorized by: {log.changed_by}</p>
                  </div>
                  <span className="font-mono text-[0.625rem] text-slate-400 shrink-0">{log.timestamp}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ----------------- ADD / EDIT EMPLOYEE SLIDE-OVER DRAWER ----------------- */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop: Minimal overlay with zero blur so the entire page remains 100% visible */}
          <div
            className="fixed inset-0 bg-slate-900/10 transition-opacity animate-fade-in"
            onClick={() => setIsAddUserModalOpen(false)}
          />

          {/* Right-side Floating Card Drawer */}
          <div className="fixed top-3 right-3 bottom-3 z-50 flex h-[calc(100vh-1.5rem)] w-full max-w-[460px] flex-col rounded-3xl bg-white border border-slate-200/90 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.22)] animate-drawer-in overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 border border-teal-200/60 text-teal-600 shadow-2xs">
                  <UserCheck size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-slate-900 font-display">
                      {editingUser ? "Edit Employee Role" : `Add Employee`}
                    </h3>
                    <span className="rounded-full bg-teal-100/80 px-2 py-0.5 text-[0.625rem] font-bold text-teal-800 font-mono">
                      STAFF
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Channel: {liveChannel.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddUserModalOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveUser} className="flex-1 flex flex-col justify-between overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
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
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Ramesh Kulkarni"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-teal-500 focus:ring-3 focus:ring-teal-500/10 focus:outline-hidden transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Mail size={13} className="text-slate-400" />
                      Corporate Email Address
                    </span>
                    <span className="text-[0.625rem] font-normal text-slate-400">Domain Auth</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="e.g. ramesh@boi-dsa.in"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-teal-500 focus:ring-3 focus:ring-teal-500/10 focus:outline-hidden transition-all font-medium"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <Shield size={13} className="text-teal-600" />
                      Assigned Role &amp; Permission Tier
                    </label>
                    <span className="rounded-full bg-teal-50 border border-teal-200/60 px-2 py-0.5 text-[0.625rem] font-mono font-bold text-teal-700">
                      Channel Level
                    </span>
                  </div>
                  <div className="relative">
                    <select
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 pr-8 text-xs text-slate-900 focus:bg-white focus:border-teal-500 focus:ring-3 focus:ring-teal-500/10 focus:outline-hidden font-bold cursor-pointer"
                    >
                      <option value="CHANNEL_ADMIN">Channel Admin (Branch Head)</option>
                      <option value="TRANSACTIONAL_USER">Transactional User (Loan Officer)</option>
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
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as UserStatus)}
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 pr-8 text-xs text-slate-900 focus:bg-white focus:border-teal-500 focus:ring-3 focus:ring-teal-500/10 focus:outline-hidden font-bold cursor-pointer"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-3.5 top-3.5 text-slate-400" />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-50/40 via-white to-slate-50 border border-teal-100 text-slate-600 text-[0.6875rem] space-y-1 shadow-2xs">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-teal-600" />
                    <span>Channel Tenancy Enforcement</span>
                  </div>
                  <p className="text-slate-500 leading-relaxed">
                    Employee will be provisioned exclusively under channel <code className="font-mono text-teal-700 font-bold">{liveChannel.name}</code> ({liveChannel.tenant_uuid.slice(0, 10)}...).
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
                    onClick={() => setIsAddUserModalOpen(false)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-teal-600/20 hover:bg-teal-700 transition-all cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>{editingUser ? "Save Changes" : "Create Employee"}</span>
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
