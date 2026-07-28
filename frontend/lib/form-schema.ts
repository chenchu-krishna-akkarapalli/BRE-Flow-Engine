/** Option sets and step plan transcribed from onboading-form.json.
 *
 * Values are the wire values the backend enum accepts verbatim — including the
 * source spelling of "Gaurantor" and "Propreitorship". Do not "correct" them. */

import type { BankCode, EntityType } from "./types";

export const ENTITY_TYPES: { value: EntityType; label: string }[] = [
  { value: "Individual", label: "Individual" },
  { value: "Company", label: "Company / Organization" },
  { value: "HUF", label: "HUF" },
];

export const GENDERS = ["Male", "Female", "Other"] as const;
export const MARITAL = ["Married", "Unmarried"] as const;
export const CITIZENSHIP = ["Resident Indian", "NRI/PIO"] as const;
export const INDUSTRIES = ["Manufacturing", "Services", "Trading", "Real Estate", "Others"] as const;
export const RESIDENCE = ["Owned House", "Rented House"] as const;

export const EMPLOYER_TYPES = [
  { value: "Employment-Pvt Ltd", label: "Private Limited (Pvt Ltd)" },
  { value: "Employment-Public Ltd", label: "Public Limited" },
  { value: "Employment-Govt", label: "Government Service" },
  { value: "Employment-PSU", label: "Public Sector Undertaking (PSU)" },
  { value: "Employment-Firm", label: "Partnership / Proprietorship Firm" },
];

export const TENURE_BANDS = [
  { value: "0-6m", label: "0 – 6 Months" },
  { value: "6m-1y", label: "6 Months – 1 Year" },
  { value: "1y-2y", label: "1 Year – 2 Years" },
  { value: "2y+", label: "2+ Years" },
] as const;

export const SALARY_BANDS = [
  { value: "lt25000", label: "Less than 25,000" },
  { value: "gt25000", label: "More than 25,000" },
] as const;

export const SALARY_MODES = [
  { value: "Salary payment mode- Bank Credit", label: "Through Bank" },
  { value: "Salary payment mode-Cash", label: "Cash" },
] as const;

export const FORM16_STATUS = [
  { value: "Form 16", label: "Form 16 / ITR Available" },
  { value: "No Income Proof", label: "No Formal Income Proof" },
] as const;

export const RENTAL_INCOME = [
  { value: "None", label: "No Rental Income Claimed" },
  { value: "Rental Income-with Agreement -Not filed ITR-Not reflecting in Bank", label: "Agreement, no ITR, not in bank" },
  { value: "Rental Income-with Agreement filed ITR- Not reflecting in Bank", label: "Agreement, filed ITR, not in bank" },
  { value: "Rental Income-with Agreement -Not filed ITR-reflecting in Bank", label: "Agreement, no ITR, reflecting in bank" },
];

export const BUSINESS_ENTITIES = [
  { value: "Propreitorship", label: "Sole Proprietorship" },
  { value: "Parternship Firm", label: "Partnership Firm" },
  { value: "Private Limited", label: "Private Limited Company" },
  { value: "Public Limited", label: "Public Limited Company" },
  { value: "HUF", label: "Hindu Undivided Family (HUF)" },
  { value: "Agriculture", label: "Agriculture Sector" },
];

export const ITR_FILING = [
  { value: "Self employed ITR Filled", label: "Filed" },
  { value: "ITR Not Filed", label: "Not Filed" },
] as const;

export const ACCOUNT_BANKS = ["BOB", "Indian Bank", "IOB", "BOI", "BOM", "Others"];
export const CAR_LOAN_BANKS = ["None", ...ACCOUNT_BANKS];
export const LOAN_TYPES = ["Auto Loan", "Personal Loan", "Home Loan"] as const;

export const AGE_RELATIONS = ["None", "Brother", "Sister"] as const;
export const INCOME_RELATIONS = ["None", "Father", "Mother", "Brother", "Sister"] as const;

