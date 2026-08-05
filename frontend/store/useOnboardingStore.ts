"use client";

import { create } from "zustand";
import { evaluateOnboardingForm, FormValidationError } from "@/lib/api";
import { STEP_PLAN } from "@/lib/form-schema";
import type {
  BankingStep,
  CoApplicantStep,
  EntityType,
  EvaluationResponse,
  Identity,
  Occupation,
  OnboardingFormRequest,
  ProfileType,
} from "@/lib/types";

// Flat draft of all five steps; buildPayload() projects it into the API's discriminated union at submit.
export interface Draft {
  // Step 1 — identity (union of both branches)
  entityType: EntityType;
  applicantName: string;
  dob: string;
  gender: string;
  pan: string;
  maritalStatus: string;
  citizenshipStatus: string;
  nriStayPeriod: number | "";
  phone: string;
  email: string;
  // Demo OTP outcomes; they gate nothing in the eligibility decision.
  panVerified: boolean;
  phoneVerified: boolean;
  companyName: string;
  companyType: string;
  companyPan: string;
  companyLocation: string;
  contactPersonName: string;
  contactPersonDesignation: string;
  companyMobile: string;
  companyEmail: string;
  companyEmployees: string;

  // Step 2 — address
  pincode: string;
  cityName: string;
  stateName: string;
  residentDetails: string;
  // Which document backs the address, chosen before the upload appears.
  // "" until the applicant picks one; only "Aadhaar Card" is OCR-readable.
  addressProofType: string;
  // Read off the address proof by OCR when that document is an Aadhaar card.
  aadhaarNumber: string;

  // Step 3 — occupation
  occupation: "Salaried" | "Self-Employed";
  employerType: string;
  tenureBand: string;
  prevCompanyName: string;
  prevCompanyJoining: string;
  grossSalary: number | "";
  salaryMode: string;
  // "Form 16" | "ITR" | "No Income Proof"
  form16Status: string;
  // Empty string while the box is cleared — buildPayload coerces on submit.
  form16Years: number | "";
  // Collected instead of Form-16 years when the proof offered is an ITR.
  salariedCurrentYearItr: number | "";
  salariedPreviousYearItr: number | "";
  // Yes/no gate in front of the rental-income category dropdown.
  hasRentalIncome: boolean;
  rentalIncomeType: string;
  officeAddressType: string;
  officeAddress: string;
  officePremisesStatus: string;
  guarantorStatus: string;
  businessEntityType: string;
  businessProof: string;
  businessProofVerified: boolean;
  businessEstablishmentDate: string;
  currentITRAmount: number | "";
  prevITRAmount: number | "";
  businessItrYears: number | "";
  companyEstablishmentDate: string;
  companyGstin: string;
  companyCurrentITRAmount: number | "";
  companyPrevITRAmount: number | "";
  businessItrYearsCompany: number | "";

  // Step 4 — banking & bureau
  existingAccountBank: string;
  existingCarLoanBank: string;
  loanType: string;
  bureauCibilScore: number | "";
  // Two yes/no questions instead of a "DPD" figure; dpdDaysFor() maps them back to days.
  hasMissedPayment: boolean;
  missedOver90: boolean;
  bureauLoanEnquiry: boolean;
  bureauCurrentlyOutstanding: number | "";
  cibilPlScoreToggle: boolean;
  bureauCibilPlScore: number | "";
  // Gate: the seven class flags below are only asked once this is true.
  hasWriteOff: boolean;
  bureauFlagPL: boolean;
  bureauFlagHome: boolean;
  bureauFlagConsumer: boolean;
  bureauFlagAgri: boolean;
  bureauFlagMSME: boolean;
  bureauFlagAuto: boolean;
  bureauFlagCC: boolean;
  bureauWriteOffAmount: number | "";

  // Step 5 — co-applicant
  coAppAgeRelation: string;
  coAppIncomeRelation: string;
  coApplicantName: string;
  coApplicantDob: string;
  coApplicantOccupation: string;
}

