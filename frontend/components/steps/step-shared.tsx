"use client";

import { Field, RadioCards, Select, TextInput } from "@/components/Field";
import {
  INCOME_RELATIONS, PATTERNS,
  RENTAL_INCOME, YES_NO,
} from "@/lib/form-schema";
import { DocumentUpload } from "@/components/DocumentUpload";
import { CoiUploadSection } from "@/components/CoiUploadSection";
import { Phase1IncomeCard } from "@/components/Phase1IncomeCard";
import { VerifyField } from "@/components/VerifyField";
import {
  CO_APPLICANT_ITR_THRESHOLD, LOAN_TENOR_YEARS, RENTAL_DOC_IN_BANK, RENTAL_DOC_WITH_ITR,
  ageAtLastEmiFor, applicantItrs, clubbedCurrentItr, clubbedPreviousItr,
  isResiCumOfficeRented, useOnboardingStore, useSetDraftField,
} from "@/store/useOnboardingStore";
import type { Draft } from "@/store/useOnboardingStore";

// Format checks run locally against the API's own patterns, so a bad PAN costs no round trip.
export function invalid(pattern: RegExp, value: string, message: string): string | undefined {
  if (value.trim() === "") return undefined;
  return pattern.test(value) ? undefined : message;
}

export function useField() {
  const draft = useOnboardingStore((s) => s.draft);
  const error = useOnboardingStore((s) => s.error);
  const setField = useSetDraftField();
  return { draft, error, set: setField };
}

export const num = (v: string) => (v === "" ? "" : Number(v));

// Yes/no answers are stored as booleans but rendered as cards.
export const yn = (v: boolean) => (v ? "yes" : "no");

