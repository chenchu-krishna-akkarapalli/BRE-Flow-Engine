"use client";

import { Phase1IncomeCard } from "@/components/Phase1IncomeCard";
import { useOnboardingStore } from "@/store/useOnboardingStore";

export function Step6Phase1Income() {
  const draft = useOnboardingStore((s) => s.draft);
  const isCorporate = draft.entityType === "Company";

  return (
    <div className="flex flex-col gap-6">
      {/* Intro Banner */}
      <div className="rounded-xl border border-brand-200/80 bg-brand-50/50 p-4 text-xs text-brand-900 leading-relaxed">
        <p className="font-semibold text-brand-950 mb-1">
          {isCorporate
            ? "Corporate Income Assessment (Current & Previous Year Documents)"
            : "Applicant Income Assessment (Current & Previous Year Documents)"}
        </p>
        <p className="text-brand-800">
          The Business Rules Engine calculates loan eligibility against an audited <strong>2-Year Average Income</strong> derived from your Current Year and Previous Year <strong>ITR</strong> and <strong>Computation of Income (COI)</strong> documents. Review the assessed numbers below before submitting for multi-bank evaluation.
        </p>
      </div>

      <Phase1IncomeCard />
    </div>
  );
}

export default Step6Phase1Income;
