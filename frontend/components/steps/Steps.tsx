"use client";

import { useState, useEffect, useRef } from "react";
import { Checkbox, Field, RadioCards, Select, TextInput, SearchableSelect } from "@/components/Field";
import {
  ACCOUNT_BANKS, AGE_RELATIONS, BUSINESS_ENTITIES, CAR_LOAN_BANKS, CITIZENSHIP,
  ADDRESS_PROOF_DETAIL, ADDRESS_PROOF_HELPER, ADDRESS_PROOF_TYPES, formatAadhaar,
  EMPLOYER_TYPES, ENTITY_TYPES, GENDERS, INCOME_PROOF,
  INCOME_RELATIONS,
  LOAN_TYPES, MARITAL, PATTERNS, RENTAL_INCOME, RESIDENCE,
  COMPANY_TYPES, YES_NO,
  totalWorkExperienceYears,
  SALARY_MODES, TENURE_BANDS, WRITE_OFF_FLAGS,
} from "@/lib/form-schema";
import { CibilUpload } from "@/components/CibilUpload";
import { DocumentUpload } from "@/components/DocumentUpload";
import { VerifyField } from "@/components/VerifyField";
import {
  LOAN_TENOR_YEARS, ageAtLastEmiFor, isResiCumOfficeRented, needsCoApplicant,
  profileTypeFor, useOnboardingStore,
} from "@/store/useOnboardingStore";
import type { Draft } from "@/store/useOnboardingStore";

// Every control is phrased as a question answerable without banking vocabulary.

// Format checks run locally against the API's own patterns, so a bad PAN costs no round trip.
function invalid(pattern: RegExp, value: string, message: string): string | undefined {
  if (value.trim() === "") return undefined;
  return pattern.test(value) ? undefined : message;
}

function useField() {
  const draft = useOnboardingStore((s) => s.draft);
  const setField = useOnboardingStore((s) => s.setField);
  return { draft, set: setField };
}

const num = (v: string) => (v === "" ? "" : Number(v));

// Yes/no answers are stored as booleans but rendered as cards.
const yn = (v: boolean) => (v ? "yes" : "no");

// An ITR amount with its own Upload and Verify, used by both occupation flows.
function ItrField({
  id, label, value, onChange,
}: {
  id: string; label: string; value: number | ""; onChange: (v: number | "") => void;
}) {
  const [verified, setVerified] = useState(false);
  return (
    <Field label={label} htmlFor={id}>
      <div className="flex flex-col gap-3">
        <TextInput
          id={id}
          type="number"
          value={value}
          onChange={(v) => { onChange(num(v)); setVerified(false); }}
          placeholder="Amount in ₹"
          numeric
          verified={verified}
        />
        <div className="flex flex-wrap items-start gap-3">
          <DocumentUpload id={`${id}Upload`} documentType="pan" label="Upload" />
          <VerifyField
            channel="email"
            target={`${id}@document.verify`}
            verified={verified}
            onVerified={setVerified}
            label="Verify"
          />
        </div>
      </div>
    </Field>
  );
}

// add-on.md §4: derived from the DOB, never asked. Shown so the applicant can
// see the number the banks score, and so a missing DOB is visibly the cause.
function AgeAtLastEmi() {
  const draft = useOnboardingStore((s) => s.draft);
  const age = ageAtLastEmiFor(draft);
  return (
    <Field label="Age at Last EMI" htmlFor="ageAtLastEmi">
      <output
        id="ageAtLastEmi"
        className="flex min-h-[48px] items-center rounded-xl border border-line bg-bg-raised px-4 py-3 text-[0.9375rem] text-ink"
      >
        {age === null
          ? "Add your date of birth in step 1 and this fills in."
          : `${age} years — your age today plus the ${LOAN_TENOR_YEARS}-year loan term.`}
      </output>
    </Field>
  );
}

