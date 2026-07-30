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

/** Flat draft of every field across all five steps.
 *
 * Kept flat rather than pre-shaped into the request body because the wizard
 * edits fields one at a time, while the API needs a discriminated union
 * assembled per entity type. buildPayload() performs that projection once, at
 * submit — which is also the only place the `extra="forbid"` rules matter. */
export interface Draft {
  // Step 1 — identity (union of all three branches)
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
  companyName: string;
  companyType: string;
  companyPan: string;
  companyLocation: string;
  contactPersonName: string;
  contactPersonDesignation: string;
  companyMobile: string;
  companyEmail: string;
  companyEmployees: string;
  hufName: string;
  hufPan: string;
  udyamRegNoHUF: string;
  hufLocation: string;
  hufFormationDate: string;
  kartaName: string;
  kartaPan: string;
  kartaMobile: string;

  // Step 2 — address
  pincode: string;
  cityName: string;
  stateName: string;
  residentDetails: string;

  // Step 3 — occupation
  occupation: "Salaried" | "Self-Employed";
  employerType: string;
  tenureBand: string;
  prevCompanyName: string;
  prevCompanyJoining: string;
  grossSalaryBand: string;
  salaryMode: string;
  form16Status: string;
  form16Years: number;
  rentalIncomeType: string;
  officeAddressType: string;
  officeAddress: string;
  officePremisesStatus: string;
  guarantorStatus: string;
  businessEntityType: string;
  businessProof: string;
  businessEstablishmentDate: string;
  currentITRAmount: number | "";
  prevITRAmount: number | "";
  businessItrYears: number | "";
  itrFilingStatus: string;
  udyamRegNoSelfEmployed: string;
  companyEstablishmentDate: string;
  companyGstin: string;
  companyCurrentITRAmount: number | "";
  companyPrevITRAmount: number | "";
  businessItrYearsCompany: number | "";

  // Step 4 — banking & bureau
  existingAccountBank: string;
  existingCarLoanBank: string;
  loanType: string;
  bureauCibilScore: number;
  bureauDpd: number;
  bureauLoanEnquiry: boolean;
  bureauCurrentlyOutstanding: number;
  bureauAgeAtLastEMI: number;
  cibilPlScoreToggle: boolean;
  bureauCibilPlScore: number | "";
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
  companyName: "", companyType: "", companyPan: "", companyLocation: "",
  contactPersonName: "", contactPersonDesignation: "", companyMobile: "",
  companyEmail: "", companyEmployees: "",
  hufName: "", hufPan: "", udyamRegNoHUF: "", hufLocation: "", hufFormationDate: "",
  kartaName: "", kartaPan: "", kartaMobile: "",

  pincode: "", cityName: "", stateName: "", residentDetails: "Owned House",

  occupation: "Salaried",
  employerType: "", tenureBand: "2y+", prevCompanyName: "", prevCompanyJoining: "",
  grossSalaryBand: "gt25000", salaryMode: "Salary payment mode- Bank Credit",
  form16Status: "Form 16", form16Years: 2, rentalIncomeType: "None",
  officeAddressType: "Same", officeAddress: "", officePremisesStatus: "",
  guarantorStatus: "", businessEntityType: "Propreitorship", businessProof: "",
  businessEstablishmentDate: "", currentITRAmount: "", prevITRAmount: "",
  businessItrYears: "", itrFilingStatus: "Self employed ITR Filled",
  udyamRegNoSelfEmployed: "", companyEstablishmentDate: "", companyGstin: "",
  companyCurrentITRAmount: "", companyPrevITRAmount: "", businessItrYearsCompany: "",

  existingAccountBank: "BOI", existingCarLoanBank: "None", loanType: "Auto Loan",
  bureauCibilScore: 750, bureauDpd: 0, bureauLoanEnquiry: false,
  bureauCurrentlyOutstanding: 0, bureauAgeAtLastEMI: 55,
  cibilPlScoreToggle: false, bureauCibilPlScore: 750,
  bureauFlagPL: false, bureauFlagHome: false, bureauFlagConsumer: false,
  bureauFlagAgri: false, bureauFlagMSME: false, bureauFlagAuto: false,
  bureauFlagCC: false, bureauWriteOffAmount: "",

  coAppAgeRelation: "None", coAppIncomeRelation: "None",
  coApplicantName: "", coApplicantDob: "", coApplicantOccupation: "",
};

/** Empty string -> undefined, so JSON.stringify drops the key entirely.
 *  The API forbids unknown/inapplicable fields; it does not forbid absent
 *  optional ones. */
