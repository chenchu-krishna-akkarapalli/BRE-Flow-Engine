"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import { extractCoiReport } from "@/lib/api";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import type { CoiRecord } from "@/store/useOnboardingStore";
import { CoiStructuredView } from "./CoiStructuredView";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
}

interface CoiYearCardProps {
  fieldId: string;
  yearLabel: string;
  subLabel?: string;
  onOpenDetails: (record: CoiRecord) => void;
}

function CoiYearCard({
  fieldId,
  yearLabel,
  subLabel,
  onOpenDetails,
}: CoiYearCardProps) {
  const scopeId = `${fieldId}_coi`;
  const coiRecord = useOnboardingStore((s) => s.coiRecords[scopeId]);
  const setCoiRecord = useOnboardingStore((s) => s.setCoiRecord);
  const setField = useOnboardingStore((s) => s.setField);
  const draft = useOnboardingStore((s) => s.draft);

  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(file: File | undefined) {
    setError(null);
    if (!file) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`File is ${(file.size / 1_048_576).toFixed(1)} MB. Limit is 5 MB.`);
      return;
    }
    if (file.type !== "application/pdf") {
      setError("Please upload the Computation of Income as a PDF.");
      return;
    }

    setBusy(true);
    try {
      const result = await extractCoiReport(file);
      if (result.extraction_status !== "SUCCESS") {
        setError(result.message || "Could not read this COI report.");
        return;
      }

      const raw = (result.extracted ?? {}) as Record<string, any>;
      const summary = (raw.summary as Record<string, any>) ?? {};
      const assessee = (raw.assessee_info as Record<string, any>) ?? {};
      const computation = (raw.computation_of_total_income as Record<string, any>) ?? {};

      // Parse total income
      const rawTotal =
        summary.total_income ??
        computation.total_income?.amount ??
        summary.gross_total_income ??
        computation.gross_total_income;

      let totalIncome: number | null = null;
      if (typeof rawTotal === "number") {
        totalIncome = rawTotal;
      } else if (rawTotal !== undefined && rawTotal !== null) {
        const parsed = parseInt(String(rawTotal).replace(/[^0-9]/g, ""), 10);
        if (!isNaN(parsed) && parsed > 0) totalIncome = parsed;
      }

      // Parse gross total income
      const rawGti = summary.gross_total_income ?? computation.gross_total_income;
      let grossTotalIncome: number | null = null;
      if (typeof rawGti === "number") {
        grossTotalIncome = rawGti;
      } else if (rawGti !== undefined && rawGti !== null) {
        const parsed = parseInt(String(rawGti).replace(/[^0-9]/g, ""), 10);
        if (!isNaN(parsed) && parsed > 0) grossTotalIncome = parsed;
      }

      // Populate applicant name / pan if empty
      const applicantName = String(summary.assessee_name ?? assessee.name ?? "");
      const panNumber = String(summary.pan ?? assessee.pan ?? "");
      if (applicantName && !draft.applicantName) {
        setField("applicantName", applicantName);
      }
      if (panNumber && !draft.pan) {
        setField("pan", panNumber);
      }

      const newRecord: CoiRecord = {
        verified: true,
        filename: result.filename,
        totalIncome,
        grossTotalIncome,
        evidence: raw,
      };

      setCoiRecord(scopeId, newRecord);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse COI report.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleClear() {
    setCoiRecord(scopeId, null);
    setError(null);
  }

  return (
    <div className="flex flex-col justify-between rounded-xl border border-line bg-white p-4 shadow-2xs transition-all hover:border-line-strong">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="sr-only"
        onChange={(e) => handleFileChange(e.target.files?.[0])}
      />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[0.75rem] font-bold uppercase tracking-wider text-ink">
            {yearLabel}
          </span>
          {subLabel && (
            <span className="text-[0.6875rem] text-ink-subtle">{subLabel}</span>
          )}
        </div>

        {!coiRecord?.verified ? (
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-slate-50/60 px-4 py-2 text-xs font-semibold text-ink transition-all hover:border-brand-500 hover:bg-brand-500/5 hover:text-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <Loader2 size={15} className="animate-spin text-brand-600" />
              ) : (
                <Upload size={15} className="text-ink-subtle" />
              )}
              <span>{busy ? "Reading COI PDF…" : `Upload ${yearLabel}`}</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2.5 py-0.5 text-[0.6875rem] font-semibold text-success">
                <CheckCircle2 size={12} />
                Verified via COI
              </span>
              <span
                className="max-w-[140px] truncate text-[0.6875rem] font-mono text-ink-subtle"
                title={coiRecord.filename}
              >
                {coiRecord.filename}
              </span>
            </div>

            {/* Total Income Display Box */}
            <div className="flex flex-col gap-1 rounded-lg border border-line bg-slate-50/80 p-2.5">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-subtle">
                Total Income from COI
              </span>
              <output className="font-mono text-base font-bold text-ink">
                {formatCurrency(coiRecord.totalIncome)}
              </output>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => onOpenDetails(coiRecord)}
                className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-brand-600 hover:text-brand-700 hover:underline"
              >
                <Eye size={13} />
                <span>View Details</span>
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center gap-1 text-[0.75rem] text-ink-subtle hover:text-danger hover:underline"
                title="Clear uploaded COI"
              >
                <RotateCcw size={13} />
                <span>Clear</span>
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-danger/30 bg-danger-bg p-2 text-[0.6875rem] text-danger">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export interface CoiUploadSectionProps {
  currentItrFieldId: string;
  currentYearLabel?: string;
  prevItrFieldId: string;
  prevYearLabel?: string;
  title?: string;
}