// Yes/no radio in front of the rental-income category dropdown (add-on.md §3.2c).
function RentalIncomeQuestion() {
  const { draft, set } = useField();
  return (
    <>
      <Field label="Do you earn any rent from a property you own?" htmlFor="hasRentalIncome">
        <RadioCards
          name="hasRentalIncome"
          label="Do you earn any rent from a property you own?"
          value={yn(draft.hasRentalIncome)}
          onChange={(v) => set("hasRentalIncome", v === "yes")}
          options={YES_NO}
        />
      </Field>
      {draft.hasRentalIncome && (
        <Field label="How is that rental income documented?" htmlFor="rentalIncomeType">
          <Select
            id="rentalIncomeType"
            value={draft.rentalIncomeType}
            onChange={(v) => set("rentalIncomeType", v)}
            options={RENTAL_INCOME}
          />
        </Field>
      )}
    </>
  );
}

export function Step1Identity() {
  const { draft, set } = useField();
  const k = <K extends keyof Draft>(key: K) => (v: Draft[K]) => set(key, v);

  return (
    <div className="flex flex-col gap-6"> 
     <Field label="What is your full name as printed on your ID card?" htmlFor="applicantName">
        <TextInput id="applicantName" value={draft.applicantName} onChange={k("applicantName")} />
      </Field>

      <Field label="Who is applying for this loan?" htmlFor="entityType">
        <RadioCards
          name="entityType"
          label="Who is applying for this loan?"
          value={draft.entityType}
          onChange={(v) => set("entityType", v as Draft["entityType"])}
          options={ENTITY_TYPES}
        />
      </Field>

    

      {draft.entityType === "Individual" && (
        <>
          <Field label="Date of Birth (DOB)" htmlFor="dob">
            <TextInput id="dob" type="date" value={draft.dob} onChange={k("dob")} />
          </Field>

          <Field
            label="PAN Number"
            htmlFor="pan"
            error={invalid(PATTERNS.pan, draft.pan, "This does not look like a PAN. It should read like ABCDE1234F.")}
          >
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-[220px] flex-1">
                  <TextInput
                    id="pan"
                    value={draft.pan}
                    onChange={(v) => { set("pan", v.toUpperCase()); set("panVerified", false); }}
                    placeholder="ABCDE1234F"
                    numeric
                    verified={draft.panVerified}
                  />
                </div>
                <VerifyField
                  channel="email"
                  target={draft.email}
                  verified={draft.panVerified}
                  onVerified={(v) => set("panVerified", v)}
                />
              </div>
              <DocumentUpload
                id="panUpload"
                documentType="pan"
                label="Upload PAN card"
                onExtracted={(fields) => {
                  if (fields.pan) set("pan", fields.pan.toUpperCase());
                  if (fields.dob && !draft.dob) set("dob", fields.dob);
                }}
              />
            </div>
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="What is your gender?" htmlFor="gender">
              <Select id="gender" value={draft.gender} onChange={k("gender")} options={GENDERS} />
            </Field>
            <Field label="Are you married?" htmlFor="maritalStatus">
              <Select id="maritalStatus" value={draft.maritalStatus} onChange={k("maritalStatus")} options={MARITAL} />
            </Field>
          </div>

          <Field label="Do you live in India, or are you an NRI living abroad?" htmlFor="citizenshipStatus">
            <Select id="citizenshipStatus" value={draft.citizenshipStatus} onChange={k("citizenshipStatus")} options={CITIZENSHIP} />
          </Field>

          {draft.citizenshipStatus === "NRI/PIO" && (
            <Field label="How many months have you stayed in India?" htmlFor="nriStayPeriod">
              <TextInput id="nriStayPeriod" type="number" value={draft.nriStayPeriod} onChange={(v) => set("nriStayPeriod", num(v))} numeric />
            </Field>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            <Field
              label="What is your mobile number?"
              htmlFor="phone"
              error={invalid(PATTERNS.phone, draft.phone, "Enter the 10 digits of your mobile number, starting with 6, 7, 8 or 9.")}
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-[180px] flex-1">
                  <TextInput
                    id="phone"
                    value={draft.phone}
                    onChange={(v) => { set("phone", v); set("phoneVerified", false); }}
                    numeric
                    verified={draft.phoneVerified}
                  />
                </div>
                <VerifyField
                  channel="mobile"
                  target={draft.phone}
                  verified={draft.phoneVerified}
                  onVerified={(v) => set("phoneVerified", v)}
                />
              </div>
            </Field>
            <Field
              label="What is your email address?"
              htmlFor="email"
              error={invalid(PATTERNS.email, draft.email, "Enter a complete email address, like name@example.com.")}
            >
              <TextInput id="email" type="email" value={draft.email} onChange={k("email")} />
            </Field>
          </div>
        </>
      )}

      {draft.entityType === "Company" && (
        <>
          <Field label="What is the registered name of your company?" htmlFor="companyName">
            <TextInput id="companyName" value={draft.companyName} onChange={k("companyName")} />
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="What kind of company is it?" htmlFor="companyType">
              <Select id="companyType" value={draft.companyType} onChange={k("companyType")} options={COMPANY_TYPES} placeholder="Choose one" />
            </Field>
            <Field
              label="What is the company's 10-character PAN number?"
              htmlFor="companyPan"
              error={invalid(PATTERNS.pan, draft.companyPan, "This does not look like a PAN. It should read like AABCT1234C.")}
            >
              <TextInput id="companyPan" value={draft.companyPan} onChange={(v) => set("companyPan", v.toUpperCase())} placeholder="AABCT1234C" numeric />
            </Field>
          </div>

          <Field label="Where is the company located?" htmlFor="companyLocation">
            <TextInput id="companyLocation" value={draft.companyLocation} onChange={k("companyLocation")} />
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Who should we speak to about this application?" htmlFor="contactPersonName">
              <TextInput id="contactPersonName" value={draft.contactPersonName} onChange={k("contactPersonName")} />
            </Field>
            <Field label="What is that person's job title?" htmlFor="contactPersonDesignation">
              <TextInput id="contactPersonDesignation" value={draft.contactPersonDesignation} onChange={k("contactPersonDesignation")} placeholder="e.g. Director, Accounts Manager" />
            </Field>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field
              label="What is the company's mobile number?"
              htmlFor="companyMobile"
              error={invalid(PATTERNS.phone, draft.companyMobile, "Enter the 10 digits of the mobile number, starting with 6, 7, 8 or 9.")}
            >
              <TextInput id="companyMobile" value={draft.companyMobile} onChange={k("companyMobile")} numeric />
            </Field>
            <Field
              label="What is the company's email address?"
              htmlFor="companyEmail"
              error={invalid(PATTERNS.email, draft.companyEmail, "Enter a complete email address, like name@example.com.")}
            >
              <TextInput id="companyEmail" type="email" value={draft.companyEmail} onChange={k("companyEmail")} />
            </Field>
          </div>

          <Field label="How many people does the company employ?" htmlFor="companyEmployees">
            <TextInput id="companyEmployees" type="number" value={draft.companyEmployees} onChange={k("companyEmployees")} numeric />
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
  const areaInputRef = useRef<HTMLInputElement>(null);

  const owned = draft.residentDetails === "Owned House";
  // A rented home has one possible proof, so it needs no type question; an
  // owned one shows nothing until the applicant says which document they have.
  const proof = owned
    ? ADDRESS_PROOF_DETAIL[draft.addressProofType]
    : { label: "Address Proof", helper: ADDRESS_PROOF_HELPER[draft.residentDetails] };
  const readsAadhaar = owned && draft.addressProofType === "Aadhaar Card";

  useEffect(() => {
    if (areas.length > 0) {
      const timer = setTimeout(() => {
        areaInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [areas]);

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
            const areaNames = postOffices.map((office: { Name: string }) => office.Name);

            // Auto-fill City & State
            set("cityName", district);
            set("stateName", state);
            setAreas(areaNames);

            // Auto-select area if only 1 option exists
            if (areaNames.length === 1) {
              setSelectedArea(areaNames[0]);
            }
          } else {
            setPincodeError("We could not find this PIN code. Please check the six digits.");
            set("cityName", "");
            set("stateName", "");
            setAreas([]);
            setSelectedArea("");
          }
        })
        .catch(() => {
          if (isMounted) {
            setPincodeError("We could not look up this PIN code just now. You can type your city and state below.");
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
      <Field
        label="What is the 6-digit PIN code of your area?"
        htmlFor="pincode"
        error={pincodeError || invalid(PATTERNS.pincode, draft.pincode, "A PIN code has six digits, like 560001.")}
      >
        <div className="relative">
          <TextInput id="pincode" value={draft.pincode} onChange={k("pincode")} placeholder="560001" numeric />
          {loading && (
            <span className="absolute right-3 top-3 text-xs text-ink animate-pulse">
              Looking up&hellip;
            </span>
          )}
        </div>
      </Field>

      {/* Area Selector - Appears only when Pincode API fetches results */}
      {areas.length > 0 && (
        <Field label="Which locality do you live in?" htmlFor="areaName">
          <SearchableSelect
            id="areaName"
            value={selectedArea}
            onChange={setSelectedArea}
            options={areas}
            placeholder="Search for your locality"
            inputRef={areaInputRef}
          />
        </Field>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Which city do you live in?" htmlFor="cityName">
          <TextInput id="cityName" value={draft.cityName} onChange={k("cityName")} />
        </Field>
        <Field label="Which state do you live in?" htmlFor="stateName">
          <TextInput id="stateName" value={draft.stateName} onChange={k("stateName")} />
        </Field>
      </div>

      <Field label="Do you own the house you live in, or do you rent it?" htmlFor="residentDetails">
        <RadioCards
          name="residentDetails"
          label="Do you own the house you live in, or do you rent it?"
          value={draft.residentDetails}
          onChange={k("residentDetails")}
          options={RESIDENCE}
        />
      </Field>

      {/* An owned home can be proved two ways, and only one of them is worth
          reading. Asking which comes first so the upload can name the document
          it expects instead of listing both. */}
      {owned && (
        <Field label="Select Address Proof Type" htmlFor="addressProofType">
          <RadioCards
            name="addressProofType"
            label="Select Address Proof Type"
            value={draft.addressProofType}
            onChange={k("addressProofType")}
            options={ADDRESS_PROOF_TYPES}
          />
        </Field>
      )}

      {proof && (
        <Field label={proof.label} htmlFor="addressProof">
          <DocumentUpload
            /* Keyed on the choice: switching proof type remounts the control,
               dropping the file staged against the previous one. */
            key={`${draft.residentDetails}:${draft.addressProofType}`}
            id="addressProof"
            documentType={readsAadhaar ? "aadhaar" : undefined}
            label="Upload address proof"
            helper={proof.helper}
            onExtracted={(fields) => {
              if (fields.aadhaar_number) set("aadhaarNumber", fields.aadhaar_number);
            }}
          />
        </Field>
      )}

      {readsAadhaar && draft.aadhaarNumber && (
        <Field
          label="Aadhaar number read from your card"
          htmlFor="aadhaarNumber"
        >
          <TextInput
            id="aadhaarNumber"
            value={formatAadhaar(draft.aadhaarNumber)}
            onChange={(v) => set("aadhaarNumber", v.replace(/\D/g, ""))}
            numeric
            verified
          />
        </Field>
      )}

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
        <Field label="Do you work for a company, or do you run your own business?" htmlFor="occupation">
          <RadioCards
            name="occupation"
            label="Do you work for a company, or do you run your own business?"
            value={draft.occupation}
            onChange={(v) => set("occupation", v as Draft["occupation"])}
            options={[
              { value: "Salaried", label: "Salaried" },
              { value: "Self-Employed", label: "Self-employed" },
            ]}
          />
        </Field>
      )}

      {profile === "Salaried" && (
        <>
          <Field label="What kind of organisation do you work for?" htmlFor="employerType">
            <Select id="employerType" value={draft.employerType} onChange={k("employerType")} options={EMPLOYER_TYPES} />
          </Field>

          <Field label="How long have you worked at your current job?" htmlFor="tenureBand">
            <Select id="tenureBand" value={draft.tenureBand} onChange={k("tenureBand")} options={TENURE_BANDS} />
          </Field>

          {/* Under 2 years here, prior employment establishes total experience. */}
          {shortTenure && (
            <>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Where did you work before this job?" htmlFor="prevCompanyName">
                  <TextInput id="prevCompanyName" value={draft.prevCompanyName} onChange={k("prevCompanyName")} />
                </Field>
                <Field label="On which date did you join that earlier job?" htmlFor="prevCompanyJoining">
                  <TextInput id="prevCompanyJoining" type="date" value={draft.prevCompanyJoining} onChange={k("prevCompanyJoining")} />
                </Field>
              </div>
              {totalExperience !== null && totalExperience < 2 && (
                <p className="rounded-md bg-warning-bg p-3 text-[0.8125rem] text-warning">
                  Most banks ask for at least 2 years of work in total. You can still apply.
                </p>
              )}
            </>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Gross Salary" htmlFor="grossSalary">
              <TextInput id="grossSalary" type="number" value={draft.grossSalary} onChange={(v) => set("grossSalary", num(v))} placeholder="Monthly amount in ₹" numeric />
            </Field>
            <Field label="How do you receive your salary: into a bank account, or in cash?" htmlFor="salaryMode">
              <RadioCards
                name="salaryMode"
                label="How do you receive your salary?"
                value={draft.salaryMode}
                onChange={k("salaryMode")}
                options={SALARY_MODES}
              />
            </Field>
          </div>

          <Field label="Do you have proof of the tax you pay on your salary?" htmlFor="form16Status">
            <RadioCards
              name="form16Status"
              label="Do you have proof of the tax you pay on your salary?"
              value={draft.form16Status}
              onChange={k("form16Status")}
              options={INCOME_PROOF}
            />
          </Field>

          {/* Scored against the bank's Form-16 minimum (matrix col 55). */}
          {draft.form16Status === "Form 16" && (
            <>
              <Field label="Upload your Form 16" htmlFor="form16Upload">
                <DocumentUpload id="form16Upload" documentType="pan" label="Upload Form 16" />
              </Field>
              <Field label="For how many years do you have Form 16?" htmlFor="form16Years">
                <TextInput id="form16Years" type="number" value={draft.form16Years} onChange={(v) => set("form16Years", num(v))} numeric />
              </Field>
            </>
          )}

          {draft.form16Status === "ITR" && (
            <div className="grid gap-6 sm:grid-cols-2">
              <ItrField
                id="salariedCurrentYearItr"
                label="Current Year ITR"
                value={draft.salariedCurrentYearItr}
                onChange={(v) => set("salariedCurrentYearItr", v)}
              />
              <ItrField
                id="salariedPreviousYearItr"
                label="Previous Year ITR"
                value={draft.salariedPreviousYearItr}
                onChange={(v) => set("salariedPreviousYearItr", v)}
              />
            </div>
          )}
        </>
      )}

      {profile === "Self-Employed" && (
        <>
          <Field label="Do you work from where you live, or from a separate place?" htmlFor="officeAddressType">
            <RadioCards
              name="officeAddressType"
              label="Do you work from where you live, or from a separate place?"
              value={draft.officeAddressType}
              onChange={k("officeAddressType")}
              options={[
                { value: "Same", label: "From my home" },
                { value: "Separate", label: "From a separate shop or office" },
              ]}
            />
          </Field>

          {draft.officeAddressType === "Separate" && (
            <>
              <Field label="What is the address of your shop or office?" htmlFor="officeAddress">
                <TextInput id="officeAddress" value={draft.officeAddress} onChange={k("officeAddress")} />
              </Field>
              <Field label="Do you own that shop or office, or do you rent it?" htmlFor="officePremisesStatus">
                <RadioCards
                  name="officePremisesStatus"
                  label="Do you own that shop or office, or do you rent it?"
                  value={draft.officePremisesStatus}
                  onChange={k("officePremisesStatus")}
                  options={[
                    { value: "Owned", label: "I own it" },
                    { value: "Rented", label: "I rent it" },
                  ]}
                />
              </Field>
            </>
          )}

          {isResiCumOfficeRented(draft) && (
            <Field label="Can someone stand as a guarantor for your loan?" htmlFor="guarantorStatus">
              <RadioCards
                name="guarantorStatus"
                label="Can someone stand as a guarantor for your loan?"
                value={draft.guarantorStatus}
                onChange={k("guarantorStatus")}
                options={[
                  { value: "With a Gaurantor", label: "Yes, I have a guarantor" },
                  { value: "Without a Gaurantor", label: "No, I do not" },
                ]}
              />
            </Field>
          )}

          <Field label="On which date did your business start?" htmlFor="businessEstablishmentDate">
            <TextInput id="businessEstablishmentDate" type="date" value={draft.businessEstablishmentDate} onChange={k("businessEstablishmentDate")} />
          </Field>

          <Field label="How is your business set up?" htmlFor="businessEntityType">
            <Select id="businessEntityType" value={draft.businessEntityType} onChange={k("businessEntityType")} options={BUSINESS_ENTITIES} />
          </Field>

          <Field label="What is your business registration or GST number?" htmlFor="businessProof">
            <div className="flex flex-col gap-3">
              <TextInput id="businessProof" value={draft.businessProof} onChange={k("businessProof")} placeholder="29AAAAA0000A1Z5" />
              <div className="flex flex-wrap items-start gap-3">
                <DocumentUpload id="businessProofUpload" documentType="pan" label="Upload" />
                <VerifyField
                  channel="email"
                  target={draft.email || "business@document.verify"}
                  verified={draft.businessProofVerified}
                  onVerified={(v) => set("businessProofVerified", v)}
                />
              </div>
            </div>
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <ItrField
              id="currentITRAmount"
              label="Current Year ITR"
              value={draft.currentITRAmount}
              onChange={(v) => set("currentITRAmount", v)}
            />
            <ItrField
              id="prevITRAmount"
              label="Previous Year ITR"
              value={draft.prevITRAmount}
              onChange={(v) => set("prevITRAmount", v)}
            />
          </div>

          <Field label="For how many years have you filed tax returns?" htmlFor="businessItrYears">
            <TextInput id="businessItrYears" type="number" value={draft.businessItrYears} onChange={(v) => set("businessItrYears", num(v))} numeric />
          </Field>
        </>
      )}

      {profile === "Company" && (
        <>
          <Field label="On which date was the company incorporated?" htmlFor="companyEstablishmentDate">
            <TextInput id="companyEstablishmentDate" type="date" value={draft.companyEstablishmentDate} onChange={k("companyEstablishmentDate")} />
          </Field>

          <Field label="What is the company's GST or Udyam registration number?" htmlFor="companyGstin">
            <TextInput id="companyGstin" value={draft.companyGstin} onChange={k("companyGstin")} placeholder="29AAAAA0000A1Z5" />
          </Field>

          <div className="grid gap-6 sm:grid-cols-3">
            <Field label="What income did the company declare last year? (₹)" htmlFor="companyCurrentITRAmount">
              <TextInput id="companyCurrentITRAmount" type="number" value={draft.companyCurrentITRAmount} onChange={(v) => set("companyCurrentITRAmount", num(v))} numeric />
            </Field>
            <Field label="And the year before that? (₹)" htmlFor="companyPrevITRAmount">
              <TextInput id="companyPrevITRAmount" type="number" value={draft.companyPrevITRAmount} onChange={(v) => set("companyPrevITRAmount", num(v))} numeric />
            </Field>
            <Field label="For how many years has the company filed tax returns?" htmlFor="businessItrYearsCompany">
              <TextInput id="businessItrYearsCompany" type="number" value={draft.businessItrYearsCompany} onChange={(v) => set("businessItrYearsCompany", num(v))} numeric />
            </Field>
          </div>
        </>
      )}

      {profile !== "Company" && <RentalIncomeQuestion />}
    </div>
  );
}

export function Step4Banking() {
  const { draft, set } = useField();
  const k = <K extends keyof Draft>(key: K) => (v: Draft[K]) => set(key, v);
  // Every bureau answer below is locked while a parsed report is attached, so
  // what the applicant signs off on is what the document actually says.
  const locked = useOnboardingStore((s) => s.cibilVerified) !== null;

  return (
    <div className="flex flex-col gap-6">
      <Field label="Which bank do you already have a savings or current account with?" htmlFor="existingAccountBank">
        <Select id="existingAccountBank" value={draft.existingAccountBank} onChange={k("existingAccountBank")} options={ACCOUNT_BANKS} />
      </Field>

      <Field label="Do you have a car loan with any bank, now or in the past?" htmlFor="existingCarLoanBank">
        <Select id="existingCarLoanBank" value={draft.existingCarLoanBank} onChange={k("existingCarLoanBank")} options={CAR_LOAN_BANKS} />
      </Field>

      <Field label="What kind of loan do you need?" htmlFor="loanType">
        <RadioCards
          name="loanType"
          label="What kind of loan do you need?"
          value={draft.loanType}
          onChange={k("loanType")}
          options={LOAN_TYPES.map((t) => ({ value: t, label: t }))}
        />
      </Field>

      <CibilUpload />

      <Field label="What is your latest credit score (CIBIL score), if you know it?" htmlFor="bureauCibilScore">
        <TextInput id="bureauCibilScore" type="number" value={draft.bureauCibilScore} onChange={(v) => set("bureauCibilScore", num(v))} numeric verified={locked} disabled={locked} />
      </Field>

      <Field label="Have you ever missed a loan payment, or paid one late?" htmlFor="hasMissedPayment">
        <RadioCards
          name="hasMissedPayment"
          label="Have you ever missed a loan payment, or paid one late?"
          value={yn(draft.hasMissedPayment)}
          onChange={(v) => set("hasMissedPayment", v === "yes")}
          options={YES_NO}
          disabled={locked}
        />
      </Field>

      {/* Several banks reject ANY late payment, the rest tolerate up to 89 days. */}
      {draft.hasMissedPayment && (
        <Field label="Was any payment more than 90 days late?" htmlFor="missedOver90">
          <RadioCards
            name="missedOver90"
            label="Was any payment more than 90 days late?"
            value={yn(draft.missedOver90)}
            onChange={(v) => set("missedOver90", v === "yes")}
            options={YES_NO}
            disabled={locked}
          />
        </Field>
      )}

      <Field label="Has any bank checked your credit for a new loan recently?" htmlFor="bureauLoanEnquiry">
        <RadioCards
          name="bureauLoanEnquiry"
          label="Has any bank checked your credit for a new loan recently?"
          value={yn(draft.bureauLoanEnquiry)}
          onChange={(v) => set("bureauLoanEnquiry", v === "yes")}
          options={YES_NO}
          disabled={locked}
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="How much do you currently owe in overdue payments? (₹)" htmlFor="bureauCurrentlyOutstanding">
          <TextInput id="bureauCurrentlyOutstanding" type="number" value={draft.bureauCurrentlyOutstanding} onChange={(v) => set("bureauCurrentlyOutstanding", num(v))} numeric verified={locked} disabled={locked} />
        </Field>
        {draft.entityType === "Individual" && <AgeAtLastEmi />}
      </div>

      <Field label="Do you have any loan or card that a bank settled or wrote off?" htmlFor="hasWriteOff">
        <RadioCards
          name="hasWriteOff"
          label="Do you have any loan or card that a bank settled or wrote off?"
          value={yn(draft.hasWriteOff)}
          onChange={(v) => set("hasWriteOff", v === "yes")}
          options={YES_NO}
          disabled={locked}
        />
      </Field>

      {draft.hasWriteOff && (
        <>
          <fieldset className="rounded-md border border-line p-4">
            <legend className="px-2 text-[0.9375rem] font-medium text-ink-muted">
              Which of these was written off? Tick all that apply.
            </legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {WRITE_OFF_FLAGS.map((flag) => (
                <Checkbox
                  key={flag.key}
                  id={flag.key}
                  checked={draft[flag.key]}
                  onChange={(v) => set(flag.key, v)}
                  label={flag.label}
                  disabled={locked}
                />
              ))}
            </div>
          </fieldset>

          {draft.bureauFlagCC && (
            <Field label="How much was written off on the credit card? (₹)" htmlFor="bureauWriteOffAmount">
              <TextInput id="bureauWriteOffAmount" type="number" value={draft.bureauWriteOffAmount} onChange={(v) => set("bureauWriteOffAmount", num(v))} numeric verified={locked} disabled={locked} />
            </Field>
          )}
        </>
      )}

      <Checkbox
        id="cibilPlScoreToggle"
        checked={draft.cibilPlScoreToggle}
        onChange={(v) => set("cibilPlScoreToggle", v)}
        label="I also know my separate personal-loan credit score"
        disabled={locked}
      />
      {draft.cibilPlScoreToggle && (
        <Field label="What is that personal-loan credit score?" htmlFor="bureauCibilPlScore">
          <TextInput id="bureauCibilPlScore" type="number" value={draft.bureauCibilPlScore} onChange={(v) => set("bureauCibilPlScore", num(v))} numeric verified={locked} disabled={locked} />
        </Field>
      )}
    </div>
  );
}

export function Step5CoApplicant() {
  const { draft, set } = useField();
  const k = <K extends keyof Draft>(key: K) => (v: Draft[K]) => set(key, v);
  const pooling = draft.coAppIncomeRelation !== "None";

  // add-on.md §5: a co-applicant only matters when the loan outlives the
  // banks' age ceiling. Below the threshold the questions are not asked at all.
  if (!needsCoApplicant(draft)) {
    const age = ageAtLastEmiFor(draft);
    return (
      <p className="text-[0.9375rem] text-ink">
        {age === null
          ? "Add your date of birth in step 1 to see whether a co-applicant is needed."
          : `You will be ${age} at your last payment, which is inside every bank's age limit. `
            + "No co-applicant is needed — continue to submit."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Field label="Is anyone joining your application to help meet the age limit?" htmlFor="coAppAgeRelation">
        <Select id="coAppAgeRelation" value={draft.coAppAgeRelation} onChange={k("coAppAgeRelation")} options={AGE_RELATIONS} />
      </Field>

      <Field label="Is anyone adding their income to yours on this application?" htmlFor="coAppIncomeRelation">
        <Select id="coAppIncomeRelation" value={draft.coAppIncomeRelation} onChange={k("coAppIncomeRelation")} options={INCOME_RELATIONS} />
      </Field>

      {pooling && (
        <div className="grid gap-6 sm:grid-cols-3">
          <Field label="What is that person's full name?" htmlFor="coApplicantName">
            <TextInput id="coApplicantName" value={draft.coApplicantName} onChange={k("coApplicantName")} />
          </Field>
          <Field label="On which date were they born?" htmlFor="coApplicantDob">
            <TextInput id="coApplicantDob" type="date" value={draft.coApplicantDob} onChange={k("coApplicantDob")} />
          </Field>
          <Field label="Do they work for a company or for themselves?" htmlFor="coApplicantOccupation">
            <Select
              id="coApplicantOccupation"
              value={draft.coApplicantOccupation}
              onChange={k("coApplicantOccupation")}
              options={[
                { value: "Salaried", label: "For a company" },
                { value: "Self-Employed", label: "For themselves" },
              ]}
              placeholder="Choose one"
            />
          </Field>
        </div>
      )}
    </div>
  );
}
