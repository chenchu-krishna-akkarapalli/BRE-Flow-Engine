"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  History,
  Mail,
  Phone,
  Search,
  Shield,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";

interface ApprovalItem {
  id: string;
  applicantName: string;
  loanType: string;
  requestedAmount: number;
  exceptionCategory: string;
  comments: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

interface PendingChannelItem {
  id: string;
  name: string;
  code: string;
  tenant_uuid: string;
  channel_type: string;
  contact_email: string;
  contact_phone: string;
  cibil_overlay?: number;
  status: string;
}

interface ApprovedChannelItem {
  id: string;
  name: string;
  code: string;
  tenant_uuid?: string;
  channel_type?: string;
  contact_email?: string;
  contact_phone?: string;
  status: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface TenantApprovalHistoryItem {
  id: string;
  tenant_id: string;
  channel_name: string;
  channel_code: string;
  tenant_uuid?: string;
  channel_type?: string;
  contact_email?: string;
  contact_phone?: string;
  previous_status: string;
  new_status: string;
  changed_by?: string;
  reason?: string;
  created_at?: string;
}

const INITIAL_APPROVALS: ApprovalItem[] = [
  {
    id: "AP-101",
    applicantName: "Ananya Deshmukh",
    loanType: "Auto Loan",
    requestedAmount: 1250000,
    exceptionCategory: "FOIR_OVERRIDE",
    comments: "FOIR is 68% against 65% ceiling. Approved with co-applicant guarantee.",
    status: "PENDING",
  },
  {
    id: "AP-102",
    applicantName: "Apex Logistics LLP",
    loanType: "Commercial Vehicle",
    requestedAmount: 4500000,
    exceptionCategory: "CIBIL_OVERLAY",
    comments: "Bureau score 695 with 1 DPD entry 14 months ago.",
    status: "PENDING",
  },
  {
    id: "AP-103",
    applicantName: "Vikram Malhotra",
    loanType: "Personal Loan",
    requestedAmount: 750000,
    exceptionCategory: "SIBLING_COAPPLICANT",
    comments: "Sibling co-applicant income inclusion requested.",
    status: "PENDING",
  },
];

export default function TenantApprovalsPage({
  params,
}: {
  params: Promise<{ tenantUuid: string }>;
}) {
  const { tenantUuid } = use(params);
  const { role, token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"exceptions" | "channels">("exceptions");
  const [channelSubTab, setChannelSubTab] = useState<"pending" | "approved" | "history">("pending");

  const [approvals, setApprovals] = useState<ApprovalItem[]>(INITIAL_APPROVALS);
  const [pendingChannels, setPendingChannels] = useState<PendingChannelItem[]>([]);
  const [approvedChannels, setApprovedChannels] = useState<ApprovedChannelItem[]>([]);
  const [approvalHistory, setApprovalHistory] = useState<TenantApprovalHistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const canManageChannels = role === "SUPER_ADMIN" || role === "REGIONAL_DIRECTOR";

  // Reusable live channel data fetcher
  const fetchChannelData = useCallback(async () => {
    if (!canManageChannels) return;
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // Fetch pending channels
      const pendingRes = await fetch(`${apiBase}/api/v1/tenants/pending-approvals`, {
        headers,
        cache: "no-store",
      });
      if (pendingRes.ok) {
        const data = await pendingRes.json();
        if (Array.isArray(data)) {
          setPendingChannels(data);
        }
      }

      // Fetch approved channels
      const approvedRes = await fetch(`${apiBase}/api/v1/tenants/approved`, {
        headers,
        cache: "no-store",
      });
      if (approvedRes.ok) {
        const data = await approvedRes.json();
        if (Array.isArray(data)) {
          setApprovedChannels(data);
        }
      }

      // Fetch approval history
      const historyRes = await fetch(`${apiBase}/api/v1/tenants/approval-history`, {
        headers,
        cache: "no-store",
      });
      if (historyRes.ok) {
        const data = await historyRes.json();
        if (Array.isArray(data)) {
          setApprovalHistory(data);
        }
      }
    } catch {
      // Fallback
    }
  }, [canManageChannels, token]);

  // 1. Initial fetch & continuous background auto-polling every 3.5 seconds
  useEffect(() => {
    if (!canManageChannels) return;
    fetchChannelData();
    const timer = setInterval(fetchChannelData, 3500);
    return () => clearInterval(timer);
  }, [canManageChannels, fetchChannelData]);

  // 2. Refetch on tab focus or document visibility change
  useEffect(() => {
    if (!canManageChannels) return;
    const onFocus = () => fetchChannelData();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchChannelData();
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [canManageChannels, fetchChannelData]);

  // 3. Instant zero-latency cross-tab synchronization via BroadcastChannel and Storage events
  useEffect(() => {
    if (!canManageChannels) return;
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("flowbre_approval_sync");
      bc.onmessage = (event) => {
        if (event.data?.type === "CHANNEL_STATUS_CHANGED") {
          fetchChannelData();
        }
      };
    } catch {}

    const onStorage = (e: StorageEvent) => {
      if (e.key === "flowbre_approval_sync") {
        fetchChannelData();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      if (bc) bc.close();
      window.removeEventListener("storage", onStorage);
    };
  }, [canManageChannels, fetchChannelData]);

  const handleDecision = (id: string, decision: "APPROVED" | "REJECTED") => {
    setApprovals(approvals.map((a) => (a.id === id ? { ...a, status: decision } : a)));
  };

  const handleChannelAction = async (channel: PendingChannelItem, action: "approve" | "reject") => {
    // Optimistic removal in current user's pending list
    setPendingChannels((prev) => prev.filter((c) => c.id !== channel.id && c.tenant_uuid !== channel.tenant_uuid));

    // Broadcast immediately across tabs
    try {
      const bc = new BroadcastChannel("flowbre_approval_sync");
      bc.postMessage({ type: "CHANNEL_STATUS_CHANGED", channelId: channel.id, action });
      bc.close();
    } catch {}
    try {
      localStorage.setItem("flowbre_approval_sync", JSON.stringify({ action, id: channel.id, timestamp: Date.now() }));
    } catch {}

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      await fetch(`${apiBase}/api/v1/tenants/${channel.tenant_uuid || channel.id}/${action}`, {
        method: "POST",
        headers,
      });

      // Refetch all channel data to update approved list & audit history
      await fetchChannelData();
    } catch {
      // Optimistic update retained
    }

    if (action === "approve") {
      setFeedbackMsg(
        `Channel "${channel.name}" approved! Credentials dispatched to ${channel.contact_email} and tenant workspace provisioned.`
      );
    } else {
      setFeedbackMsg(`Channel "${channel.name}" registration has been rejected.`);
    }

    setTimeout(() => setFeedbackMsg(null), 6000);
  };

  // Filtered views based on search query
  const filteredApproved = approvedChannels.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.code?.toLowerCase().includes(q) ||
      c.tenant_uuid?.toLowerCase().includes(q) ||
      c.contact_email?.toLowerCase().includes(q) ||
      c.channel_type?.toLowerCase().includes(q)
    );
  });

  const filteredHistory = approvalHistory.filter((h) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      h.channel_name?.toLowerCase().includes(q) ||
      h.channel_code?.toLowerCase().includes(q) ||
      h.changed_by?.toLowerCase().includes(q) ||
      h.reason?.toLowerCase().includes(q) ||
      h.new_status?.toLowerCase().includes(q)
    );
  });

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-6 px-4 sm:px-6 py-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-ink font-display">
              Approvals & Governance Queue
            </h1>
            <span className="rounded-md bg-brand-500/10 px-2 py-0.5 text-xs font-mono font-bold text-brand-600 border border-brand-500/20">
              {tenantUuid}
            </span>
          </div>
          <p className="text-xs text-ink-subtle mt-0.5">
            Credit committee review, underwriting exceptions, and partner channel onboarding governance.
          </p>
        </div>

        {/* Primary Tab Navigation */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab("exceptions")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "exceptions"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Underwriting Exceptions ({approvals.filter((a) => a.status === "PENDING").length})
          </button>

          {canManageChannels && (
            <button
              type="button"
              onClick={() => {
                setActiveTab("channels");
                fetchChannelData();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "channels"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Channel Onboarding</span>
              {pendingChannels.length > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full text-[0.625rem] bg-amber-500 text-white font-mono font-bold animate-pulse">
                  {pendingChannels.length}
                </span>
              ) : (
                <span className="px-1.5 py-0.2 rounded-full text-[0.625rem] bg-emerald-600 text-white font-mono">
                  {approvedChannels.length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Action Feedback Banner */}
      {feedbackMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button type="button" onClick={() => setFeedbackMsg(null)} className="text-emerald-600 hover:text-emerald-900">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Tab 1: Underwriting Exceptions */}
      {activeTab === "exceptions" ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-slate-50 text-[0.6875rem] font-extrabold uppercase tracking-wider text-ink-subtle">
              <tr>
                <th className="px-5 py-3">Queue ID</th>
                <th className="px-5 py-3">Applicant</th>
                <th className="px-5 py-3">Exception Category</th>
                <th className="px-5 py-3">Underwriter Notes</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {approvals.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-mono font-bold text-brand-600">{item.id}</td>
                  <td className="px-5 py-3.5">
                    <p className="font-bold text-ink">{item.applicantName}</p>
                    <p className="text-[0.6875rem] text-ink-subtle">₹{item.requestedAmount.toLocaleString("en-IN")}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex rounded-md bg-amber-500/10 px-2 py-0.5 text-[0.6875rem] font-bold text-amber-600 border border-amber-500/20">
                      {item.exceptionCategory}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-ink-muted max-w-xs truncate">{item.comments}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[0.625rem] font-bold uppercase ${
                        item.status === "APPROVED"
                          ? "bg-success/10 text-success border border-success/20"
                          : item.status === "REJECTED"
                          ? "bg-danger/10 text-danger border border-danger/20"
                          : "bg-warning/10 text-warning border border-warning/20"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {item.status === "PENDING" ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleDecision(item.id, "APPROVED")}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-[0.6875rem] font-bold text-white shadow-xs hover:bg-emerald-600"
                        >
                          <Check size={12} />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDecision(item.id, "REJECTED")}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-500 px-2.5 py-1 text-[0.6875rem] font-bold text-white shadow-xs hover:bg-rose-600"
                        >
                          <X size={12} />
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-[0.6875rem] text-ink-subtle">Signed off</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Tab 2: Channel Onboarding Management & Audit Views */
        <div className="space-y-4">
          {/* Policy Banner */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-teal-600 shrink-0" />
              <span>
                <strong>Channel Governance & Dual-Gate Approval:</strong> As <strong>{role}</strong>, you have complete visibility over channel onboarding approvals, active partners, and cryptographic audit logs.
              </span>
            </div>
            <span className="text-[0.6875rem] font-mono font-bold text-slate-500 shrink-0">
              Authority: {role === "SUPER_ADMIN" ? "Company Super Administrator" : "Regional Director"}
            </span>
          </div>

          {/* Sub-Tabs and Search Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-1.5">
              {/* Subtab 1: Pending Approvals */}
              <button
                type="button"
                onClick={() => setChannelSubTab("pending")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  channelSubTab === "pending"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Clock size={14} className={channelSubTab === "pending" ? "text-amber-400" : "text-slate-400"} />
                <span>Pending Review</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[0.625rem] font-mono font-bold ${
                    channelSubTab === "pending" ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {pendingChannels.length}
                </span>
              </button>

              {/* Subtab 2: Approved Channels */}
              <button
                type="button"
                onClick={() => setChannelSubTab("approved")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  channelSubTab === "approved"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <UserCheck size={14} className={channelSubTab === "approved" ? "text-emerald-400" : "text-slate-400"} />
                <span>Approved Channels</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[0.625rem] font-mono font-bold ${
                    channelSubTab === "approved" ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {approvedChannels.length}
                </span>
              </button>

              {/* Subtab 3: Approval Audit History */}
              <button
                type="button"
                onClick={() => setChannelSubTab("history")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  channelSubTab === "history"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <History size={14} className={channelSubTab === "history" ? "text-sky-400" : "text-slate-400"} />
                <span>Approval Audit Log</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[0.625rem] font-mono font-bold ${
                    channelSubTab === "history" ? "bg-sky-600 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {approvalHistory.length}
                </span>
              </button>
            </div>

            {/* Filter / Search Bar */}
            {channelSubTab !== "pending" && (
              <div className="relative flex items-center min-w-[220px]">
                <Search size={14} className="absolute left-3 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    channelSubTab === "approved"
                      ? "Search approved channels..."
                      : "Search audit logs..."
                  }
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-brand-500 focus:bg-white transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Subtab Content 1: Pending Approvals */}
          {channelSubTab === "pending" && (
            <div>
              {pendingChannels.length === 0 ? (
                <div className="rounded-2xl border border-line bg-white p-12 text-center text-xs text-slate-500 shadow-xs">
                  <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
                  <p className="font-bold text-slate-800 text-sm">All channel onboarding requests have been reviewed!</p>
                  <p className="text-[0.6875rem] text-slate-400 mt-1">
                    Check the <strong>Approved Channels</strong> tab or <strong>Approval Audit Log</strong> to see all onboarded partners.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingChannels.map((channel) => (
                    <div
                      key={channel.id}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-10 w-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                              <Building2 size={20} />
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-900 text-sm font-display">{channel.name}</h3>
                              <span className="font-mono text-[0.6875rem] text-teal-600">/{channel.tenant_uuid}</span>
                            </div>
                          </div>
                          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[0.625rem] font-mono font-bold text-amber-700 border border-amber-200">
                            {channel.channel_type || "DSA"}
                          </span>
                        </div>

                        <div className="space-y-1.5 py-3 border-y border-slate-100 text-xs">
                          <div className="flex items-center gap-2 text-slate-600">
                            <Mail size={13} className="text-slate-400" />
                            <span className="font-mono">{channel.contact_email}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-600">
                            <Phone size={13} className="text-slate-400" />
                            <span>{channel.contact_phone}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 flex items-center justify-end gap-2.5">
                        <button
                          type="button"
                          onClick={() => handleChannelAction(channel, "reject")}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-xs font-bold transition-all"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChannelAction(channel, "approve")}
                          className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                        >
                          <Check size={14} className="text-emerald-400" />
                          <span>Accept & Provision Channel</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Subtab Content 2: Approved Channels */}
          {channelSubTab === "approved" && (
            <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
              {filteredApproved.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500">
                  <Building2 size={36} className="mx-auto text-slate-300 mb-2" />
                  <p className="font-bold text-slate-800 text-sm">
                    {searchQuery ? "No channels match your search query." : "No approved channels found."}
                  </p>
                  <p className="text-[0.6875rem] text-slate-400 mt-1">
                    Once onboarding requests are approved, they will be cataloged here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-line bg-slate-50 text-[0.6875rem] font-extrabold uppercase tracking-wider text-ink-subtle">
                      <tr>
                        <th className="px-5 py-3">Channel Partner</th>
                        <th className="px-5 py-3">Channel Code</th>
                        <th className="px-5 py-3">Classification</th>
                        <th className="px-5 py-3">Admin Contact</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Approved / Updated</th>
                        <th className="px-5 py-3 text-right">Workspace Access</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {filteredApproved.map((channel) => (
                        <tr key={channel.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                                <Building2 size={16} />
                              </div>
                              <div>
                                <p className="font-bold text-ink">{channel.name}</p>
                                <span className="font-mono text-[0.6875rem] text-teal-600">
                                  /{channel.tenant_uuid || channel.id}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 font-mono font-bold text-slate-700">
                            {channel.code}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[0.6875rem] font-mono font-bold text-slate-700 border border-slate-200">
                              {channel.channel_type || "DSA"}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="font-mono text-slate-800">{channel.contact_email || "-"}</p>
                            <p className="text-[0.6875rem] text-slate-400">{channel.contact_phone || "-"}</p>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[0.625rem] font-bold uppercase text-emerald-700 border border-emerald-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                              Active
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-slate-500 font-mono text-[0.6875rem]">
                            {formatTimestamp(channel.updated_at || channel.created_at)}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <Link
                              href={`/${channel.tenant_uuid || channel.code}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[0.6875rem] transition-colors"
                            >
                              <span>Enter</span>
                              <ExternalLink size={12} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Subtab Content 3: Approval Audit History */}
          {channelSubTab === "history" && (
            <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
              {filteredHistory.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500">
                  <History size={36} className="mx-auto text-slate-300 mb-2" />
                  <p className="font-bold text-slate-800 text-sm">
                    {searchQuery ? "No history entries match your search." : "No approval audit events recorded yet."}
                  </p>
                  <p className="text-[0.6875rem] text-slate-400 mt-1">
                    Every state transition, registration, and approval is recorded immutably here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-line bg-slate-50 text-[0.6875rem] font-extrabold uppercase tracking-wider text-ink-subtle">
                      <tr>
                        <th className="px-5 py-3">Channel Name</th>
                        <th className="px-5 py-3">Lifecycle Transition</th>
                        <th className="px-5 py-3">Authorized By</th>
                        <th className="px-5 py-3">Audit Reason / Justification</th>
                        <th className="px-5 py-3">Contact Email</th>
                        <th className="px-5 py-3 text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {filteredHistory.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3.5">
                            <p className="font-bold text-ink">{item.channel_name}</p>
                            <span className="font-mono text-[0.6875rem] text-teal-600">
                              /{item.tenant_uuid || item.channel_code}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="inline-flex items-center gap-1.5">
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[0.625rem] font-mono text-slate-600 border border-slate-200">
                                {item.previous_status}
                              </span>
                              <ArrowRight size={11} className="text-slate-400" />
                              <span
                                className={`rounded-md px-2 py-0.5 text-[0.625rem] font-mono font-bold border ${
                                  item.new_status === "active"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : item.new_status === "rejected"
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                }`}
                              >
                                {item.new_status}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[0.6875rem] font-bold ${
                                item.changed_by === "SUPER_ADMIN"
                                  ? "bg-purple-50 text-purple-700 border border-purple-200"
                                  : item.changed_by === "REGIONAL_DIRECTOR"
                                  ? "bg-sky-50 text-sky-700 border border-sky-200"
                                  : "bg-slate-100 text-slate-700 border border-slate-200"
                              }`}
                            >
                              <Shield size={11} />
                              {item.changed_by || "System"}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-slate-600 max-w-sm">
                            <span className="line-clamp-2">{item.reason || "-"}</span>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-slate-600">
                            {item.contact_email || "-"}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono text-[0.6875rem] text-slate-500 whitespace-nowrap">
                            {formatTimestamp(item.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