export function CoiUploadSection({
  currentItrFieldId,
  currentYearLabel = "Current Year COI",
  prevItrFieldId,
  prevYearLabel = "Previous Year COI",
  title = "Computation of Income (COI) Verification",
}: CoiUploadSectionProps) {
  const [activeDetails, setActiveDetails] = useState<CoiRecord | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll and listen for Escape key when modal is open
  useEffect(() => {
    if (!activeDetails) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveDetails(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeDetails]);

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-line bg-bg-raised p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600">
          <FileText size={16} />
        </span>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
            {title}
          </h4>
          <p className="text-[0.6875rem] text-ink-subtle">
            Upload your tax computation schedule to verify your computation of income.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CoiYearCard
          fieldId={currentItrFieldId}
          yearLabel={currentYearLabel}
          onOpenDetails={setActiveDetails}
        />
        <CoiYearCard
          fieldId={prevItrFieldId}
          yearLabel={prevYearLabel}
          onOpenDetails={setActiveDetails}
        />
      </div>

      {/* COI Structured Details Modal rendered in Portal */}
      {mounted &&
        typeof document !== "undefined" &&
        activeDetails &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="coi-modal-title"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-3 sm:p-6 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setActiveDetails(null)}
          >
            <div
              className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-line bg-white shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Sticky Header */}
              <div className="flex items-center justify-between border-b border-line bg-slate-50/90 px-5 py-3.5 backdrop-blur-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 border border-brand-500/20">
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 id="coi-modal-title" className="text-sm font-bold text-ink">
                        Computation of Income (COI) Details
                      </h3>
                      <span className="hidden sm:inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[0.6875rem] font-semibold text-emerald-700">
                        Verified
                      </span>
                    </div>
                    <p className="truncate font-mono text-[0.6875rem] text-ink-subtle">
                      {activeDetails.filename}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDetails(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-subtle transition-colors hover:border-line-strong hover:bg-white hover:text-ink cursor-pointer"
                  aria-label="Close modal"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <CoiStructuredView
                  data={activeDetails.evidence}
                  filename={activeDetails.filename}
                  onClear={() => setActiveDetails(null)}
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
