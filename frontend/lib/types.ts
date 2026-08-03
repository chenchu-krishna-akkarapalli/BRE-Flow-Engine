// Wire contract for POST /api/v1/onboarding/evaluate/form, mirroring app/api/schemas/onboarding.py.
// The backend validates with `extra="forbid"`, so a field outside the submitted branch is a 422, not
// a silently ignored key — the payload builder must strip empty values rather than send them.

// HUF is not offered by this wizard. The API still models it; the frontend
// simply never constructs that branch.
export type EntityType = "Individual" | "Company";
export type ProfileType = "Salaried" | "Self-Employed" | "Company";

export const BANK_CODES = [
  "BOI", "INDIAN_BANK", "IOB", "BOB", "BOM", "HDFC", "AXIS", "KOTAK",
] as const;
export type BankCode = (typeof BANK_CODES)[number];

export interface IndividualIdentity {
  entityType: "Individual";
  applicantName: string;
  dob: string;
  gender?: "Male" | "Female" | "Other";
  pan: string;
  maritalStatus?: "Married" | "Unmarried";
  citizenshipStatus: "Resident Indian" | "NRI/PIO";
  nriStayPeriod?: number;
  phone: string;
  email: string;
}

export interface CompanyIdentity {
  entityType: "Company";
  applicantName: string;
  companyName: string;
  companyType: "partnership_firm" | "proprietorship" | "private_limited" | "public_limited";
  companyPan: string;
  companyLocation: string;
  contactPersonName: string;
  contactPersonDesignation?: string;
  companyMobile: string;
  companyEmail: string;
  companyEmployees?: number;
}

export type Identity = IndividualIdentity | CompanyIdentity;

export interface AddressStep {
  pincode: string;
  cityName?: string;
  stateName?: string;
  residentDetails: "Owned House" | "Rented House";
  aadhaarNumber?: string;
}

export interface SalariedOccupation {
  profileType: "Salaried";
  employerType?: string;
  tenureBand: "0-6m" | "6m-1y" | "1y-2y" | "2y+";
  prevCompanyName?: string;
  prevCompanyJoining?: string;
  grossSalary: number;
  salaryMode: "Salary payment mode- Bank Credit" | "Salary payment mode-Cash";
  form16Status: "Form 16" | "ITR" | "No Income Proof";
  // Years of Form 16 on file — required only when Form 16 is claimed.
  form16Years?: number;
  // Required instead of form16Years when the proof offered is an ITR.
  currentYearItr?: number;
  previousYearItr?: number;
  rentalIncomeTypeSalaried: string;
}

export interface SelfEmployedOccupation {
  profileType: "Self-Employed";
  officeAddressType: "Same" | "Separate";
  officeAddress?: string;
  officePremisesStatus?: "Owned" | "Rented";
  guarantorStatus?: "Without a Gaurantor" | "With a Gaurantor";
  businessEntityType: string;
  businessProof?: string;
  businessEstablishmentDate: string;
  currentITRAmount: number;
  prevITRAmount: number;
  businessItrAmount: number;
  rentalIncomeTypeSelfEmployed: string;
}

export interface CompanyBusiness {
  profileType: "Company";
  companyEstablishmentDate: string;
  companyGstin: string;
  companyCurrentITRAmount: number;
  companyPrevITRAmount: number;
  businessItrAmountCompany: number;
}

export type Occupation =
  | SalariedOccupation
  | SelfEmployedOccupation
  | CompanyBusiness;

export interface BankingStep {
  existingAccountBank: string;
  existingCarLoanBank: string;
  loanType: "Auto Loan" | "Personal Loan" | "Home Loan";
  bureauCibilScore: number;
  bureauDpd: number;
  bureauLoanEnquiry: boolean;
  bureauCurrentlyOutstanding: number;
  // Omitted by the wizard; the API derives it from the DOB (age + 7).
  bureauAgeAtLastEMI?: number;
  cibilPlScoreToggle: boolean;
  bureauCibilPlScore?: number;
  bureauFlagPL: boolean;
  bureauFlagHome: boolean;
  bureauFlagConsumer: boolean;
  bureauFlagAgri: boolean;
  bureauFlagMSME: boolean;
  bureauFlagAuto: boolean;
  bureauFlagCC: boolean;
  bureauWriteOffAmount: number;
}

export interface CoApplicantStep {
  coAppAgeRelation: "None" | "Brother" | "Sister";
  coAppIncomeRelation: "None" | "Father" | "Mother" | "Brother" | "Sister";
  coApplicantName?: string;
  coApplicantDob?: string;
  coApplicantOccupation?: "Salaried" | "Self-Employed";
}

export interface OnboardingFormRequest {
  identity: Identity;
  address?: AddressStep;
  occupation: Occupation;
  banking: BankingStep;
  coApplicant?: CoApplicantStep;
}

export interface RejectionReason {
  rule_id: string;
  category: string;
  message: string;
}

export interface RuleOutcome {
  rule_id: string;
  name: string;
  category: string;
  value: string;
  limit: string;
  message: string;
}

export interface BankEvaluationReport {
  is_eligible: boolean;
  passed_rules: RuleOutcome[];
  failed_rules: RuleOutcome[];
}

export interface EvaluationResponse {
  success: boolean;
  status: "APPROVED" | "REJECTED";
  overall_eligible: boolean;
  executed_rules_count: number;
  execution_time_ms: number;
  rejection_reasons: RejectionReason[];
  bank_eligibility: Record<BankCode, boolean>;
  evaluation_report: Record<BankCode, BankEvaluationReport>;
  application_id: string | null;
  entity_type: EntityType;
  selected_bank: BankCode;
  persisted: boolean;
}

// FastAPI 422 body: {"detail": [{loc, msg, type}, ...]}
export interface ValidationErrorItem {
  loc: (string | number)[];
  msg: string;
  type: string;
}
