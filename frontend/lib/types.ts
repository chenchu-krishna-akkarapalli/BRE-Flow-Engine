/** Wire contract for POST /api/v1/onboarding/evaluate/form.
 *
 * Mirrors app/api/schemas/onboarding.py. The backend validates with
 * `extra="forbid"`, so a field that does not belong to the submitted branch is
 * a 422 — not a silently ignored key. Every optional field below is therefore
 * genuinely omittable, and the payload builder must strip rather than send
 * empty values. */

export type EntityType = "Individual" | "Company" | "HUF";
export type ProfileType = "Salaried" | "Self-Employed" | "HUF" | "Company";

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
  companyIndustryType: "Manufacturing" | "Services" | "Trading" | "Real Estate" | "Others";
  companyPan: string;
  companyLocation: string;
  contactPersonName: string;
  contactPersonDesignation?: string;
  companyMobile: string;
  companyEmail: string;
  companyEmployees?: number;
}

export interface HUFIdentity {
  entityType: "HUF";
  applicantName: string;
  hufName: string;
  hufPan: string;
  udyamRegNoHUF?: string;
  hufLocation?: string;
  hufFormationDate?: string;
  kartaName: string;
  kartaPan: string;
  kartaMobile?: string;
}

export type Identity = IndividualIdentity | CompanyIdentity | HUFIdentity;

export interface AddressStep {
  pincode: string;
  cityName?: string;
  stateName?: string;
  residentDetails: "Owned House" | "Rented House";
}

export interface SalariedOccupation {
  profileType: "Salaried";
  employerType?: string;
  tenureBand: "0-6m" | "6m-1y" | "1y-2y" | "2y+";
  prevCompanyName?: string;
  prevCompanyJoining?: string;
  grossSalaryBand: "lt25000" | "gt25000";
  salaryMode: "Salary payment mode- Bank Credit" | "Salary payment mode-Cash";
  form16Status: "Form 16" | "No Income Proof";
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

export interface HUFBusiness {
  profileType: "HUF";
  officeAddressType: "Same" | "Separate";
  officeAddress?: string;
  udyamRegNoSelfEmployed?: string;
  businessEstablishmentDate: string;
  itrFilingStatus: "Self employed ITR Filled" | "ITR Not Filed";
  currentITRAmount?: number;
  prevITRAmount?: number;
  rentalIncomeTypeSelfEmployed: string;
  businessProof?: string;
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
  | HUFBusiness
  | CompanyBusiness;

export interface BankingStep {
  existingAccountBank: string;
  existingCarLoanBank: string;
  loanType: "Auto Loan" | "Personal Loan" | "Home Loan";
  bureauCibilScore: number;
  bureauDpd: number;
  bureauLoanEnquiry: number;
  bureauCurrentlyOutstanding: number;
  /** Omitted for the Company workflow — the corporate matrix has no age column. */
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

/** FastAPI 422 body: {"detail": [{loc, msg, type}, ...]} */
export interface ValidationErrorItem {
  loc: (string | number)[];
  msg: string;
  type: string;
}
