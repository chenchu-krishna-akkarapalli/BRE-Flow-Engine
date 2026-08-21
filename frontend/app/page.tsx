"use client";

import { useState } from "react";
import type { JSX } from "react";
import { ArrowLeft, ArrowRight, RefreshCw, ShieldCheck, Zap } from "lucide-react";
import { AuditCards } from "@/components/AuditCards";
import { ReviewCard } from "@/components/ReviewCard";
import { Stepper } from "@/components/Stepper";
import { BankMatrix, DecisionPanel } from "@/components/Telemetry";
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

  const [showSummary, setShowSummary] = useState(false);
  const [submittingApplication, setSubmittingApplication] = useState(false);

  const plan = STEP_PLAN[draft.entityType];
  const isFirst = plan.indexOf(stepId) === 0;
  const isLast = plan.indexOf(stepId) === plan.length - 1;
  const StepBody = STEP_COMPONENTS[stepId];

  const handleEvaluate = async () => {
    await submit();
    const currentError = useOnboardingStore.getState().error;
    if (!currentError) {
      setShowSummary(true);
    }
  };

  const handleJump = (id: number) => {
    if (id === 6 && !result) return;
    goTo(id);
  };

  const handleSubmitApplication = async () => {
    if (submittingApplication) return;
    setSubmittingApplication(true);
    try {
      // Simulate submission loading time for visual indicator and preventing duplicate clicks
      await new Promise((resolve) => setTimeout(resolve, 800));
      setShowSummary(false);
      goTo(6); // Navigate to Step 6
    } finally {
      setSubmittingApplication(false);
    }
  };

  const handleReset = () => {
    setShowSummary(false);
    reset();
  };

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
      <main className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-8 px-6 pt-4 pb-8 lg:flex-row lg:items-start animate-fade-in">
        {stepId === 6 ? (
          /* Step 6 Content - Side-by-side layout on large screens */
          <div className="flex w-full flex-col gap-8 lg:flex-row lg:items-start max-w-[var(--shell-max)] mx-auto animate-in fade-in duration-300">
            {/* Left Column: Full Audit Trail */}
            <div className="flex w-full flex-col gap-6 lg:max-w-[var(--form-col)]">
              {/* Stepper Progress Header */}
              <Stepper entityType={draft.entityType} stepId={stepId} onJump={handleJump} />

              {result && <DecisionPanel result={result} />}
              {result && <AuditCards result={result} />}
              
              {/* Start Again button at the bottom of the left column */}
              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex min-h-[48px] items-center gap-2 rounded-xl border border-line bg-white px-6 py-3 text-sm font-bold text-ink transition-all hover:bg-bg-raised"
                >
                  <RefreshCw size={16} />
                  <span>Start again</span>
                </button>
              </div>
            </div>

            {/* Right Column: BRE Telemetry Matrix */}
            <aside className="w-full lg:sticky lg:top-24 lg:max-w-[var(--telemetry-col)]">
              <BankMatrix result={result} />
            </aside>
          </div>
        ) : (
          /* Normal Onboarding Steps 1 to 5 */
          <>
            {/* Left Form Wizard Column */}
            <div className="flex w-full flex-col gap-6 lg:max-w-[var(--form-col)]">
              {/* Stepper Progress Header */}
              <Stepper entityType={draft.entityType} stepId={stepId} onJump={handleJump} />

              {/* Form Step Body Container with Day Mode Glass Panel */}
              <section
                key={stepId}
                className="step-enter glass-panel rounded-2xl p-6 sm:p-8 shadow-sm border border-line bg-white"
              >
                {StepBody && <StepBody />}
              </section>

              {/* Validation & Error Slot */}
              {error && (
                <div className="validation-slot">
                  <div role="alert" className="rounded-2xl border border-danger/30 bg-danger-bg p-5 text-sm font-bold text-danger backdrop-blur-xl shadow-xs">
                    {error}
                  </div>
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
                  <button
                    type="button"
                    onClick={handleEvaluate}
                    disabled={submitting}
                    className="group relative flex min-h-[48px] items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-brand-500 via-brand-indigo to-brand-violet px-8 py-3 text-sm font-extrabold text-white shadow-glow transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_4px_25px_rgba(13,148,136,0.35)] active:scale-[0.98] disabled:opacity-60"
                  >
                    <span>{submitting ? "Evaluating Application..." : "Evaluate Application"}</span>
                  </button>
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
              {/* Telemetry Matrix shows PENDING (null) on Steps 1 to 5 */}
              <BankMatrix result={null} />
            </aside>
          </>
        )}
      </main>

      {/* Application Summary Popup Modal */}
      {showSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <ReviewCard
              draft={draft}
              onEdit={(step) => {
                setShowSummary(false);
                goTo(step);
              }}
              applicationId={result?.application_id}
              result={result}
              onSubmitApplication={handleSubmitApplication}
              submittingApplication={submittingApplication}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-auto border-t border-line bg-white/60 py-6 text-center text-xs font-medium text-ink-subtle backdrop-blur-xl">
        <p>FlowBRE Engine &copy; {new Date().getFullYear()} — Multi-Bank Rule Evaluation System</p>
      </footer>
    </div>
  );
}
