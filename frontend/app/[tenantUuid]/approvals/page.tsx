"use client";

import { use, useCallback, useEffect, useState } from "react";
import {
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Layers,
  Phone,
  Mail,
  Shield,
  ShieldAlert,
  Sparkles,
  Users,
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

const INITIAL_APPROVALS: ApprovalItem[] = [
  { id: "AP-101", applicantName: "Ananya Deshmukh", loanType: "Auto Loan", requestedAmount: 1250000, exceptionCategory: "FOIR_OVERRIDE", comments: "FOIR is 68% against 65% ceiling. Approved with co-applicant guarantee.", status: "PENDING" },
  { id: "AP-102", applicantName: "Apex Logistics LLP", loanType: "Commercial Vehicle", requestedAmount: 4500000, exceptionCategory: "CIBIL_OVERLAY", comments: "Bureau score 695 with 1 DPD entry 14 months ago.", status: "PENDING" },
  { id: "AP-103", applicantName: "Vikram Malhotra", loanType: "Personal Loan", requestedAmount: 750000, exceptionCategory: "SIBLING_COAPPLICANT", comments: "Sibling co-applicant income inclusion requested.", status: "PENDING" },
];

export default function TenantApprovalsPage({
  params,
}: {
  params: Promise<{ tenantUuid: string }>;
}) {
  const { tenantUuid } = use(params);
  const { role, token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"exceptions" | "channels">("exceptions");

  const [approvals, setApprovals] = useState<ApprovalItem[]>(INITIAL_APPROVALS);
  const [pendingChannels, setPendingChannels] = useState<PendingChannelItem[]>([]);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const canManageChannels = role === "SUPER_ADMIN" || role === "REGIONAL_DIRECTOR";

  // Reusable live channel fetcher
  const fetchPendingChannels = useCallback(async () => {
    if (!canManageChannels) return;
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${apiBase}/api/v1/tenants/pending-approvals`, {
        headers,
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setPendingChannels(data);
        }
      }
    } catch {
      // Fallback
    }
  }, [canManageChannels, token]);

  // 1. Initial fetch & continuous background auto-polling every 2.5 seconds
  useEffect(() => {
    if (!canManageChannels) return;
    fetchPendingChannels();
    const timer = setInterval(fetchPendingChannels, 2500);
    return () => clearInterval(timer);
  }, [canManageChannels, fetchPendingChannels]);

  // 2. Refetch on tab focus or document visibility change
  useEffect(() => {
    if (!canManageChannels) return;
    const onFocus = () => fetchPendingChannels();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchPendingChannels();
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [canManageChannels, fetchPendingChannels]);

  // 3. Instant zero-latency cross-tab synchronization via BroadcastChannel and Storage events
  useEffect(() => {
    if (!canManageChannels) return;
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("flowbre_approval_sync");
      bc.onmessage = (event) => {
        if (event.data?.type === "CHANNEL_STATUS_CHANGED") {
          fetchPendingChannels();
        }
      };
    } catch {}

    const onStorage = (e: StorageEvent) => {
      if (e.key === "flowbre_approval_sync") {
        fetchPendingChannels();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      if (bc) bc.close();
      window.removeEventListener("storage", onStorage);
    };
  }, [canManageChannels, fetchPendingChannels]);

  const handleDecision = (id: string, decision: "APPROVED" | "REJECTED") => {
    setApprovals(approvals.map((a) => (a.id === id ? { ...a, status: decision } : a)));
  };

  const handleChannelAction = async (channel: PendingChannelItem, action: "approve" | "reject") => {
    // Optimistic removal in current user's state
    setPendingChannels((prev) => prev.filter((c) => c.id !== channel.id && c.tenant_uuid !== channel.tenant_uuid));

    // Broadcast immediately across tabs so other open roles (e.g. Regional Director) reflect it in real-time
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
    } catch {
      // Optimistic update retained
    }

    if (action === "approve") {
      setFeedbackMsg(
        `Channel "${channel.name}" accepted! Provisioned Channel Admin credentials for ${channel.contact_email}. Visible to Sales Manager, Team Leader, Area Manager, and Regional Director.`
      );
    } else {
      setFeedbackMsg(`Channel "${channel.name}" registration has been rejected.`);
    }

    setTimeout(() => setFeedbackMsg(null), 6000);
  };

  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-6 px-4 sm:px-6 py-6 animate-fade-in">
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
            Credit committee review, manual exceptions, and partner channel onboarding gate.
          </p>
        </div>

        {/* Tab Navigation */}
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
                fetchPendingChannels();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "channels"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Channel Onboarding</span>
              <span className="px-1.5 py-0.2 rounded-full text-[0.625rem] bg-emerald-500 text-white font-mono">
                {pendingChannels.length}
              </span>
            </button>
          )}
        </div>
      </div>

      {feedbackMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button type="button" onClick={() => setFeedbackMsg(null)} className="text-emerald-600 hover:text-emerald-900">
            <X size={14} />
          </button>
        </div>
      )}

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
        /* Channel Onboarding Dual-Gate Approval List */
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 text-xs text-slate-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-teal-600" />
              <span>
                <strong>Dual-Gate Approval Policy:</strong> As <strong>{role}</strong>, your acceptance will activate the channel workspace and automatically provision the partner <strong>Channel Admin</strong>.
              </span>
            </div>
            <span className="text-[0.6875rem] font-mono font-bold text-slate-400">
              Authority: {role === "SUPER_ADMIN" ? "Company Director" : "Regional Director"}
            </span>
          </div>

          {pendingChannels.length === 0 ? (
            <div className="rounded-2xl border border-line bg-white p-12 text-center text-xs text-slate-500">
              <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
              <p className="font-bold text-slate-800">All partner channel onboarding requests have been reviewed.</p>
              <p className="text-[0.6875rem] text-slate-400 mt-0.5">New self-registration requests will automatically appear here.</p>
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
                        <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                          <Building2 size={18} />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm font-display">{channel.name}</h3>
                          <span className="font-mono text-[0.6875rem] text-teal-600">/{channel.tenant_uuid}</span>
                        </div>
                      </div>
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[0.625rem] font-mono font-bold text-amber-700 border border-amber-200">
                        {channel.channel_type}
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
    </div>
  );
}
