"use client";

import type { JSX } from "react";
import { AuditCards } from "@/components/AuditCards";
import { ReviewCard } from "@/components/ReviewCard";
import { Stepper } from "@/components/Stepper";
import { BankMatrix, DecisionPanel, ValidationBanner } from "@/components/Telemetry";
import {
  Step1Identity, Step2Address, Step3Occupation, Step4Banking, Step5CoApplicant,
} from "@/components/steps/Steps";
import { STEP_PLAN } from "@/lib/form-schema";
import { useOnboardingStore } from "@/store/useOnboardingStore";

const STEP_COMPONENTS: Record<number, () => JSX.Element> = {
  1: Step1Identity,
  2: Step2Address,
  3: Step3Occupation,
  4: Step4Banking,
  5: Step5CoApplicant,
};

export default function OnboardingWizard() {
  const draft = useOnboardingStore((s) => s.draft);
  const stepId = useOnboardingStore((s) => s.stepId);
  const submitting = useOnboardingStore((s) => s.submitting);
  const result = useOnboardingStore((s) => s.result);
  const error = useOnboardingStore((s) => s.error);
  const goTo = useOnboardingStore((s) => s.goTo);
  const next = useOnboardingStore((s) => s.next);
  const prev = useOnboardingStore((s) => s.prev);
  const submit = useOnboardingStore((s) => s.submit);
  const reset = useOnboardingStore((s) => s.reset);

  const plan = STEP_PLAN[draft.entityType];
  const isFirst = plan.indexOf(stepId) === 0;
  const isLast = plan.indexOf(stepId) === plan.length - 1;
  const StepBody = STEP_COMPONENTS[stepId];

  return (
    <main className="mx-auto flex w-full max-w-[var(--shell-max)] flex-col gap-8 px-6 py-12 lg:flex-row lg:items-start">
      <div className="flex w-full flex-col gap-6 lg:max-w-[var(--form-col)]">
        <Stepper entityType={draft.entityType} stepId={stepId} onJump={goTo} />

        <section key={stepId} className="step-enter glass rounded-lg p-6">
          <StepBody />
        </section>

        {isLast && <ReviewCard draft={draft} onEdit={goTo} />}

        {result && <DecisionPanel result={result} />}

        {/* Per-bank audit trail + document exports. */}
        {result && <AuditCards result={result} />}

        {/* Height reserved up front so the panel fills in place (no CLS). */}
        {(result || error) && (
          <div className="validation-slot">
            {result && !result.overall_eligible && (
              <ValidationBanner reasons={result.rejection_reasons} onJump={goTo} />
            )}
            {error && (
              <p role="alert" className="rounded-md border border-danger/40 bg-danger-bg p-4 text-[0.9375rem] text-danger">
                {error}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={prev}
            disabled={isFirst}
            className="min-h-[44px] rounded-md border border-line px-6 py-3 text-[0.9375rem] text-ink-muted transition-colors hover:border-line-strong disabled:opacity-40"
          >
            Back
          </button>

          {isLast ? (
            <div className="flex gap-3">
              {result && (
                <button
                  type="button"
                  onClick={reset}
                  className="min-h-[44px] rounded-md border border-line px-6 py-3 text-[0.9375rem] text-ink-muted"
                >
                  Start over
                </button>
              )}
              {/* No spinner: the verdict returns inside the ~100 ms SLA, where a
                  spinner would flash and read as a glitch (ui_ux_design §3.4). */}
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="min-h-[44px] rounded-md bg-brand-600 px-6 py-3 text-[0.9375rem] font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
              >
                {submitting ? "Evaluating…" : "Submit application"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={next}
              className="min-h-[44px] rounded-md bg-brand-600 px-6 py-3 text-[0.9375rem] font-medium text-white transition-colors hover:bg-brand-700"
            >
              Continue
            </button>
          )}
        </div>
      </div>

      <aside className="w-full lg:sticky lg:top-12 lg:max-w-[var(--telemetry-col)]">
        <BankMatrix result={result} />
      </aside>
    </main>
  );
}
