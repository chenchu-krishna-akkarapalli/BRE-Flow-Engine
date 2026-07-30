"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { redactDob, redactPan } from "@/lib/redact";
import { STEP_PLAN } from "@/lib/form-schema";
import type { Draft } from "@/store/useOnboardingStore";
import { profileTypeFor } from "@/store/useOnboardingStore";

// Plain restatement of the two repayment answers.
function missedPaymentSummary(draft: Draft): string {
  if (!draft.hasMissedPayment) return "None";
  return draft.missedOver90 ? "Yes, more than 90 days late" : "Yes, but under 90 days";
}

// Step 5 review. PII is masked by default (same masks as redact_pii); unmasking is an explicit action.
export function ReviewCard({
  draft, onEdit,
}: {
  draft: Draft; onEdit: (stepId: number) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const profile = profileTypeFor(draft);
  const isCompany = draft.entityType === "Company";
  const plan = STEP_PLAN[draft.entityType];

  const pan = isCompany ? draft.companyPan : draft.pan;
  const name = isCompany ? draft.companyName : draft.applicantName;

  const groups: { step: number; title: string; rows: [string, string][] }[] = [
    {
      step: 1,
      title: "Identity",
      rows: [
        ["Name", name || "—"],
        ["Applying as", isCompany ? "A company" : "An individual"],
        ["PAN", pan ? (revealed ? pan : redactPan(pan)) : "—"],
        ...(draft.entityType === "Individual"
          ? ([["DOB", draft.dob ? (revealed ? draft.dob : redactDob(draft.dob)) : "—"]] as [string, string][])
          : []),
      ],
    },
    ...(isCompany
      ? []
      : [{
          step: 2,
          title: "Address",
          rows: [
            ["PIN code", draft.pincode || "—"],
            ["City and state", [draft.cityName, draft.stateName].filter(Boolean).join(", ") || "—"],
            ["Home", draft.residentDetails],
          ] as [string, string][],
        }]),
    {
      step: 3,
      title: "Occupation",
      rows:
        profile === "Salaried"
          ? [["Works as", "Salaried"], ["Time at current job", draft.tenureBand], ["Proof of income", draft.form16Status === "Form 16" ? `Form 16 · ${draft.form16Years} yrs` : "None"]]
          : profile === "Company"
          ? [["Works as", "A company"], ["GST / Udyam number", draft.companyGstin || "—"], ["Income declared last year", `₹${draft.companyCurrentITRAmount.toLocaleString("en-IN")}`]]
          : [["Works as", "Self-employed"], ["Business started", draft.businessEstablishmentDate || "—"], ["Income declared last year", `₹${draft.currentITRAmount.toLocaleString("en-IN")}`]],
    },
    {
      step: 4,
      title: "Banking & Bureau",
      rows: [
        ["Banks with", draft.existingAccountBank],
        ["Loan wanted", draft.loanType],
        ["Credit score", String(draft.bureauCibilScore)],
        ["Missed payments", missedPaymentSummary(draft)],
        ["Written-off accounts", draft.hasWriteOff ? "Yes" : "None"],
      ],
    },
    ...(isCompany
      ? []
      : [{
          step: 5,
          title: "Co-Applicant",
          rows: [
            ["Joining for the age limit", draft.coAppAgeRelation],
            ["Adding their income", draft.coAppIncomeRelation],
          ] as [string, string][],
        }]),
  ];

  return (
    <section className="glass rounded-lg p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[1.25rem] font-semibold">Please check your answers</h2>
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          className="flex min-h-[44px] items-center gap-2 text-[0.8125rem] text-brand-400"
        >
          {revealed ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
          {revealed ? "Hide" : "Show"} my PAN and date of birth
        </button>
      </div>

      <dl className="mt-4 flex flex-col gap-5">
        {groups.map((group) => (
          <div key={group.step} className="border-t border-line pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[0.9375rem] font-semibold text-ink">{group.title}</h3>
              {plan.includes(group.step) && (
                <button
                  type="button"
                  onClick={() => onEdit(group.step)}
                  className="min-h-[44px] text-[0.8125rem] text-brand-400"
                >
                  Edit
                </button>
              )}
            </div>
            <div className="mt-1 grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {group.rows.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-[0.8125rem] text-ink-muted">{label}</dt>
                  <dd className="numeric text-[0.8125rem] text-ink">{value}</dd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}
