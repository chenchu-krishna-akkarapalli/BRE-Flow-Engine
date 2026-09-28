"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import type { JSX } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, ArrowRight, Building2, RefreshCw, ShieldCheck } from "lucide-react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Stepper } from "@/components/Stepper";
import { StepLoadingSkeleton } from "@/components/StepLoadingSkeleton";
import { ResumePromptBanner } from "@/components/ResumePromptBanner";
import { AutoSaveIndicator } from "@/components/AutoSaveIndicator";
import { OfflineAlert } from "@/components/OfflineAlert";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuthStore } from "@/store/useAuthStore";
import { STEP_PLAN } from "@/lib/form-schema";
import { terminationReason, useOnboardingStore } from "@/store/useOnboardingStore";
import type { Draft } from "@/store/useOnboardingStore";
import { isStepValid, validateStep } from "@/lib/validation";
import { usePreheatNextStep } from "@/hooks/usePreheatNextStep";
import { startStepTransition, endStepTransition, initPerformanceObserver } from "@/lib/telemetry";

// Core Synchronous Initial Route
import { Step1Identity } from "@/components/steps/Step1Identity";

// Lazily imported Steps 2–6 with Suspense Skeletons
const Step2Address = dynamic(() => import("@/components/steps/Step2Address").then((m) => m.Step2Address), {
  loading: () => <StepLoadingSkeleton stepNumber={2} />,
});
const Step3Occupation = dynamic(() => import("@/components/steps/Step3Occupation").then((m) => m.Step3Occupation), {
  loading: () => <StepLoadingSkeleton stepNumber={3} />,
});
const Step4Banking = dynamic(() => import("@/components/steps/Step4Banking").then((m) => m.Step4Banking), {
  loading: () => <StepLoadingSkeleton stepNumber={4} />,
});
const Step5CoApplicant = dynamic(() => import("@/components/steps/Step5CoApplicant").then((m) => m.Step5CoApplicant), {
  loading: () => <StepLoadingSkeleton stepNumber={5} />,
});
const Step6Phase1Income = dynamic(() => import("@/components/steps/Step6Phase1Income").then((m) => m.Step6Phase1Income), {
  loading: () => <StepLoadingSkeleton stepNumber={6} />,
});

// Heavy Telemetry & Review Views
const AuditCards = dynamic(() => import("@/components/AuditCards").then((m) => m.AuditCards), {
  loading: () => (
    <div className="flex h-48 items-center justify-center rounded-2xl border border-line bg-white/60">
      <RefreshCw className="animate-spin text-brand-500" size={24} />
    </div>
  ),
});
const DecisionPanel = dynamic(() => import("@/components/Telemetry").then((m) => m.DecisionPanel));
const BankMatrix = dynamic(() => import("@/components/Telemetry").then((m) => m.BankMatrix));
const ReviewCard = dynamic(() => import("@/components/ReviewCard").then((m) => m.ReviewCard));

const OCCUPATION_STEP = 3;

const STEP_COMPONENTS: Record<number, React.ComponentType> = {
  1: Step1Identity,
  2: Step2Address,
  3: Step3Occupation,
  4: Step4Banking,
  5: Step5CoApplicant,
  6: Step6Phase1Income,
};

function isStepCompleted(stepNum: number, draft: Draft): boolean {
  return isStepValid(stepNum, draft);
}

function isStepAccessible(
  targetStep: number,
  draft: Draft,
  plan: number[],
  result: any
): boolean {
  if (targetStep === 7) {
    return !!result;
  }
  if (!plan.includes(targetStep)) {
    return false;
  }
  if (targetStep === plan[0]) {
    return true;
  }
  const targetIndex = plan.indexOf(targetStep);
  for (let i = 0; i < targetIndex; i++) {
    const prevStep = plan[i];
    if (!isStepCompleted(prevStep, draft)) {
      return false;
    }
  }
  return true;
}

