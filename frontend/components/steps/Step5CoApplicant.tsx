"use client";

import { Field, Select } from "@/components/Field";
import { AGE_RELATIONS } from "@/lib/form-schema";
import {
  ageAtLastEmiFor, needsCoApplicant, needsIncomeCoApplicant,
  needsIncomeCoApplicantInStep3,
} from "@/store/useOnboardingStore";
import type { Draft } from "@/store/useOnboardingStore";
import { IncomeCoApplicant, useField } from "./step-shared";

export function Step5CoApplicant() {
  const { draft, set } = useField();
  const k = <K extends keyof Draft>(key: K) => (v: Draft[K]) => set(key, v);
  const pooling = draft.coAppIncomeRelation !== "None";

  // add-on.md §8: the two questions are now triggered independently — age by
  // the EMI ceiling, income by the applicant's own filed returns.
  const forAge = needsCoApplicant(draft);
  const forIncome = needsIncomeCoApplicant(draft);
  const age = ageAtLastEmiFor(draft);

  if (!forAge && !forIncome) {
    // Step 3 owns the income question for self-employed applicants, so say what
    // they already answered there rather than claiming nobody is joining.
    const pooledInStep3 = needsIncomeCoApplicantInStep3(draft) && pooling;
    return (
      <p className="text-[0.9375rem] text-ink">
        {age === null
          ? "Add your date of birth in step 1 to see whether a co-applicant is needed."
          : pooledInStep3
          ? `You added your ${draft.coAppIncomeRelation.toLowerCase()}'s income in step 3, `
            + `and you will be ${age} at your last payment, which is inside every bank's `
            + "age limit. Nothing more is needed — continue to submit."
          : `You will be ${age} at your last payment, which is inside every bank's age limit, `
            + "and your declared income clears the threshold on its own. "
            + "No co-applicant is needed — continue to submit."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {forAge && (
        <Field label="Is anyone joining your application to help meet the age limit?" htmlFor="coAppAgeRelation">
          <Select id="coAppAgeRelation" value={draft.coAppAgeRelation} onChange={k("coAppAgeRelation")} options={AGE_RELATIONS} />
        </Field>
      )}

      {forIncome && <IncomeCoApplicant />}
    </div>
  );
}

export default Step5CoApplicant;
