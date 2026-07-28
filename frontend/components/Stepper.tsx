"use client";

import { Check } from "lucide-react";
import { STEP_PLAN, STEP_TITLES, progressFor } from "@/lib/form-schema";
import { workflowFor } from "@/store/useOnboardingStore";
import type { EntityType } from "@/lib/types";

/** Entity-aware progress rail.
 *
 * Company collects only steps 1, 3 and 4, so progress is computed over the
 * ACTIVE plan (33/67/100) rather than a fixed 20% ladder, which would strand a
 * Company at 60%. Steps dropped by the entity choice render dimmed and struck
 * through rather than vanishing silently. */
export function Stepper({
  entityType, stepId, onJump,
}: {
  entityType: EntityType; stepId: number; onJump: (id: number) => void;
}) {
  const plan = STEP_PLAN[entityType];
  const percent = progressFor(entityType, stepId);
  const allSteps = [1, 2, 3, 4, 5];

  return (
    <nav aria-label="Onboarding progress" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-[1.25rem] font-semibold">{STEP_TITLES[stepId]}</h1>
        <div className="flex items-baseline gap-3">
          {/* Which entity-scoped matrix the backend will score against. */}
          <span
            className={`rounded-sm px-2 py-0.5 text-[0.8125rem] ${
              workflowFor(entityType) === "COMPANY"
                ? "bg-info-bg text-info"
                : "bg-brand-500/15 text-brand-400"
            }`}
          >
            {workflowFor(entityType) === "COMPANY" ? "Corporate" : "Individual"} workflow
          </span>
          <span className="numeric text-[0.8125rem] text-ink-muted">{percent}%</span>
        </div>
      </div>

      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-bg-raised"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-brand-500 transition-[width] duration-[240ms] ease-[var(--ease-in-out)]"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ol className="flex flex-wrap gap-2">
        {allSteps.map((id) => {
          const active = id === stepId;
          const included = plan.includes(id);
          const done = included && plan.indexOf(id) < plan.indexOf(stepId);

          if (!included) {
            return (
              <li
                key={id}
                className="flex min-h-[44px] items-center gap-2 px-2 text-[0.8125rem] text-ink-subtle line-through"
                title="Not collected for Company applicants"
              >
                {STEP_TITLES[id]}
              </li>
            );
          }
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onJump(id)}
                aria-current={active ? "step" : undefined}
                className={`flex min-h-[44px] items-center gap-2 rounded-sm px-2 text-[0.8125rem] transition-colors ${
                  active ? "text-brand-400" : done ? "text-success" : "text-ink-muted"
                }`}
              >
                {done && <Check size={14} aria-hidden />}
                {STEP_TITLES[id]}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
