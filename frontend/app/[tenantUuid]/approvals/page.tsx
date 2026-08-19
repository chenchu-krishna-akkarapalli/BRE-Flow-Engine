"use client";

import { use, useState } from "react";
import { Check, CheckCircle2, ShieldAlert, X } from "lucide-react";

interface ApprovalItem {
  id: string;
  applicantName: string;
  loanType: string;
  requestedAmount: number;
  exceptionCategory: string;
  comments: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
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
  const [approvals, setApprovals] = useState<ApprovalItem[]>(INITIAL_APPROVALS);

  const handleDecision = (id: string, decision: "APPROVED" | "REJECTED") => {
    setApprovals(approvals.map((a) => (a.id === id ? { ...a, status: decision } : a)));
  };

  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-6 px-4 sm:px-6 py-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-ink font-display">
              Underwriting Exception Queue
            </h1>
            <span className="rounded-md bg-brand-500/10 px-2 py-0.5 text-xs font-mono font-bold text-brand-600 border border-brand-500/20">
              {tenantUuid}
            </span>
          </div>
          <p className="text-xs text-ink-subtle mt-0.5">
            Credit committee review and manual exception sign-offs.
          </p>
        </div>
      </div>

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
    </div>
  );
}
