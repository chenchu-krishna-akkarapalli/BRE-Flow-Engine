// Option sets from onboading-form.json. Values are the backend's wire values verbatim, including the
// source spelling of "Gaurantor" and "Propreitorship". Do not "correct" them.

import type { BankCode, EntityType } from "./types";

export const ENTITY_TYPES: { value: EntityType; label: string }[] = [
  { value: "Individual", label: "Individual" },
  { value: "Company", label: "Company or organisation" },
];

// Reusable yes/no answers, so every binary question reads the same way.
export const YES_NO = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
];

export const GENDERS = ["Male", "Female", "Other"] as const;
export const MARITAL = ["Married", "Unmarried"] as const;
export const CITIZENSHIP = ["Resident Indian", "NRI/PIO"] as const;
// Legal constitution of a corporate applicant (replaces the old industry list).
export const COMPANY_TYPES = [
  { value: "partnership_firm", label: "Partnership Firm" },
  { value: "proprietorship", label: "Proprietorship" },
  { value: "private_limited", label: "Private Limited" },
  { value: "public_limited", label: "Public Limited" },
];
export const RESIDENCE = [
  { value: "Rented House", label: "Rented house" },
  { value: "Owned House", label: "Owned house" },
];

// Helper text under the address-proof upload, per residence type (add-on.md §2.1).
export const ADDRESS_PROOF_HELPER: Record<string, string> = {
  "Rented House": "Please upload your rental agreement document",
  "Owned House": "Please upload your Aadhaar card or electricity bill",
};

// An owned-home applicant picks which document backs the address BEFORE the
// upload appears, because only the Aadhaar card is worth running OCR over.
export const ADDRESS_PROOF_TYPES = [
  { value: "Aadhaar Card", label: "Aadhaar Card" },
  { value: "Electricity Bill", label: "Electricity Bill" },
];

export const ADDRESS_PROOF_DETAIL: Record<string, { label: string; helper: string }> = {
  "Aadhaar Card": {
    label: "Address Proof (Aadhaar Card)",
    helper: "Please upload your Aadhaar Card. The system will read your Aadhaar number automatically.",
  },
  "Electricity Bill": {
    label: "Address Proof (Electricity Bill)",
    helper: "Please upload a copy of your recent electricity bill.",
  },
};