const INITIAL_DRAFT: Draft = {
  entityType: "Individual",
  applicantName: "", dob: "", gender: "", pan: "", maritalStatus: "",
  citizenshipStatus: "Resident Indian", nriStayPeriod: 12, phone: "", email: "",
  panVerified: false, phoneVerified: false,
  companyName: "", companyType: "", companyPan: "", companyLocation: "",
  contactPersonName: "", contactPersonDesignation: "", companyMobile: "",
  companyEmail: "", companyEmployees: "",

  pincode: "", cityName: "", stateName: "", residentDetails: "Owned House",
  addressProofType: "", aadhaarNumber: "",

  occupation: "Salaried",
  employerType: "", tenureBand: "2y+", prevCompanyName: "", prevCompanyJoining: "",
  grossSalary: "", salaryMode: "Salary payment mode- Bank Credit",
  form16Status: "Form 16", form16Years: 2, salariedCurrentYearItr: "",
  salariedPreviousYearItr: "", hasRentalIncome: false,
  rentalIncomeType: "Rental Income-with Agreement -Not filed ITR-Not reflecting in Bank",
  officeAddressType: "Same", officeAddress: "", officePremisesStatus: "",
  guarantorStatus: "", businessEntityType: "Propreitorship", businessProof: "",
  businessProofVerified: false,
  businessEstablishmentDate: "", currentITRAmount: "", prevITRAmount: "",
  businessItrYears: "", companyEstablishmentDate: "", companyGstin: "",
  companyCurrentITRAmount: "", companyPrevITRAmount: "", businessItrYearsCompany: "",

  existingAccountBank: "BOI", existingCarLoanBank: "None", loanType: "Auto Loan",
  bureauCibilScore: 750, hasMissedPayment: false, missedOver90: false,
  bureauLoanEnquiry: false,
  bureauCurrentlyOutstanding: 0,
  cibilPlScoreToggle: false, bureauCibilPlScore: 750,
  hasWriteOff: false, bureauFlagPL: false, bureauFlagHome: false, bureauFlagConsumer: false,
  bureauFlagAgri: false, bureauFlagMSME: false, bureauFlagAuto: false,
  bureauFlagCC: false, bureauWriteOffAmount: "",

  coAppAgeRelation: "None", coAppIncomeRelation: "None",
  coApplicantName: "", coApplicantDob: "", coApplicantOccupation: "",
};

// Empty string -> undefined so JSON.stringify drops the key; the API forbids inapplicable fields, not absent ones.
const opt = (value: string): string | undefined => (value.trim() === "" ? undefined : value);

// Which entity-scoped matrix scores this draft; the corporate one carries no demographic or employment columns.
export type Workflow = "INDIVIDUAL" | "COMPANY";

export function workflowFor(entityType: EntityType): Workflow {
  return entityType === "Company" ? "COMPANY" : "INDIVIDUAL";
}

export function profileTypeFor(draft: Draft): ProfileType {
  return draft.entityType === "Company" ? "Company" : draft.occupation;
}

// Days past due implied by the two repayment answers; 30 keeps the middle case out of the max_dpd=0 banks.
// Draft fields a parsed CIBIL report is allowed to write, and therefore the
// exact set the wizard locks behind the verified badge.
export const CIBIL_POPULATED_FIELDS = [
  "bureauCibilScore",
  "hasMissedPayment",
  "missedOver90",
  "bureauLoanEnquiry",
  "bureauCurrentlyOutstanding",
  "hasWriteOff",
  "bureauFlagPL",
  "bureauFlagHome",
  "bureauFlagConsumer",
  "bureauFlagAgri",
  "bureauFlagMSME",
  "bureauFlagAuto",
  "bureauFlagCC",
  "bureauWriteOffAmount",
  "cibilPlScoreToggle",
  "bureauCibilPlScore",
] as const satisfies readonly (keyof Draft)[];

export function dpdDaysFor(draft: Draft): number {
  if (!draft.hasMissedPayment) return 0;
  return draft.missedOver90 ? 90 : 30;
}

