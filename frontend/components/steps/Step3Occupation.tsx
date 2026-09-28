"use client";

import { Field, RadioCards, Select, TextInput } from "@/components/Field";
import {
  BUSINESS_ENTITIES, CITIZENSHIP, EMPLOYER_TYPES, GOVERNMENT_SECTOR,
  INCOME_PROOF, SALARY_MODES, TENURE_BANDS, YES_NO,
  totalWorkExperienceYears,
} from "@/lib/form-schema";
import { DocumentUpload } from "@/components/DocumentUpload";
import { PayslipUpload } from "@/components/PayslipUpload";
import { CoiUploadSection } from "@/components/CoiUploadSection";
import {
  isAgriculture, needsIncomeCoApplicantInStep3, profileTypeFor,
} from "@/store/useOnboardingStore";
import type { Draft } from "@/store/useOnboardingStore";
import {
  AgricultureBranch, IncomeCoApplicant, ItrField,
  RentalIncomeBranch, TradeBusinessBranch, num, useField, yn,
} from "./step-shared";

export function Step3Occupation() {
  const { draft, set } = useField();
  const k = <K extends keyof Draft>(key: K) => (v: Draft[K]) => set(key, v);
  const profile = profileTypeFor(draft);
  const isGovernment = draft.employerType === GOVERNMENT_SECTOR;
  const isFarming = isAgriculture(draft);
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
              { value: "Rental Income", label: "Rental income" },
            ]}
          />
        </Field>
      )}

      {profile === "Rental Income" && <RentalIncomeBranch />}

      {profile === "Salaried" && (
        <>
          <Field label="What kind of organisation do you work for?" htmlFor="employerType">
            <RadioCards
              name="employerType"
              label="What kind of organisation do you work for?"
              value={draft.employerType}
              onChange={k("employerType")}
              options={EMPLOYER_TYPES}
            />
          </Field>

          <Field label="How long have you worked at your current job?" htmlFor="tenureBand">
            <Select id="tenureBand" value={draft.tenureBand} onChange={k("tenureBand")} options={TENURE_BANDS} />
          </Field>

          {/* add-on.md §4: government service is not scored on tenure, so the
              prior-employer questions are not asked and short tenure is fine. */}
          {isGovernment && (
            <p className="rounded-md bg-bg-raised p-3 text-[0.8125rem] text-ink-muted">
              Government service is not assessed against a minimum length of
              employment, so you can continue whatever you answered above.
            </p>
          )}

          {/* Under 2 years here, prior employment establishes total experience. */}
          {!isGovernment && shortTenure && (
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

          <PayslipUpload />

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
            <>
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
              <CoiUploadSection
                currentItrFieldId="salariedCurrentYearItr"
                prevItrFieldId="salariedPreviousYearItr"
              />
            </>
          )}

          {/* add-on.md §2: residency is asked here, and only of salaried
              applicants — the NRI matrix columns score employment income. */}
          <Field label="Do you live in India, or are you an NRI living abroad?" htmlFor="citizenshipStatus">
            <Select id="citizenshipStatus" value={draft.citizenshipStatus} onChange={k("citizenshipStatus")} options={CITIZENSHIP} />
          </Field>

          {draft.citizenshipStatus === "NRI/PIO" && (
            <Field label="How many months have you stayed in India?" htmlFor="nriStayPeriod">
              <TextInput id="nriStayPeriod" type="number" value={draft.nriStayPeriod} onChange={(v) => set("nriStayPeriod", num(v))} numeric />
            </Field>
          )}
        </>
      )}

      {/* add-on.md §3: "How is your business set up?" comes FIRST, because its
          answer decides whether the trade questions or the farming ones apply. */}
      {profile === "Self-Employed" && (
        <Field label="How is your business set up?" htmlFor="businessEntityType">
          <Select id="businessEntityType" value={draft.businessEntityType} onChange={k("businessEntityType")} options={BUSINESS_ENTITIES} />
        </Field>
      )}

      {profile === "Self-Employed" && isFarming && (
        <>
          <Field label="Do you operate your farming as a registered business (e.g. own a mill, warehouse, trading office, processing unit)?" htmlFor="isRegisteredBusiness">
            <RadioCards
              name="isRegisteredBusiness"
              label="Do you operate your farming as a registered business?"
              value={yn(draft.isRegisteredBusiness)}
              onChange={(v) => set("isRegisteredBusiness", v === "yes")}
              options={YES_NO}
            />
          </Field>
          <AgricultureBranch />
        </>
      )}

      {profile === "Self-Employed" && (!isFarming || draft.isRegisteredBusiness) && (
        <TradeBusinessBranch />
      )}

      {/* Bug 9: asked here, as soon as the two ITR amounts are on screen. The
          farming branch fills the same two fields, so it is covered too. */}
      {needsIncomeCoApplicantInStep3(draft) && <IncomeCoApplicant />}

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

          <CoiUploadSection
            currentItrFieldId="companyCurrentITRAmount"
            currentYearLabel="Company Current Year COI"
            prevItrFieldId="companyPrevITRAmount"
            prevYearLabel="Company Previous Year COI"
            title="Company Computation of Income (COI) Verification"
          />
        </>
      )}

    </div>
  );
}

export default Step3Occupation;
