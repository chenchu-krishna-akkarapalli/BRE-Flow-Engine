"use client";

import type { JSX } from "react";
import { ArrowLeft, ArrowRight, RefreshCw, ShieldCheck, Zap } from "lucide-react";
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
    <div className="flex min-h-screen flex-col bg-bg-deep">
      {/* Top Application Header - Day Mode */}
      <header className="border-b border-line bg-white/90 backdrop-blur-xl sticky top-0 z-40 shadow-xs">
        <div className="mx-auto flex max-w-[var(--shell-max)] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-500 via-brand-indigo to-brand-violet text-white shadow-glow font-bold">
              <Zap size={22} fill="currentColor" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-tight text-lg text-ink font-display">
                  Flow<span className="text-gradient">BRE</span>
                </span>
                <span className="rounded-full bg-brand-500/10 px-2.5 py-0.5 text-[0.6875rem] font-bold text-brand-600 border border-brand-500/20">
                  Engine v2.4
                </span>
              </div>
              <p className="text-xs text-ink-subtle font-medium hidden sm:block">
                Instant Multi-Bank Onboarding &amp; Eligibility Wizard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:flex items-center gap-1.5 rounded-full border border-success/30 bg-success-bg px-3 py-1 text-xs font-bold text-success">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              8 Bank APIs Online
            </span>
          </div>
        </div>
      </header>

      {/* Main Wizard Shell */}
      <main className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-8 px-6 py-8 lg:flex-row lg:items-start">
        {/* Left Form Wizard Column */}
        <div className="flex w-full flex-col gap-6 lg:max-w-[var(--form-col)]">
          {/* Stepper Progress Header */}
          <Stepper entityType={draft.entityType} stepId={stepId} onJump={goTo} />

          {/* Form Step Body Container with Day Mode Glass Panel */}
          <section
            key={stepId}
            className="step-enter glass-panel rounded-2xl p-6 sm:p-8 shadow-sm border border-line bg-white"
          >
            <StepBody />
          </section>

          {/* Final Step Review Card */}
          {isLast && (
            <ReviewCard
              draft={draft}
              onEdit={goTo}
              applicationId={result?.application_id}
            />
          )}

          {/* Verdict Decision Panel */}
          {result && <DecisionPanel result={result} />}

          {/* Detailed Audit Logs */}
          {result && <AuditCards result={result} />}

          {/* Validation & Error Slot */}
          {(result || error) && (
            <div className="validation-slot">
              {result && !result.overall_eligible && (
                <ValidationBanner reasons={result.rejection_reasons} onJump={goTo} />
              )}
              {error && (
                <div role="alert" className="rounded-2xl border border-danger/30 bg-danger-bg p-5 text-sm font-bold text-danger backdrop-blur-xl shadow-xs">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Form Wizard Navigation Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <button
              type="button"
              onClick={prev}
              disabled={isFirst}
              className="flex min-h-[48px] items-center gap-2 rounded-xl border border-line bg-white px-6 py-3 text-sm font-bold text-ink shadow-xs transition-all hover:border-line-strong hover:bg-bg-raised disabled:opacity-40"
            >
              <ArrowLeft size={16} />
              <span>Go back</span>
            </button>

            {isLast ? (
              <div className="flex items-center gap-3">
                {result && (
                  <button
                    type="button"
                    onClick={reset}
                    className="flex min-h-[48px] items-center gap-2 rounded-xl border border-line bg-white px-6 py-3 text-sm font-bold text-ink transition-all hover:bg-bg-raised"
                  >
                    <RefreshCw size={16} />
                    <span>Start again</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="group relative flex min-h-[48px] items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-brand-500 via-brand-indigo to-brand-violet px-8 py-3 text-sm font-extrabold text-white shadow-glow transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_4px_25px_rgba(13,148,136,0.35)] active:scale-[0.98] disabled:opacity-60"
                >
                  <ShieldCheck size={18} />
                  <span>{submitting ? "Checking BRE Engine..." : "See which banks will lend to me"}</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={next}
                className="group flex min-h-[48px] items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-indigo px-8 py-3 text-sm font-extrabold text-white shadow-glow transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_4px_20px_rgba(13,148,136,0.3)] active:scale-[0.98]"
              >
                <span>Next question</span>
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </button>
            )}
          </div>
        </div>

        {/* Right Telemetry Column */}
        <aside className="w-full lg:sticky lg:top-24 lg:max-w-[var(--telemetry-col)]">
          <BankMatrix result={result} />
        </aside>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-line bg-white/60 py-6 text-center text-xs font-medium text-ink-subtle backdrop-blur-xl">
        <p>FlowBRE Engine &copy; {new Date().getFullYear()} — Multi-Bank Rule Evaluation System</p>
      </footer>
    </div>
  );
}
