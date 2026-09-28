"use client";

import { Checkbox, Field, RadioCards, Select, TextInput } from "@/components/Field";
import {
  ACCOUNT_BANKS, CAR_LOAN_BANKS, LOAN_TYPES, WRITE_OFF_FLAGS, YES_NO,
} from "@/lib/form-schema";
import { CibilUpload } from "@/components/CibilUpload";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import type { Draft } from "@/store/useOnboardingStore";
import { AgeAtLastEmi, num, useField, yn } from "./step-shared";

export function Step4Banking() {
  const { draft, set } = useField();
  const k = <K extends keyof Draft>(key: K) => (v: Draft[K]) => set(key, v);
  // Every bureau answer below is locked while a parsed report is attached, so
  // what the applicant signs off on is what the document actually says.
  const locked = useOnboardingStore((s) => s.cibilVerified) !== null;

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <Field label="Which bank do you already have a savings or current account with?" htmlFor="existingAccountBank">
        <Select id="existingAccountBank" value={draft.existingAccountBank} onChange={k("existingAccountBank")} options={ACCOUNT_BANKS} />
      </Field>

      <Field label="Do you have a car loan with any bank, now or in the past?" htmlFor="existingCarLoanBank">
        <Select id="existingCarLoanBank" value={draft.existingCarLoanBank} onChange={k("existingCarLoanBank")} options={CAR_LOAN_BANKS} />
      </Field>

      <Field label="What kind of loan do you need?" htmlFor="loanType">
        <RadioCards
          name="loanType"
          label="What kind of loan do you need?"
          value={draft.loanType}
          onChange={k("loanType")}
          options={LOAN_TYPES.map((t) => ({ value: t, label: t }))}
        />
      </Field>

      <CibilUpload />

      <div className="grid gap-6 sm:grid-cols-2 min-w-0">
        <Field label="What is your latest credit score (CIBIL score), if you know it?" htmlFor="bureauCibilScore">
          <TextInput id="bureauCibilScore" type="number" value={draft.bureauCibilScore} onChange={(v) => set("bureauCibilScore", num(v))} numeric verified={locked} disabled={locked} />
        </Field>

        <Field label="Total ongoing monthly loan EMI obligations (₹)" htmlFor="existingEmi">
          <TextInput
            id="existingEmi"
            type="number"
            value={draft.existingEmi}
            onChange={(v) => {
              const val = num(v);
              set("existingEmi", val);
              useOnboardingStore.getState().setExistingEmi(val === "" ? "" : Number(val));
            }}
            numeric
            verified={locked}
            disabled={locked}
          />
        </Field>
      </div>

      <Field label="Have you ever missed a loan payment, or paid one late?" htmlFor="hasMissedPayment">
        <RadioCards
          name="hasMissedPayment"
          label="Have you ever missed a loan payment, or paid one late?"
          value={yn(draft.hasMissedPayment)}
          onChange={(v) => set("hasMissedPayment", v === "yes")}
          options={YES_NO}
          disabled={locked}
        />
      </Field>

      {/* Several banks reject ANY late payment, the rest tolerate up to 89 days. */}
      {draft.hasMissedPayment && (
        <Field label="Was any payment more than 90 days late?" htmlFor="missedOver90">
          <RadioCards
            name="missedOver90"
            label="Was any payment more than 90 days late?"
            value={yn(draft.missedOver90)}
            onChange={(v) => set("missedOver90", v === "yes")}
            options={YES_NO}
            disabled={locked}
          />
        </Field>
      )}

      <Field label="Has any bank checked your credit for a new loan recently?" htmlFor="bureauLoanEnquiry">
        <RadioCards
          name="bureauLoanEnquiry"
          label="Has any bank checked your credit for a new loan recently?"
          value={yn(draft.bureauLoanEnquiry)}
          onChange={(v) => set("bureauLoanEnquiry", v === "yes")}
          options={YES_NO}
          disabled={locked}
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2 min-w-0">
        <Field label="How much do you currently owe in overdue payments? (₹)" htmlFor="bureauCurrentlyOutstanding">
          <TextInput id="bureauCurrentlyOutstanding" type="number" value={draft.bureauCurrentlyOutstanding} onChange={(v) => set("bureauCurrentlyOutstanding", num(v))} numeric verified={locked} disabled={locked} />
        </Field>
        {draft.entityType === "Individual" && <AgeAtLastEmi />}
      </div>

      <Field label="Do you have any loan or card that a bank settled or wrote off?" htmlFor="hasWriteOff">
        <RadioCards
          name="hasWriteOff"
          label="Do you have any loan or card that a bank settled or wrote off?"
          value={yn(draft.hasWriteOff)}
          onChange={(v) => set("hasWriteOff", v === "yes")}
          options={YES_NO}
          disabled={locked}
        />
      </Field>

      {draft.hasWriteOff && (
        <>
          <fieldset className="min-w-0 rounded-md border border-line p-4">
            <legend className="px-2 text-[0.9375rem] font-medium text-ink-muted">
              Which of these was written off? Tick all that apply.
            </legend>
            <div className="grid gap-1 sm:grid-cols-2 min-w-0">
              {WRITE_OFF_FLAGS.map((flag) => (
                <Checkbox
                  key={flag.key}
                  id={flag.key}
                  checked={draft[flag.key]}
                  onChange={(v) => set(flag.key, v)}
                  label={flag.label}
                  disabled={locked}
                />
              ))}
            </div>
          </fieldset>

          {draft.bureauFlagCC && (
            <Field label="How much was written off on the credit card? (₹)" htmlFor="bureauWriteOffAmount">
              <TextInput id="bureauWriteOffAmount" type="number" value={draft.bureauWriteOffAmount} onChange={(v) => set("bureauWriteOffAmount", num(v))} numeric verified={locked} disabled={locked} />
            </Field>
          )}
        </>
      )}

      <Checkbox
        id="cibilPlScoreToggle"
        checked={draft.cibilPlScoreToggle}
        onChange={(v) => set("cibilPlScoreToggle", v)}
        label="I also know my separate personal-loan credit score"
        disabled={locked}
      />
      {draft.cibilPlScoreToggle && (
        <Field label="What is that personal-loan credit score?" htmlFor="bureauCibilPlScore">
          <TextInput id="bureauCibilPlScore" type="number" value={draft.bureauCibilPlScore} onChange={(v) => set("bureauCibilPlScore", num(v))} numeric verified={locked} disabled={locked} />
        </Field>
      )}
    </div>
  );
}

export default Step4Banking;
