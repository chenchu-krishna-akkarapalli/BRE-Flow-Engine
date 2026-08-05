"use client";

import { useRef, useState } from "react";
import { BadgeCheck, FileText, Loader2, RotateCcw } from "lucide-react";
import { MAX_UPLOAD_BYTES, extractCibilReport } from "@/lib/api";
import { useOnboardingStore } from "@/store/useOnboardingStore";

// Upload a CIBIL report and let the Rust engine fill Step 4 from it. The PDF is
// posted, parsed and discarded; only the bureau fields come back.
export function CibilUpload() {
  const verified = useOnboardingStore((s) => s.cibilVerified);
  const apply = useOnboardingStore((s) => s.applyCibilExtraction);
  const clear = useOnboardingStore((s) => s.clearCibilExtraction);

  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`That file is ${(file.size / 1_048_576).toFixed(1)} MB. The limit is 5 MB.`);
      return;
    }
    if (file.type !== "application/pdf") {
      setError("Upload the CIBIL report as a PDF.");
      return;
    }

    setBusy(true);
    try {
      const result = await extractCibilReport(file);
      if (!result.success) {
        // A report the engine cannot attribute to a consumer must never be
        // presented as this applicant's history; they answer the questions instead.
        setError(
          result.status === "UNKNOWN_CONSUMER"
            ? "We could not read a credit history from that PDF — it may be a scan or an image-only export. Please answer the questions below instead."
            : result.message || "That report could not be read. Please answer the questions below.",
        );
        return;
      }
      apply(result.extracted, result.filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The report could not be parsed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const evidence = verified?.evidence ?? {};
  const worstEver = Number(evidence.worstEverDpd ?? 0);
  const recent = Number(evidence.bureauDpd ?? 0);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-bg-raised p-4">
      <input
        ref={inputRef}
        id="cibilReport"
        type="file"
        accept="application/pdf"
        className="sr-only"
        onChange={(e) => upload(e.target.files?.[0])}
      />

      {!verified && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="flex min-h-[44px] items-center gap-2 rounded-md border border-line bg-white px-4 py-2 text-[0.875rem] text-ink transition-colors hover:border-line-strong disabled:opacity-60"
            >
              {busy ? (
                <Loader2 size={15} aria-hidden className="animate-spin" />
              ) : (
                <FileText size={15} aria-hidden />
              )}
              {busy ? "Reading your report…" : "Upload CIBIL report"}
            </button>
            <p className="text-[0.8125rem] text-ink">
              Optional. Upload the PDF and we will fill in the answers below for you.
            </p>
          </div>
          <p aria-live="polite" className="sr-only">
            {busy ? "Reading your credit report" : ""}
          </p>
        </>
      )}

      {verified && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-success-bg px-3 py-1 text-[0.8125rem] font-medium text-success">
              <BadgeCheck size={15} aria-hidden />
              Verified via CIBIL PDF
            </span>
            <span className="numeric text-[0.8125rem] text-ink">{verified.filename}</span>
            <button
              type="button"
              onClick={clear}
              className="ml-auto flex min-h-[44px] items-center gap-1.5 text-[0.8125rem] text-brand-600 underline underline-offset-2"
            >
              <RotateCcw size={14} aria-hidden />
              Answer these myself instead
            </button>
          </div>
          <p className="text-[0.8125rem] text-ink">
            The answers below were read from your report and cannot be edited while it is attached.
          </p>
          {/* An old default that has since cured is not current delinquency, but
              hiding it entirely would misrepresent the report we just read. */}
          {worstEver > recent && (
            <p className="text-[0.8125rem] text-ink">
              Your report also shows an older delinquency of {worstEver} days that has since been
              cleared. Banks score your recent history, so it is not counted below.
            </p>
          )}
        </div>
      )}

      {error && <p className="text-[0.8125rem] font-medium text-danger">{error}</p>}
    </div>
  );
}
