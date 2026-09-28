/**
 * High-Precision Performance & Step Transition Telemetry
 * Uses User Timing API (performance.mark / performance.measure) and PerformanceObserver.
 */

let activeTransitionFromStep: number | null = null;
let activeTransitionStartTime: number | null = null;

export interface StepTransitionTelemetry {
  fromStep: number;
  toStep: number;
  durationMs: number;
  timestamp: number;
}

const transitionLogs: StepTransitionTelemetry[] = [];

/**
 * Marks the beginning of a step change interaction.
 */
export function startStepTransition(fromStep: number): void {
  activeTransitionFromStep = fromStep;
  activeTransitionStartTime = typeof performance !== "undefined" ? performance.now() : Date.now();

  if (typeof performance !== "undefined" && "mark" in performance) {
    try {
      performance.mark(`flowbre-step-start-${fromStep}`);
    } catch {
      // Ignore in unsupported environments
    }
  }
}

/**
 * Measures and records completion of a step transition.
 */
export function endStepTransition(toStep: number): StepTransitionTelemetry | null {
  if (activeTransitionFromStep === null || activeTransitionStartTime === null) {
    return null;
  }

  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const durationMs = Math.round((now - activeTransitionStartTime) * 100) / 100;
  const fromStep = activeTransitionFromStep;

  const record: StepTransitionTelemetry = {
    fromStep,
    toStep,
    durationMs,
    timestamp: Date.now(),
  };

  transitionLogs.push(record);
  if (transitionLogs.length > 50) {
    transitionLogs.shift();
  }

  if (typeof performance !== "undefined" && "measure" in performance) {
    try {
      performance.mark(`flowbre-step-end-${toStep}`);
      performance.measure(
        `Step Transition: ${fromStep} -> ${toStep}`,
        `flowbre-step-start-${fromStep}`,
        `flowbre-step-end-${toStep}`,
      );
    } catch {
      // Ignore
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(`[Telemetry] Step ${fromStep} -> ${toStep} transition completed in ${durationMs}ms`);
  }

  activeTransitionFromStep = null;
  activeTransitionStartTime = null;

  return record;
}

export function getRecentTransitions(): readonly StepTransitionTelemetry[] {
  return transitionLogs;
}

/**
 * Initializes PerformanceObserver to monitor long tasks (>50ms) on the main thread.
 */
export function initPerformanceObserver(): (() => void) | undefined {
  if (
    typeof window === "undefined" ||
    !("PerformanceObserver" in window) ||
    process.env.NODE_ENV === "production"
  ) {
    return undefined;
  }

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === "longtask" && entry.duration > 50) {
          console.warn(`[Telemetry:LongTask] Task blocked main thread for ${Math.round(entry.duration)}ms`, entry);
        }
      }
    });

    observer.observe({ entryTypes: ["longtask"] });
    return () => observer.disconnect();
  } catch {
    // longtask observer not supported on all browsers
    return undefined;
  }
}
