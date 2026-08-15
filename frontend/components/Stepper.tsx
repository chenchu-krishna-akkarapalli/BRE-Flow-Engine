"use client";

import { ShieldCheck, Sparkles } from "lucide-react";
import { STEP_PLAN, STEP_TITLES } from "@/lib/form-schema";
import { workflowFor } from "@/store/useOnboardingStore";
import type { EntityType } from "@/lib/types";

interface StepperProps {
  entityType: EntityType;
  stepId: number;
  onJump: (id: number) => void;
}

/**
 * Redesigned Clutter-Free Stepper Component
 * Features:
 * - Single-row Ultra-Clean Header with active step title, step count, and engine badge
 * - Segmented Linear Progress Track with interactive hover tooltips and seamless onJump navigation
 * - Complete removal of circular SVG, redundant SLA text, and truncated button grids
 */
export function Stepper({ entityType, stepId, onJump }: StepperProps) {
  const plan = STEP_PLAN[entityType];
  const isCorporate = workflowFor(entityType) === "COMPANY";
  const activePlanSteps = [...plan, 6];

  const totalStepsCount = plan.length;
  const currentStepNumber =
    stepId === 6 ? totalStepsCount : plan.indexOf(stepId) + 1;

  return (
    <nav
      aria-label="Onboarding wizard progress"
      className="flex flex-col gap-3.5 rounded-2xl border border-line bg-white p-4 sm:p-5 shadow-xs backdrop-blur-md"
    >
      {/* 1. Ultra-Clean Header Grid */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="shrink-0 rounded-lg bg-brand-500/10 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider text-brand-600 border border-brand-500/20 flex items-center gap-1 font-mono">
            <Sparkles size={13} className="text-brand-500" />
            {stepId === 6 ? "Verdict" : `Step ${currentStepNumber} of ${totalStepsCount}`}
          </span>
          <h1 className="truncate text-base sm:text-lg font-extrabold tracking-tight text-ink font-display">
            {STEP_TITLES[stepId]}
          </h1>
        </div>

        {/* Workflow Engine Badge */}
        <div className="shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border ${
              isCorporate
                ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-700"
                : "border-brand-500/30 bg-brand-500/10 text-brand-600"
            }`}
          >
            <ShieldCheck size={13} />
            {isCorporate ? "Corporate Engine" : "Individual Engine"}
          </span>
        </div>
      </div>

      {/* 2. Segmented Linear Progress Track */}
      <div
        className="flex items-center gap-1.5 w-full"
        role="progressbar"
        aria-valuenow={currentStepNumber}
        aria-valuemin={1}
        aria-valuemax={totalStepsCount}
      >
        {activePlanSteps.map((id, index) => {
          const isStep6 = id === 6;
          const isActive = id === stepId;
          const isDone =
            stepId === 6 ? id !== 6 : plan.indexOf(id) < plan.indexOf(stepId);
          const stepNumber = isStep6 ? totalStepsCount + 1 : plan.indexOf(id) + 1;
          const stepLabel = isStep6 ? "Results & Audit" : STEP_TITLES[id];

          return (
            <div key={id} className="relative flex-1 group">
              {/* Tooltip Overlay */}
              <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 opacity-0 transition-all duration-200 group-hover:opacity-100 z-30 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 text-[0.6875rem] font-bold text-white shadow-lg after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-ink">
                {isStep6 ? stepLabel : `Step ${stepNumber}: ${stepLabel}`}
              </div>

              {/* Segment Pill Button */}
              <button
                type="button"
                onClick={() => onJump(id)}
                aria-label={`Jump to ${stepLabel}`}
                className={`h-2.5 w-full rounded-full transition-all duration-300 ${
                  isDone
                    ? "bg-gradient-to-r from-brand-500 via-brand-indigo to-brand-violet hover:opacity-90 shadow-xs"
                    : isActive
                    ? "bg-brand-500 ring-2 ring-brand-500/40 ring-offset-1 shadow-glow"
                    : "bg-line hover:bg-line-strong"
                }`}
              />
            </div>
          );
        })}
      </div>
    </nav>
  );
}
