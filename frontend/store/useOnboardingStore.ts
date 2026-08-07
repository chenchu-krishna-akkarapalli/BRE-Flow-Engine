"use client";

import { create } from "zustand";
import { evaluateOnboardingForm, FormValidationError } from "@/lib/api";
import { GOVERNMENT_SECTOR, STEP_PLAN } from "@/lib/form-schema";
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
  occupation: "Salaried" | "Self-Employed" | "Rental Income";
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
  // add-on.md §7: rent is its own occupation now, so these describe the
  // Rental Income branch rather than a rider on another one.
  rentalPropertyAddress: string;
  rentalIncomeType: string;
  rentalIncomeAmount: number | "";
  rentalBankStatementProvided: boolean;
  rentalCurrentYearItr: number | "";
  rentalPreviousYearItr: number | "";
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
  // add-on.md §3: the farming branch, shown instead of the trade fields.
  ownsAgriculturalLand: boolean;
  agriculturalLandLocation: string;
  annualAgriculturalIncome: number | "";
  agricultureItrFiled: boolean;
  agriculturalIncomeProof: string;
  agriculturalIncomeProofVerified: boolean;
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
  // add-on.md §8: clubbed with the applicant's before the ITR floors score.
  coApplicantCurrentItr: number | "";
  coApplicantPreviousItr: number | "";
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
  employerType: "Private Sector", tenureBand: "2y+", prevCompanyName: "", prevCompanyJoining: "",
  grossSalary: "", salaryMode: "Salary payment mode- Bank Credit",
  form16Status: "Form 16", form16Years: 2, salariedCurrentYearItr: "",
  salariedPreviousYearItr: "",
  rentalPropertyAddress: "",
  rentalIncomeType: "Rental Income-with Agreement -Not filed ITR-Not reflecting in Bank",
  rentalIncomeAmount: "", rentalBankStatementProvided: false,
  rentalCurrentYearItr: "", rentalPreviousYearItr: "",
  officeAddressType: "Same", officeAddress: "", officePremisesStatus: "",
  guarantorStatus: "", businessEntityType: "Propreitorship", businessProof: "",
  businessProofVerified: false,
  businessEstablishmentDate: "", currentITRAmount: "", prevITRAmount: "",
  businessItrYears: "",
  ownsAgriculturalLand: true, agriculturalLandLocation: "",
  annualAgriculturalIncome: "", agricultureItrFiled: true, agriculturalIncomeProof: "",
  agriculturalIncomeProofVerified: false,
  companyEstablishmentDate: "", companyGstin: "",
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
  coApplicantCurrentItr: "", coApplicantPreviousItr: "",
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

// add-on.md §8: the income question has its own trigger, independent of age.
export const CO_APPLICANT_ITR_THRESHOLD = 100000;

// The applicant's own filed returns, whichever branch of step 3 collected them.
export function applicantItrs(draft: Draft): { current: number; previous: number } | null {
  const profile = profileTypeFor(draft);
  const pair = (c: number | "", p: number | "") =>
    c === "" || p === "" ? null : { current: Number(c), previous: Number(p) };

  if (profile === "Salaried") {
    // Only the ITR proof carries amounts; a Form-16 applicant declares none.
    return draft.form16Status === "ITR"
      ? pair(draft.salariedCurrentYearItr, draft.salariedPreviousYearItr)
      : null;
  }
  if (profile === "Rental Income") {
    return draft.rentalIncomeType === RENTAL_DOC_WITH_ITR
      ? pair(draft.rentalCurrentYearItr, draft.rentalPreviousYearItr)
      : null;
  }
  if (profile === "Self-Employed") {
    if (isAgriculture(draft) && !draft.agricultureItrFiled) return null;
    return pair(draft.currentITRAmount, draft.prevITRAmount);
  }
  return null;
}

// One rule, asked on whichever screen owns the applicant's ITR amounts.
//
// EITHER year falling short triggers it (add-on.md bug 9). The stricter "both
// years" reading in bug 8 hid the question from the applicants who most need
// it: someone at 95,000 current and 400,000 previous has a weak year the
// clubbing exists to cover, and would never have been offered a co-applicant.
// Undeclared income does not trigger it — there is no figure to judge as low.
function incomeIsShort(draft: Draft): boolean {
  const itrs = applicantItrs(draft);
  if (itrs === null) return false;
  return itrs.current < CO_APPLICANT_ITR_THRESHOLD
    || itrs.previous < CO_APPLICANT_ITR_THRESHOLD;
}

