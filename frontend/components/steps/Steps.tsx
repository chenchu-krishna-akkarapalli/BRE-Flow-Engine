"use client";

import { useState, useEffect } from "react";
import { Checkbox, Field, RadioCards, Select, TextInput } from "@/components/Field";
import {
  ACCOUNT_BANKS, AGE_RELATIONS, BUSINESS_ENTITIES, CAR_LOAN_BANKS, CITIZENSHIP,
  EMPLOYER_TYPES, ENTITY_TYPES, FORM16_STATUS, GENDERS, INCOME_RELATIONS, INDUSTRIES,
  ITR_FILING, LOAN_TYPES, MARITAL, PATTERNS, RENTAL_INCOME, RESIDENCE, SALARY_BANDS,
  TENURE_BAND_MONTHS, totalWorkExperienceYears,
  SALARY_MODES, TENURE_BANDS, WRITE_OFF_FLAGS,
} from "@/lib/form-schema";
import { isBothRented, profileTypeFor, useOnboardingStore, workflowFor } from "@/store/useOnboardingStore";
import type { Draft } from "@/store/useOnboardingStore";

/** Format validation runs locally against the same patterns the API enforces,
 *  so a malformed PAN never costs a round trip. */
function invalid(pattern: RegExp, value: string, message: string): string | undefined {
  if (value.trim() === "") return undefined;
  return pattern.test(value) ? undefined : message;
}

function useField() {
  const draft = useOnboardingStore((s) => s.draft);
  const setField = useOnboardingStore((s) => s.setField);
  return { draft, set: setField };
}

const num = (v: string) => (v === "" ? 0 : Number(v));