const opt = (value: string): string | undefined => (value.trim() === "" ? undefined : value);

/** Which entity-scoped eligibility matrix the backend will score this draft
 *  against. Individual and HUF share the Individual matrix; Company is scored
 *  on the corporate one, which carries no demographic or employment columns. */
export type Workflow = "INDIVIDUAL" | "COMPANY";

export function workflowFor(entityType: EntityType): Workflow {
  return entityType === "Company" ? "COMPANY" : "INDIVIDUAL";
}

export function profileTypeFor(draft: Draft): ProfileType {
  if (draft.entityType === "Company") return "Company";
  if (draft.entityType === "HUF") return "HUF";
  return draft.occupation;
}

/** The office runs out of a RENTED residence — the only configuration that asks
 *  the guarantor question, and where the API requires an answer. A separately
 *  addressed office is assessed on its own premises tenure and never prompts,
 *  whatever its premises status. */
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
  if (d.entityType === "HUF") {
    return {
      entityType: "HUF",
      applicantName: d.applicantName,
      hufName: d.hufName,
      hufPan: d.hufPan.toUpperCase(),
      udyamRegNoHUF: opt(d.udyamRegNoHUF),
      hufLocation: opt(d.hufLocation),
      hufFormationDate: opt(d.hufFormationDate),
      kartaName: d.kartaName,
      kartaPan: d.kartaPan.toUpperCase(),
      kartaMobile: opt(d.kartaMobile),
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

  if (profile === "HUF") {
    const filed = d.itrFilingStatus === "Self employed ITR Filled";
    return {
      profileType: "HUF",
      officeAddressType: d.officeAddressType as "Same" | "Separate",
      officeAddress: d.officeAddressType === "Separate" ? d.officeAddress : undefined,
      udyamRegNoSelfEmployed: opt(d.udyamRegNoSelfEmployed),
      businessEstablishmentDate: d.businessEstablishmentDate,
      itrFilingStatus: d.itrFilingStatus as never,
      // Amounts are required when filed and meaningless when not.
      currentITRAmount: filed ? Number(d.currentITRAmount) : undefined,
      prevITRAmount: filed ? Number(d.prevITRAmount) : undefined,
      rentalIncomeTypeSelfEmployed: d.rentalIncomeType,
      businessProof: opt(d.businessProof),
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
      rentalIncomeTypeSelfEmployed: d.rentalIncomeType,
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
    grossSalaryBand: d.grossSalaryBand as never,
    salaryMode: d.salaryMode as never,
    form16Status: d.form16Status as never,
    // Only accepted when Form 16 is claimed; the API rejects it otherwise.
    form16Years: d.form16Status === "Form 16" ? Number(d.form16Years) : undefined,
    rentalIncomeTypeSalaried: d.rentalIncomeType,
  };
}

function buildBanking(d: Draft): BankingStep {
  return {
    existingAccountBank: d.existingAccountBank,
    existingCarLoanBank: d.existingCarLoanBank,
    loanType: d.loanType as never,
    bureauCibilScore: Number(d.bureauCibilScore),
    bureauDpd: Number(d.bureauDpd),
    bureauLoanEnquiry: d.bureauLoanEnquiry,
    bureauCurrentlyOutstanding: Number(d.bureauCurrentlyOutstanding),
    // A company has no age; the Company matrix carries no age-at-EMI column,
    // so the field is neither collected nor sent for the corporate workflow.
    bureauAgeAtLastEMI:
      workflowFor(d.entityType) === "COMPANY" ? undefined : Number(d.bureauAgeAtLastEMI),
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

/** Project the flat draft into the discriminated-union request body.
 *  Address and co-applicant are omitted entirely for Company — the API
 *  rejects the submission outright if either is present. */
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

  setField: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
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

  setField: (key, value) =>
    set((state) => {
      const draft = { ...state.draft, [key]: value };
      // Un-ticking a conditional flag must clear the value it guarded, or the
      // stale amount still ships. A write-off amount with no accompanying
      // class reaches the engine as an UNCLASSIFIED write-off and fails closed
      // (BUR-401D) — a rejection the applicant cannot see the cause of.
      if (key === "bureauFlagCC" && value === false) {
        draft.bureauWriteOffAmount = "";
      }
      if (key === "cibilPlScoreToggle" && value === false) {
        draft.bureauCibilPlScore = INITIAL_DRAFT.bureauCibilPlScore;
      }
      return { draft, error: null };
    }),

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
