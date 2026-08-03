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


/** Fetch an export and hand it to the browser as a native download.
 *
 * The endpoint streams a binary with a Content-Disposition filename; fetching
 * it as a blob (rather than navigating) keeps the X-Tenant-ID header on the
 * request, which a plain <a href> could not carry. */
export async function downloadApplicationExport(
  applicationId: string,
  format: "pdf" | "excel",
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/api/v1/onboarding/applications/${applicationId}/export?format=${format}`,
    { headers: { "X-Tenant-ID": TENANT_ID } },
  );
  if (!response.ok) {
    throw new ApiError(response.status, `Export failed (${response.status}).`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `flowbre-eligibility-${applicationId}.${format === "pdf" ? "pdf" : "xlsx"}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}


// --------------------------------------------------------------------------- //
// Document extraction & OTP verification (add-on.md)
// --------------------------------------------------------------------------- //

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_UPLOAD_TYPES = ["image/jpeg", "image/png", "application/pdf"];

export interface DocumentExtraction {
  document_type: "pan" | "aadhaar";
  filename: string;
  size_bytes: number;
  extracted: Record<string, string | null>;
  populated: boolean;
  // True when the OCR stack was unavailable and the fields came from a
  // filename scan — never present these as read off the document.
  simulated: boolean;
}

// The file is posted, read and discarded; nothing is stored server-side.
export async function extractDocument(
  documentType: "pan" | "aadhaar",
  file: File,
): Promise<DocumentExtraction> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(
    `${API_BASE}/api/v1/onboarding/documents/${documentType}/extract`,
    { method: "POST", headers: { "X-Tenant-ID": TENANT_ID }, body: form },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body?.detail ?? `Extraction failed (${response.status}).`);
  }
  return (await response.json()) as DocumentExtraction;
}

export interface OtpChallenge {
  challenge_id: string;
  channel: "email" | "mobile";
  sent_to: string;
  expires_in_seconds: number;
  demo_code?: string | null;
}

export async function sendOtp(channel: "email" | "mobile", target: string): Promise<OtpChallenge> {
  const response = await fetch(`${API_BASE}/api/v1/onboarding/verification/otp/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Tenant-ID": TENANT_ID },
    body: JSON.stringify({ channel, target }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body?.detail ?? `Could not send a code (${response.status}).`);
  }
  return (await response.json()) as OtpChallenge;
}

export async function verifyOtp(
  challengeId: string,
  code: string,
): Promise<{ verified: boolean; attempts_remaining: number }> {
  const response = await fetch(`${API_BASE}/api/v1/onboarding/verification/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Tenant-ID": TENANT_ID },
    body: JSON.stringify({ challenge_id: challengeId, code }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body?.detail ?? `Verification failed (${response.status}).`);
  }
  return (await response.json()) as { verified: boolean; attempts_remaining: number };
}
