"use client";

import { useState } from "react";
import { Download, Eye, EyeOff, FileSpreadsheet, Printer, ShieldCheck } from "lucide-react";
import { downloadApplicationExport } from "@/lib/api";
import { redactDob, redactPan } from "@/lib/redact";
import { STEP_PLAN } from "@/lib/form-schema";
import type { Draft } from "@/store/useOnboardingStore";
import { profileTypeFor } from "@/store/useOnboardingStore";

function missedPaymentSummary(draft: Draft): string {
  if (!draft.hasMissedPayment) return "None";
  return draft.missedOver90 ? "Yes, >90 days overdue" : "Yes, <90 days overdue";
}

/**
 * Final Step Review Card Component - Day Mode
 * Clean summary board with print/export options (PDF/Excel) and PII masking toggle.
 */
export function ReviewCard({
  draft,
  onEdit,
  applicationId,
}: {
  draft: Draft;
  onEdit: (stepId: number) => void;
  applicationId?: string | null;
}) {
  const [revealed, setRevealed] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  const profile = profileTypeFor(draft);
  const isCompany = draft.entityType === "Company";
  const plan = STEP_PLAN[draft.entityType];

  const pan = isCompany ? draft.companyPan : draft.pan;
  const name = isCompany ? draft.companyName : draft.applicantName;

  async function handleExport(format: "pdf" | "excel") {
    if (!applicationId) return;
    setExporting(format);
    try {
      await downloadApplicationExport(applicationId, format);
    } catch {
      window.print();
    } finally {
      setExporting(null);
    }
  }

  const groups: { step: number; title: string; rows: [string, string][] }[] = [
    {
      step: 1,
      title: "Identity Profile",
      rows: [
        ["Applicant Name", name || "—"],
        ["Entity Type", isCompany ? "Corporate Company" : "Individual Applicant"],
        ["PAN Identification", pan ? (revealed ? pan : redactPan(pan)) : "—"],
        ...(draft.entityType === "Individual"
          ? ([["Date of Birth", draft.dob ? (revealed ? draft.dob : redactDob(draft.dob)) : "—"]] as [string, string][])
          : []),
      ],
    },
    ...(isCompany
      ? []
      : [{
          step: 2,
          title: "Address & Location",
          rows: [
            ["PIN Code", draft.pincode || "—"],
            ["City & State", [draft.cityName, draft.stateName].filter(Boolean).join(", ") || "—"],
            ["Residence Status", draft.residentDetails],
          ] as [string, string][],
        }]),
    {
      step: 3,
      title: "Employment & Financials",
      rows:
        profile === "Salaried"
          ? [
              ["Profile Type", "Salaried Professional"],
              ["Job Tenure", draft.tenureBand],
              ["Income Proof", draft.form16Status === "Form 16" ? `Form 16 (${draft.form16Years} yrs)` : "None"],
            ]
          : profile === "Company"
          ? [
              ["Profile Type", "Registered Corporate Entity"],
              ["GST / Udyam ID", draft.companyGstin || "—"],
              ["Declared ITR", `₹${Number(draft.companyCurrentITRAmount || 0).toLocaleString("en-IN")}`],
            ]
          : [
              ["Profile Type", "Self-Employed Entity"],
              ["Business Inception", draft.businessEstablishmentDate || "—"],
              ["Declared ITR", `₹${Number(draft.currentITRAmount || 0).toLocaleString("en-IN")}`],
            ],
    },
    {
      step: 4,
      title: "Banking & Bureau Metrics",
      rows: [
        ["Primary Account Bank", draft.existingAccountBank],
        ["Target Loan Product", draft.loanType],
        ["CIBIL Score", String(draft.bureauCibilScore)],
        ["Repayment Delinquency", missedPaymentSummary(draft)],
        ["Settled / Written-off Accounts", draft.hasWriteOff ? "Yes (Flagged)" : "None"],
      ],
    },
    ...(isCompany
      ? []
      : [{
          step: 5,
          title: "Co-Applicant Details",
          rows: [
            ["Age Extension Pooling", draft.coAppAgeRelation],
            ["Income Aggregation", draft.coAppIncomeRelation],
          ] as [string, string][],
        }]),
  ];

  return (
    <section className="glass-panel rounded-2xl p-6 shadow-sm border border-line flex flex-col gap-6">
      {/* Header with Print/Export triggers */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <span className="text-xs uppercase tracking-wider text-brand-600 font-bold flex items-center gap-1">
            <ShieldCheck size={14} /> Application Summary
          </span>
          <h2 className="text-xl font-bold tracking-tight text-ink mt-0.5">
            Review Your Application Parameters
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* PII Masking Toggle Button */}
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            className="flex min-h-[40px] items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-semibold text-ink hover:border-line-strong hover:bg-bg-raised transition-all"
          >
            {revealed ? <EyeOff size={14} className="text-brand-600" /> : <Eye size={14} className="text-brand-600" />}
            <span>{revealed ? "Hide PII" : "Unmask PII"}</span>
          </button>

          {/* Quick Print Button */}
          <button
            type="button"
            onClick={() => window.print()}
            className="flex min-h-[40px] items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-semibold text-ink hover:border-line-strong hover:bg-bg-raised transition-all"
          >
            <Printer size={14} />
            <span className="hidden sm:inline">Print</span>
          </button>

          {/* Export PDF */}
          <button
            type="button"
            onClick={() => handleExport("pdf")}
            disabled={exporting !== null}
            className="flex min-h-[40px] items-center gap-2 rounded-xl border border-brand-500/30 bg-brand-500/10 px-3.5 py-2 text-xs font-bold text-brand-600 hover:border-brand-500 hover:bg-brand-500/20 transition-all disabled:opacity-50"
          >
            <Download size={14} />
            <span>{exporting === "pdf" ? "Exporting..." : "PDF"}</span>
          </button>

          {/* Export Excel */}
          <button
            type="button"
            onClick={() => handleExport("excel")}
            disabled={exporting !== null}
            className="flex min-h-[40px] items-center gap-2 rounded-xl border border-brand-indigo/30 bg-brand-indigo/10 px-3.5 py-2 text-xs font-bold text-brand-indigo hover:border-brand-indigo hover:bg-brand-indigo/20 transition-all disabled:opacity-50"
          >
            <FileSpreadsheet size={14} />
            <span>{exporting === "excel" ? "Exporting..." : "Excel"}</span>
          </button>
        </div>
      </div>

      {/* Summary Grid Groups */}
      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.step} className="rounded-xl border border-line bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <h3 className="text-sm font-bold text-ink tracking-wide">{group.title}</h3>
              {plan.includes(group.step) && (
                <button
                  type="button"
                  onClick={() => onEdit(group.step)}
                  className="text-xs font-bold text-brand-600 hover:underline transition-colors"
                >
                  Edit Step {group.step} &rarr;
                </button>
              )}
            </div>

            <dl className="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {group.rows.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4 border-b border-line pb-1">
                  <dt className="text-xs font-medium text-ink-subtle">{label}</dt>
                  <dd className="numeric text-xs font-bold text-ink truncate max-w-[200px]" title={value}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