// Step 3 asks the self-employed flow, the moment the two ITR amounts are on
// screen. Step 5 asks everyone else.
export function needsIncomeCoApplicantInStep3(draft: Draft): boolean {
  return profileTypeFor(draft) === "Self-Employed" && incomeIsShort(draft);
}

// Self-employed is excluded because step 3 already asked. There is one answer
// in the draft, so asking twice could only produce two views of it that
// disagree — whichever screen the applicant edited last would silently win.
export function needsIncomeCoApplicant(draft: Draft): boolean {
  return profileTypeFor(draft) !== "Self-Employed" && incomeIsShort(draft);
}

function pooledItr(draft: Draft, key: "coApplicantCurrentItr" | "coApplicantPreviousItr"): number {
  const value = draft[key];
  return draft.coAppIncomeRelation !== "None" && value !== "" ? Number(value) : 0;
}

// The figures the banks actually score once a co-applicant pools their income.
export function clubbedCurrentItr(draft: Draft): number {
  return (applicantItrs(draft)?.current ?? 0) + pooledItr(draft, "coApplicantCurrentItr");
}

export function clubbedPreviousItr(draft: Draft): number {
  return (applicantItrs(draft)?.previous ?? 0) + pooledItr(draft, "coApplicantPreviousItr");
}

// add-on.md §2: the NRI questions live in step 3 and are asked only of salaried
// applicants. Everyone else submits as resident, whatever step 1 once held.
export function isNriApplicant(draft: Draft): boolean {
  return profileTypeFor(draft) === "Salaried" && draft.citizenshipStatus === "NRI/PIO";
}

// add-on.md §4: government service skips both experience floors, so the wizard
// stops asking for a previous employer and the payload stops carrying one.
export function isGovernmentEmployee(draft: Draft): boolean {
  return draft.employerType === GOVERNMENT_SECTOR;
}

// add-on.md §6: below this the application stops at step 3 rather than being
// collected in full and rejected at the end.
export const MIN_SALARIED_MONTHLY_SALARY = 25000;

// add-on.md §5 / §6: conditions that end onboarding where they are answered.
// Returns the reason to show, or null when the applicant may continue.
export function terminationReason(draft: Draft): string | null {
  const profile = profileTypeFor(draft);

  if (profile === "Salaried") {
    const salary = draft.grossSalary;
    if (salary !== "" && Number(salary) < MIN_SALARIED_MONTHLY_SALARY) {
      return `A monthly salary below ₹${MIN_SALARIED_MONTHLY_SALARY.toLocaleString("en-IN")} `
        + "does not meet the minimum for any of our partner banks, so this application "
        + "cannot go further.";
    }
  }

  // Farming is evidenced by land and either a return or an income proof, so it
  // is never asked for a registration number and is not stopped for lacking one.
  if (profile === "Self-Employed" && !isAgriculture(draft) && draft.businessProof.trim() === "") {
    return "Business proof is mandatory for self-employed applicants. Add your "
      + "business registration or GST number to continue.";
  }

  return null;
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
  // add-on.md §2: only a salaried applicant is asked about residency, so only
  // a salaried applicant can be scored as one — anyone else is resident by
  // construction rather than by a value left behind from an earlier answer.
  const isNri = isNriApplicant(d);
  return {
    entityType: "Individual",
    applicantName: d.applicantName,
    dob: d.dob,
    gender: opt(d.gender) as never,
    pan: d.pan.toUpperCase(),
    maritalStatus: opt(d.maritalStatus) as never,
    citizenshipStatus: (isNri ? "NRI/PIO" : "Resident Indian") as never,
    // Only collected — and only accepted — for NRI/PIO applicants.
    nriStayPeriod: isNri ? Number(d.nriStayPeriod) : undefined,
    phone: d.phone,
    email: d.email,
  };
}

// add-on.md §7: the two documentation options that pull extra evidence.
export const RENTAL_DOC_WITH_ITR = "Rental Income-with Agreement filed ITR- Not reflecting in Bank";
export const RENTAL_DOC_IN_BANK = "Rental Income-with Agreement -Not filed ITR-reflecting in Bank";

// add-on.md §3: farming is a businessEntityType, not a separate profileType —
// "How is your business set up?" is still what selects it.
export const AGRICULTURE = "Agriculture";