export const BANK_LABELS: Record<BankCode, string> = {
  BOI: "Bank of India",
  INDIAN_BANK: "Indian Bank",
  IOB: "Indian Overseas Bank",
  BOB: "Bank of Baroda",
  BOM: "Bank of Maharashtra",
  HDFC: "HDFC Bank",
  AXIS: "Axis Bank",
  KOTAK: "Kotak Mahindra",
};

export const WRITE_OFF_FLAGS = [
  { key: "bureauFlagPL", label: "PL Write-Off" },
  { key: "bureauFlagHome", label: "Home Loan WO" },
  { key: "bureauFlagConsumer", label: "Consumer WO" },
  { key: "bureauFlagAgri", label: "Agri Loan WO" },
  { key: "bureauFlagMSME", label: "MSME WO" },
  { key: "bureauFlagAuto", label: "Auto Loan WO" },
  { key: "bureauFlagCC", label: "Credit Card WO" },
] as const;

/** Steps collected per entity type. Company skips Address (2) and
 *  Co-Applicant (5) — the API rejects them outright if sent — so a fixed 20%
 *  ladder would strand a Company at 60%. */
export const STEP_PLAN: Record<EntityType, number[]> = {
  Individual: [1, 2, 3, 4, 5],
  HUF: [1, 2, 3, 4, 5],
  Company: [1, 3, 4],
};

export const STEP_TITLES: Record<number, string> = {
  1: "Identity Details",
  2: "Address & Residence",
  3: "Occupation & Business",
  4: "Banking, Bureau & Loan",
  5: "Co-Applicant & Review",
};

export function progressFor(entity: EntityType, stepId: number): number {
  const plan = STEP_PLAN[entity];
  const index = plan.indexOf(stepId);
  if (index === -1) return 0;
  return Math.round(((index + 1) / plan.length) * 100);
}

/** Lower bound of each tenure band in months — the conservative end, matching
 *  the backend's TENURE_BAND_TO_MONTHS. */
export const TENURE_BAND_MONTHS: Record<string, number> = {
  "0-6m": 0, "6m-1y": 6, "1y-2y": 12, "2y+": 24,
};

/** Total employment history in years, mirroring the engine exactly: the
 *  prior-employment span (previous joining -> start of the current job) plus
 *  the current tenure. Shown as helper text so the applicant sees the number
 *  the bank will actually score. */
export function totalWorkExperienceYears(
  prevJoining: string,
  tenureBand: string,
): number | null {
  if (!prevJoining) return null;
  const start = new Date(prevJoining);
  if (Number.isNaN(start.getTime())) return null;

  const DAYS_PER_YEAR = 365.25;
  const tenureYears = (TENURE_BAND_MONTHS[tenureBand] ?? 0) / 12;
  const currentJobStart = new Date(Date.now() - tenureYears * DAYS_PER_YEAR * 864e5);
  const priorSpan = Math.max(
    (currentJobStart.getTime() - start.getTime()) / (DAYS_PER_YEAR * 864e5),
    0,
  );
  return priorSpan + tenureYears;
}

/** Client-side format checks — same regexes the API enforces, so a format
 *  error never costs a round trip. */
export const PATTERNS = {
  pan: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  pincode: /^[1-9][0-9]{5}$/,
  phone: /^[6-9]\d{9}$/,
  email: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
};

/** rule_id prefix -> the step that owns the failing field (ui_ux_design §3). */
export function stepForRule(ruleId: string): number {
  if (ruleId.startsWith("DEM-") || ruleId.startsWith("ENT-50")) return 1;
  if (ruleId.startsWith("RES-")) return 2;
  if (ruleId.startsWith("EMP-") || ruleId.startsWith("INC-")) return 3;
  if (ruleId.startsWith("BUR-") || ruleId.startsWith("EXB-") || ruleId.startsWith("REL-")) return 4;
  if (ruleId.startsWith("COA-")) return 5;
  return 1;
}