export function Step1Identity() {
  const { draft, set } = useField();
  const k = <K extends keyof Draft>(key: K) => (v: Draft[K]) => set(key, v);

  return (
    <div className="flex flex-col gap-6">
      <Field label="Full Name" htmlFor="applicantName">
        <TextInput id="applicantName" value={draft.applicantName} onChange={k("applicantName")} />
      </Field>

      <Field label="Who is applying today?" htmlFor="entityType">
        <RadioCards
          name="entityType"
          value={draft.entityType}
          onChange={(v) => set("entityType", v as Draft["entityType"])}
          options={ENTITY_TYPES}
        />
      </Field>

      {draft.entityType === "Individual" && (
        <>
          <Field label="Date of Birth" htmlFor="dob">
            <TextInput id="dob" type="date" value={draft.dob} onChange={k("dob")} />
          </Field>
          <Field label="PAN" htmlFor="pan" error={invalid(PATTERNS.pan, draft.pan, "Format: ABCDE1234F")}>
            <TextInput id="pan" value={draft.pan} onChange={(v) => set("pan", v.toUpperCase())} placeholder="ABCDE1234F" numeric />
          </Field>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Gender" htmlFor="gender">
              <Select id="gender" value={draft.gender} onChange={k("gender")} options={GENDERS} placeholder="Select" />
            </Field>
            <Field label="Marital Status" htmlFor="maritalStatus">
              <Select id="maritalStatus" value={draft.maritalStatus} onChange={k("maritalStatus")} options={MARITAL} placeholder="Select" />
            </Field>
          </div>
          <Field label="Citizenship / Residency" htmlFor="citizenshipStatus">
            <Select id="citizenshipStatus" value={draft.citizenshipStatus} onChange={k("citizenshipStatus")} options={CITIZENSHIP} />
          </Field>
          {draft.citizenshipStatus === "NRI/PIO" && (
            <Field label="NRI Stay Period in India (months)" htmlFor="nriStayPeriod">
              <TextInput id="nriStayPeriod" type="number" value={draft.nriStayPeriod} onChange={(v) => set("nriStayPeriod", num(v))} numeric />
            </Field>
          )}
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Phone" htmlFor="phone" error={invalid(PATTERNS.phone, draft.phone, "10 digits, starting 6–9")}>
              <TextInput id="phone" value={draft.phone} onChange={k("phone")} numeric />
            </Field>
            <Field label="Email" htmlFor="email" error={invalid(PATTERNS.email, draft.email, "Enter a valid email")}>
              <TextInput id="email" type="email" value={draft.email} onChange={k("email")} />
            </Field>
          </div>
        </>
      )}

      {draft.entityType === "Company" && (
        <>
          <Field label="Registered Company Name" htmlFor="companyName">
            <TextInput id="companyName" value={draft.companyName} onChange={k("companyName")} />
          </Field>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Industry Type" htmlFor="companyIndustryType">
              <Select id="companyIndustryType" value={draft.companyIndustryType} onChange={k("companyIndustryType")} options={INDUSTRIES} placeholder="Select" />
            </Field>
            <Field label="Company PAN" htmlFor="companyPan" error={invalid(PATTERNS.pan, draft.companyPan, "Format: AABCT1234C")}>
              <TextInput id="companyPan" value={draft.companyPan} onChange={(v) => set("companyPan", v.toUpperCase())} numeric />
            </Field>
          </div>
          <Field label="Company Location" htmlFor="companyLocation">
            <TextInput id="companyLocation" value={draft.companyLocation} onChange={k("companyLocation")} placeholder="Registered / operating address" />
          </Field>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Contact Person Name" htmlFor="contactPersonName">
              <TextInput id="contactPersonName" value={draft.contactPersonName} onChange={k("contactPersonName")} />
            </Field>
            <Field label="Designation" htmlFor="contactPersonDesignation">
              <TextInput id="contactPersonDesignation" value={draft.contactPersonDesignation} onChange={k("contactPersonDesignation")} />
            </Field>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Mobile No." htmlFor="companyMobile" error={invalid(PATTERNS.phone, draft.companyMobile, "10 digits, starting 6–9")}>
              <TextInput id="companyMobile" value={draft.companyMobile} onChange={k("companyMobile")} numeric />
            </Field>
            <Field label="Email ID" htmlFor="companyEmail" error={invalid(PATTERNS.email, draft.companyEmail, "Enter a valid email")}>
              <TextInput id="companyEmail" type="email" value={draft.companyEmail} onChange={k("companyEmail")} />
            </Field>
          </div>
          <Field label="No. of Employees" htmlFor="companyEmployees">
            <TextInput id="companyEmployees" type="number" value={draft.companyEmployees} onChange={k("companyEmployees")} numeric />
          </Field>
        </>
      )}

      {draft.entityType === "HUF" && (
        <>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="HUF Name" htmlFor="hufName">
              <TextInput id="hufName" value={draft.hufName} onChange={k("hufName")} placeholder="e.g. Sharma HUF" />
            </Field>
            <Field label="HUF PAN" htmlFor="hufPan" error={invalid(PATTERNS.pan, draft.hufPan, "Format: AAAHS1234F")}>
              <TextInput id="hufPan" value={draft.hufPan} onChange={(v) => set("hufPan", v.toUpperCase())} numeric />
            </Field>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Udyam Registration No." htmlFor="udyamRegNoHUF">
              <TextInput id="udyamRegNoHUF" value={draft.udyamRegNoHUF} onChange={k("udyamRegNoHUF")} placeholder="UDYAM-XX-00-0000000" />
            </Field>
            <Field label="HUF Location" htmlFor="hufLocation">
              <TextInput id="hufLocation" value={draft.hufLocation} onChange={k("hufLocation")} />
            </Field>
          </div>
          <Field label="Date of HUF Formation / Deed" htmlFor="hufFormationDate">
            <TextInput id="hufFormationDate" type="date" value={draft.hufFormationDate} onChange={k("hufFormationDate")} />
          </Field>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Karta Name" htmlFor="kartaName">
              <TextInput id="kartaName" value={draft.kartaName} onChange={k("kartaName")} />
            </Field>
            <Field label="Karta PAN" htmlFor="kartaPan" error={invalid(PATTERNS.pan, draft.kartaPan, "Format: ABCDE1234F")}>
              <TextInput id="kartaPan" value={draft.kartaPan} onChange={(v) => set("kartaPan", v.toUpperCase())} numeric />
            </Field>
          </div>
          <Field label="Karta Mobile No." htmlFor="kartaMobile" error={invalid(PATTERNS.phone, draft.kartaMobile, "10 digits, starting 6–9")}>
            <TextInput id="kartaMobile" value={draft.kartaMobile} onChange={k("kartaMobile")} numeric />
          </Field>
        </>
      )}
    </div>
  );
}