// 1234 5678 9012 — grouped for reading back, never reformatted for the wire.
export function formatAadhaar(digits: string): string {
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

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

// Answers to the "more than Rs 25,000 a month?" question; the values are what the API expects.
export const SALARY_BANDS = [
  { value: "gt25000", label: "Yes, more than ₹25,000" },
  { value: "lt25000", label: "No, ₹25,000 or less" },
] as const;

export const SALARY_MODES = [
  { value: "Salary payment mode- Bank Credit", label: "Into my bank account" },
  { value: "Salary payment mode-Cash", label: "In cash" },
] as const;

export const INCOME_PROOF = [
  { value: "Form 16", label: "Form 16" },
  { value: "ITR", label: "ITR" },
  { value: "No Income Proof", label: "No income proof" },
] as const;

// Shown only when the rental-income radio is Yes. "None" is not an option here
// — answering No is what sets it.
export const RENTAL_INCOME = [
  { value: "Rental Income-with Agreement -Not filed ITR-Not reflecting in Bank", label: "Yes — I have a rent agreement, but no tax return, and the rent is not paid into my bank" },
  { value: "Rental Income-with Agreement filed ITR- Not reflecting in Bank", label: "Yes — I have a rent agreement and a tax return, but the rent is not paid into my bank" },
  { value: "Rental Income-with Agreement -Not filed ITR-reflecting in Bank", label: "Yes — I have a rent agreement and the rent is paid into my bank, but no tax return" },
];

export const BUSINESS_ENTITIES = [
  { value: "Propreitorship", label: "I run it on my own (sole proprietorship)" },
  { value: "Parternship Firm", label: "A partnership firm" },
  { value: "Private Limited", label: "A private limited company" },
  { value: "Public Limited", label: "A public limited company" },
  { value: "Agriculture", label: "Farming or agriculture" },
];

// One option per partner bank, matching ExistingBankOption on the backend.
// A bank missing from this list cannot be selected, and because the private
// banks require an existing account relationship it would then be rejected by
// REL-501 on every submission rather than simply being unavailable.
export const ACCOUNT_BANKS = [
  "BOB", "Indian Bank", "IOB", "BOI", "BOM", "HDFC", "Axis", "Kotak", "Others",
];
export const CAR_LOAN_BANKS = ["None", ...ACCOUNT_BANKS];
export const LOAN_TYPES = ["Auto Loan", "Personal Loan", "Home Loan"] as const;

export const AGE_RELATIONS = [
  { value: "None", label: "No one — just me" },
  { value: "Brother", label: "My brother" },
  { value: "Sister", label: "My sister" },
  { value: "Son", label: "My son" },
  { value: "Daughter", label: "My daughter" },
];
export const INCOME_RELATIONS = [
  { value: "None", label: "No one — just my own income" },
  { value: "Father", label: "My father" },
  { value: "Mother", label: "My mother" },
  { value: "Brother", label: "My brother" },
  { value: "Sister", label: "My sister" },
  { value: "Son", label: "My son" },
  { value: "Daughter", label: "My daughter" },
];

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
  { key: "bureauFlagPL", label: "A personal loan" },
  { key: "bureauFlagHome", label: "A home loan" },
  { key: "bureauFlagConsumer", label: "A consumer loan (phone, TV, appliance)" },
  { key: "bureauFlagAgri", label: "A farm or agriculture loan" },
  { key: "bureauFlagMSME", label: "A small-business (MSME) loan" },
  { key: "bureauFlagAuto", label: "A car or vehicle loan" },
  { key: "bureauFlagCC", label: "A credit card" },
] as const;

// Steps per entity type. Company skips Address (2) and Co-Applicant (5), which the API rejects if sent.
export const STEP_PLAN: Record<EntityType, number[]> = {
  Individual: [1, 2, 3, 4, 5],
  Company: [1, 3, 4],
};

export const STEP_TITLES: Record<number, string> = {
  1: "About you",
  2: "Where you live",
  3: "Your work and income",
  4: "Your banking and credit history",
  5: "Anyone applying with you",
  6: "Results & Audit",
};

export function progressFor(entity: EntityType, stepId: number): number {
  const plan = STEP_PLAN[entity];
  const index = plan.indexOf(stepId);
  if (index === -1) return 0;
  return Math.round(((index + 1) / plan.length) * 100);
}

// Lower bound of each tenure band in months, matching the backend's TENURE_BAND_TO_MONTHS.
export const TENURE_BAND_MONTHS: Record<string, number> = {
  "0-6m": 0, "6m-1y": 6, "1y-2y": 12, "2y+": 24,
};

// Total employment years, mirroring the engine: prior-employment span plus current tenure.
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

// Client-side format checks — the same regexes the API enforces.
export const PATTERNS = {
  pan: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  pincode: /^[1-9][0-9]{5}$/,
  phone: /^[6-9]\d{9}$/,
  email: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
};

// rule_id prefix -> the step that owns the failing field (ui_ux_design §3).
export function stepForRule(ruleId: string): number {
  if (ruleId.startsWith("DEM-") || ruleId.startsWith("ENT-50")) return 1;
  if (ruleId.startsWith("RES-") || ruleId.startsWith("REL-502")) return 2;
  if (ruleId.startsWith("EMP-") || ruleId.startsWith("INC-")) return 3;
  if (ruleId.startsWith("BUR-") || ruleId.startsWith("EXB-") || ruleId.startsWith("REL-")) return 4;
  if (ruleId.startsWith("COA-")) return 5;
  return 1;
}
