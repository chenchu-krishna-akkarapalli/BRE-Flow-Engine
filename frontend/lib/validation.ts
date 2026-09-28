import { PATTERNS } from "./form-schema";
import type { Draft } from "../store/useOnboardingStore";

export interface StepValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export const VALIDATION_PATTERNS = {
  ...PATTERNS,
  aadhaar: /^\d{12}$/,
  companyPan: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
};

/**
 * Validates format and presence of all required fields for a specific wizard step.
 */
export function validateStep(stepNum: number, draft: Draft): StepValidationResult {
  const errors: Record<string, string> = {};

  if (stepNum === 1) {
    if (draft.entityType === "Individual") {
      if (!draft.applicantName?.trim()) {
        errors.applicantName = "Full legal name is required.";
      }
      if (!draft.dob) {
        errors.dob = "Date of birth is required.";
      }
      if (!draft.gender) {
        errors.gender = "Please select your gender.";
      }
      if (!draft.pan?.trim()) {
        errors.pan = "PAN number is required.";
      } else if (!VALIDATION_PATTERNS.pan.test(draft.pan.toUpperCase())) {
        errors.pan = "Enter a valid 10-character PAN (e.g., ABCDE1234F).";
      }
      if (!draft.phone?.trim()) {
        errors.phone = "Mobile number is required.";
      } else if (!VALIDATION_PATTERNS.phone.test(draft.phone)) {
        errors.phone = "Enter a valid 10-digit Indian mobile number.";
      }
      if (!draft.email?.trim()) {
        errors.email = "Email address is required.";
      } else if (!VALIDATION_PATTERNS.email.test(draft.email)) {
        errors.email = "Enter a valid email address.";
      }
    } else {
      // Company entity
      if (!draft.companyName?.trim()) {
        errors.companyName = "Company or organisation name is required.";
      }
      if (!draft.companyType) {
        errors.companyType = "Please select the legal constitution.";
      }
      if (!draft.companyPan?.trim()) {
        errors.companyPan = "Company PAN is required.";
      } else if (!VALIDATION_PATTERNS.companyPan.test(draft.companyPan.toUpperCase())) {
        errors.companyPan = "Enter a valid 10-character Company PAN.";
      }
      if (!draft.contactPersonName?.trim()) {
        errors.contactPersonName = "Contact person name is required.";
      }
      if (!draft.companyMobile?.trim()) {
        errors.companyMobile = "Mobile number is required.";
      } else if (!VALIDATION_PATTERNS.phone.test(draft.companyMobile)) {
        errors.companyMobile = "Enter a valid 10-digit mobile number.";
      }
      if (!draft.companyEmail?.trim()) {
        errors.companyEmail = "Corporate email is required.";
      } else if (!VALIDATION_PATTERNS.email.test(draft.companyEmail)) {
        errors.companyEmail = "Enter a valid corporate email address.";
      }
    }
  } else if (stepNum === 2) {
    if (draft.entityType === "Individual") {
      if (!draft.pincode?.trim()) {
        errors.pincode = "PIN code is required.";
      } else if (!VALIDATION_PATTERNS.pincode.test(draft.pincode)) {
        errors.pincode = "Enter a valid 6-digit Indian PIN code.";
      }
      if (!draft.cityName?.trim()) {
        errors.cityName = "City name is required.";
      }
      if (!draft.stateName?.trim()) {
        errors.stateName = "State is required.";
      }
      if (!draft.residentDetails) {
        errors.residentDetails = "Please specify residential ownership status.";
      }
      if (draft.addressProofType === "Aadhaar Card" && draft.aadhaarNumber?.trim()) {
        const rawAadhaar = draft.aadhaarNumber.replace(/\s+/g, "");
        if (!VALIDATION_PATTERNS.aadhaar.test(rawAadhaar)) {
          errors.aadhaarNumber = "Enter a valid 12-digit Aadhaar number.";
        }
      }
    }
  } else if (stepNum === 3) {
    if (draft.entityType === "Individual") {
      if (!draft.occupation) {
        errors.occupation = "Please select your primary source of income.";
      } else if (draft.occupation === "Salaried") {
        if (!draft.employerType) {
          errors.employerType = "Please select your employer type.";
        }
        if (draft.grossSalary === "" || draft.grossSalary === null || draft.grossSalary === undefined || Number(draft.grossSalary) <= 0) {
          errors.grossSalary = "Gross monthly salary must be greater than zero.";
        }
        if (!draft.salaryMode) {
          errors.salaryMode = "Please select how your salary is disbursed.";
        }
      } else if (draft.occupation === "Self-Employed") {
        if (!draft.businessEntityType) {
          errors.businessEntityType = "Please select your business entity type.";
        }
        if (draft.businessEntityType === "Agriculture") {
          if (!draft.agriculturalLandLocation?.trim()) {
            errors.agriculturalLandLocation = "Location of agricultural land is required.";
          }
          if (draft.annualAgriculturalIncome === "" || draft.annualAgriculturalIncome === null || Number(draft.annualAgriculturalIncome) <= 0) {
            errors.annualAgriculturalIncome = "Annual agricultural income is required.";
          }
        } else {
          if (draft.currentITRAmount === "" || draft.currentITRAmount === null || draft.currentITRAmount === undefined) {
            errors.currentITRAmount = "Current year income / ITR amount is required.";
          }
        }
      } else if (draft.occupation === "Rental Income") {
        if (!draft.rentalPropertyAddress?.trim()) {
          errors.rentalPropertyAddress = "Rental property address is required.";
        }
        if (draft.rentalIncomeAmount === "" || draft.rentalIncomeAmount === null || Number(draft.rentalIncomeAmount) <= 0) {
          errors.rentalIncomeAmount = "Rental income amount is required.";
        }
      }
    } else {
      // Company occupation
      if (!draft.companyEstablishmentDate) {
        errors.companyEstablishmentDate = "Establishment date is required.";
      }
      if (draft.companyCurrentITRAmount === "" || draft.companyCurrentITRAmount === null || draft.companyCurrentITRAmount === undefined) {
        errors.companyCurrentITRAmount = "Current year financial / ITR amount is required.";
      }
    }
  } else if (stepNum === 4) {
    if (!draft.existingAccountBank) {
      errors.existingAccountBank = "Please select your primary operational bank.";
    }
  } else if (stepNum === 5) {
    // Co-applicant is optional; if an age relation is specified, ensure coApplicantName is present
    if (draft.coAppAgeRelation && draft.coAppAgeRelation !== "None") {
      if (!draft.coApplicantName?.trim()) {
        errors.coApplicantName = "Co-applicant name is required when a relation is selected.";
      }
    }
  } else if (stepNum === 6) {
    // Step 6: Phase 1 Income Assessment review
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Fast boolean check for step gating and preheating.
 */
export function isStepValid(stepNum: number, draft: Draft): boolean {
  return validateStep(stepNum, draft).isValid;
}
