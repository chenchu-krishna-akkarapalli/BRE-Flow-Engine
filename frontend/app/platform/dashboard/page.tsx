"use client";

import { useState } from "react";
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
  Download,
  ExternalLink,
  Filter,
  HelpCircle,
  Info,
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

export type TenantLifecycleStatus = "pending" | "under_review" | "active" | "suspended" | "rejected";

export interface TenantRecord {
  id: string;
  name: string;
  code: string;
  tenant_uuid: string;
  channel_type: string;
  status: TenantLifecycleStatus;
  cibil_overlay: number;
  contact_email: string;
  contact_phone: string;
  evaluation_count_24h: number;
  mean_latency_ms: number;
  created_at: string;
}

export interface StatusAuditEntry {
  id: string;
  tenant_name: string;
  tenant_uuid: string;
  previous_status: string;
  new_status: string;
  changed_by: string;
  reason: string;
  timestamp: string;
}

const INITIAL_TENANTS: TenantRecord[] = [
  {
    id: "t-boi-01",
    name: "Bank of India Channel",
    code: "boi-channel-north",
    tenant_uuid: "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f",
    channel_type: "DSA",
    status: "active",
    cibil_overlay: 10,
    contact_email: "ops@boi-dsa.in",
    contact_phone: "+91 98765 43210",
    evaluation_count_24h: 1482,
    mean_latency_ms: 18.4,
    created_at: "2026-08-10T10:00:00Z",
  },
  {
    id: "t-hdfc-02",
    name: "HDFC Apex Retail Channel",
    code: "hdfc-apex-mumbai",
    tenant_uuid: "b8a7c2d1-94e5-4f6a-8b1c-2d3e4f5a6b7c",
    channel_type: "FINTECH_PARTNER",
    status: "active",
    cibil_overlay: 15,
    contact_email: "partner@hdfc-apex.com",
    contact_phone: "+91 98222 11100",
    evaluation_count_24h: 3290,
    mean_latency_ms: 14.1,
    created_at: "2026-08-12T14:30:00Z",
  },
  {
    id: "t-finsol-03",
    name: "Finsol Western Partner Network",
    code: "finsol-west-pune",
    tenant_uuid: "c9d8e7f6-a5b4-4c3d-2e1f-0a9b8c7d6e5f",
    channel_type: "DSA",
    status: "pending",
    cibil_overlay: 10,
    contact_email: "admin@finsol-west.in",
    contact_phone: "+91 97654 32190",
    evaluation_count_24h: 0,
    mean_latency_ms: 0,
    created_at: "2026-08-18T18:20:00Z",
  },
  {
    id: "t-axis-04",
    name: "Axis Direct Fintech Connect",
    code: "axis-fintech-delhi",
    tenant_uuid: "f1e2d3c4-b5a6-4f7e-8d9c-0b1a2c3d4e5f",
    channel_type: "BANK_BRANCH",
    status: "under_review",
    cibil_overlay: 20,
    contact_email: "connect@axis-fintech.in",
    contact_phone: "+91 99112 33445",
    evaluation_count_24h: 0,
    mean_latency_ms: 0,
    created_at: "2026-08-17T11:15:00Z",
  },
  {
    id: "t-icici-05",
    name: "ICICI Regional Alliance",
    code: "icici-alliance-south",
    tenant_uuid: "a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d",
    channel_type: "DEALER_PARTNER",
    status: "rejected",
    cibil_overlay: 10,
    contact_email: "dealer@icici-alliance.in",
    contact_phone: "+91 98111 22334",
    evaluation_count_24h: 0,
    mean_latency_ms: 0,
    created_at: "2026-08-15T09:00:00Z",
  },
];

const INITIAL_AUDIT_LOGS: StatusAuditEntry[] = [
  {
    id: "aud-01",
    tenant_name: "Axis Direct Fintech Connect",
    tenant_uuid: "f1e2d3c4-b5a6-4f7e-8d9c-0b1a2c3d4e5f",
    previous_status: "pending",
    new_status: "under_review",
    changed_by: "super.admin@flowbre.com",
    reason: "Claimed for legal verification against MCA database.",
    timestamp: "2026-08-18 19:40:12",
  },
  {
    id: "aud-02",
    tenant_name: "HDFC Apex Retail Channel",
    tenant_uuid: "b8a7c2d1-94e5-4f6a-8b1c-2d3e4f5a6b7c",
    previous_status: "under_review",
    new_status: "active",
    changed_by: "ops.head@flowbre.com",
    reason: "Approved with +15 CIBIL overlay margin and provisioned 13 navigation nodes.",
    timestamp: "2026-08-12 15:00:00",
  },
];