// Whole years elapsed since the DOB, on the calendar (no day-count drift).
export function ageFromDob(dob: string): number | null {
  if (!dob) return null;
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return null;
  const today = new Date();
  let years = today.getFullYear() - born.getFullYear();
  if (today.getMonth() < born.getMonth()
    || (today.getMonth() === born.getMonth() && today.getDate() < born.getDate())) {
    years -= 1;
  }
  return Math.max(years, 0);
}

// add-on.md §4: no longer asked. Age at the final EMI is current age + a fixed 7-year tenor.
export const LOAN_TENOR_YEARS = 7;

export function ageAtLastEmiFor(draft: Draft): number | null {
  const age = ageFromDob(draft.dob);
  return age === null ? null : age + LOAN_TENOR_YEARS;
}

// add-on.md §5: the co-applicant section only appears when the loan outlives the age limit.
export const CO_APPLICANT_AGE_THRESHOLD = 60;

export function needsCoApplicant(draft: Draft): boolean {
  const age = ageAtLastEmiFor(draft);
  return age !== null && age > CO_APPLICANT_AGE_THRESHOLD;
}

// Office in a RENTED residence — the only configuration that asks the guarantor question.
export function isResiCumOfficeRented(draft: Draft): boolean {
  return (
    profileTypeFor(draft) === "Self-Employed" &&
    draft.residentDetails === "Rented House" &&
    draft.officeAddressType === "Same"
  );
}

function buildIdentity(d: Draft): Identity {
  if (d.entityType === "Company") {
    return {
      entityType: "Company",
      applicantName: d.applicantName,
      companyName: d.companyName,
      companyType: d.companyType as never,
      companyPan: d.companyPan.toUpperCase(),
      companyLocation: d.companyLocation,
      contactPersonName: d.contactPersonName,
      contactPersonDesignation: opt(d.contactPersonDesignation),
      companyMobile: d.companyMobile,
      companyEmail: d.companyEmail,
      companyEmployees: d.companyEmployees ? Number(d.companyEmployees) : undefined,
    };
  }
  const isNri = d.citizenshipStatus === "NRI/PIO";
  return {
    entityType: "Individual",
    applicantName: d.applicantName,
    dob: d.dob,
    gender: opt(d.gender) as never,
    pan: d.pan.toUpperCase(),
    maritalStatus: opt(d.maritalStatus) as never,
    citizenshipStatus: d.citizenshipStatus as never,
    // Only collected — and only accepted — for NRI/PIO applicants.
    nriStayPeriod: isNri ? Number(d.nriStayPeriod) : undefined,
    phone: d.phone,
    email: d.email,
  };
}

// "No" to the rental radio is what sets the None category; the dropdown never carries it.
function rentalIncomeFor(d: Draft): string {
  return d.hasRentalIncome ? d.rentalIncomeType : "None";
}

function buildOccupation(d: Draft): Occupation {
  const profile = profileTypeFor(d);

  if (profile === "Company") {
    return {
      profileType: "Company",
      companyEstablishmentDate: d.companyEstablishmentDate,
      companyGstin: d.companyGstin,
      companyCurrentITRAmount: Number(d.companyCurrentITRAmount),
      companyPrevITRAmount: Number(d.companyPrevITRAmount),
      businessItrAmountCompany: Number(d.businessItrYearsCompany),
    };
  }

  if (profile === "Self-Employed") {
    const separate = d.officeAddressType === "Separate";
    return {
      profileType: "Self-Employed",
      officeAddressType: d.officeAddressType as "Same" | "Separate",
      officeAddress: separate ? d.officeAddress : undefined,
      // Premises status is accepted ONLY alongside a separate office.
      officePremisesStatus: separate
        ? (d.officePremisesStatus as "Owned" | "Rented")
        : undefined,
      // Guarantor is accepted ONLY when the office shares a rented residence.
      guarantorStatus: isResiCumOfficeRented(d)
        ? (d.guarantorStatus as "Without a Gaurantor" | "With a Gaurantor")
        : undefined,
      businessEntityType: d.businessEntityType,
      businessProof: opt(d.businessProof),
      businessEstablishmentDate: d.businessEstablishmentDate,
      currentITRAmount: Number(d.currentITRAmount),
      prevITRAmount: Number(d.prevITRAmount),
      businessItrAmount: Number(d.businessItrYears),
      rentalIncomeTypeSelfEmployed: rentalIncomeFor(d),
    };
  }

  const shortTenure = d.tenureBand !== "2y+";
  return {
    profileType: "Salaried",
    employerType: opt(d.employerType),
    tenureBand: d.tenureBand as never,
    // Prior employment is required below 2 years and rejected at 2y+.
    prevCompanyName: shortTenure ? d.prevCompanyName : undefined,
    prevCompanyJoining: shortTenure ? d.prevCompanyJoining : undefined,
    grossSalary: Number(d.grossSalary),
    salaryMode: d.salaryMode as never,
    form16Status: d.form16Status as never,
    // Only accepted when Form 16 is claimed; the API rejects it otherwise.
    form16Years: d.form16Status === "Form 16" ? Number(d.form16Years) : undefined,
    // ...and these only when the proof offered is an ITR.
    currentYearItr: d.form16Status === "ITR" ? Number(d.salariedCurrentYearItr) : undefined,
    previousYearItr: d.form16Status === "ITR" ? Number(d.salariedPreviousYearItr) : undefined,
    rentalIncomeTypeSalaried: rentalIncomeFor(d),
  };
}