// An ITR amount with its own Upload and Verify, used by both occupation flows.
export function ItrField({
  id, label, value, onChange,
}: {
  id: string; label: string; value: number | ""; onChange: (v: number | "") => void;
}) {
  const itrRecord = useOnboardingStore((s) => s.itrRecords[id]);
  const setItrRecord = useOnboardingStore((s) => s.setItrRecord);
  const setField = useOnboardingStore((s) => s.setField);
  const draft = useOnboardingStore((s) => s.draft);

  const verified = itrRecord?.verified ?? false;
  const taxFeePayable = itrRecord?.taxFeePayable ?? null;

  function handleExtracted(fields: Record<string, string | null>) {
    let parsedIncome = 0;
    if (fields.total_income) {
      const parsed = parseInt(fields.total_income, 10);
      if (!isNaN(parsed) && parsed > 0) {
        parsedIncome = parsed;
        onChange(parsed);
      }
    }
    let parsedTax = 0;
    if (
      fields.total_tax_interest_and_fee_payable !== undefined &&
      fields.total_tax_interest_and_fee_payable !== null &&
      fields.total_tax_interest_and_fee_payable !== ""
    ) {
      const val = parseInt(fields.total_tax_interest_and_fee_payable, 10);
      parsedTax = isNaN(val) ? 0 : val;
    }
    if (fields.pan && !draft.pan) {
      setField("pan", fields.pan);
    }
    if (fields.name && !draft.applicantName) {
      setField("applicantName", fields.name);
    }
    setItrRecord(id, {
      verified: true,
      taxFeePayable: parsedTax,
    });

    const isCurrent = id.toLowerCase().includes("current");
    const isPrev = id.toLowerCase().includes("prev");
    const updatePhase1 = useOnboardingStore.getState().updatePhase1DocData;
    if (isCurrent) {
      updatePhase1("current", {
        total_income: parsedIncome,
        total_tax_interest_and_fee_payable: parsedTax,
      });
    } else if (isPrev) {
      updatePhase1("previous", {
        total_income: parsedIncome,
        total_tax_interest_and_fee_payable: parsedTax,
      });
    }
  }

  function handleClear() {
    setItrRecord(id, null);
    onChange("");
    const isCurrent = id.toLowerCase().includes("current");
    const isPrev = id.toLowerCase().includes("prev");
    const updatePhase1 = useOnboardingStore.getState().updatePhase1DocData;
    if (isCurrent) {
      updatePhase1("current", {
        total_income: 0,
        total_tax_interest_and_fee_payable: 0,
      });
    } else if (isPrev) {
      updatePhase1("previous", {
        total_income: 0,
        total_tax_interest_and_fee_payable: 0,
      });
    }
  }

  return (
    <Field label={label} htmlFor={id}>
      <div className="flex flex-col gap-3">
        {/* Row 1: Total Income Box */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[0.75rem] font-semibold uppercase tracking-wider text-ink-subtle">
              Total Income
            </span>
            {verified && (
              <span className="text-[0.6875rem] font-medium text-success bg-success-bg px-2 py-0.5 rounded-full flex items-center gap-1">
                ✓ Document Verified (Locked)
              </span>
            )}
          </div>
          <TextInput
            id={id}
            type="number"
            value={value}
            onChange={(v) => {
              const val = num(v);
              onChange(val);
              if (verified) setItrRecord(id, null);
              const isCurrent = id.toLowerCase().includes("current");
              const isPrev = id.toLowerCase().includes("prev");
              const updatePhase1 = useOnboardingStore.getState().updatePhase1DocData;
              if (isCurrent) {
                updatePhase1("current", {
                  total_income: Number(val) || 0,
                });
              } else if (isPrev) {
                updatePhase1("previous", {
                  total_income: Number(val) || 0,
                });
              }
            }}
            placeholder="Amount in ₹"
            numeric
            verified={verified}
            readOnly={verified}
          />
        </div>

        {/* Row 2: Total Tax, Interest and Fee Payable Box */}
        {verified && (
          <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-bg-raised p-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <label htmlFor={`${id}TaxFee`} className="text-[0.75rem] font-semibold uppercase tracking-wider text-ink-subtle">
                Total Tax, Interest & Fee Payable
              </label>
              <span className="text-[0.6875rem] font-medium text-ink-subtle bg-white px-2 py-0.5 rounded-full border border-line">
                Extracted from ITR
              </span>
            </div>
            <output
              id={`${id}TaxFee`}
              className="flex min-h-[44px] items-center rounded-lg border border-line bg-slate-50/80 px-3.5 py-2 font-mono text-[0.9375rem] font-semibold text-ink shadow-xs select-text cursor-not-allowed"
            >
              ₹{Number(taxFeePayable ?? 0).toLocaleString("en-IN")}
            </output>
          </div>
        )}

        {/* Controls: Upload, Ack & Clear */}
        <div className="flex flex-wrap items-center gap-3">
          {!verified ? (
            <DocumentUpload
              id={`${id}Upload`}
              documentType="itr"
              label="Upload ITR"
              onExtracted={handleExtracted}
            />
          ) : (
            <div className="flex items-center gap-3">
              <DocumentUpload
                id={`${id}Reupload`}
                documentType="itr"
                label="Re-upload"
                buttonClassName="flex min-h-[34px] items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1 text-[0.8125rem] font-medium text-ink transition-colors hover:border-line-strong hover:bg-slate-50 cursor-pointer shadow-2xs"
                hideDone
                onExtracted={handleExtracted}
              />
              <button
                type="button"
                onClick={handleClear}
                className="text-[0.75rem] text-ink-subtle hover:text-danger underline underline-offset-2 transition-colors cursor-pointer"
                title="Clear uploaded ITR and enter manually"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>
    </Field>
  );
}

// add-on.md §4: derived from the DOB, never asked. Shown so the applicant can
// see the number the banks score, and so a missing DOB is visibly the cause.
export function AgeAtLastEmi() {
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

// add-on.md §7: rent is a top-level occupation, so this is a whole branch of
// step 3 rather than two sub-questions hanging off the salaried flow.
export function RentalIncomeBranch() {
  const { draft, set } = useField();
  const k = <K extends keyof Draft>(key: K) => (v: Draft[K]) => set(key, v);
  const withItr = draft.rentalIncomeType === RENTAL_DOC_WITH_ITR;
  const inBank = draft.rentalIncomeType === RENTAL_DOC_IN_BANK;

  return (
    <>
      <Field label="What is the address of the property you rent out?" htmlFor="rentalPropertyAddress">
        <TextInput id="rentalPropertyAddress" value={draft.rentalPropertyAddress} onChange={k("rentalPropertyAddress")} />
      </Field>

      <Field label="How is that rental income documented?" htmlFor="rentalIncomeType">
        <RadioCards
          name="rentalIncomeType"
          label="How is that rental income documented?"
          value={draft.rentalIncomeType}
          onChange={k("rentalIncomeType")}
          options={RENTAL_INCOME}
        />
      </Field>

      {withItr && (
        <>
          <div className="grid gap-6 sm:grid-cols-2">
            <ItrField
              id="rentalCurrentYearItr"
              label="Current Year ITR"
              value={draft.rentalCurrentYearItr}
              onChange={(v) => set("rentalCurrentYearItr", v)}
            />
            <ItrField
              id="rentalPreviousYearItr"
              label="Previous Year ITR"
              value={draft.rentalPreviousYearItr}
              onChange={(v) => set("rentalPreviousYearItr", v)}
            />
          </div>
          <CoiUploadSection
            currentItrFieldId="rentalCurrentYearItr"
            prevItrFieldId="rentalPreviousYearItr"
          />
        </>
      )}

      {inBank && (
        <>
          <Field label="Upload the bank statement showing the rent credits" htmlFor="rentalBankStatement">
            <DocumentUpload
              id="rentalBankStatement"
              label="Upload bank statement"
              helper="The statement must show the rent arriving in your account."
              onAttached={(attached) => set("rentalBankStatementProvided", attached)}
            />
          </Field>
          <Field label="How much rent do you receive each month? (₹)" htmlFor="rentalIncomeAmount">
            <TextInput id="rentalIncomeAmount" type="number" value={draft.rentalIncomeAmount} onChange={(v) => set("rentalIncomeAmount", num(v))} numeric />
          </Field>
        </>
      )}
    </>
  );
}

// Shared business-setup sub-flow used by the self-employed categories.
export function TradeBusinessBranch() {
  const { draft, set } = useField();
  const k = <K extends keyof Draft>(key: K) => (v: Draft[K]) => set(key, v);

  return (
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

      <Field
        label="What is your business registration or GST number?"
        htmlFor="businessProof"
        error={draft.businessProof.trim() === ""
          ? "Business proof is mandatory — onboarding cannot continue without it."
          : undefined}
      >
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

      <CoiUploadSection
        currentItrFieldId="currentITRAmount"
        prevItrFieldId="prevITRAmount"
      />

      <Phase1IncomeCard />

      <Field label="For how many years have you filed tax returns?" htmlFor="businessItrYears">
        <TextInput id="businessItrYears" type="number" value={draft.businessItrYears} onChange={(v) => set("businessItrYears", num(v))} numeric />
      </Field>
    </>
  );
}

// add-on.md §3: farming's own field set. None of the trade questions — work
// location, guarantor, business registration, GST — are asked here.
export function AgricultureBranch() {
  const { draft, set } = useField();
  const k = <K extends keyof Draft>(key: K) => (v: Draft[K]) => set(key, v);

  return (
    <>
      <Field label="Do you own the agricultural land?" htmlFor="ownsAgriculturalLand">
        <RadioCards
          name="ownsAgriculturalLand"
          label="Do you own the agricultural land?"
          value={yn(draft.ownsAgriculturalLand)}
          onChange={(v) => set("ownsAgriculturalLand", v === "yes")}
          options={YES_NO}
        />
      </Field>

      <Field label="Where is the agricultural land located?" htmlFor="agriculturalLandLocation">
        <TextInput id="agriculturalLandLocation" value={draft.agriculturalLandLocation} onChange={k("agriculturalLandLocation")} placeholder="Village, taluk and district" />
      </Field>

      <Field label="What is your approximate annual agricultural income? (₹)" htmlFor="annualAgriculturalIncome">
        <TextInput id="annualAgriculturalIncome" type="number" value={draft.annualAgriculturalIncome} onChange={(v) => set("annualAgriculturalIncome", num(v))} numeric />
      </Field>

      {!draft.isRegisteredBusiness && (
        <>
          <Field label="Have you filed an income tax return?" htmlFor="agricultureItrFiled">
            <RadioCards
              name="agricultureItrFiled"
              label="Have you filed an income tax return?"
              value={yn(draft.agricultureItrFiled)}
              onChange={(v) => set("agricultureItrFiled", v === "yes")}
              options={YES_NO}
            />
          </Field>

          {draft.agricultureItrFiled ? (
            <>
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
              <CoiUploadSection
                currentItrFieldId="currentITRAmount"
                prevItrFieldId="prevITRAmount"
              />
              <Phase1IncomeCard />
              <Field label="For how many years have you filed tax returns?" htmlFor="businessItrYears">
                <TextInput id="businessItrYears" type="number" value={draft.businessItrYears} onChange={(v) => set("businessItrYears", num(v))} numeric />
              </Field>
            </>
          ) : (
            <Field
              label="Agricultural income proof"
              htmlFor="agriculturalIncomeProof"
              error={draft.agriculturalIncomeProof.trim() === ""
                ? "Without a filed return, this proof is what evidences the income."
                : undefined}
            >
              <div className="flex flex-col gap-3">
                <TextInput
                  id="agriculturalIncomeProof"
                  value={draft.agriculturalIncomeProof}
                  onChange={(v) => { set("agriculturalIncomeProof", v); set("agriculturalIncomeProofVerified", false); }}
                  placeholder="Reference on the document you upload"
                  verified={draft.agriculturalIncomeProofVerified}
                />
                <div className="flex flex-wrap items-start gap-3">
                  <DocumentUpload id="agriculturalIncomeProofUpload" label="Upload" />
                  <VerifyField
                    channel="email"
                    target={draft.email || "agri@document.verify"}
                    verified={draft.agriculturalIncomeProofVerified}
                    onVerified={(v) => set("agriculturalIncomeProofVerified", v)}
                  />
                </div>
              </div>
            </Field>
          )}
        </>
      )}
    </>
  );
}

// The income co-applicant question and the fields it reveals.
//
// One component, rendered by step 3 for the self-employed flow and by step 5
// for everyone else — the answer is a single set of draft fields, so two
// separately maintained copies could only drift into disagreeing about it.
export function IncomeCoApplicant() {
  const { draft, set } = useField();
  const k = <K extends keyof Draft>(key: K) => (v: Draft[K]) => set(key, v);
  const pooling = draft.coAppIncomeRelation !== "None";
  const itrs = applicantItrs(draft);
  const bothShort =
    itrs !== null
    && itrs.current < CO_APPLICANT_ITR_THRESHOLD
    && itrs.previous < CO_APPLICANT_ITR_THRESHOLD;

  return (
    <>
      <p className="rounded-md bg-bg-raised p-3 text-[0.8125rem] text-ink-muted">
        {bothShort ? "Both of your" : "One of your"} declared tax returns
        {bothShort ? " are" : " is"} under
        {" "}₹{CO_APPLICANT_ITR_THRESHOLD.toLocaleString("en-IN")}. Adding someone
        else&rsquo;s income to yours can bring the total above what the banks ask for.
      </p>

      <Field label="Is anyone adding their income to yours on this application?" htmlFor="coAppIncomeRelation">
        <Select id="coAppIncomeRelation" value={draft.coAppIncomeRelation} onChange={k("coAppIncomeRelation")} options={INCOME_RELATIONS} />
      </Field>

      {pooling && (
        <>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="What is that person's full name?" htmlFor="coApplicantName">
              <TextInput id="coApplicantName" value={draft.coApplicantName} onChange={k("coApplicantName")} />
            </Field>
            <Field label="On which date were they born?" htmlFor="coApplicantDob">
              <TextInput id="coApplicantDob" type="date" value={draft.coApplicantDob} onChange={k("coApplicantDob")} />
            </Field>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <ItrField
              id="coApplicantCurrentItr"
              label="Their Current Year ITR"
              value={draft.coApplicantCurrentItr}
              onChange={(v) => set("coApplicantCurrentItr", v)}
            />
            <ItrField
              id="coApplicantPreviousItr"
              label="Their Previous Year ITR"
              value={draft.coApplicantPreviousItr}
              onChange={(v) => set("coApplicantPreviousItr", v)}
            />
          </div>

          <CoiUploadSection
            currentItrFieldId="coApplicantCurrentItr"
            currentYearLabel="Co-Applicant Current Year COI"
            prevItrFieldId="coApplicantPreviousItr"
            prevYearLabel="Co-Applicant Previous Year COI"
            title="Co-Applicant Computation of Income (COI) Verification"
          />

          <p className="rounded-md bg-bg-raised p-3 text-[0.8125rem] text-ink-muted">
            Combined for the banks:
            {" "}current year ₹{clubbedCurrentItr(draft).toLocaleString("en-IN")},
            {" "}previous year ₹{clubbedPreviousItr(draft).toLocaleString("en-IN")}.
          </p>
        </>
      )}
    </>
  );
}
