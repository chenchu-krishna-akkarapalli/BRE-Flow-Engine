"use client";

import { create } from "zustand";
import { evaluateOnboardingForm, FormValidationError } from "@/lib/api";
import { GOVERNMENT_SECTOR, STEP_PLAN } from "@/lib/form-schema";
import type {
  BankFoirDetail,
  BankingStep,
  CoApplicantStep,
  EntityType,
  EvaluationResponse,
  Identity,
  Occupation,
  OnboardingFormRequest,
  Phase1IncomeCalculationResponse,
  Phase2FoirCalculationResponse,
  ProfileType,
  YearlyIncomeBreakdown,
  YearlyIncomeInput,
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
  isRegisteredBusiness: boolean;
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
  existingEmi: number | "";

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
  isRegisteredBusiness: false,
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
  existingEmi: "",

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
    if (isAgriculture(draft) && !draft.isRegisteredBusiness && !draft.agricultureItrFiled) return null;
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
  if (profile === "Self-Employed" && (!isAgriculture(draft) || draft.isRegisteredBusiness) && draft.businessProof.trim() === "") {
    return "Business proof is mandatory for self-employed applicants. Add your "
      + "business registration or GST number to continue.";
  }

  return null;
}

// Office in a RENTED residence — the only configuration that asks the guarantor question.
export function isResiCumOfficeRented(draft: Draft): boolean {
  return (
    profileTypeFor(draft) === "Self-Employed" &&
    (!isAgriculture(draft) || draft.isRegisteredBusiness) &&
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
  const isReg = d.isRegisteredBusiness;
  if (!isReg) {
    return {
      profileType: "Self-Employed",
      businessEntityType: AGRICULTURE,
      isRegisteredBusiness: false,
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
  } else {
    const separate = d.officeAddressType === "Separate";
    return {
      profileType: "Self-Employed",
      businessEntityType: AGRICULTURE,
      isRegisteredBusiness: true,
      ownsAgriculturalLand: d.ownsAgriculturalLand,
      agriculturalLandLocation: d.agriculturalLandLocation,
      annualAgriculturalIncome: Number(d.annualAgriculturalIncome),
      officeAddressType: d.officeAddressType as "Same" | "Separate",
      officeAddress: separate ? d.officeAddress : undefined,
      officePremisesStatus: separate
        ? (d.officePremisesStatus as "Owned" | "Rented")
        : undefined,
      guarantorStatus: isResiCumOfficeRented(d)
        ? (d.guarantorStatus as "Without a Gaurantor" | "With a Gaurantor")
        : undefined,
      businessProof: opt(d.businessProof),
      businessEstablishmentDate: d.businessEstablishmentDate,
      currentITRAmount: Number(d.currentITRAmount),
      prevITRAmount: Number(d.prevITRAmount),
      businessItrAmount: Number(d.businessItrYears),
    };
  }
}

function buildOccupation(d: Draft, avgIncome = 0): Occupation {
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
  const avgMonthly = avgIncome > 0
    ? Math.round((avgIncome / 12) * 100) / 100
    : (d.grossSalary !== "" ? Number(d.grossSalary) : 0);

  return {
    profileType: "Salaried",
    employerType: opt(d.employerType),
    tenureBand: d.tenureBand as never,
    // Prior employment is required below 2 years and rejected at 2y+.
    prevCompanyName: collectsPrevEmployer ? d.prevCompanyName : undefined,
    prevCompanyJoining: collectsPrevEmployer ? d.prevCompanyJoining : undefined,
    grossSalary: avgMonthly,
    averageMonthlyIncome: avgMonthly,
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
    existingEmi: Number(d.existingEmi || 0),
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
export function buildPayload(d: Draft, avgIncome = 0): OnboardingFormRequest {
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
    occupation: buildOccupation(d, avgIncome),
    banking: buildBanking(d),
    coApplicant: isCompany ? undefined : buildCoApplicant(d),
  };
}

export interface ItrRecord {
  verified: boolean;
  taxFeePayable: number | null;
}

export interface CoiRecord {
  verified: boolean;
  filename: string;
  totalIncome: number | null;
  grossTotalIncome: number | null;
  evidence: Record<string, unknown>;
}

export const INITIAL_YEARLY_INCOME: YearlyIncomeInput = {
  total_income: 0,
  total_tax_interest_and_fee_payable: 0,
  total_other_interest_income: 0,
  interest_on_partners_capital: 0,
  partner_remuneration: 0,
  income_from_capital_gain: 0,
};

export function computeYearlyIncomeBreakdown(d: YearlyIncomeInput): YearlyIncomeBreakdown {
  const total_income = Number(d.total_income) || 0;
  const total_tax = Number(d.total_tax_interest_and_fee_payable) || 0;
  const income_from_calc = Math.round((total_income - total_tax) * 100) / 100;
  const other_interest = Number(d.total_other_interest_income) || 0;
  const partner_interest = Number(d.interest_on_partners_capital) || 0;
  const partner_remun = Number(d.partner_remuneration) || 0;
  const income_from_other_sources = Math.round(Math.max(0, other_interest - (partner_interest + partner_remun)) * 100) / 100;
  const capital_gain = Number(d.income_from_capital_gain) || 0;
  const total_passive_deductions = Math.round((income_from_other_sources + capital_gain) * 100) / 100;
  const final_yearly_income = Math.round((income_from_calc - total_passive_deductions) * 100) / 100;

  return {
    total_income,
    total_tax_interest_and_fee_payable: total_tax,
    income_from_calc,
    total_other_interest_income: other_interest,
    interest_on_partners_capital: partner_interest,
    partner_remuneration: partner_remun,
    income_from_other_sources,
    income_from_capital_gain: capital_gain,
    total_passive_deductions,
    final_yearly_income,
  };
}

export function computePhase1IncomeResult(
  cy: YearlyIncomeInput,
  py: YearlyIncomeInput,
): Phase1IncomeCalculationResponse {
  const current_year_breakdown = computeYearlyIncomeBreakdown(cy);
  const previous_year_breakdown = computeYearlyIncomeBreakdown(py);
  const income_current_year = current_year_breakdown.final_yearly_income;
  const income_previous_year = previous_year_breakdown.final_yearly_income;
  const average_income = Math.round(((income_current_year + income_previous_year) / 2) * 100) / 100;

  return {
    current_year_breakdown,
    previous_year_breakdown,
    income_current_year,
    income_previous_year,
    average_income,
  };
}

export function getBankFoirRatioClient(
  bankCode: string,
  workType: string,
  averageIncome: number,
): { foirPct: number; desc: string; notes?: string } {
  const code = bankCode.toUpperCase();
  const isSalaried = workType.toLowerCase().includes("salaried");
  const gmi = Math.round((averageIncome / 12) * 100) / 100;

  if (code === "BOB") {
    if (isSalaried) {
      if (gmi <= 50000) return { foirPct: 0.6, desc: "GMI ≤ ₹50,000 (60%)" };
      if (gmi <= 150000) return { foirPct: 0.7, desc: "GMI ₹50,000 – ₹1,50,000 (70%)" };
      return { foirPct: 0.8, desc: "GMI > ₹1,50,000 (80%)" };
    } else {
      if (averageIncome < 600000) return { foirPct: 0.6, desc: "Avg Annual Income < ₹6 Lakh (60%)" };
      return { foirPct: 0.8, desc: "Avg Annual Income ≥ ₹6 Lakh (80%)" };
    }
  } else if (code === "BOM") {
    if (isSalaried) {
      if (gmi <= 50000) return { foirPct: 0.6, desc: "GMI ≤ ₹50,000 (60%)" };
      if (gmi <= 100000) return { foirPct: 0.65, desc: "GMI ₹50,000 – ₹1,00,000 (65%)" };
      if (gmi <= 200000) return { foirPct: 0.7, desc: "GMI ₹1,00,000 – ₹2,00,000 (70%)" };
      if (gmi <= 500000) return { foirPct: 0.75, desc: "GMI ₹2,00,000 – ₹5,00,000 (75%)" };
      return { foirPct: 0.8, desc: "GMI > ₹5,00,000 (80%)" };
    } else {
      if (averageIncome < 600000) return { foirPct: 0.6, desc: "Avg Annual Income < ₹6 Lakh (60%)" };
      if (averageIncome < 1200000) return { foirPct: 0.65, desc: "Avg Annual Income ₹6L – ₹12L (65%)" };
      if (averageIncome < 2400000) return { foirPct: 0.7, desc: "Avg Annual Income ₹12L – ₹24L (70%)" };
      if (averageIncome < 6000000) return { foirPct: 0.75, desc: "Avg Annual Income ₹24L – ₹60L (75%)" };
      return { foirPct: 0.8, desc: "Avg Annual Income ≥ ₹60 Lakh (80%)" };
    }
  } else if (code === "BOI") {
    if (isSalaried) {
      if (gmi < 100000) return { foirPct: 0.6, desc: "GMI < ₹1 Lakh (60%)" };
      if (gmi <= 500000) return { foirPct: 0.7, desc: "GMI ₹1 Lakh – ₹5 Lakh (70%)" };
      return { foirPct: 0.75, desc: "GMI > ₹5 Lakh (75%)" };
    } else {
      if (gmi < 100000) return { foirPct: 0.6, desc: "Converted GMI < ₹1 Lakh (60%)", notes: "Evaluated on converted monthly income" };
      if (gmi <= 500000) return { foirPct: 0.7, desc: "Converted GMI ₹1L – ₹5L (70%)", notes: "Evaluated on converted monthly income" };
      return { foirPct: 0.75, desc: "Converted GMI > ₹5 Lakh (75%)", notes: "Evaluated on converted monthly income" };
    }
  } else if (code === "IOB") {
    if (isSalaried) {
      if (gmi <= 100000) return { foirPct: 0.6, desc: "GMI ≤ ₹1 Lakh (60%)" };
      return { foirPct: 0.7, desc: "GMI > ₹1 Lakh (70%)", notes: "Requires DGM Approval" };
    } else {
      if (gmi <= 100000) return { foirPct: 0.6, desc: "Converted GMI ≤ ₹1 Lakh (60%)", notes: "Evaluated on converted monthly income" };
      return { foirPct: 0.7, desc: "Converted GMI > ₹1 Lakh (70%)", notes: "Requires DGM Approval" };
    }
  } else if (code === "INDIAN" || code === "INDIAN_BANK") {
    const ref = (isSalaried && averageIncome > 15000000) ? gmi : averageIncome;
    if (ref < 1500000) return { foirPct: 0.6, desc: "Income < ₹15 Lakhs (60%)" };
    return { foirPct: 0.7, desc: "Income ≥ ₹15 Lakhs (70%)", notes: "Subject to ₹50,000 minimum net take-home surplus condition" };
  } else {
    // Default (HDFC, AXIS, KOTAK)
    if (isSalaried) return { foirPct: 0.5, desc: "Standard Salaried Benchmark (50%)", notes: "Default benchmark" };
    return { foirPct: 0.6, desc: "Standard Self-Employed Benchmark (60%)", notes: "Default benchmark" };
  }
}

export function computePhase2FoirResult(
  averageIncome: number,
  occupation: string,
  existingEmi: number,
): Phase2FoirCalculationResponse {
  const isSalaried = occupation.toLowerCase().includes("salaried");
  const workType = isSalaried ? "Salaried" : "Self-Employed";
  const averageMonthly = Math.round((averageIncome / 12) * 100) / 100;
  const baseIncome = isSalaried ? averageMonthly : Math.round(averageIncome * 100) / 100;
  const emi = Math.max(0, Number(existingEmi) || 0);

  const bankNames: Record<string, string> = {
    BOB: "Bank of Baroda",
    BOM: "Bank of Maharashtra",
    BOI: "Bank of India",
    IOB: "Indian Overseas Bank",
    INDIAN_BANK: "Indian Bank",
    HDFC: "HDFC Bank",
    AXIS: "Axis Bank",
    KOTAK: "Kotak Mahindra Bank",
  };

  const allBanks = ["BOB", "BOM", "BOI", "IOB", "INDIAN_BANK", "HDFC", "AXIS", "KOTAK"];
  const results: Record<string, BankFoirDetail> = {};

  for (const code of allBanks) {
    const { foirPct, desc, notes } = getBankFoirRatioClient(code, workType, averageIncome);
    const foirBasedIncome = Math.round(baseIncome * foirPct * 100) / 100;
    const finalProcessed = Math.round((foirBasedIncome - emi) * 100) / 100;

    results[code] = {
      bank_code: code,
      bank_name: bankNames[code] || code,
      work_type: workType,
      base_income: baseIncome,
      foir_percentage: foirPct,
      foir_based_income: foirBasedIncome,
      existing_emi: emi,
      final_processed_income: finalProcessed,
      bracket_description: desc,
      notes,
    };
  }

  return {
    average_income: averageIncome,
    average_monthly_income: averageMonthly,
    occupation: workType,
    existing_emi: emi,
    bank_foir_results: results,
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
  payslipVerified: { filename: string; evidence: Record<string, unknown> } | null;
  coiVerified: { filename: string; evidence: Record<string, unknown> } | null;
  itrVerified: { filename: string; evidence: Record<string, unknown> } | null;
  itrRecords: Record<string, ItrRecord>;
  coiRecords: Record<string, CoiRecord>;

  // Phase 1: 2-Year Document-Based Income Data
  currentYearDocData: YearlyIncomeInput;
  prevYearDocData: YearlyIncomeInput;
  phase1IncomeResult: Phase1IncomeCalculationResponse;

  // Phase 2: Bank FOIR & Processed Income Data
  phase2FoirResult: Phase2FoirCalculationResponse;
  setExistingEmi: (amount: number | "") => void;

  setField: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  updatePhase1DocData: (year: "current" | "previous", patch: Partial<YearlyIncomeInput>) => void;
  // Bureau fields read off an uploaded CIBIL report. Set together so the
  // verified badge and the locked inputs can never disagree about their source.
  applyCibilExtraction: (fields: Record<string, unknown>, filename: string) => void;
  clearCibilExtraction: () => void;
  applyPayslipExtraction: (fields: Record<string, unknown>, filename: string) => void;
  clearPayslipExtraction: () => void;
  applyCoiExtraction: (data: Record<string, unknown>, filename: string) => void;
  clearCoiExtraction: () => void;
  applyItrExtraction: (data: Record<string, unknown>, filename: string) => void;
  clearItrExtraction: () => void;
  setItrRecord: (id: string, record: ItrRecord | null) => void;
  setCoiRecord: (id: string, record: CoiRecord | null) => void;
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
  payslipVerified: null,
  coiVerified: null,
  itrVerified: null,
  itrRecords: {},
  coiRecords: {},

  currentYearDocData: INITIAL_YEARLY_INCOME,
  prevYearDocData: INITIAL_YEARLY_INCOME,
  phase1IncomeResult: computePhase1IncomeResult(INITIAL_YEARLY_INCOME, INITIAL_YEARLY_INCOME),
  phase2FoirResult: computePhase2FoirResult(0, "Self-Employed", 0),

  setExistingEmi: (amount) =>
    set((state) => {
      const draft = { ...state.draft, existingEmi: amount };
      const occupation = profileTypeFor(draft);
      const emi = Number(amount || 0);
      const avgIncome = state.phase1IncomeResult.average_income;
      const phase2FoirResult = computePhase2FoirResult(avgIncome, occupation, emi);
      return { draft, phase2FoirResult };
    }),

  updatePhase1DocData: (year, patch) =>
    set((state) => {
      const current = year === "current" ? { ...state.currentYearDocData, ...patch } : state.currentYearDocData;
      const prev = year === "previous" ? { ...state.prevYearDocData, ...patch } : state.prevYearDocData;
      const phase1IncomeResult = computePhase1IncomeResult(current, prev);
      const occupation = profileTypeFor(state.draft);
      const emi = Number(state.draft.existingEmi || 0);
      const phase2FoirResult = computePhase2FoirResult(phase1IncomeResult.average_income, occupation, emi);

      const draft = { ...state.draft };
      if (occupation === "Salaried" && phase1IncomeResult.average_income > 0) {
        draft.grossSalary = phase2FoirResult.average_monthly_income;
      }

      return {
        draft,
        currentYearDocData: current,
        prevYearDocData: prev,
        phase1IncomeResult,
        phase2FoirResult,
      };
    }),

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
      let phase2FoirResult = state.phase2FoirResult;
      if (key === "existingEmi" || key === "occupation" || key === "entityType") {
        const occupation = profileTypeFor(draft);
        const emi = Number(draft.existingEmi || 0);
        phase2FoirResult = computePhase2FoirResult(state.phase1IncomeResult.average_income, occupation, emi);
      }
      return { draft, phase2FoirResult, error: null };
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

  applyPayslipExtraction: (fields, filename) =>
    set((state) => {
      const draft = { ...state.draft };
      const evaluated = (fields.evaluated as Record<string, unknown>) ?? {};
      const gross = Number(evaluated.monthlyGrossSalary ?? fields.grossSalary ?? 0);
      if (gross > 0) {
        draft.grossSalary = gross;
      }
      const paymentMethod = String(evaluated.salaryPaymentMethod ?? fields.salaryPaymentMethod ?? "");
      if (paymentMethod === "Bank Account") {
        draft.salaryMode = "Salary payment mode- Bank Credit";
      } else if (paymentMethod === "Cash") {
        draft.salaryMode = "Salary payment mode-Cash";
      }

      const breakdown = (fields.transparentBreakdown as Record<string, unknown>) ?? {};
      const metadata = (breakdown.employeeMetadata as Record<string, unknown>) ?? {};
      const applicantName = String(metadata.applicantName ?? fields.applicantName ?? "");
      const panNumber = String(metadata.panNumber ?? fields.panNumber ?? "");

      if (applicantName && !draft.applicantName) {
        draft.applicantName = applicantName;
      }
      if (panNumber && !draft.pan) {
        draft.pan = panNumber;
      }
      return { draft, payslipVerified: { filename, evidence: fields }, error: null };
    }),

  clearPayslipExtraction: () => set({ payslipVerified: null }),

  applyCoiExtraction: (fields, filename) =>
    set((state) => {
      const draft = { ...state.draft };
      const summary = (fields.summary as Record<string, unknown>) ?? {};
      const assessee = (fields.assessee_info as Record<string, unknown>) ?? {};

      const applicantName = String(summary.assessee_name ?? assessee.name ?? "");
      const panNumber = String(summary.pan ?? assessee.pan ?? "");

      if (applicantName && !draft.applicantName) {
        draft.applicantName = applicantName;
      }
      if (panNumber && !draft.pan) {
        draft.pan = panNumber;
      }

      return { draft, coiVerified: { filename, evidence: fields }, error: null };
    }),

  clearCoiExtraction: () => set({ coiVerified: null }),

  applyItrExtraction: (data, filename) =>
    set((state) => {
      const draft = { ...state.draft };
      const rawData = (data.data as Record<string, unknown>) ?? data;
      const assessee = (rawData.assessee_info as Record<string, unknown>) ?? {};

      const applicantName = String(assessee.name ?? "");
      const panNumber = String(assessee.pan ?? "");

      if (applicantName && !draft.applicantName) {
        draft.applicantName = applicantName;
      }
      if (panNumber && !draft.pan) {
        draft.pan = panNumber;
      }

      return { draft, itrVerified: { filename, evidence: rawData }, error: null };
    }),

  clearItrExtraction: () => set({ itrVerified: null }),

  setItrRecord: (id, record) =>
    set((state) => {
      const nextRecords = { ...state.itrRecords };
      if (record) {
        nextRecords[id] = record;
      } else {
        delete nextRecords[id];
      }
      return { itrRecords: nextRecords };
    }),

  setCoiRecord: (id, record) =>
    set((state) => {
      const nextRecords = { ...state.coiRecords };
      if (record) {
        nextRecords[id] = record;
      } else {
        delete nextRecords[id];
      }
      return { coiRecords: nextRecords };
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
    const { draft, phase1IncomeResult } = get();
    set({ submitting: true, error: null });
    try {
      const result = await evaluateOnboardingForm(
        buildPayload(draft, phase1IncomeResult.average_income)
      );
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

  reset: () =>
    set({
      draft: INITIAL_DRAFT,
      stepId: 1,
      result: null,
      error: null,
      cibilVerified: null,
      payslipVerified: null,
      coiVerified: null,
      itrVerified: null,
      itrRecords: {},
      coiRecords: {},
      phase2FoirResult: computePhase2FoirResult(0, "Self-Employed", 0),
    }),

}));