function buildBanking(d: Draft): BankingStep {
  return {
    existingAccountBank: d.existingAccountBank,
    existingCarLoanBank: d.existingCarLoanBank,
    loanType: d.loanType as never,
    bureauCibilScore: Number(d.bureauCibilScore),
    bureauDpd: dpdDaysFor(d),
    bureauLoanEnquiry: d.bureauLoanEnquiry,
    bureauCurrentlyOutstanding: Number(d.bureauCurrentlyOutstanding),
    // Omitted entirely: the API derives it from the DOB (age + 7). A company
    // has no DOB and the Company matrix carries no age-at-EMI column anyway.
    cibilPlScoreToggle: d.cibilPlScoreToggle,
    bureauCibilPlScore: d.cibilPlScoreToggle ? Number(d.bureauCibilPlScore) : undefined,
    bureauFlagPL: d.bureauFlagPL,
    bureauFlagHome: d.bureauFlagHome,
    bureauFlagConsumer: d.bureauFlagConsumer,
    bureauFlagAgri: d.bureauFlagAgri,
    bureauFlagMSME: d.bureauFlagMSME,
    bureauFlagAuto: d.bureauFlagAuto,
    bureauFlagCC: d.bureauFlagCC,
    bureauWriteOffAmount: Number(d.bureauWriteOffAmount),
  };
}

function buildCoApplicant(d: Draft): CoApplicantStep {
  const pooling = d.coAppIncomeRelation !== "None";
  return {
    coAppAgeRelation: d.coAppAgeRelation as never,
    coAppIncomeRelation: d.coAppIncomeRelation as never,
    coApplicantName: pooling ? d.coApplicantName : undefined,
    coApplicantDob: pooling ? d.coApplicantDob : undefined,
    coApplicantOccupation: pooling
      ? (d.coApplicantOccupation as "Salaried" | "Self-Employed")
      : undefined,
  };
}

// Project the draft into the request body; Company omits address and co-applicant, which the API rejects outright.
export function buildPayload(d: Draft): OnboardingFormRequest {
  const isCompany = d.entityType === "Company";
  return {
    identity: buildIdentity(d),
    address: isCompany
      ? undefined
      : {
          pincode: d.pincode,
          cityName: opt(d.cityName),
          stateName: opt(d.stateName),
              residentDetails: d.residentDetails as "Owned House" | "Rented House",
          aadhaarNumber: opt(d.aadhaarNumber),
        },
    occupation: buildOccupation(d),
    banking: buildBanking(d),
    coApplicant: isCompany ? undefined : buildCoApplicant(d),
  };
}

interface OnboardingState {
  draft: Draft;
  stepId: number;
  submitting: boolean;
  result: EvaluationResponse | null;
  error: string | null;
  // Non-null once a CIBIL report has been parsed: the bureau inputs are locked
  // to what it says, and the badge names the file they came from.
  cibilVerified: { filename: string; evidence: Record<string, unknown> } | null;

