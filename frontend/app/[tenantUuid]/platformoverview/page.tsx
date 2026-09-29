"use client";

import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  CheckCircle,
  CheckCircle2,
  Clock,
  Copy,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Eye,
  Filter,
  Globe,
  HelpCircle,
  Info,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  TrendingUp,
  UserCheck,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  INITIAL_TENANTS,
  INITIAL_AUDIT_LOGS,
  TenantRecord,
  StatusAuditEntry,
  TenantLifecycleStatus,
} from "@/lib/tenants-data";
import { useAuthStore } from "@/store/useAuthStore";

export default function ScopedPlatformOverviewPage({
  params,
}: {
  params: Promise<{ tenantUuid: string }>;
}) {
  const { tenantUuid } = use(params);
  const { token, user } = useAuthStore();

  const [tenants, setTenants] = useState<TenantRecord[]>(INITIAL_TENANTS);
  const [auditLogs, setAuditLogs] = useState<StatusAuditEntry[]>(INITIAL_AUDIT_LOGS);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Modal State
  const [selectedTenant, setSelectedTenant] = useState<TenantRecord | null>(null);
  const [approvalOverlay, setApprovalOverlay] = useState(15);
  const [actionReason, setActionReason] = useState("");
  const [activeModal, setActiveModal] = useState<"APPROVE" | "REJECT" | "SUSPEND" | "REQUEST_INFO" | "REOPEN" | null>(null);

  // Add Channel Right-Side Drawer State
  const [isAddChannelDrawerOpen, setIsAddChannelDrawerOpen] = useState(false);
  // Audit Log Timeline Downwards Expand State
  const [isAuditLogsExpanded, setIsAuditLogsExpanded] = useState(false);
  const [newChannelForm, setNewChannelForm] = useState({
    name: "",
    code: "",
    channelType: "DSA",
    contactEmail: "",
    contactPhone: "",
    cibilOverlay: 10,
  });
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [createChannelError, setCreateChannelError] = useState<string | null>(null);

  const handleChannelNameChange = (val: string) => {
    const slug = val
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    setNewChannelForm((prev) => ({
      ...prev,
      name: val,
      code: `tenant-${slug}`,
    }));
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateChannelError(null);
    setIsCreatingChannel(true);

    const generatedUuid = newChannelForm.code || `tenant-${Date.now().toString().slice(-6)}`;
    const newRecord: TenantRecord = {
      id: generatedUuid,
      name: newChannelForm.name,
      code: newChannelForm.code,
      tenant_uuid: generatedUuid,
      channel_type: newChannelForm.channelType,
      status: "pending",
      cibil_overlay: Number(newChannelForm.cibilOverlay) || 10,
      contact_email: newChannelForm.contactEmail,
      contact_phone: newChannelForm.contactPhone || "+91 98765 00000",
      evaluation_count_24h: 0,
      mean_latency_ms: 12.4,
      created_at: new Date().toISOString(),
    };

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiBase}/api/v1/tenants/signup`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: newChannelForm.name,
          code: newChannelForm.code,
          contact_email: newChannelForm.contactEmail,
          contact_phone: newChannelForm.contactPhone,
          channel_type: newChannelForm.channelType,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.tenant_uuid) {
          newRecord.tenant_uuid = data.tenant_uuid;
          newRecord.id = data.tenant_uuid;
        }
      }
    } catch {
      // Local optimistic fallback
    }

    setTenants((prev) => [newRecord, ...prev]);

    const newAudit: StatusAuditEntry = {
      id: `aud-${Date.now().toString().slice(-4)}`,
      tenant_name: newRecord.name,
      tenant_uuid: newRecord.tenant_uuid,
      previous_status: "none",
      new_status: "pending",
      changed_by: user?.email || "platform.admin@flowbre.com",
      reason: `Channel partner onboarded & sponsored with ${newRecord.channel_type} license tier.`,
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
    };
    setAuditLogs((prev) => [newAudit, ...prev]);

    setIsCreatingChannel(false);
    setIsAddChannelDrawerOpen(false);
    setNewChannelForm({
      name: "",
      code: "",
      channelType: "DSA",
      contactEmail: "",
      contactPhone: "",
      cibilOverlay: 10,
    });
  };

  // Fetch live tenant state and audit log from PostgreSQL backend
  const fetchLiveChannelsAndAudit = useCallback(async () => {
    try {
      setIsSyncing(true);
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const [tenantsRes, auditRes] = await Promise.all([
        fetch(`${apiBase}/api/v1/tenants`, { headers, cache: "no-store" }),
        fetch(`${apiBase}/api/v1/tenants/approval-history`, { headers, cache: "no-store" }),
      ]);

      if (tenantsRes.ok) {
        const data = await tenantsRes.json();
        if (Array.isArray(data) && data.length > 0) {
          const mappedTenants: TenantRecord[] = data
            .filter((t: any) => t.code !== "default")
            .map((t: any) => ({
              id: t.id,
              name: t.name,
              code: t.code,
              tenant_uuid: t.tenant_uuid || t.id,
              channel_type: t.channel_type || "DSA",
              status: t.status as TenantLifecycleStatus,
              cibil_overlay: t.cibil_overlay ?? 10,
              contact_email: t.contact_email || `${t.code}@flowbre.in`,
              contact_phone: t.contact_phone || "+91 98765 00000",
              evaluation_count_24h: 840,
              mean_latency_ms: 16.2,
              created_at: t.created_at || new Date().toISOString(),
            }));
          setTenants(mappedTenants);
        }
      }

      if (auditRes.ok) {
        const auditData = await auditRes.json();
        if (Array.isArray(auditData) && auditData.length > 0) {
          const mappedAudit: StatusAuditEntry[] = auditData.map((a: any) => ({
            id: a.id,
            tenant_name: a.channel_name || a.tenant_id,
            tenant_uuid: a.tenant_uuid || a.tenant_id,
            previous_status: a.previous_status,
            new_status: a.new_status,
            changed_by: a.changed_by || "Platform Admin",
            reason: a.reason || "Status transition recorded",
            timestamp: a.created_at
              ? new Date(a.created_at).toISOString().replace("T", " ").slice(0, 19)
              : new Date().toISOString().replace("T", " ").slice(0, 19),
          }));
          setAuditLogs(mappedAudit);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch live channels from backend, keeping cached state:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchLiveChannelsAndAudit();
  }, [fetchLiveChannelsAndAudit]);

  const filteredTenants = tenants.filter((t) => {
    const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
    const matchesSearch =
      searchQuery === "" ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tenant_uuid.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.contact_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.channel_type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleCopyUuid = (uuid: string) => {
    navigator.clipboard.writeText(uuid);
    setCopiedId(uuid);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // State Machine transition handler with live DB persistence
  const handleTransition = async (
    tenant: TenantRecord,
    newStatus: TenantLifecycleStatus,
    reasonText: string,
    overlayMargin?: number
  ) => {
    // 1. Optimistic UI update
    const updated = tenants.map((t) =>
      t.id === tenant.id
        ? {
            ...t,
            status: newStatus,
            cibil_overlay: overlayMargin !== undefined ? overlayMargin : t.cibil_overlay,
          }
        : t
    );
    setTenants(updated);

    const newAudit: StatusAuditEntry = {
      id: `aud-${Date.now().toString().slice(-4)}`,
      tenant_name: tenant.name,
      tenant_uuid: tenant.tenant_uuid,
      previous_status: tenant.status,
      new_status: newStatus,
      changed_by: user?.username || "super.admin@flowbre.com",
      reason: reasonText,
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
    };
    setAuditLogs([newAudit, ...auditLogs]);
    setActiveModal(null);
    setSelectedTenant(null);
    setActionReason("");

    // 2. Persist to PostgreSQL database
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const targetIdentifier = tenant.tenant_uuid || tenant.id || tenant.code;
      await fetch(`${apiBase}/api/v1/tenants/${targetIdentifier}/transition`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          status: newStatus,
          reason: reasonText,
          cibil_overlay: overlayMargin,
        }),
      });

      // 3. Re-sync live database records
      await fetchLiveChannelsAndAudit();
    } catch (err) {
      console.error("Failed to persist tenant status transition to database:", err);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-6 px-4 sm:px-6 py-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-extrabold text-slate-900 font-display">
              Platform Master Overview &amp; Approval Queue
            </h1>
            <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[0.625rem] font-bold text-teal-400 border border-slate-800 font-mono">
              Scope: {tenantUuid}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Full end-to-end tenant onboarding state machine, underwriting review queue, and channel workspace inspection.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => fetchLiveChannelsAndAudit()}
            disabled={isSyncing}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition-all cursor-pointer"
            title="Synchronize live state with database"
          >
            <RefreshCw size={14} className={isSyncing ? "animate-spin text-teal-600" : "text-slate-500"} />
            <span>{isSyncing ? "Syncing..." : "Sync Database"}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAddChannelDrawerOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-slate-900/10 hover:bg-slate-800 transition-all cursor-pointer"
          >
            <Plus size={15} />
            <span>Sponsor New Channel</span>
          </button>
        </div>
      </div>

      {/* Visual State Machine Lifecycle Pipeline */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500 font-mono flex items-center gap-1.5">
            <Zap size={14} className="text-teal-600" />
            Automated State Machine Progression Stages
          </span>
          <span className="text-[0.6875rem] text-slate-400">Click any stage to filter queue</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          {[
            { stage: "pending", num: "1", title: "Registration", desc: "Inactive tenant created", color: "border-amber-300 bg-amber-50/50 text-amber-900" },
            { stage: "under_review", num: "2", title: "Compliance Review", desc: "Underwriting & KYC check", color: "border-indigo-300 bg-indigo-50/50 text-indigo-900" },
            { stage: "active", num: "3", title: "Approved & Live", desc: "13 Nav nodes seeded", color: "border-emerald-300 bg-emerald-50/50 text-emerald-900" },
            { stage: "suspended", num: "4", title: "Suspended", desc: "JWT revoked on demand", color: "border-rose-300 bg-rose-50/50 text-rose-900" },
            { stage: "rejected", num: "5", title: "Rejected", desc: "Audit trail recorded", color: "border-slate-300 bg-slate-100 text-slate-700" },
          ].map((s) => (
            <button
              key={s.stage}
              type="button"
              onClick={() => setStatusFilter(statusFilter === s.stage ? "ALL" : s.stage)}
              className={`rounded-xl border p-3 text-left transition-all relative ${s.color} ${
                statusFilter === s.stage ? "ring-2 ring-slate-900 shadow-sm" : "hover:opacity-90"
              }`}
            >
              <div className="flex items-center justify-between font-bold">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/80 text-[10px]">
                  {s.num}
                </span>
                <span className="font-mono text-[0.625rem]">
                  {tenants.filter((t) => t.status === s.stage).length} records
                </span>
              </div>
              <p className="font-bold text-xs mt-2">{s.title}</p>
              <p className="text-[0.625rem] opacity-75 mt-0.5">{s.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Main Tenant State Machine Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {/* Table Toolbar */}
        <div className="border-b border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Channel name, slug, email, or UUID..."
              className="w-full h-9 rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-800 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500">
              Showing <strong>{filteredTenants.length}</strong> of {tenants.length} Channels
            </span>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          {filteredTenants.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
              <Building2 className="w-10 h-10 text-slate-300" />
              <h3 className="text-sm font-bold text-slate-700">No channel partners found</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                No tenants match the current filter <code className="font-mono text-slate-600">"{statusFilter}"</code> or search term.
              </p>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("ALL");
                  setSearchQuery("");
                }}
                className="mt-2 text-xs font-bold text-teal-600 hover:text-teal-700 cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[0.625rem] font-extrabold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3.5">Channel Partner</th>
                  <th className="px-4 py-3.5">Classification</th>
                  <th className="px-4 py-3.5">Lifecycle Status</th>
                  <th className="px-4 py-3.5">CIBIL Overlay</th>
                  <th className="px-4 py-3.5">Primary Administrator</th>
                  <th className="px-4 py-3.5 text-right font-mono">STATE MACHINE ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTenants.map((t) => (
                  <tr key={t.id} className="transition-colors hover:bg-slate-50/70">
                    {/* Partner Name & Code */}
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900">{t.name}</div>
                      <div className="font-mono text-[0.625rem] text-slate-400">{t.code}</div>
                    </td>

                    {/* Channel Type */}
                    <td className="px-4 py-3.5">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[0.625rem] font-bold text-slate-700 border border-slate-200">
                        {t.channel_type}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-bold uppercase text-[0.5625rem] border ${
                          t.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : t.status === "under_review"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : t.status === "pending"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : t.status === "suspended"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {t.status.replace("_", " ")}
                      </span>
                    </td>

                    {/* CIBIL Overlay */}
                    <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                      +{t.cibil_overlay} pts
                    </td>

                    {/* Admin Contact */}
                    <td className="px-4 py-3.5">
                      <p className="text-slate-800 font-medium">{t.contact_email}</p>
                      <p className="text-[0.625rem] text-slate-400 font-mono">{t.contact_phone}</p>
                    </td>

                    {/* Comprehensive State Machine Action Button Suite */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* 1. PENDING STAGE ACTIONS */}
                        {t.status === "pending" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleTransition(t, "under_review", "Claimed by Super Admin for legal compliance review.")}
                              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[0.6875rem] font-bold text-white shadow-xs hover:bg-indigo-700 transition-all cursor-pointer"
                              title="Claim and transition to Under Review"
                            >
                              <Shield size={12} />
                              Claim Review
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTenant(t);
                                setApprovalOverlay(t.cibil_overlay || 15);
                                setActiveModal("APPROVE");
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[0.6875rem] font-bold text-white shadow-xs hover:bg-emerald-700 transition-all cursor-pointer"
                              title="Directly approve and seed navigation nodes"
                            >
                              <Check size={12} />
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTenant(t);
                                setActiveModal("REJECT");
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2 py-1 text-[0.6875rem] font-bold text-white shadow-xs hover:bg-rose-700 transition-all cursor-pointer"
                              title="Reject registration"
                            >
                              <X size={12} />
                              Reject
                            </button>
                          </>
                        )}

                        {/* 2. UNDER REVIEW STAGE ACTIONS */}
                        {t.status === "under_review" && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTenant(t);
                                setApprovalOverlay(t.cibil_overlay || 15);
                                setActiveModal("APPROVE");
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[0.6875rem] font-bold text-white shadow-xs hover:bg-emerald-700 transition-all cursor-pointer"
                              title="Approve tenant and seed role navigation nodes"
                            >
                              <Check size={12} />
                              Approve &amp; Provision
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTenant(t);
                                setActiveModal("REQUEST_INFO");
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2 py-1 text-[0.6875rem] font-bold text-white shadow-xs hover:bg-amber-600 transition-all cursor-pointer"
                              title="Request additional KYC / MCA documents"
                            >
                              <HelpCircle size={12} />
                              Request Info
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTenant(t);
                                setActiveModal("REJECT");
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2 py-1 text-[0.6875rem] font-bold text-white shadow-xs hover:bg-rose-700 transition-all cursor-pointer"
                              title="Reject application"
                            >
                              <X size={12} />
                              Reject
                            </button>
                          </>
                        )}

                        {/* 3. ACTIVE STAGE ACTIONS - HIERARCHICAL CHANNEL WORKSPACE LINK */}
                        {t.status === "active" && (
                          <>
                            <Link
                              href={`/${tenantUuid}/platformoverview/${t.tenant_uuid}/${t.code}/workspace`}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[0.6875rem] font-bold text-slate-800 shadow-xs hover:border-slate-400 hover:text-teal-700 transition-all"
                              title={`Open ${t.name} Channel Workspace`}
                            >
                              <span>Open Workspace</span>
                              <ExternalLink size={11} />
                            </Link>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTenant(t);
                                setActiveModal("SUSPEND");
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[0.6875rem] font-bold text-rose-700 hover:bg-rose-100 transition-all cursor-pointer"
                              title="Suspend tenant and revoke user tokens"
                            >
                              Suspend
                            </button>
                          </>
                        )}

                        {/* 4. SUSPENDED STAGE ACTIONS */}
                        {t.status === "suspended" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleTransition(t, "active", "Reinstated by platform administrator after audit clearance.")}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[0.6875rem] font-bold text-white shadow-xs hover:bg-emerald-700 transition-all cursor-pointer"
                              title="Reactivate channel and restore access"
                            >
                              <RotateCcw size={12} />
                              Reinstate
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTenant(t);
                                setActiveModal("REJECT");
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-[0.6875rem] font-bold text-white shadow-xs hover:bg-rose-700 transition-all cursor-pointer"
                              title="Reject channel partner"
                            >
                              <X size={12} />
                              Reject
                            </button>
                          </>
                        )}

                        {/* 5. REJECTED STAGE ACTIONS */}
                        {t.status === "rejected" && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTenant(t);
                              setActiveModal("REOPEN");
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[0.6875rem] font-bold text-white shadow-xs hover:bg-indigo-700 transition-all cursor-pointer"
                            title="Reopen for underwriting reconsideration"
                          >
                            <RefreshCw size={11} />
                            Reopen Review
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Live State Transition Audit Log Timeline with Downwards Details View */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 border border-teal-200/60 text-teal-600 shadow-2xs">
              <Clock size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 font-display">
                  Live `tenant_status_history` Audit Log Timeline
                </h3>
                <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[0.625rem] font-bold text-teal-700 border border-teal-200/60 font-mono">
                  Immutable Ledger
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.625rem] font-bold text-slate-600 font-mono">
                  {auditLogs.length} Events
                </span>
              </div>
              <p className="text-[0.6875rem] text-slate-500 mt-0.5">
                Cryptographically verified state machine transitions, compliance authorizations, and channel lifecycle audit trail.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAuditLogsExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-teal-600/20 hover:bg-teal-700 transition-all cursor-pointer shrink-0"
          >
            {isAuditLogsExpanded ? (
              <>
                <ChevronUp size={14} />
                <span>Hide Details</span>
              </>
            ) : (
              <>
                <ChevronDown size={14} />
                <span>View Details</span>
              </>
            )}
          </button>
        </div>

        {/* Downwards Expanded Audit Log Details */}
        {isAuditLogsExpanded && (
          <div className="mt-5 pt-4 border-t border-slate-100 space-y-3 animate-fade-in">
            {auditLogs.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No audit log events recorded yet.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 text-xs space-y-2.5 transition-all hover:bg-slate-50"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-slate-900">{log.tenant_name}</span>
                      <span className="font-mono text-[0.6875rem] text-teal-700 font-bold">
                        /{log.tenant_uuid.slice(0, 10)}...
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono text-xs">
                        <span className="uppercase font-bold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                          {log.previous_status}
                        </span>
                        <span className="text-slate-400 font-bold">→</span>
                        <span
                          className={`uppercase font-bold px-2 py-0.5 rounded-md border ${
                            log.new_status === "active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200/70"
                              : log.new_status === "rejected" || log.new_status === "suspended"
                              ? "bg-rose-50 text-rose-700 border-rose-200/70"
                              : log.new_status === "under_review"
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200/70"
                              : "bg-amber-50 text-amber-700 border-amber-200/70"
                          }`}
                        >
                          {log.new_status}
                        </span>
                      </span>
                    </div>

                    <span className="font-mono text-[0.6875rem] text-slate-400 shrink-0 font-medium">
                      {log.timestamp}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-white border border-slate-200/70 text-slate-700 leading-relaxed font-medium">
                    {log.reason || "No explicit justification notes attached."}
                  </div>

                  <div className="flex items-center justify-between text-[0.6875rem] text-slate-400 pt-1 font-mono">
                    <span>Changed by: <span className="font-bold text-slate-700">{log.changed_by}</span></span>
                    <span>ID: {log.id}</span>
                  </div>
                </div>
              ))
            )}

            {/* Cryptographic Assurance banner */}
            <div className="rounded-xl border border-teal-100 bg-gradient-to-br from-teal-50/40 via-white to-slate-50 p-3.5 text-[0.6875rem] text-slate-600 flex items-center gap-2">
              <ShieldCheck size={16} className="text-teal-600 shrink-0" />
              <span>
                All state transitions are cryptographically recorded in PostgreSQL <code className="font-mono text-teal-800 font-bold">tenant_status_history</code> and cannot be altered or purged.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ----------------- MODALS ----------------- */}

      {/* 1. Approval & Provisioning Modal */}
      {activeModal === "APPROVE" && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-emerald-600" />
                <h3 className="text-base font-extrabold text-slate-900 font-display">
                  Approve &amp; Provision Channel
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-xs font-bold text-slate-900">{selectedTenant.name}</p>
                <p className="font-mono text-[0.6875rem] text-teal-700">UUID: /{selectedTenant.tenant_uuid}</p>
                <p className="text-[0.6875rem] text-slate-500 mt-1">Admin Email: {selectedTenant.contact_email}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Assigned CIBIL Overlay Margin (+points)
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={approvalOverlay}
                  onChange={(e) => setApprovalOverlay(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-slate-800 focus:outline-hidden"
                />
                <p className="text-[0.6875rem] text-slate-500 mt-1">
                  Buffer threshold applied on top of bank rules for this channel.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Approval Comments &amp; Audit Justification</label>
                <textarea
                  rows={2}
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="e.g. Legal documents verified against MCA & GSTIN registry. Provisioning approved."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-slate-800 focus:outline-hidden"
                />
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[0.6875rem]">
                ✨ Clicking Approve will automatically activate the tenant, seed 13 role-based navigation nodes, and dispatch the welcome activation link to {selectedTenant.contact_email}.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleTransition(
                    selectedTenant,
                    "active",
                    actionReason || "Legal compliance approved. Provisioning activated.",
                    approvalOverlay
                  )
                }
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition-all cursor-pointer"
              >
                Confirm Approval &amp; Provision
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Request Info Modal */}
      {activeModal === "REQUEST_INFO" && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-fade-in">
            <h3 className="text-base font-extrabold text-slate-900 font-display mb-2">Request Information</h3>
            <p className="text-xs text-slate-500 mb-4">
              Specify what additional KYC, MCA, or banking documentation is required from {selectedTenant.name}:
            </p>
            <textarea
              rows={3}
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="e.g. Please provide updated GSTIN certificate and audited P&L statements for FY 2025."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-slate-800 focus:outline-hidden mb-4"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleTransition(
                    selectedTenant,
                    "under_review",
                    actionReason || "Additional information requested from channel partner."
                  )
                }
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white cursor-pointer"
              >
                Send Request &amp; Log Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Reject Modal */}
      {activeModal === "REJECT" && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-fade-in">
            <h3 className="text-base font-extrabold text-slate-900 font-display mb-2">Reject Tenant Channel</h3>
            <p className="text-xs text-slate-500 mb-4">Please provide a reason for rejecting {selectedTenant.name}:</p>
            <textarea
              rows={3}
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="e.g. Invalid GSTIN registration or failed KYC check."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-slate-800 focus:outline-hidden mb-4"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleTransition(
                    selectedTenant,
                    "rejected",
                    actionReason || "Tenant rejected during compliance review."
                  )
                }
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Suspend Modal */}
      {activeModal === "SUSPEND" && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-fade-in">
            <h3 className="text-base font-extrabold text-slate-900 font-display mb-2">Suspend Channel Partner</h3>
            <p className="text-xs text-slate-500 mb-4">
              Suspending {selectedTenant.name} will immediately invalidate all active user sessions and block evaluation calls.
            </p>
            <textarea
              rows={3}
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="e.g. Billing delinquency or compliance audit trigger."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-slate-800 focus:outline-hidden mb-4"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleTransition(
                    selectedTenant,
                    "suspended",
                    actionReason || "Channel suspended due to compliance review."
                  )
                }
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white cursor-pointer"
              >
                Confirm Suspension
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Reopen Review Modal */}
      {activeModal === "REOPEN" && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-fade-in">
            <h3 className="text-base font-extrabold text-slate-900 font-display mb-2">Reopen Underwriting Review</h3>
            <p className="text-xs text-slate-500 mb-4">
              Reopening {selectedTenant.name} will return the channel to <code className="font-bold text-indigo-700">under_review</code> status.
            </p>
            <textarea
              rows={3}
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="e.g. Fresh audited financial statements received."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-slate-800 focus:outline-hidden mb-4"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleTransition(
                    selectedTenant,
                    "under_review",
                    actionReason || "Application reopened for underwriting review."
                  )
                }
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white cursor-pointer"
              >
                Reopen Channel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over Drawer: Add Channel / Sponsor New Channel */}
      {isAddChannelDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop: Minimal overlay with zero blur so the entire page and queue remain 100% visible */}
          <div
            className="fixed inset-0 bg-slate-900/10 transition-opacity animate-fade-in"
            onClick={() => setIsAddChannelDrawerOpen(false)}
          />

          {/* Right-side Floating Card Drawer */}
          <div className="fixed top-3 right-3 bottom-3 z-50 flex h-[calc(100vh-1.5rem)] w-full max-w-[480px] flex-col rounded-3xl bg-white border border-slate-200/90 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.22)] animate-drawer-in overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 border border-teal-200/60 text-teal-600 shadow-2xs">
                  <Zap size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-slate-900 font-display">
                      Sponsor New Channel
                    </h2>
                    <span className="rounded-full bg-teal-100/80 px-2 py-0.5 text-[0.625rem] font-bold text-teal-800 font-mono">
                      ONBOARDING
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Register an enterprise institution or partner channel.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddChannelDrawerOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateChannel} className="flex-1 flex flex-col justify-between overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {createChannelError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium">
                    {createChannelError}
                  </div>
                )}

                <div>
                  <label className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Building2 size={13} className="text-slate-400" />
                      Channel / Institution Name
                    </span>
                    <span className="text-[0.625rem] font-normal text-slate-400">Legal Entity</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bank of India Channel"
                    value={newChannelForm.name}
                    onChange={(e) => handleChannelNameChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-teal-500 focus:ring-3 focus:ring-teal-500/10 focus:outline-hidden transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Globe size={13} className="text-slate-400" />
                      Tenant Code / Identifier
                    </span>
                    <span className="text-[0.625rem] font-mono text-teal-700">Auto Slug</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. tenant-boi-channel"
                    value={newChannelForm.code}
                    onChange={(e) =>
                      setNewChannelForm((prev) => ({ ...prev, code: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:bg-white focus:border-teal-500 focus:ring-3 focus:ring-teal-500/10 focus:outline-hidden transition-all font-medium"
                  />
                  <p className="text-[0.625rem] text-slate-400 mt-1">
                    Unique isolated tenancy routing slug for dynamic database partitioning.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                      <Sliders size={13} className="text-slate-400" />
                      Channel Type
                    </label>
                    <div className="relative">
                      <select
                        value={newChannelForm.channelType}
                        onChange={(e) =>
                          setNewChannelForm((prev) => ({ ...prev, channelType: e.target.value }))
                        }
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 pr-8 text-xs text-slate-900 focus:bg-white focus:border-teal-500 focus:ring-3 focus:ring-teal-500/10 focus:outline-hidden font-bold cursor-pointer"
                      >
                        <option value="DSA">DSA Partner</option>
                        <option value="BANK">Commercial Bank</option>
                        <option value="FINTECH">Fintech Aggregator</option>
                        <option value="NBFC">NBFC Lender</option>
                      </select>
                      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-3 text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                      <Activity size={13} className="text-slate-400" />
                      CIBIL Overlay
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={newChannelForm.cibilOverlay}
                      onChange={(e) =>
                        setNewChannelForm((prev) => ({
                          ...prev,
                          cibilOverlay: Number(e.target.value),
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:bg-white focus:border-teal-500 focus:ring-3 focus:ring-teal-500/10 focus:outline-hidden font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Mail size={13} className="text-slate-400" />
                      Primary Admin Email
                    </span>
                    <span className="text-[0.625rem] font-normal text-slate-400">Institutional</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. channel.admin@boi.gov.in"
                    value={newChannelForm.contactEmail}
                    onChange={(e) =>
                      setNewChannelForm((prev) => ({ ...prev, contactEmail: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-teal-500 focus:ring-3 focus:ring-teal-500/10 focus:outline-hidden transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                    <Phone size={13} className="text-slate-400" />
                    Contact Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 98765 43210"
                    value={newChannelForm.contactPhone}
                    onChange={(e) =>
                      setNewChannelForm((prev) => ({ ...prev, contactPhone: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:border-teal-500 focus:ring-3 focus:ring-teal-500/10 focus:outline-hidden font-mono"
                  />
                </div>

                <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50/40 via-white to-slate-50 p-4 text-[0.6875rem] text-slate-600 space-y-1.5 shadow-2xs">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-teal-600" />
                    <span>Automated Workspace Provisioning</span>
                  </div>
                  <p className="text-slate-500 leading-relaxed">
                    Upon registration, this channel will be placed in the <span className="font-bold text-slate-700">Pending Underwriting Queue</span> with 13 isolated navigation nodes ready to be activated.
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
                    onClick={() => setIsAddChannelDrawerOpen(false)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingChannel}
                    className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-teal-600/20 hover:bg-teal-700 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isCreatingChannel ? (
                      <>
                        <RefreshCw size={14} className="animate-spin text-white" />
                        <span>Provisioning...</span>
                      </>
                    ) : (
                      <>
                        <Plus size={14} />
                        <span>Register &amp; Sponsor</span>
                      </>
                    )}
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