export default function PlatformOverviewPage() {
  const [tenants, setTenants] = useState<TenantRecord[]>(INITIAL_TENANTS);
  const [auditLogs, setAuditLogs] = useState<StatusAuditEntry[]>(INITIAL_AUDIT_LOGS);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State
  const [selectedTenant, setSelectedTenant] = useState<TenantRecord | null>(null);
  const [approvalOverlay, setApprovalOverlay] = useState(15);
  const [actionReason, setActionReason] = useState("");
  const [activeModal, setActiveModal] = useState<"APPROVE" | "REJECT" | "SUSPEND" | "REQUEST_INFO" | "REOPEN" | null>(null);

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

  // State Machine transition handler
  const handleTransition = (
    tenant: TenantRecord,
    newStatus: TenantLifecycleStatus,
    reasonText: string,
    overlayMargin?: number
  ) => {
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
      changed_by: "super.admin@flowbre.com",
      reason: reasonText,
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
    };
    setAuditLogs([newAudit, ...auditLogs]);
    setActiveModal(null);
    setSelectedTenant(null);
    setActionReason("");
  };

  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-6 px-4 sm:px-6 py-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-slate-900 font-display">
              Platform Master Overview &amp; Approval Queue
            </h1>
            <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[0.625rem] font-bold text-teal-400 border border-slate-800">
              Platform Owner Scope
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Full end-to-end tenant onboarding state machine, underwriting review queue, and automated navigation node provisioning.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <Link
            href="/new-channel"
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-slate-900/10 hover:bg-slate-800 transition-all"
          >
            <Plus size={15} />
            <span>Sponsor New Channel</span>
          </Link>
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
                className="mt-2 text-xs font-bold text-teal-600 hover:text-teal-700"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[0.625rem] font-extrabold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3.5">Channel Partner</th>
                  <th className="px-4 py-3.5">Dynamic Tenant UUID</th>
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

                    {/* Compact Copyable Dynamic UUID */}
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => handleCopyUuid(t.tenant_uuid)}
                        className="group inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[0.6875rem] text-slate-700 hover:bg-white hover:border-slate-300 transition-all"
                        title="Click to copy tenant UUID"
                      >
                        <span>/{t.tenant_uuid.slice(0, 10)}...</span>
                        {copiedId === t.tenant_uuid ? (
                          <Check size={12} className="text-emerald-600" />
                        ) : (
                          <Copy size={12} className="text-slate-400 group-hover:text-slate-600" />
                        )}
                      </button>
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
                              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[0.6875rem] font-bold text-white shadow-xs hover:bg-indigo-700 transition-all"
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
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[0.6875rem] font-bold text-white shadow-xs hover:bg-emerald-700 transition-all"
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
                              className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2 py-1 text-[0.6875rem] font-bold text-white shadow-xs hover:bg-rose-700 transition-all"
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
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[0.6875rem] font-bold text-white shadow-xs hover:bg-emerald-700 transition-all"
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
                              className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2 py-1 text-[0.6875rem] font-bold text-white shadow-xs hover:bg-amber-600 transition-all"
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
                              className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2 py-1 text-[0.6875rem] font-bold text-white shadow-xs hover:bg-rose-700 transition-all"
                              title="Reject application"
                            >
                              <X size={12} />
                              Reject
                            </button>
                          </>
                        )}

                        {/* 3. ACTIVE STAGE ACTIONS */}
                        {t.status === "active" && (
                          <>
                            <Link
                              href={`/${t.tenant_uuid}/dashboard`}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[0.6875rem] font-bold text-slate-800 shadow-xs hover:border-slate-400 hover:text-teal-700 transition-all"
                              title="Open scoped tenant workspace"
                            >
                              <span>Open Workspace</span>
                              <ExternalLink size={11} />
                            </Link>
                            <Link
                              href={`/${t.tenant_uuid}/configurator`}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[0.6875rem] font-bold text-slate-600 hover:bg-white hover:text-slate-900 transition-all"
                              title="Adjust BRE rules and CIBIL overlays"
                            >
                              <Sliders size={11} />
                              <span>Rules</span>
                            </Link>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTenant(t);
                                setActiveModal("SUSPEND");
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[0.6875rem] font-bold text-rose-700 hover:bg-rose-100 transition-all"
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
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[0.6875rem] font-bold text-white shadow-xs hover:bg-emerald-700 transition-all"
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
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 text-[0.6875rem] font-bold text-slate-600 hover:bg-slate-200 transition-all"
                              title="Decommission channel"
                            >
                              Archive
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
                            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[0.6875rem] font-bold text-white shadow-xs hover:bg-indigo-700 transition-all"
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

      {/* Live State Transition Audit Log Timeline */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-teal-600" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 font-display">
              Live `tenant_status_history` Audit Log Timeline
            </h3>
          </div>
          <span className="text-[0.625rem] font-mono text-slate-400">Immutable Ledger</span>
        </div>

        <div className="space-y-3">
          {auditLogs.map((log) => (
            <div key={log.id} className="flex items-start justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{log.tenant_name}</span>
                  <span className="font-mono text-[0.625rem] text-teal-700 font-bold">/{log.tenant_uuid.slice(0, 8)}...</span>
                  <span className="inline-flex items-center gap-1 font-mono text-[0.6875rem] text-slate-500">
                    <span className="uppercase font-bold text-slate-500">{log.previous_status}</span>
                    <span>→</span>
                    <span className="uppercase font-bold text-emerald-700">{log.new_status}</span>
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">{log.reason}</p>
                <p className="text-[0.625rem] text-slate-400 mt-0.5">Changed by: {log.changed_by}</p>
              </div>
              <span className="font-mono text-[0.625rem] text-slate-400 shrink-0">{log.timestamp}</span>
            </div>
          ))}
        </div>
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
                className="text-slate-400 hover:text-slate-600 transition-colors"
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
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
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
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition-all"
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
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
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
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white"
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
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
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
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white"
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
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleTransition(
                    selectedTenant,
                    "suspended",
                    actionReason || "Tenant suspended by platform admin."
                  )
                }
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white"
              >
                Confirm Suspension
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Reopen Modal */}
      {activeModal === "REOPEN" && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-fade-in">
            <h3 className="text-base font-extrabold text-slate-900 font-display mb-2">Reopen Underwriting Review</h3>
            <p className="text-xs text-slate-500 mb-4">
              Reopen {selectedTenant.name} for compliance review after receiving updated documents:
            </p>
            <textarea
              rows={3}
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="e.g. Channel submitted rectified GSTIN documents. Reopening for review."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-slate-800 focus:outline-hidden mb-4"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleTransition(
                    selectedTenant,
                    "under_review",
                    actionReason || "Review reopened by platform administrator."
                  )
                }
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white"
              >
                Reopen &amp; Move to Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
