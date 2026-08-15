"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";

interface OverrideItem {
  id: string;
  applicant: string;
  entity: string;
  cibil: number;
  loanAmount: string;
  targetBank: string;
  deviationRule: string;
  severity: "Minor" | "Moderate" | "Critical";
  reason: string;
  mitigant: string;
  status: "Pending" | "Approved" | "Rejected";
}

const INITIAL_QUEUE: OverrideItem[] = [
  {
    id: "DEV-1082",
    applicant: "Kunal Mehra",
    entity: "Individual",
    cibil: 692,
    loanAmount: "₹ 28,00,000",
    targetBank: "HDFC",
    deviationRule: "CIBIL-700-FLOOR",
    severity: "Minor",
    reason: "CIBIL score is 692 (8 points below minimum threshold 700).",
    mitigant: "Applicant has ₹1.8L monthly salary mode bank credit with 0 DPD in 24 months.",
    status: "Pending",
  },
  {
    id: "DEV-1079",
    applicant: "Trident Engineering Pvt Ltd",
    entity: "Company",
    cibil: 720,
    loanAmount: "₹ 95,00,000",
    targetBank: "BOB",
    deviationRule: "FOIR-DEBT-CAP",
    severity: "Moderate",
    reason: "Projected FOIR is 68% against standard bank cap of 65%.",
    mitigant: "Current year audited ITR turnover increased by 34% YoY with high debt service ratio.",
    status: "Pending",
  },
  {
    id: "DEV-1074",
    applicant: "Ritu Singhal",
    entity: "Individual",
    cibil: 705,
    loanAmount: "₹ 45,00,000",
    targetBank: "AXIS",
    deviationRule: "TENURE-AGE-LIMIT",
    severity: "Minor",
    reason: "Age at loan maturity will be 62 years (Standard ceiling 60 years).",
    mitigant: "Applicant holds central government pensionable employment.",
    status: "Pending",
  },
  {
    id: "DEV-1068",
    applicant: "Shree Ganesh Agro Foods",
    entity: "Company",
    cibil: 660,
    loanAmount: "₹ 1,50,00,000",
    targetBank: "BOI",
    deviationRule: "COLLATERAL-MARGIN",
    severity: "Critical",
    reason: "DPD 30 flagged on past commercial equipment loan 18 months ago.",
    mitigant: "Full closure certificate submitted with no active delinquency.",
    status: "Pending",
  },
];

export default function ApprovalsPage() {
  const [queue, setQueue] = useState<OverrideItem[]>(INITIAL_QUEUE);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleAction = (id: string, newStatus: "Approved" | "Rejected") => {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
    );
    const item = queue.find((i) => i.id === id);
    setToastMessage(
      `Case ${id} (${item?.applicant}) successfully ${newStatus.toLowerCase()} with audit sign-off.`
    );
    setTimeout(() => setToastMessage(null), 4000);
  };

  const pendingCount = queue.filter((i) => i.status === "Pending").length;

  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-6 px-4 sm:px-6 py-6 animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 rounded-2xl border border-brand-500/30 bg-white p-4 shadow-xl backdrop-blur-md animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2 text-xs font-bold text-ink">
            <CheckCircle2 size={16} className="text-success" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink font-display">
            Approval &amp; Override Queue
          </h1>
          <p className="text-xs text-ink-subtle">
            Manual sign-off desk for applications with non-terminating rule deviations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-xl border border-warning/30 bg-warning-bg px-3 py-1.5 text-xs font-bold text-warning flex items-center gap-1.5">
            <Clock size={14} />
            {pendingCount} Pending Sign-offs
          </span>
        </div>
      </div>

      {/* Queue List */}
      <div className="space-y-4">
        {queue.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-line bg-white p-5 shadow-xs transition-all hover:border-line-strong"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-extrabold text-brand-600">
                  {item.id}
                </span>
                <span className="text-sm font-bold text-ink">{item.applicant}</span>
                <span className="rounded bg-bg-raised px-2 py-0.5 text-[0.6875rem] font-medium text-ink-subtle">
                  {item.entity}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[0.6875rem] font-bold border ${
                    item.severity === "Minor"
                      ? "bg-brand-500/10 text-brand-600 border-brand-500/20"
                      : item.severity === "Moderate"
                      ? "bg-warning/10 text-warning border-warning/20"
                      : "bg-danger/10 text-danger border-danger/20"
                  }`}
                >
                  {item.severity} Deviation
                </span>
                <span className="rounded bg-bg-raised px-2 py-0.5 font-mono text-xs font-bold text-ink">
                  Target: {item.targetBank}
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3 text-xs">
              <div className="rounded-xl bg-danger-bg/50 p-3 border border-danger/20">
                <span className="font-bold text-danger flex items-center gap-1">
                  <ShieldAlert size={14} />
                  Triggered Deviation: {item.deviationRule}
                </span>
                <p className="mt-1 text-ink-muted leading-relaxed">{item.reason}</p>
              </div>

              <div className="rounded-xl bg-success-bg/50 p-3 border border-success/20 md:col-span-2">
                <span className="font-bold text-success flex items-center gap-1">
                  <ShieldCheck size={14} />
                  Compensating Factor / Policy Mitigant
                </span>
                <p className="mt-1 text-ink-muted leading-relaxed">{item.mitigant}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-3">
              <div className="flex items-center gap-4 text-xs">
                <span className="text-ink-subtle">
                  Amount: <strong className="font-mono text-ink">{item.loanAmount}</strong>
                </span>
                <span className="text-ink-subtle">
                  Bureau CIBIL: <strong className="font-mono text-ink">{item.cibil}</strong>
                </span>
              </div>

              {item.status === "Pending" ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAction(item.id, "Rejected")}
                    className="flex min-h-[38px] items-center gap-1.5 rounded-xl border border-danger/30 bg-white px-4 py-2 text-xs font-bold text-danger transition-all hover:bg-danger-bg"
                  >
                    <XCircle size={14} />
                    <span>Decline Override</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction(item.id, "Approved")}
                    className="flex min-h-[38px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-success to-teal-600 px-5 py-2 text-xs font-extrabold text-white shadow-glow transition-all hover:scale-[1.02]"
                  >
                    <CheckCircle2 size={14} />
                    <span>Sign-off &amp; Approve</span>
                  </button>
                </div>
              ) : (
                <span
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                    item.status === "Approved"
                      ? "bg-success-bg text-success border border-success/30"
                      : "bg-danger-bg text-danger border border-danger/30"
                  }`}
                >
                  Status: {item.status} Signed
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