function OnboardingWizardContent() {
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

  // Pre-fetch next step chunk during browser idle time when current step inputs are valid
  usePreheatNextStep(stepId, draft);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams();

  const authRole = useAuthStore((s) => s.role);
  const authTenantUuid = useAuthStore((s) => s.tenantUuid);
  const routeTenantUuid = (params?.tenantUuid as string) || authTenantUuid || null;

  useEffect(() => {
    if (routeTenantUuid) {
      useOnboardingStore.getState().setTenantUuid(routeTenantUuid);
    }
    if (authRole) {
      useOnboardingStore.getState().setActiveRole(authRole);
    }
  }, [routeTenantUuid, authRole]);

  const plan = STEP_PLAN[draft.entityType];
  const isFirst = plan.indexOf(stepId) === 0;
  const isLast = plan.indexOf(stepId) === plan.length - 1;
  const StepBody = STEP_COMPONENTS[stepId];

  // Tracking direction of animations
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [lastStepId, setLastStepId] = useState(stepId);

  if (stepId !== lastStepId) {
    setDirection(stepId > lastStepId ? "forward" : "backward");
    setLastStepId(stepId);
  }

  const animationClass = direction === "forward" ? "slide-in-right" : "slide-in-left";

  const lastStepIdRef = useRef<number>(stepId);
  const modalRef = useRef<HTMLDivElement>(null);
  const evaluateBtnRef = useRef<HTMLButtonElement>(null);

  // Synchronize URL query parameter with Zustand store stepId while strictly preserving full pathname
  useEffect(() => {
    const urlStepStr = searchParams.get("step");
    const urlStep = urlStepStr ? parseInt(urlStepStr, 10) : null;

    if (urlStep === null) {
      router.replace(`${pathname}?step=${stepId}`);
      lastStepIdRef.current = stepId;
      return;
    }

    if (urlStep !== stepId) {
      if (lastStepIdRef.current !== stepId) {
        // Store changed (via next, prev, reset, etc.), update URL
        router.push(`${pathname}?step=${stepId}`);
        lastStepIdRef.current = stepId;
      } else {
        // URL changed (via browser back/forward buttons, direct manual input)
        const isValid = urlStep === 7 ? !!result : plan.includes(urlStep);
        const isAccessible = isValid && isStepAccessible(urlStep, draft, plan, result);

        if (isAccessible) {
          startStepTransition(stepId);
          goTo(urlStep);
          lastStepIdRef.current = urlStep;
        } else {
          // Revert URL to last accessible step
          let lastAccessible = plan[0];
          for (const s of plan) {
            if (isStepAccessible(s, draft, plan, result)) {
              lastAccessible = s;
            } else {
              break;
            }
          }
          const fallbackStep = result ? 7 : lastAccessible;
          router.replace(`${pathname}?step=${fallbackStep}`);
          startStepTransition(stepId);
          goTo(fallbackStep);
          lastStepIdRef.current = fallbackStep;
        }
      }
    } else {
      lastStepIdRef.current = stepId;
    }
  }, [searchParams, stepId, draft, result, plan, goTo, router, pathname]);

  // Focus trapping to first interactive input upon step progression & performance metrics
  useEffect(() => {
    endStepTransition(stepId);
    const disconnectObserver = initPerformanceObserver();

    const container = document.getElementById("step-content-region");
    if (container) {
      const firstInput = container.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), button:not([disabled])");
      firstInput?.focus({ preventScroll: true });
    }

    return () => {
      disconnectObserver?.();
    };
  }, [stepId]);

  // Accessibility Focus Trap & Escape key handling for Application Summary Review Modal
  useEffect(() => {
    if (!showSummary) return;

    const modal = modalRef.current;
    if (!modal) return;

    const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableElements = modal.querySelectorAll<HTMLElement>(focusableSelectors);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    firstElement?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setShowSummary(false);
        evaluateBtnRef.current?.focus();
      }

      if (e.key === "Tab") {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showSummary]);

  // add-on.md §5/§6: these end the application where they are answered, so the
  // applicant is told at step 3 rather than after four more steps of questions.
  const termination = stepId === OCCUPATION_STEP ? terminationReason(draft) : null;

  const handleNext = () => {
    const currentValidation = validateStep(stepId, draft);
    if (!currentValidation.isValid) {
      const firstError = Object.values(currentValidation.errors)[0];
      const firstKey = Object.keys(currentValidation.errors)[0];
      if (firstError) {
        useOnboardingStore.setState({ error: firstError });
      }
      if (firstKey) {
        const el = document.getElementById(firstKey);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus();
        }
      }
      return;
    }
    useOnboardingStore.setState({ error: null });
    startStepTransition(stepId);
    next();
  };

  const handlePrev = () => {
    startStepTransition(stepId);
    prev();
  };

  const handleEvaluate = async () => {
    await submit();
    const currentError = useOnboardingStore.getState().error;
    if (!currentError) {
      setShowSummary(true);
    }
  };

  const handleJump = (id: number) => {
    if (id === 7 && !result) return;
    startStepTransition(stepId);
    goTo(id);
  };

  const handleSubmitApplication = async () => {
    if (submittingApplication) return;
    setSubmittingApplication(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setShowSummary(false);
      startStepTransition(stepId);
      goTo(7); // Navigate to Step 7 Results
    } finally {
      setSubmittingApplication(false);
    }
  };

  const handleReset = () => {
    setShowSummary(false);
    reset();
  };

  return (
    <div className="flex w-full flex-1 flex-col justify-between">
      {/* Invisible screen reader announcer for step progression */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {stepId === 7 ? "Evaluating application results" : `Step ${stepId} of ${plan.length}`}
      </div>

      {/* Global Offline Network Alert */}
      <div className="mx-auto w-full max-w-[var(--shell-max)] px-4 sm:px-6 pt-4">
        <OfflineAlert />
      </div>

      {/* Main Wizard Content Shell */}
      <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-8 px-4 sm:px-6 pt-4 pb-8 lg:flex-row lg:items-start animate-fade-in">
        {stepId === 7 ? (
          /* Step 7 Content - Side-by-side layout on large screens */
          <div className={`flex w-full flex-col gap-8 lg:flex-row lg:items-start max-w-[var(--shell-max)] mx-auto ${animationClass}`}>
            {/* Left Column: Full Audit Trail */}
            <div className="flex w-full min-w-0 flex-1 flex-col gap-6 lg:max-w-[var(--form-col)]">
              {/* Stepper Progress Header */}
              <Stepper entityType={draft.entityType} stepId={stepId} onJump={handleJump} />

              <ErrorBoundary name="Verdict Evaluation & Audit Trail">
                {result && <DecisionPanel result={result} />}
                {result && <AuditCards result={result} />}
              </ErrorBoundary>
              
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
            <aside className="w-full shrink-0 lg:sticky lg:top-20 lg:w-[var(--telemetry-col)] lg:max-w-[var(--telemetry-col)]">
              <ErrorBoundary name="Telemetry Bank Matrix">
                <BankMatrix result={result} />
              </ErrorBoundary>
            </aside>
          </div>
        ) : (
          /* Normal Onboarding Steps 1 to 6 */
          <>
            {/* Left Form Wizard Column */}
            <div className="flex w-full min-w-0 flex-1 flex-col gap-6 lg:max-w-[var(--form-col)]">
              {/* Role & Tenant Channel Context Badge */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs backdrop-blur-xs">
                    <Building2 size={13} className="text-teal-600" />
                    <span>Channel: {routeTenantUuid ? routeTenantUuid.slice(0, 8) + "..." : "Global Standard"}</span>
                  </span>
                  {authRole && (
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200/80 bg-teal-50/90 px-3 py-1.5 text-xs font-bold text-teal-800 shadow-2xs">
                      <ShieldCheck size={13} className="text-teal-600" />
                      <span>Role: {authRole.replace(/_/g, " ")}</span>
                    </span>
                  )}
                </div>
                <AutoSaveIndicator />
              </div>

              {/* Stepper Progress Header */}
              <Stepper entityType={draft.entityType} stepId={stepId} onJump={handleJump} />

              {/* Form Step Body Container with ErrorBoundary Protection */}
              <ErrorBoundary name="Form Step">
                <section
                  id="step-content-region"
                  key={stepId}
                  className={`${animationClass} glass-panel w-full min-w-0 rounded-2xl p-6 sm:p-8 shadow-sm border border-line bg-white overflow-hidden`}
                >
                  <Suspense fallback={<StepLoadingSkeleton stepNumber={stepId} />}>
                    {StepBody && <StepBody />}
                  </Suspense>
                </section>
              </ErrorBoundary>

              {/* Terminating condition — the application stops here. */}
              {termination && (
                <div className="validation-slot">
                  <div role="alert" className="rounded-2xl border border-danger/30 bg-danger-bg p-5 text-sm font-bold text-danger backdrop-blur-xl shadow-xs">
                    {termination}
                  </div>
                </div>
              )}

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
                  onClick={handlePrev}
                  disabled={isFirst}
                  className="flex min-h-[48px] items-center gap-2 rounded-xl border border-line bg-white px-6 py-3 text-sm font-bold text-ink shadow-xs transition-all hover:border-line-strong hover:bg-bg-raised disabled:opacity-40 cursor-pointer"
                >
                  <ArrowLeft size={16} />
                  <span>Go back</span>
                </button>

                {isLast ? (
                  <button
                    ref={evaluateBtnRef}
                    type="button"
                    onClick={handleEvaluate}
                    disabled={submitting}
                    className="group relative flex min-h-[48px] items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-brand-500 via-brand-indigo to-brand-violet px-8 py-3 text-sm font-extrabold text-white shadow-glow transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_4px_25px_rgba(13,148,136,0.35)] active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                  >
                    <span>{submitting ? "Evaluating Application..." : "Evaluate Application"}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={termination !== null}
                    className="group flex min-h-[48px] items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-indigo px-8 py-3 text-sm font-extrabold text-white shadow-glow transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_4px_20px_rgba(13,148,136,0.3)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:shadow-none cursor-pointer"
                  >
                    <span>Next question</span>
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                  </button>
                )}
              </div>
            </div>

            {/* Right Telemetry Column */}
            <aside className="w-full shrink-0 lg:sticky lg:top-20 lg:w-[var(--telemetry-col)] lg:max-w-[var(--telemetry-col)] flex flex-col gap-4">
              <ErrorBoundary name="Telemetry Bank Matrix">
                <BankMatrix result={null} />
              </ErrorBoundary>
            </aside>
          </>
        )}
      </div>

      {/* Accessible Application Summary Popup Modal */}
      {showSummary && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="summary-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div
            ref={modalRef}
            className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          >
            <ReviewCard
              draft={draft}
              onEdit={(step) => {
                setShowSummary(false);
                startStepTransition(stepId);
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
      <footer className="border-t border-line bg-white/60 py-6 text-center text-xs font-medium text-ink-subtle backdrop-blur-xl">
        <p>FlowBRE Engine &copy; {new Date().getFullYear()} — Multi-Bank Rule Evaluation System</p>
      </footer>
    </div>
  );
}

export default function OnboardingWizard() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-bg-deep text-ink">
        <RefreshCw className="animate-spin text-brand-500" size={32} />
      </div>
    }>
      <OnboardingWizardContent />
    </Suspense>
  );
}
