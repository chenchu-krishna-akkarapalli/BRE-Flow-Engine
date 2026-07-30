"use client";

import { Check, ShieldCheck, Sparkles } from "lucide-react";
import { STEP_PLAN, STEP_TITLES, progressFor } from "@/lib/form-schema";
import { workflowFor } from "@/store/useOnboardingStore";
import type { EntityType } from "@/lib/types";

/**
 * Premium Stepper Component - Day Mode
 * Features:
 * - Animated Circular Gauge
 * - Sleek Horizontal Progress Bar
 * - Touch-friendly Step Pills with light mode state indicators
 */
export function Stepper({
  entityType,
  stepId,
  onJump,
}: {
  entityType: EntityType;
  stepId: number;
  onJump: (id: number) => void;
}) {
  const plan = STEP_PLAN[entityType];
  const percent = progressFor(entityType, stepId);
  const allSteps = [1, 2, 3, 4, 5];
  const isCorporate = workflowFor(entityType) === "COMPANY";

  // Circular progress SVG calculations (radius 18, circumference ~113.1)
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (percent / 100) * circumference;

  return (
    <nav aria-label="Onboarding wizard progress" className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div className="flex items-center gap-4">
          {/* Circular Progress Gauge */}
          <div className="relative flex h-14 w-14 items-center justify-center shrink-0">
            <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 44 44">
              <circle
                cx="22"
                cy="22"
                r={radius}
                className="stroke-line"
                strokeWidth="4"
                fill="transparent"
              />
              <circle
                cx="22"
                cy="22"
                r={radius}
                className="stroke-brand-500 transition-all duration-500 ease-out"
                strokeWidth="4"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <span className="numeric absolute text-[0.8125rem] font-bold tracking-tighter text-ink">
              {percent}%
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-brand-600 font-bold flex items-center gap-1">
                <Sparkles size={13} /> Step {plan.indexOf(stepId) + 1} of {plan.length}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.75rem] font-medium border ${
                  isCorporate
                    ? "border-info/30 bg-info-bg text-info"
                    : "border-brand-500/30 bg-brand-500/10 text-brand-600"
                }`}
              >
                <ShieldCheck size={12} />
                {isCorporate ? "Corporate Engine" : "Individual Engine"}
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-ink mt-0.5">
              {STEP_TITLES[stepId]}
            </h1>
          </div>
        </div>

        {/* Step Track Summary */}
        <div className="text-right hidden sm:block">
          <p className="text-xs text-ink-subtle">Target Evaluation SLA</p>
          <p className="numeric text-sm font-bold text-brand-600">&lt; 30 ms Instant Verdict</p>
        </div>
      </div>

      {/* Sleek Progress Track */}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-bg-raised p-0.5 border border-line"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 via-brand-indigo to-brand-violet transition-all duration-300 ease-out shadow-glow"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Interactive Step Navigation Pills */}
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {allSteps.map((id) => {
          const active = id === stepId;
          const included = plan.includes(id);
          const done = included && plan.indexOf(id) < plan.indexOf(stepId);

          if (!included) {
            return (
              <li
                key={id}
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-line bg-bg-raised px-3 py-2 text-center text-xs text-ink-subtle line-through cursor-not-allowed"
                title="Not applicable for Corporate applicants"
              >
                <span>{id}.</span>
                <span className="truncate">{STEP_TITLES[id]}</span>
              </li>
            );
          }

          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onJump(id)}
                aria-current={active ? "step" : undefined}
                className={`group flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-center text-xs font-semibold transition-all duration-200 ${
                  active
                    ? "border-brand-500 bg-brand-500/10 text-brand-600 shadow-sm ring-1 ring-brand-500/30"
                    : done
                    ? "border-success/40 bg-success-bg text-success hover:border-success"
                    : "border-line bg-white text-ink-muted hover:border-line-strong hover:bg-bg-raised hover:text-ink"
                }`}
              >
                {done ? (
                  <Check size={14} className="shrink-0 text-success" />
                ) : (
                  <span className={`numeric font-bold ${active ? "text-brand-600" : "text-ink-subtle"}`}>
                    0{id}
                  </span>
                )}
                <span className="truncate">{STEP_TITLES[id]}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
