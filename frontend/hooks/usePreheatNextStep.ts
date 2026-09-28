"use client";

import { useEffect } from "react";
import type { Draft } from "@/store/useOnboardingStore";
import { isStepValid } from "@/lib/validation";

/**
 * Pre-fetches the JavaScript chunk for the next wizard step in the background
 * once the active step satisfies all validation constraints.
 *
 * Runs during browser idle time (requestIdleCallback) to prevent competing
 * with user input interactions or main-thread rendering.
 */
export function usePreheatNextStep(currentStep: number, draft: Draft): void {
  useEffect(() => {
    // Only preheat when user inputs in current step are completely valid
    if (!isStepValid(currentStep, draft)) return;

    const schedulePreheat = (callback: () => void) => {
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        const handle = (window as any).requestIdleCallback(callback, { timeout: 2000 });
        return () => (window as any).cancelIdleCallback(handle);
      }
      const timer = setTimeout(callback, 200);
      return () => clearTimeout(timer);
    };

    const cleanup = schedulePreheat(() => {
      const nextStep = currentStep + 1;

      switch (nextStep) {
        case 2:
          void import("@/components/steps/Step2Address");
          break;
        case 3:
          void import("@/components/steps/Step3Occupation");
          break;
        case 4:
          void import("@/components/steps/Step4Banking");
          break;
        case 5:
          void import("@/components/steps/Step5CoApplicant");
          break;
        case 6:
          void import("@/components/steps/Step6Phase1Income");
          break;
        case 7:
          // Pre-warm heavy telemetry & review modals when user is completing Step 6
          void import("@/components/AuditCards");
          void import("@/components/Telemetry");
          void import("@/components/ReviewCard");
          break;
        default:
          break;
      }
    });

    return cleanup;
  }, [currentStep, draft]);
}

export default usePreheatNextStep;