export function Step2Address() {
  const { draft, set } = useField();
  const k = <K extends keyof Draft>(key: K) => (v: Draft[K]) => set(key, v);

  const [areas, setAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [pincodeError, setPincodeError] = useState("");
  const [selectedArea, setSelectedArea] = useState("");

  useEffect(() => {
    const pincode = draft.pincode || "";
    
    if (/^\d{6}$/.test(pincode)) {
      let isMounted = true;
      setLoading(true);
      setPincodeError("");

      fetch(`https://api.postalpincode.in/pincode/${pincode}`)
        .then((res) => res.json())
        .then((data) => {
          if (!isMounted) return;
          if (data[0] && data[0].Status === "Success" && data[0].PostOffice) {
            const postOffices = data[0].PostOffice;
            const district = postOffices[0].District;
            const state = postOffices[0].State;
            const areaNames = postOffices.map((office: any) => office.Name);

            // Auto-fill City & State
            set("cityName", district);
            set("stateName", state);
            setAreas(areaNames);

            // Auto-select area if only 1 option exists
            if (areaNames.length === 1) {
              setSelectedArea(areaNames[0]);
            }
          } else {
            setPincodeError("Invalid PIN Code");
            set("cityName", "");
            set("stateName", "");
            setAreas([]);
            setSelectedArea("");
          }
        })
        .catch(() => {
          if (isMounted) {
            setPincodeError("Failed to fetch location details");
            set("cityName", "");
            set("stateName", "");
            setAreas([]);
            setSelectedArea("");
          }
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });

      return () => {
        isMounted = false;
      };
    } else {
      setAreas([]);
      setSelectedArea("");
    }
  }, [draft.pincode, set]);

  return (
    <div className="flex flex-col gap-6">
      <Field label="Pincode" htmlFor="pincode" error={pincodeError || invalid(PATTERNS.pincode, draft.pincode, "6 digits")}>
        <div className="relative">
          <TextInput id="pincode" value={draft.pincode} onChange={k("pincode")} placeholder="560001" numeric />
          {loading && (
            <span className="absolute right-3 top-3 text-xs text-gray-400 animate-pulse">
              Fetching...
            </span>
          )}
        </div>
      </Field>

      {/* Area Selector - Appears only when Pincode API fetches results */}
      {areas.length > 0 && (
        <Field label="Area / Locality" htmlFor="areaName">
          {/* Note: If your Draft store has a field for area, you can bind it directly 
              using: value={draft.areaName} onChange={k("areaName")} instead of local state */}
          <Select
            id="areaName"
            value={selectedArea}
            onChange={setSelectedArea}
            options={areas}
            placeholder="Select Locality"
          />
        </Field>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="City" htmlFor="cityName">
          <TextInput id="cityName" value={draft.cityName} onChange={k("cityName")} />
        </Field>
        <Field label="State" htmlFor="stateName">
          <TextInput id="stateName" value={draft.stateName} onChange={k("stateName")} />
        </Field>
      </div>
      <Field label="Resident Details" htmlFor="residentDetails">
        <Select id="residentDetails" value={draft.residentDetails} onChange={k("residentDetails")} options={RESIDENCE} />
      </Field>
    </div>
  );
}

export function Step3Occupation() {
  const { draft, set } = useField();
  const k = <K extends keyof Draft>(key: K) => (v: Draft[K]) => set(key, v);
  const profile = profileTypeFor(draft);
  const shortTenure = draft.tenureBand !== "2y+";
  const totalExperience = shortTenure
    ? totalWorkExperienceYears(draft.prevCompanyJoining, draft.tenureBand)
    : null;

  return (
    <div className="flex flex-col gap-6">
      {draft.entityType === "Individual" && (
        <Field label="Occupation" htmlFor="occupation">
          <Select id="occupation" value={draft.occupation} onChange={(v) => set("occupation", v as Draft["occupation"])} options={["Salaried", "Self-Employed"]} />
        </Field>
      )}

      {profile === "Salaried" && (
        <>
          <Field label="Employment Type" htmlFor="employerType">
            <Select id="employerType" value={draft.employerType} onChange={k("employerType")} options={EMPLOYER_TYPES} placeholder="Select" />
          </Field>
          <Field label="With Current Company Since" htmlFor="tenureBand">
            <Select id="tenureBand" value={draft.tenureBand} onChange={k("tenureBand")} options={TENURE_BANDS} />
          </Field>
          {/* Under 2 years at the current employer, prior employment is what
              establishes total experience — the matrix scores the sum. */}
          {shortTenure && (
            <>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Previous Company Name" htmlFor="prevCompanyName">
                  <TextInput id="prevCompanyName" value={draft.prevCompanyName} onChange={k("prevCompanyName")} />
                </Field>
                <Field
                  label="Previous Joining Date"
                  htmlFor="prevCompanyJoining"
                  hint={
                    totalExperience === null
                      ? "Required — total experience is measured from this date."
                      : `Total work experience: ${totalExperience.toFixed(1)} years ` +
                        `(${(totalExperience - TENURE_BAND_MONTHS[draft.tenureBand] / 12).toFixed(1)} prior ` +
                        `+ ${(TENURE_BAND_MONTHS[draft.tenureBand] / 12).toFixed(1)} current)`
                  }
                >
                  <TextInput id="prevCompanyJoining" type="date" value={draft.prevCompanyJoining} onChange={k("prevCompanyJoining")} />
                </Field>
              </div>
              {totalExperience !== null && totalExperience < 2 && (
                <p className="rounded-md bg-warning-bg p-3 text-[0.8125rem] text-warning">
                  Most partner banks require at least 2 years of total work experience.
                </p>
              )}
            </>
          )}
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Approx. Gross Salary (₹)" htmlFor="grossSalaryBand">
              <Select id="grossSalaryBand" value={draft.grossSalaryBand} onChange={k("grossSalaryBand")} options={SALARY_BANDS} />
            </Field>
            <Field label="Salary Payment Mode" htmlFor="salaryMode">
              <Select id="salaryMode" value={draft.salaryMode} onChange={k("salaryMode")} options={SALARY_MODES} />
            </Field>
          </div>
          <Field label="Tax Proof Availability" htmlFor="form16Status">
            <Select id="form16Status" value={draft.form16Status} onChange={k("form16Status")} options={FORM16_STATUS} />
          </Field>
        </>
      )}

      {(profile === "Self-Employed" || profile === "HUF") && (
        <>
          <Field label="Office Address Type" htmlFor="officeAddressType">
            <Select id="officeAddressType" value={draft.officeAddressType} onChange={k("officeAddressType")} options={["Same", "Separate"]} />
          </Field>
          {draft.officeAddressType === "Separate" && (
            <>
              <Field label="Office Address" htmlFor="officeAddress">
                <TextInput id="officeAddress" value={draft.officeAddress} onChange={k("officeAddress")} />
              </Field>
              {profile === "Self-Employed" && (
                <Field label="Office Premises Status" htmlFor="officePremisesStatus">
                  <Select id="officePremisesStatus" value={draft.officePremisesStatus} onChange={k("officePremisesStatus")} options={["Owned", "Rented"]} placeholder="Select" />
                </Field>
              )}
            </>
          )}
          {isBothRented(draft) && (
            <Field
              label="Guarantor Arrangement"
              htmlFor="guarantorStatus"
              hint="Required when residence and office are both rented."
            >
              <Select id="guarantorStatus" value={draft.guarantorStatus} onChange={k("guarantorStatus")} options={[
                { value: "Without a Gaurantor", label: "Without a Guarantor" },
                { value: "With a Gaurantor", label: "With a Guarantor" },
              ]} placeholder="Select" />
            </Field>
          )}
          <Field label="Business Establishment / Reg. Date" htmlFor="businessEstablishmentDate">
            <TextInput id="businessEstablishmentDate" type="date" value={draft.businessEstablishmentDate} onChange={k("businessEstablishmentDate")} />
          </Field>
        </>
      )}

      {profile === "Self-Employed" && (
        <>
          <Field label="Business Entity Type" htmlFor="businessEntityType">
            <Select id="businessEntityType" value={draft.businessEntityType} onChange={k("businessEntityType")} options={BUSINESS_ENTITIES} />
          </Field>
          <Field label="Udyam Reg. No. / GSTIN / Business Proof" htmlFor="businessProof">
            <TextInput id="businessProof" value={draft.businessProof} onChange={k("businessProof")} placeholder="GSTIN: 29AAAAA0000A1Z5" />
          </Field>
          <div className="grid gap-6 sm:grid-cols-3">
            <Field label="Current Year ITR (₹)" htmlFor="currentITRAmount">
              <TextInput id="currentITRAmount" type="number" value={draft.currentITRAmount} onChange={(v) => set("currentITRAmount", num(v))} numeric />
            </Field>
            <Field label="Previous Year ITR (₹)" htmlFor="prevITRAmount">
              <TextInput id="prevITRAmount" type="number" value={draft.prevITRAmount} onChange={(v) => set("prevITRAmount", num(v))} numeric />
            </Field>
            <Field label="Business ITR (₹)" htmlFor="businessItrAmount">
              <TextInput id="businessItrAmount" type="number" value={draft.businessItrAmount} onChange={(v) => set("businessItrAmount", num(v))} numeric />
            </Field>
          </div>
        </>
      )}

      {profile === "HUF" && (
        <>
          <Field label="Udyam Registration No." htmlFor="udyamRegNoSelfEmployed">
            <TextInput id="udyamRegNoSelfEmployed" value={draft.udyamRegNoSelfEmployed} onChange={k("udyamRegNoSelfEmployed")} placeholder="UDYAM-XX-00-0000000" />
          </Field>
          <Field label="ITR Filing Status" htmlFor="itrFilingStatus">
            <Select id="itrFilingStatus" value={draft.itrFilingStatus} onChange={k("itrFilingStatus")} options={ITR_FILING} />
          </Field>
          {draft.itrFilingStatus === "Self employed ITR Filled" && (
            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="Current Year ITR (₹)" htmlFor="hufCurrentITR">
                <TextInput id="hufCurrentITR" type="number" value={draft.currentITRAmount} onChange={(v) => set("currentITRAmount", num(v))} numeric />
              </Field>
              <Field label="Previous Year ITR (₹)" htmlFor="hufPrevITR">
                <TextInput id="hufPrevITR" type="number" value={draft.prevITRAmount} onChange={(v) => set("prevITRAmount", num(v))} numeric />
              </Field>
            </div>
          )}
          <Field label="Business Registration Proof / GSTIN" htmlFor="hufBusinessProof">
            <TextInput id="hufBusinessProof" value={draft.businessProof} onChange={k("businessProof")} />
          </Field>
        </>
      )}

      {profile === "Company" && (
        <>
          <Field label="Business Establishment / Incorporation Date" htmlFor="companyEstablishmentDate">
            <TextInput id="companyEstablishmentDate" type="date" value={draft.companyEstablishmentDate} onChange={k("companyEstablishmentDate")} />
          </Field>
          <Field label="Udyam Reg. No. / GSTIN No." htmlFor="companyGstin">
            <TextInput id="companyGstin" value={draft.companyGstin} onChange={k("companyGstin")} placeholder="UDYAM-XX-00-0000000 or GSTIN" />
          </Field>
          <div className="grid gap-6 sm:grid-cols-3">
            <Field label="Current Year ITR (₹)" htmlFor="companyCurrentITRAmount">
              <TextInput id="companyCurrentITRAmount" type="number" value={draft.companyCurrentITRAmount} onChange={(v) => set("companyCurrentITRAmount", num(v))} numeric />
            </Field>
            <Field label="Previous Year ITR (₹)" htmlFor="companyPrevITRAmount">
              <TextInput id="companyPrevITRAmount" type="number" value={draft.companyPrevITRAmount} onChange={(v) => set("companyPrevITRAmount", num(v))} numeric />
            </Field>
            <Field label="Business ITR (₹)" htmlFor="businessItrAmountCompany">
              <TextInput id="businessItrAmountCompany" type="number" value={draft.businessItrAmountCompany} onChange={(v) => set("businessItrAmountCompany", num(v))} numeric />
            </Field>
          </div>
        </>
      )}

      {profile !== "Company" && (
        <Field label="Secondary Rental Income Status" htmlFor="rentalIncomeType">
          <Select id="rentalIncomeType" value={draft.rentalIncomeType} onChange={k("rentalIncomeType")} options={RENTAL_INCOME} />
        </Field>
      )}
    </div>
  );
}

export function Step4Banking() {
  const { draft, set } = useField();
  const k = <K extends keyof Draft>(key: K) => (v: Draft[K]) => set(key, v);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Existing Current/Savings A/c With" htmlFor="existingAccountBank" hint="Selects the primary bank policy applied.">
          <Select id="existingAccountBank" value={draft.existingAccountBank} onChange={k("existingAccountBank")} options={ACCOUNT_BANKS} />
        </Field>
        <Field label="Car Loan (Existing / Closed) With" htmlFor="existingCarLoanBank">
          <Select id="existingCarLoanBank" value={draft.existingCarLoanBank} onChange={k("existingCarLoanBank")} options={CAR_LOAN_BANKS} />
        </Field>
      </div>

      <Field label="Type of Loan Required" htmlFor="loanType">
        <Select id="loanType" value={draft.loanType} onChange={k("loanType")} options={LOAN_TYPES} />
      </Field>

      <div className="grid gap-6 sm:grid-cols-3">
        <Field label="CIBIL Score" htmlFor="bureauCibilScore">
          <TextInput id="bureauCibilScore" type="number" value={draft.bureauCibilScore} onChange={(v) => set("bureauCibilScore", num(v))} numeric />
        </Field>
        <Field label="DPD (Days Past Due)" htmlFor="bureauDpd">
          <TextInput id="bureauDpd" type="number" value={draft.bureauDpd} onChange={(v) => set("bureauDpd", num(v))} numeric />
        </Field>
        <Field label="Loan Enquiry (count)" htmlFor="bureauLoanEnquiry">
          <TextInput id="bureauLoanEnquiry" type="number" value={draft.bureauLoanEnquiry} onChange={(v) => set("bureauLoanEnquiry", num(v))} numeric />
        </Field>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Currently Outstanding (₹)" htmlFor="bureauCurrentlyOutstanding">
          <TextInput id="bureauCurrentlyOutstanding" type="number" value={draft.bureauCurrentlyOutstanding} onChange={(v) => set("bureauCurrentlyOutstanding", num(v))} numeric />
        </Field>
        {workflowFor(draft.entityType) === "INDIVIDUAL" && (
          <Field label="Age at Last EMI" htmlFor="bureauAgeAtLastEMI">
            <TextInput id="bureauAgeAtLastEMI" type="number" value={draft.bureauAgeAtLastEMI} onChange={(v) => set("bureauAgeAtLastEMI", num(v))} numeric />
          </Field>
        )}
      </div>

      <Checkbox id="cibilPlScoreToggle" checked={draft.cibilPlScoreToggle} onChange={(v) => set("cibilPlScoreToggle", v)} label="Is CIBIL PL Score available?" />
      {draft.cibilPlScoreToggle && (
        <Field label="CIBIL PL Score" htmlFor="bureauCibilPlScore">
          <TextInput id="bureauCibilPlScore" type="number" value={draft.bureauCibilPlScore} onChange={(v) => set("bureauCibilPlScore", num(v))} numeric />
        </Field>
      )}

      <fieldset className="rounded-md border border-line p-4">
        <legend className="px-2 text-[0.8125rem] text-ink-muted">Write-offs on record</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {WRITE_OFF_FLAGS.map((flag) => (
            <Checkbox
              key={flag.key}
              id={flag.key}
              checked={draft[flag.key]}
              onChange={(v) => set(flag.key, v)}
              label={flag.label}
            />
          ))}
        </div>
      </fieldset>

      {draft.bureauFlagCC && (
        <Field label="Write-Off Amount (₹)" htmlFor="bureauWriteOffAmount" hint="Required when a credit-card write-off is on record.">
          <TextInput id="bureauWriteOffAmount" type="number" value={draft.bureauWriteOffAmount} onChange={(v) => set("bureauWriteOffAmount", num(v))} numeric />
        </Field>
      )}
    </div>
  );
}

export function Step5CoApplicant() {
  const { draft, set } = useField();
  const k = <K extends keyof Draft>(key: K) => (v: Draft[K]) => set(key, v);
  const pooling = draft.coAppIncomeRelation !== "None";

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Co-Applicant for Age Extension" htmlFor="coAppAgeRelation">
          <Select id="coAppAgeRelation" value={draft.coAppAgeRelation} onChange={k("coAppAgeRelation")} options={AGE_RELATIONS} />
        </Field>
        <Field label="Co-Applicant for Income Pooling" htmlFor="coAppIncomeRelation">
          <Select id="coAppIncomeRelation" value={draft.coAppIncomeRelation} onChange={k("coAppIncomeRelation")} options={INCOME_RELATIONS} />
        </Field>
      </div>
      {pooling && (
        <div className="grid gap-6 sm:grid-cols-3">
          <Field label="Co-Applicant Name" htmlFor="coApplicantName">
            <TextInput id="coApplicantName" value={draft.coApplicantName} onChange={k("coApplicantName")} />
          </Field>
          <Field label="Co-Applicant DOB" htmlFor="coApplicantDob">
            <TextInput id="coApplicantDob" type="date" value={draft.coApplicantDob} onChange={k("coApplicantDob")} />
          </Field>
          <Field label="Occupation Type" htmlFor="coApplicantOccupation">
            <Select id="coApplicantOccupation" value={draft.coApplicantOccupation} onChange={k("coApplicantOccupation")} options={["Salaried", "Self-Employed"]} placeholder="Select" />
          </Field>
        </div>
      )}
    </div>
  );
}