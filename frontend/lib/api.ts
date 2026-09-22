import { redactPii } from "./redact";
import type {
  EvaluationResponse,
  OnboardingFormRequest,
  Phase1IncomeCalculationRequest,
  Phase1IncomeCalculationResponse,
  Phase2FoirCalculationResponse,
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
  document_type: "pan" | "aadhaar" | "itr";
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
  documentType: "pan" | "aadhaar" | "itr",
  file: File,
): Promise<DocumentExtraction> {
  if (documentType === "itr") {
    const itrRes = await extractItrDocument(file);
    const income = itrRes.data?.taxable_income_and_tax_details?.total_income;
    const taxAndFee = itrRes.data?.taxable_income_and_tax_details?.total_tax_interest_and_fee_payable;
    const pan = itrRes.data?.assessee_info?.pan;
    const name = itrRes.data?.assessee_info?.name;
    const ack = itrRes.data?.return_details?.acknowledgement_number;
    return {
      document_type: "itr",
      filename: file.name,
      size_bytes: file.size,
      populated: true,
      simulated: false,
      extracted: {
        total_income: income !== undefined && income !== null ? String(income) : "",
        total_tax_interest_and_fee_payable: taxAndFee !== undefined && taxAndFee !== null ? String(taxAndFee) : "",
        pan: pan ?? "",
        name: name ?? "",
        acknowledgement_number: ack ?? "",
      },
    };
  }

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

// The CIBIL report is parsed by the Rust engine and discarded; only these
// bureau fields come back, keyed to the wizard's own draft fields.
export interface CibilExtraction {
  success: boolean;
  filename: string;
  size_bytes: number;
  // SUCCESS | UNKNOWN_CONSUMER | DUPLICATE_DOCUMENT — only SUCCESS carries fields.
  status: string;
  message: string;
  extracted: Record<string, string | number | boolean | null>;
}

export async function extractCibilReport(file: File): Promise<CibilExtraction> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${API_BASE}/api/v1/onboarding/documents/cibil/extract`, {
    method: "POST",
    headers: { "X-Tenant-ID": TENANT_ID },
    body: form,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body?.detail ?? `CIBIL parsing failed (${response.status}).`);
  }
  return (await response.json()) as CibilExtraction;
}

export interface PayslipExtraction {
  filename: string;
  extraction_status: string;
  message: string;
  extracted: Record<string, string | number | boolean | null>;
}

export async function extractPayslipReport(file: File): Promise<PayslipExtraction> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${API_BASE}/api/v1/onboarding/documents/payslip/extract`, {
    method: "POST",
    headers: { "X-Tenant-ID": TENANT_ID },
    body: form,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body?.detail ?? `Payslip parsing failed (${response.status}).`);
  }
  return (await response.json()) as PayslipExtraction;
}

export interface CoiExtraction {
  filename: string;
  extraction_status: string;
  message: string;
  extracted: Record<string, unknown>;
}

// single concise context line
export async function extractCoiReport(file: File): Promise<CoiExtraction> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${API_BASE}/api/v1/onboarding/documents/coi/extract`, {
    method: "POST",
    headers: { "X-Tenant-ID": TENANT_ID },
    body: form,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body?.detail ?? `COI parsing failed (${response.status}).`);
  }
  return (await response.json()) as CoiExtraction;
}

export interface ItrExtraction {
  status: string;
  data: {
    _meta?: { ocr_used: boolean; source: string };
    assessee_info?: {
      pan?: string;
      name?: string;
      address?: string;
      status?: string;
      assessment_year?: string;
      financial_year?: string;
    };
    return_details?: {
      form_number?: string;
      filed_u_s?: string;
      acknowledgement_number?: string;
      date_of_filing?: string;
    };
    taxable_income_and_tax_details?: {
      current_year_business_loss?: number;
      total_income?: number;
      book_profit_under_mat?: number;
      adjusted_total_income_under_amt?: number;
      net_tax_payable?: number;
      interest_and_fee_payable?: number;
      total_tax_interest_and_fee_payable?: number;
      taxes_paid?: number;
      tax_payable_or_refundable?: number;
    };
    accreted_income_and_tax_details?: Record<string, unknown>;
    verification_details?: Record<string, unknown>;
  };
}

export async function extractItrDocument(file: File): Promise<ItrExtraction> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${API_BASE}/api/v1/onboarding/documents/itr/extract`, {
    method: "POST",
    headers: { "X-Tenant-ID": TENANT_ID },
    body: form,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body?.detail ?? `ITR parsing failed (${response.status}).`);
  }
  return (await response.json()) as ItrExtraction;
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

export async function calculatePhase1Income(
  payload: Phase1IncomeCalculationRequest,
): Promise<Phase1IncomeCalculationResponse> {
  const response = await fetch(`${API_BASE}/api/v1/onboarding/income/phase1-calculate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-ID": TENANT_ID,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      body?.detail ?? `Phase 1 income calculation failed (${response.status}).`,
    );
  }
  return (await response.json()) as Phase1IncomeCalculationResponse;
}

export async function calculatePhase2Foir(params: {
  average_income: number;
  occupation: string;
  existing_emi: number;
}): Promise<Phase2FoirCalculationResponse> {
  const response = await fetch(`${API_BASE}/api/v1/onboarding/income/phase2-foir`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-ID": TENANT_ID,
    },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      body?.detail ?? `Phase 2 FOIR calculation failed (${response.status}).`,
    );
  }
  return (await response.json()) as Phase2FoirCalculationResponse;
}


