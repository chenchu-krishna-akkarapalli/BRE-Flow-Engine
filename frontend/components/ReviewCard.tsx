"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { redactDob, redactPan } from "@/lib/redact";
import { STEP_PLAN } from "@/lib/form-schema";
import type { Draft } from "@/store/useOnboardingStore";
import { profileTypeFor } from "@/store/useOnboardingStore";

/** Step 5 review summary.
 *
 * PII is masked by default using the same masks as the backend's redact_pii —
 * this is the most screenshotted surface in the flow, so unmasking is an
 * explicit per-card action, never the default view. */
export function ReviewCard({
  draft, onEdit,
}: {
  draft: Draft; onEdit: (stepId: number) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const profile = profileTypeFor(draft);
  const isCompany = draft.entityType === "Company";
  const plan = STEP_PLAN[draft.entityType];

  const pan =
    draft.entityType === "Company" ? draft.companyPan
    : draft.entityType === "HUF" ? draft.hufPan
    : draft.pan;
  const name =
    draft.entityType === "Company" ? draft.companyName
    : draft.entityType === "HUF" ? draft.hufName
    : draft.applicantName;

  const groups: { step: number; title: string; rows: [string, string][] }[] = [
    {
      step: 1,
      title: "Identity",
      rows: [
        ["Name", name || "—"],
        ["Entity", draft.entityType],
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
            ["Pincode", draft.pincode || "—"],
            ["City / State", [draft.cityName, draft.stateName].filter(Boolean).join(", ") || "—"],
            ["Residence", draft.residentDetails],
          ] as [string, string][],
        }]),
    {
      step: 3,
      title: "Occupation",
      rows:
        profile === "Salaried"
          ? [["Profile", "Salaried"], ["Tenure", draft.tenureBand], ["Income proof", draft.form16Status]]
          : profile === "Company"
          ? [["Profile", "Company"], ["GSTIN", draft.companyGstin || "—"], ["Current ITR", `₹${draft.companyCurrentITRAmount.toLocaleString("en-IN")}`]]
          : [["Profile", profile], ["Established", draft.businessEstablishmentDate || "—"], ["Current ITR", `₹${draft.currentITRAmount.toLocaleString("en-IN")}`]],
    },
    {
      step: 4,
      title: "Banking & Bureau",
      rows: [
        ["Primary bank", draft.existingAccountBank],
        ["Loan type", draft.loanType],
        ["CIBIL", String(draft.bureauCibilScore)],
        ["DPD", String(draft.bureauDpd)],
      ],
    },
    ...(isCompany
      ? []
      : [{
          step: 5,
          title: "Co-Applicant",
          rows: [
            ["Age extension", draft.coAppAgeRelation],
            ["Income pooling", draft.coAppIncomeRelation],
          ] as [string, string][],
        }]),
  ];

  return (
    <section className="glass rounded-lg p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[1.25rem] font-semibold">Review your application</h2>
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          className="flex min-h-[44px] items-center gap-2 text-[0.8125rem] text-brand-400"
        >
          {revealed ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
          {revealed ? "Hide" : "Reveal"} sensitive fields
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
