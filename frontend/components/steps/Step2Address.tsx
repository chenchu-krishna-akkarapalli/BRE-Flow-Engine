"use client";

import { useState, useEffect, useRef } from "react";
import { Field, RadioCards, SearchableSelect, TextInput } from "@/components/Field";
import {
  ADDRESS_PROOF_DETAIL, ADDRESS_PROOF_HELPER, ADDRESS_PROOF_TYPES,
  formatAadhaar, PATTERNS, RESIDENCE,
} from "@/lib/form-schema";
import { DocumentUpload } from "@/components/DocumentUpload";
import type { Draft } from "@/store/useOnboardingStore";
import { invalid, useField } from "./step-shared";

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

export default Step2Address;