export function isAgriculture(draft: Draft): boolean {
  return (
    profileTypeFor(draft) === "Self-Employed" && draft.businessEntityType === AGRICULTURE
  );
}

function buildRentalIncome(d: Draft): Occupation {
  const withItr = d.rentalIncomeType === RENTAL_DOC_WITH_ITR;
  const inBank = d.rentalIncomeType === RENTAL_DOC_IN_BANK;
  return {
    profileType: "Rental Income",
    rentalPropertyAddress: d.rentalPropertyAddress,
    rentalIncomeDocumentation: d.rentalIncomeType,
    // Each documentation option carries only its own evidence; the API
    // rejects the other option's fields outright.
    currentYearItr: withItr ? Number(d.rentalCurrentYearItr) : undefined,
    previousYearItr: withItr ? Number(d.rentalPreviousYearItr) : undefined,
    rentalBankStatementProvided: inBank ? d.rentalBankStatementProvided : undefined,
    rentalIncomeAmount: inBank ? Number(d.rentalIncomeAmount) : undefined,
  };
}

function buildAgriculture(d: Draft): Occupation {
  const filed = d.agricultureItrFiled;
  return {
    profileType: "Self-Employed",
    businessEntityType: AGRICULTURE,
    ownsAgriculturalLand: d.ownsAgriculturalLand,
    agriculturalLandLocation: d.agriculturalLandLocation,
    annualAgriculturalIncome: Number(d.annualAgriculturalIncome),
    agricultureItrFiled: filed,
    // Filed returns replace the income proof, and vice versa.
    currentITRAmount: filed ? Number(d.currentITRAmount) : undefined,
    prevITRAmount: filed ? Number(d.prevITRAmount) : undefined,
    businessItrAmount: filed ? Number(d.businessItrYears) : undefined,
    agriculturalIncomeProof: filed ? undefined : opt(d.agriculturalIncomeProof),
  };
}

function buildOccupation(d: Draft): Occupation {
  const profile = profileTypeFor(d);

  if (profile === "Rental Income") return buildRentalIncome(d);
  if (isAgriculture(d)) return buildAgriculture(d);

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
    };
  }

  // add-on.md §4: government service is exempt from the tenure floors, so the
  // API rejects a prior employer sent alongside it.
  const collectsPrevEmployer = !isGovernmentEmployee(d) && d.tenureBand !== "2y+";
  return {
    profileType: "Salaried",
    employerType: opt(d.employerType),
    tenureBand: d.tenureBand as never,
    // Prior employment is required below 2 years and rejected at 2y+.
    prevCompanyName: collectsPrevEmployer ? d.prevCompanyName : undefined,
    prevCompanyJoining: collectsPrevEmployer ? d.prevCompanyJoining : undefined,
    grossSalary: Number(d.grossSalary),
    salaryMode: d.salaryMode as never,
    form16Status: d.form16Status as never,
    // Only accepted when Form 16 is claimed; the API rejects it otherwise.
    form16Years: d.form16Status === "Form 16" ? Number(d.form16Years) : undefined,
    // ...and these only when the proof offered is an ITR.
    currentYearItr: d.form16Status === "ITR" ? Number(d.salariedCurrentYearItr) : undefined,
    previousYearItr: d.form16Status === "ITR" ? Number(d.salariedPreviousYearItr) : undefined,
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
  // Income is pooled only while the question is actually being asked. Editing
  // the ITR amounts back above the threshold retracts the pooling rather than
  // leaving a co-applicant's income clubbed into a total nobody is still shown.
  const asked = needsIncomeCoApplicantInStep3(d) || needsIncomeCoApplicant(d);
  const pooling = asked && d.coAppIncomeRelation !== "None";
  return {
    coAppAgeRelation: d.coAppAgeRelation as never,
    coAppIncomeRelation: (pooling ? d.coAppIncomeRelation : "None") as never,
    coApplicantName: pooling ? d.coApplicantName : undefined,
    coApplicantDob: pooling ? d.coApplicantDob : undefined,
    // add-on.md §8 no longer asks for it, so it is usually absent. Sent through
    // `opt` because an empty string is not a valid occupation and would 422.
    coApplicantOccupation: pooling
      ? (opt(d.coApplicantOccupation) as "Salaried" | "Self-Employed" | undefined)
      : undefined,
    coApplicantCurrentItr: pooling ? Number(d.coApplicantCurrentItr) : undefined,
    coApplicantPreviousItr: pooling ? Number(d.coApplicantPreviousItr) : undefined,
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
