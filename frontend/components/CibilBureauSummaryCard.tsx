"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  BadgeCheck,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Eye,
  RotateCcw,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import type { CibilAccountDetail } from "@/lib/api";

function formatInr(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "₹0";
  const n = typeof val === "string" ? parseFloat(val.replace(/,/g, "")) : Number(val);
  if (isNaN(n)) return "₹0";
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

function getScoreTier(score: number): { label: string; color: string; bg: string; border: string } {
  if (score >= 750) {
    return { label: "Excellent", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" };
  }
  if (score >= 700) {
    return { label: "Good", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" };
  }
  if (score >= 650) {
    return { label: "Fair / Borderline", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" };
  }
  return { label: "High Risk", color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200" };
}

export interface CibilBureauSummaryCardProps {
  onReupload?: () => void;
  reuploadBusy?: boolean;
}

export function CibilBureauSummaryCard({
  onReupload,
  reuploadBusy = false,
}: CibilBureauSummaryCardProps = {}) {
  const verified = useOnboardingStore((s) => s.cibilVerified);
  const clear = useOnboardingStore((s) => s.clearCibilExtraction);
  const draft = useOnboardingStore((s) => s.draft);

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "all">("active");
  const [showRiskDetails, setShowRiskDetails] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isDetailsOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsDetailsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDetailsOpen]);

  if (!verified) return null;

  const evidence = (verified.evidence ?? {}) as Record<string, any>;
  const consumer = (evidence.consumerInfo ?? {}) as Record<string, any>;
  const accountsSummary = (evidence.accountsSummary ?? {}) as Record<string, any>;
  const rawAccounts: CibilAccountDetail[] = evidence.accounts ?? [];
  const activeAccounts: CibilAccountDetail[] = evidence.activeAccounts ?? rawAccounts.filter((a) => a.isActive);

  const score = Number(evidence.bureauCibilScore ?? draft.bureauCibilScore ?? 0);
  const scoreTier = getScoreTier(score);

  const totalActiveEmi = Number(evidence.totalActiveEmi ?? evidence.existingEmi ?? draft.existingEmi ?? 0);
  const totalEmi = Number(evidence.totalEmi ?? 0);
  const totalBalance = Number(evidence.totalCurrentBalance ?? accountsSummary.totalBalance ?? 0);
  const totalOverdue = Number(evidence.bureauCurrentlyOutstanding ?? draft.bureauCurrentlyOutstanding ?? 0);

  const totalAccountsCount = Number(accountsSummary.totalAccounts ?? rawAccounts.length);
  const activeAccountsCount = Number(accountsSummary.activeAccounts ?? activeAccounts.length);
  const closedAccountsCount = Number(accountsSummary.closedAccounts ?? Math.max(0, totalAccountsCount - activeAccountsCount));

  const worstRecentDpd = Number(evidence.bureauDpd ?? 0);
  const lifetimeWorstDpd = Number(evidence.worstEverDpd ?? 0);
  const enquiries30d = Number(evidence.enquiriesLast30Days ?? 0);
  const enquiries12m = Number(evidence.enquiriesLast12Months ?? 0);
  const hasWriteOff = Boolean(evidence.hasWriteOff);
  const writeOffAmount = Number(evidence.bureauWriteOffAmount ?? 0);

  // Identity match comparison with Step 1
  const cibilName = String(consumer.name || "").trim();
  const draftName = String(draft.applicantName || "").trim();
  const nameMatches = Boolean(
    cibilName && draftName && (cibilName.toLowerCase().includes(draftName.toLowerCase()) || draftName.toLowerCase().includes(cibilName.toLowerCase()))
  );

  const cibilPan = String(consumer.pan || "").trim().toUpperCase();
  const draftPan = String(draft.pan || "").trim().toUpperCase();
  const panMatches = Boolean(cibilPan && draftPan && cibilPan === draftPan);

  const displayedAccounts = activeTab === "active" ? activeAccounts : rawAccounts;

  return (
    <>
      {/* Compact Status Card shown on Step 4 */}
      <div className="flex w-full min-w-0 flex-col gap-3 rounded-2xl border border-emerald-200/90 bg-emerald-50/20 p-4 shadow-xs">
        {/* Top Row: Badge, Filename, Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line/50 pb-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 shrink-0">
              <BadgeCheck size={15} className="text-emerald-600" />
              Verified via CIBIL PDF
            </span>
            <span
              className="max-w-[180px] sm:max-w-xs truncate font-mono text-xs font-medium text-ink-muted"
              title={verified.filename}
            >
              {verified.filename}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {onReupload && (
              <button
                type="button"
                onClick={onReupload}
                disabled={reuploadBusy}
                className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink transition-colors cursor-pointer"
              >
                <Upload size={13} />
                <span>{reuploadBusy ? "Uploading…" : "Re-upload"}</span>
              </button>
            )}
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline transition-colors cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>Answer myself instead</span>
            </button>
          </div>
        </div>

        {/* Concise Summary Metrics Bar */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 min-w-0">
          {/* CIBIL Score */}
          <div className="flex items-center justify-between sm:flex-col sm:items-start rounded-xl border border-line bg-white p-3 shadow-2xs">
            <span className="text-[0.6875rem] font-semibold text-ink-subtle uppercase tracking-wider">
              CIBIL Score
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-mono text-xl font-bold text-ink">
                {score || "—"}
              </span>
              <span className={`text-xs font-bold ${scoreTier.color}`}>
                ({scoreTier.label})
              </span>
            </div>
          </div>

          {/* Total Active Monthly EMI */}
          <div className="flex items-center justify-between sm:flex-col sm:items-start rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 shadow-2xs">
            <span className="text-[0.6875rem] font-semibold text-emerald-900 uppercase tracking-wider">
              Total Active EMI
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-mono text-xl font-extrabold text-emerald-950">
                {formatInr(totalActiveEmi)}
              </span>
              <span className="text-xs font-medium text-emerald-800">/ mo</span>
            </div>
          </div>

          {/* Credit Facilities */}
          <div className="flex items-center justify-between sm:flex-col sm:items-start rounded-xl border border-line bg-white p-3 shadow-2xs">
            <span className="text-[0.6875rem] font-semibold text-ink-subtle uppercase tracking-wider">
              Credit Facilities
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-mono text-xl font-bold text-ink">
                {activeAccountsCount} Active
              </span>
              <span className="text-xs text-ink-subtle">
                / {totalAccountsCount} total
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Meta + View Details Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle min-w-0">
            {consumer.reportDate && (
              <span className="flex items-center gap-1">
                <Calendar size={13} />
                Date: <strong className="text-ink font-semibold">{consumer.reportDate}</strong>
              </span>
            )}
            {panMatches && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/70 px-2 py-0.5 text-[0.6875rem] font-semibold text-emerald-800">
                <CheckCircle2 size={11} /> PAN Verified
              </span>
            )}
            {totalOverdue > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[0.6875rem] font-bold text-rose-700">
                <AlertCircle size={11} /> Overdue: {formatInr(totalOverdue)}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsDetailsOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-all hover:scale-[1.01] hover:shadow-sm active:scale-[0.99] cursor-pointer"
          >
            <Eye size={15} />
            <span>View Details</span>
          </button>
        </div>
      </div>

      {/* Full Bureau Details Modal Dialog */}
      {mounted &&
        typeof document !== "undefined" &&
        isDetailsOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cibil-modal-title"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-3 sm:p-6 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setIsDetailsOpen(false)}
          >
            <div
              className="relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl border border-line bg-white shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Sticky Header */}
              <div className="flex items-center justify-between border-b border-line bg-slate-50/90 px-5 py-3.5 backdrop-blur-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 border border-brand-500/20">
                    <ShieldCheck size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 id="cibil-modal-title" className="text-sm font-bold text-ink">
                        Credit Bureau (CIBIL) Analysis
                      </h3>
                      <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[0.6875rem] font-semibold text-emerald-800">
                        <BadgeCheck size={13} className="text-emerald-600" />
                        Verified PDF
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[0.6875rem] text-ink-subtle">
                      <span className="truncate max-w-[240px] sm:max-w-md">{verified.filename}</span>
                      {consumer.reportDate && (
                        <>
                          <span>•</span>
                          <span>Report Date: {consumer.reportDate}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsDetailsOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-subtle transition-colors hover:border-line-strong hover:bg-white hover:text-ink cursor-pointer"
                  aria-label="Close dialog"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5">
                {/* Identity Cross-Verification Bar */}
                {(cibilName || cibilPan) && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs border border-line">
                    <span className="font-semibold text-ink-muted">Report Subject:</span>
                    {cibilName && (
                      <span className="font-medium text-ink">
                        {cibilName}
                        {draftName && (
                          <span
                            className={`ml-1 text-[0.6875rem] font-semibold ${
                              nameMatches ? "text-emerald-700" : "text-amber-700"
                            }`}
                          >
                            ({nameMatches ? "Name Matches" : "Step 1: " + draftName})
                          </span>
                        )}
                      </span>
                    )}
                    {cibilPan && (
                      <span className="ml-auto font-mono font-medium text-ink">
                        PAN: {cibilPan}
                        {draftPan && (
                          <span
                            className={`ml-1 text-[0.6875rem] font-semibold ${
                              panMatches ? "text-emerald-700" : "text-amber-700"
                            }`}
                          >
                            ({panMatches ? "PAN Verified" : "Differs from Step 1"})
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                )}

                {/* Executive Bureau Scorecard: 4 KPI Cards */}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 min-w-0">
                  {/* 1. CIBIL Score Card */}
                  <div className={`flex flex-col justify-between rounded-xl border p-3.5 ${scoreTier.bg} ${scoreTier.border}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-ink-muted">CIBIL Score</span>
                      <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-bold ${scoreTier.color} bg-white/80 border`}>
                        {scoreTier.label}
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="font-mono text-2xl font-extrabold text-ink sm:text-3xl">
                        {score || "—"}
                      </span>
                      <span className="text-[0.6875rem] text-ink-subtle font-medium">/ 900</span>
                    </div>
                    <p className="mt-1 text-[0.6875rem] text-ink-subtle">
                      {score >= 650 ? "Meets bank minimum (650+)" : "Below standard bank floor"}
                    </p>
                  </div>

                  {/* 2. Total Active Monthly EMI Card */}
                  <div className="flex flex-col justify-between rounded-xl border border-emerald-300 bg-emerald-50/70 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-900">Total Active EMI</span>
                      <span className="rounded-full bg-emerald-200/80 px-2 py-0.5 text-[0.6875rem] font-bold text-emerald-900">
                        FOIR Driver
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className="font-mono text-2xl font-extrabold text-emerald-950 sm:text-3xl">
                        {formatInr(totalActiveEmi)}
                      </span>
                      <span className="text-[0.6875rem] font-medium text-emerald-800">/ mo</span>
                    </div>
                    <p className="mt-1 text-[0.6875rem] text-emerald-800/80">
                      {totalEmi > totalActiveEmi ? `Total historical: ${formatInr(totalEmi)}` : "Ongoing monthly obligation"}
                    </p>
                  </div>

                  {/* 3. Facilities Count */}
                  <div className="flex flex-col justify-between rounded-xl border border-line bg-slate-50/70 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-ink-muted">Credit Facilities</span>
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[0.6875rem] font-semibold text-slate-700">
                        {activeAccountsCount} Active
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className="font-mono text-2xl font-bold text-ink sm:text-3xl">
                        {activeAccountsCount}
                      </span>
                      <span className="text-xs text-ink-subtle">/ {totalAccountsCount} accounts</span>
                    </div>
                    <p className="mt-1 text-[0.6875rem] text-ink-subtle">
                      {closedAccountsCount} closed / settled loans
                    </p>
                  </div>

                  {/* 4. Current Balance & Overdue */}
                  <div className={`flex flex-col justify-between rounded-xl border p-3.5 ${totalOverdue > 0 ? "border-rose-300 bg-rose-50/70" : "border-line bg-slate-50/70"}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-ink-muted">Current Exposure</span>
                      {totalOverdue > 0 ? (
                        <span className="flex items-center gap-1 rounded-full bg-rose-200 px-2 py-0.5 text-[0.6875rem] font-bold text-rose-800">
                          <AlertCircle size={12} /> Overdue
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[0.6875rem] font-semibold text-emerald-800">
                          <CheckCircle2 size={12} /> Clean
                        </span>
                      )}
                    </div>
                    <div className="mt-2">
                      <span className="font-mono text-xl font-bold text-ink sm:text-2xl">
                        {formatInr(totalBalance)}
                      </span>
                    </div>
                    <p className="mt-1 text-[0.6875rem] font-medium text-ink-subtle">
                      {totalOverdue > 0 ? (
                        <span className="text-rose-700 font-bold">Overdue: {formatInr(totalOverdue)}</span>
                      ) : (
                        "₹0 overdue balances"
                      )}
                    </p>
                  </div>
                </div>

                {/* Loan Obligations & Repayment Breakdown Table */}
                <div className="overflow-hidden rounded-xl border border-line bg-white shadow-2xs">
                  {/* Table Header & Tabs */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-slate-50/80 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CreditCard size={16} className="text-brand-600" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
                        Loan Obligations & Repayment Breakdown
                      </h4>
                    </div>

                    <div className="flex items-center rounded-lg border border-line bg-white p-0.5 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => setActiveTab("active")}
                        className={`rounded-md px-3 py-1 transition-colors cursor-pointer ${
                          activeTab === "active"
                            ? "bg-brand-500 font-bold text-white shadow-2xs"
                            : "text-ink-muted hover:text-ink"
                        }`}
                      >
                        Active Obligations ({activeAccounts.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("all")}
                        className={`rounded-md px-3 py-1 transition-colors cursor-pointer ${
                          activeTab === "all"
                            ? "bg-brand-500 font-bold text-white shadow-2xs"
                            : "text-ink-muted hover:text-ink"
                        }`}
                      >
                        All Facilities ({rawAccounts.length})
                      </button>
                    </div>
                  </div>

                  {/* Table Content */}
                  {displayedAccounts.length === 0 ? (
                    <div className="p-6 text-center text-xs text-ink-muted">
                      No {activeTab === "active" ? "active" : ""} loan accounts found in this credit report.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-line bg-slate-50/50 text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-subtle">
                          <tr>
                            <th className="px-4 py-2.5">#</th>
                            <th className="px-4 py-2.5">Facility / Loan Type</th>
                            <th className="px-4 py-2.5">Lender & Acct No</th>
                            <th className="px-4 py-2.5 text-right">Monthly EMI</th>
                            <th className="px-4 py-2.5 text-right">Sanctioned Limit</th>
                            <th className="px-4 py-2.5 text-right">Current Balance</th>
                            <th className="px-4 py-2.5">Tenure & Rate</th>
                            <th className="px-4 py-2.5 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line/60">
                          {displayedAccounts.map((acc, idx) => {
                            const hasEmi = acc.emi > 0;
                            const isDelinquent = (acc.amountOverdue ?? 0) > 0 || acc.worstDpd > 0;

                            return (
                              <tr
                                key={acc.key || idx}
                                className={`transition-colors hover:bg-slate-50/60 ${
                                  acc.isActive ? "bg-white" : "bg-slate-50/30 text-ink-muted"
                                }`}
                              >
                                <td className="px-4 py-3 font-mono text-[0.6875rem] text-ink-subtle">
                                  {acc.index || idx + 1}
                                </td>

                                <td className="px-4 py-3">
                                  <div className="font-semibold text-ink">
                                    {acc.accountType || "Credit Facility"}
                                  </div>
                                  {acc.paymentFrequency && (
                                    <div className="text-[0.6875rem] text-ink-subtle">
                                      Freq: {acc.paymentFrequency}
                                    </div>
                                  )}
                                </td>

                                <td className="px-4 py-3">
                                  <div className="font-medium text-ink">
                                    {acc.memberName || "Member Bank"}
                                  </div>
                                  <div className="font-mono text-[0.6875rem] text-ink-subtle">
                                    {acc.accountNumber ? `Acct: ${acc.accountNumber}` : "—"}
                                  </div>
                                </td>

                                <td className="px-4 py-3 text-right">
                                  {hasEmi ? (
                                    <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                      {formatInr(acc.emi)}
                                    </span>
                                  ) : (
                                    <span className="text-ink-subtle font-mono">—</span>
                                  )}
                                </td>

                                <td className="px-4 py-3 text-right font-mono font-medium text-ink">
                                  {acc.sanctionedAmount ? formatInr(acc.sanctionedAmount) : "—"}
                                </td>

                                <td className="px-4 py-3 text-right font-mono font-medium text-ink">
                                  {acc.currentBalance !== null && acc.currentBalance !== undefined
                                    ? formatInr(acc.currentBalance)
                                    : "—"}
                                </td>

                                <td className="px-4 py-3 text-[0.6875rem]">
                                  <div>
                                    {acc.repaymentTenure ? `${acc.repaymentTenure} mos` : "Tenure: —"}
                                  </div>
                                  <div className="text-ink-subtle">
                                    {acc.interestRate ? `${acc.interestRate}% p.a.` : "Rate: —"}
                                  </div>
                                </td>

                                <td className="px-4 py-3 text-center">
                                  <span
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-bold ${
                                      acc.isActive
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-slate-200 text-slate-700"
                                    }`}
                                  >
                                    {acc.isActive ? "ACTIVE" : "CLOSED"}
                                  </span>
                                  {isDelinquent && (
                                    <div className="mt-0.5 text-[0.625rem] font-bold text-rose-700">
                                      {acc.worstDpd > 0 ? `${acc.worstDpd} DPD` : "Overdue"}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Table Footer */}
                  <div className="border-t border-line bg-slate-50/50 px-4 py-2.5 text-[0.6875rem] text-ink-subtle flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Showing {displayedAccounts.length} accounts. Active EMIs are automatically applied to your Step 6 FOIR capacity calculation.
                    </span>
                    <span className="font-semibold text-emerald-800">
                      Total Active Monthly EMI: {formatInr(totalActiveEmi)}
                    </span>
                  </div>
                </div>

                {/* Expandable Bureau Risk & Delinquency Details */}
                <div className="rounded-xl border border-line bg-slate-50/50 p-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowRiskDetails(!showRiskDetails)}
                    className="flex w-full items-center justify-between font-semibold text-ink hover:text-brand-600 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={16} className="text-brand-600" />
                      <span>Delinquency, Write-Off & Inquiries Analysis</span>
                      {worstRecentDpd === 0 && !hasWriteOff && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.6875rem] font-bold text-emerald-800">
                          Clean Record
                        </span>
                      )}
                    </div>
                    {showRiskDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {showRiskDetails && (
                    <div className="mt-3 grid gap-3 border-t border-line/60 pt-3 sm:grid-cols-3">
                      {/* DPD Health */}
                      <div className="rounded-lg border border-line bg-white p-3">
                        <div className="font-semibold text-ink-muted text-[0.6875rem] uppercase">
                          Payment Track (DPD)
                        </div>
                        <div className="mt-1 flex items-baseline gap-1.5">
                          <span className="font-mono text-lg font-bold text-ink">
                            {worstRecentDpd} days
                          </span>
                          <span className="text-[0.6875rem] text-ink-subtle">(last 24m)</span>
                        </div>
                        {lifetimeWorstDpd > worstRecentDpd && (
                          <p className="mt-1 text-[0.6875rem] text-amber-700">
                            Older cured default: {lifetimeWorstDpd} days
                          </p>
                        )}
                      </div>

                      {/* Inquiries */}
                      <div className="rounded-lg border border-line bg-white p-3">
                        <div className="font-semibold text-ink-muted text-[0.6875rem] uppercase">
                          Credit Inquiries
                        </div>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="font-mono text-lg font-bold text-ink">
                            {enquiries30d}
                          </span>
                          <span className="text-[0.6875rem] text-ink-subtle">in past 30 days</span>
                        </div>
                        <p className="mt-1 text-[0.6875rem] text-ink-subtle">
                          Past 12 months: {enquiries12m} inquiries
                        </p>
                      </div>

                      {/* Write-Offs */}
                      <div className="rounded-lg border border-line bg-white p-3">
                        <div className="font-semibold text-ink-muted text-[0.6875rem] uppercase">
                          Written-Off & Settled
                        </div>
                        <div className="mt-1 flex items-baseline gap-1.5">
                          <span className={`font-mono text-lg font-bold ${hasWriteOff ? "text-rose-700" : "text-emerald-700"}`}>
                            {hasWriteOff ? formatInr(writeOffAmount) : "NIL"}
                          </span>
                        </div>
                        <p className="mt-1 text-[0.6875rem] text-ink-subtle">
                          {hasWriteOff ? "Write-off reported" : "Zero write-offs reported"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Sticky Footer */}
              <div className="flex items-center justify-between border-t border-line bg-slate-50/90 px-5 py-3 backdrop-blur-xs">
                <span className="text-[0.6875rem] text-ink-subtle hidden sm:inline">
                  Active monthly loan obligations are automatically factored into your Step 6 FOIR capacity.
                </span>
                <button
                  type="button"
                  onClick={() => setIsDetailsOpen(false)}
                  className="ml-auto rounded-xl border border-line bg-white px-5 py-2 text-xs font-bold text-ink transition-colors hover:border-line-strong hover:bg-slate-50 cursor-pointer shadow-2xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