  setField: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  // Bureau fields read off an uploaded CIBIL report. Set together so the
  // verified badge and the locked inputs can never disagree about their source.
  applyCibilExtraction: (fields: Record<string, unknown>, filename: string) => void;
  clearCibilExtraction: () => void;
  goTo: (stepId: number) => void;
  next: () => void;
  prev: () => void;
  submit: () => Promise<void>;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  draft: INITIAL_DRAFT,
  stepId: 1,
  submitting: false,
  result: null,
  error: null,
  cibilVerified: null,

  setField: (key, value) =>
    set((state) => {
      const draft = { ...state.draft, [key]: value };
      // Un-ticking a flag must clear what it guarded, or an unclassified write-off fails closed (BUR-401D).
      if (key === "bureauFlagCC" && value === false) {
        draft.bureauWriteOffAmount = "";
      }
      if (key === "cibilPlScoreToggle" && value === false) {
        draft.bureauCibilPlScore = INITIAL_DRAFT.bureauCibilPlScore;
      }
      // Answering "no" to a gate must retract everything it revealed.
      if (key === "hasWriteOff" && value === false) {
        draft.bureauFlagPL = false;
        draft.bureauFlagHome = false;
        draft.bureauFlagConsumer = false;
        draft.bureauFlagAgri = false;
        draft.bureauFlagMSME = false;
        draft.bureauFlagAuto = false;
        draft.bureauFlagCC = false;
        draft.bureauWriteOffAmount = "";
      }
      if (key === "hasMissedPayment" && value === false) {
        draft.missedOver90 = false;
      }
      // Switching residence or proof type invalidates whatever was uploaded
      // against the previous choice, and any number read off it.
      if (key === "residentDetails") {
        draft.addressProofType = "";
        draft.aadhaarNumber = "";
      }
      if (key === "addressProofType") {
        draft.aadhaarNumber = "";
      }
      return { draft, error: null };
    }),

  applyCibilExtraction: (fields, filename) =>
    set((state) => {
      // Only fields the wizard actually owns are written; the response also
      // carries evidence (worstEverDpd, enquiry counts) that has no input.
      const draft = { ...state.draft };
      for (const key of CIBIL_POPULATED_FIELDS) {
        const value = fields[key];
        if (value !== undefined && value !== null) {
          (draft as Record<string, unknown>)[key] = value;
        }
      }
      return { draft, cibilVerified: { filename, evidence: fields }, error: null };
    }),

  clearCibilExtraction: () => set({ cibilVerified: null }),

  goTo: (stepId) => set({ stepId }),

  next: () => {
    const { draft, stepId } = get();
    const plan = STEP_PLAN[draft.entityType];
    const i = plan.indexOf(stepId);
    if (i >= 0 && i < plan.length - 1) set({ stepId: plan[i + 1] });
  },

  prev: () => {
    const { draft, stepId } = get();
    const plan = STEP_PLAN[draft.entityType];
    const i = plan.indexOf(stepId);
    if (i > 0) set({ stepId: plan[i - 1] });
  },

  submit: async () => {
    const { draft } = get();
    set({ submitting: true, error: null });
    try {
      const result = await evaluateOnboardingForm(buildPayload(draft));
      set({ result, submitting: false });
    } catch (err) {
      if (err instanceof FormValidationError) {
        // Navigate to the step that owns the rejected field.
        const section = err.section;
        const sectionStep: Record<string, number> = {
          identity: 1, address: 2, occupation: 3, banking: 4, coApplicant: 5,
        };
        set({
          error: err.message,
          submitting: false,
          stepId: section ? (sectionStep[section] ?? get().stepId) : get().stepId,
        });
        return;
      }
      set({
        error: err instanceof Error ? err.message : "Evaluation failed.",
        submitting: false,
      });
    }
  },

  reset: () => set({ draft: INITIAL_DRAFT, stepId: 1, result: null, error: null }),
}));
