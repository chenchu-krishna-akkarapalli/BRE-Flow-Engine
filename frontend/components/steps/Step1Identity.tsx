"use client";

import { Field, RadioCards, Select, TextInput } from "@/components/Field";
import {
  COMPANY_TYPES, ENTITY_TYPES, GENDERS, MARITAL, PATTERNS,
} from "@/lib/form-schema";
import { DocumentUpload } from "@/components/DocumentUpload";
import { VerifyField } from "@/components/VerifyField";
import type { Draft } from "@/store/useOnboardingStore";
import { invalid, useField } from "./step-shared";

export function Step1Identity() {
  const { draft, error, set } = useField();
  const k = <K extends keyof Draft>(key: K) => (v: Draft[K]) => set(key, v);

  const applicantNameError = error && !draft.applicantName?.trim() ? "Full legal name is required." : undefined;
  const dobError = error && !draft.dob ? "Date of birth is required." : undefined;
  const genderError = error && !draft.gender ? "Please select your gender." : undefined;
  const panError = (error && !draft.pan?.trim() ? "PAN number is required." : undefined) ||
    invalid(PATTERNS.pan, draft.pan, "This does not look like a PAN. It should read like ABCDE1234F.");
  const phoneError = (error && !draft.phone?.trim() ? "Mobile number is required." : undefined) ||
    invalid(PATTERNS.phone, draft.phone, "Enter the 10 digits of your mobile number, starting with 6, 7, 8 or 9.");
  const emailError = (error && !draft.email?.trim() ? "Email address is required." : undefined) ||
    invalid(PATTERNS.email, draft.email, "Enter a complete email address, like name@example.com.");

  const companyNameError = error && !draft.companyName?.trim() ? "Company or organisation name is required." : undefined;
  const companyTypeError = error && !draft.companyType ? "Please select the legal constitution." : undefined;
  const companyPanError = (error && !draft.companyPan?.trim() ? "Company PAN is required." : undefined) ||
    invalid(PATTERNS.pan, draft.companyPan, "This does not look like a PAN. It should read like AABCT1234C.");
  const contactPersonNameError = error && !draft.contactPersonName?.trim() ? "Contact person name is required." : undefined;
  const companyMobileError = (error && !draft.companyMobile?.trim() ? "Mobile number is required." : undefined) ||
    invalid(PATTERNS.phone, draft.companyMobile, "Enter a valid 10-digit mobile number.");
  const companyEmailError = (error && !draft.companyEmail?.trim() ? "Corporate email is required." : undefined) ||
    invalid(PATTERNS.email, draft.companyEmail, "Enter a valid corporate email address.");

  return (
    <div className="flex flex-col gap-6"> 
      <Field
        label="What is your full name as printed on your ID card?"
        htmlFor="applicantName"
        error={applicantNameError}
      >
        <TextInput
          id="applicantName"
          value={draft.applicantName}
          onChange={k("applicantName")}
          error={applicantNameError}
        />
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
          <Field
            label="Date of Birth (DOB)"
            htmlFor="dob"
            error={dobError}
          >
            <TextInput
              id="dob"
              type="date"
              value={draft.dob}
              onChange={k("dob")}
              error={dobError}
            />
          </Field>

          <Field
            label="PAN Number"
            htmlFor="pan"
            error={panError}
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
                    error={panError}
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
            <Field label="What is your gender?" htmlFor="gender" error={genderError}>
              <Select id="gender" value={draft.gender} onChange={k("gender")} options={GENDERS} />
            </Field>
            <Field label="Are you married?" htmlFor="maritalStatus">
              <Select id="maritalStatus" value={draft.maritalStatus} onChange={k("maritalStatus")} options={MARITAL} />
            </Field>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field
              label="What is your mobile number?"
              htmlFor="phone"
              error={phoneError}
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-[180px] flex-1">
                  <TextInput
                    id="phone"
                    value={draft.phone}
                    onChange={(v) => { set("phone", v); set("phoneVerified", false); }}
                    numeric
                    verified={draft.phoneVerified}
                    error={phoneError}
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
              error={emailError}
            >
              <TextInput
                id="email"
                type="email"
                value={draft.email}
                onChange={k("email")}
                error={emailError}
              />
            </Field>
          </div>
        </>
      )}

      {draft.entityType === "Company" && (
        <>
          <Field
            label="What is the registered name of your company?"
            htmlFor="companyName"
            error={companyNameError}
          >
            <TextInput
              id="companyName"
              value={draft.companyName}
              onChange={k("companyName")}
              error={companyNameError}
            />
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="What kind of company is it?" htmlFor="companyType" error={companyTypeError}>
              <Select id="companyType" value={draft.companyType} onChange={k("companyType")} options={COMPANY_TYPES} placeholder="Choose one" />
            </Field>
            <Field
              label="What is the company's 10-character PAN number?"
              htmlFor="companyPan"
              error={companyPanError}
            >
              <TextInput
                id="companyPan"
                value={draft.companyPan}
                onChange={(v) => set("companyPan", v.toUpperCase())}
                placeholder="AABCT1234C"
                numeric
                error={companyPanError}
              />
            </Field>
          </div>

          <Field label="Where is the company located?" htmlFor="companyLocation">
            <TextInput id="companyLocation" value={draft.companyLocation} onChange={k("companyLocation")} />
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field
              label="Who should we speak to about this application?"
              htmlFor="contactPersonName"
              error={contactPersonNameError}
            >
              <TextInput
                id="contactPersonName"
                value={draft.contactPersonName}
                onChange={k("contactPersonName")}
                error={contactPersonNameError}
              />
            </Field>
            <Field label="What is that person's job title?" htmlFor="contactPersonDesignation">
              <TextInput id="contactPersonDesignation" value={draft.contactPersonDesignation} onChange={k("contactPersonDesignation")} placeholder="e.g. Director, Accounts Manager" />
            </Field>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field
              label="What is the company's mobile number?"
              htmlFor="companyMobile"
              error={companyMobileError}
            >
              <TextInput
                id="companyMobile"
                value={draft.companyMobile}
                onChange={k("companyMobile")}
                numeric
                error={companyMobileError}
              />
            </Field>
            <Field
              label="What is the company's email address?"
              htmlFor="companyEmail"
              error={companyEmailError}
            >
              <TextInput
                id="companyEmail"
                type="email"
                value={draft.companyEmail}
                onChange={k("companyEmail")}
                error={companyEmailError}
              />
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

export default Step1Identity;
