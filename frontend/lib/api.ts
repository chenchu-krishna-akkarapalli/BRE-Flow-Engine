import { redactPii } from "./redact";
import type {
  EvaluationResponse,
  OnboardingFormRequest,
  ValidationErrorItem,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";
const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID ?? "default";

/** A 422 from the backend's discriminated-union validation, mapped to the
 *  step that owns the offending field so the wizard can navigate to it. */
export class FormValidationError extends Error {
  readonly issues: ValidationErrorItem[];
  constructor(issues: ValidationErrorItem[]) {
    super(issues[0]?.msg ?? "The submission failed validation.");
    this.name = "FormValidationError";
    this.issues = issues;
  }
  /** Top-level section the first failure belongs to: identity | address | ... */
  get section(): string | undefined {
    return this.issues[0]?.loc.find(
      (part) => typeof part === "string" && part !== "body",
    ) as string | undefined;
  }
}

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Logging hook — never receives raw PII. */
export function logSubmission(payload: OnboardingFormRequest): void {
  if (process.env.NODE_ENV === "production") return;
  console.info("[onboarding] submitting", redactPii(payload));
}

export async function evaluateOnboardingForm(
  payload: OnboardingFormRequest,
  signal?: AbortSignal,
): Promise<EvaluationResponse> {
  logSubmission(payload);

  const response = await fetch(`${API_BASE}/api/v1/onboarding/evaluate/form`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-ID": TENANT_ID,
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (response.status === 422) {
    const body = (await response.json()) as { detail?: ValidationErrorItem[] };
    throw new FormValidationError(body.detail ?? []);
  }
  if (!response.ok) {
    throw new ApiError(response.status, `Evaluation failed (${response.status}).`);
  }

  return (await response.json()) as EvaluationResponse;
}
