"use client";

import { useRef, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { MAX_UPLOAD_BYTES, extractCibilReport } from "@/lib/api";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import { CibilBureauSummaryCard } from "@/components/CibilBureauSummaryCard";

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

  if (verified) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-3">
        <input
          ref={inputRef}
          id="cibilReport"
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={(e) => upload(e.target.files?.[0])}
        />
        <CibilBureauSummaryCard
          onReupload={() => inputRef.current?.click()}
          reuploadBusy={busy}
        />
        {error && <p className="text-[0.8125rem] font-medium text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 rounded-xl border border-line bg-bg-raised p-4">
      <input
        ref={inputRef}
        id="cibilReport"
        type="file"
        accept="application/pdf"
        className="sr-only"
        onChange={(e) => upload(e.target.files?.[0])}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex min-h-[44px] items-center gap-2 rounded-md border border-line bg-white px-4 py-2 text-[0.875rem] text-ink transition-colors hover:border-line-strong disabled:opacity-60 cursor-pointer"
        >
          {busy ? (
            <Loader2 size={15} aria-hidden className="animate-spin" />
          ) : (
            <FileText size={15} aria-hidden />
          )}
          {busy ? "Reading your report…" : "Upload CIBIL report"}
        </button>
        <p className="text-[0.8125rem] text-ink">
          Optional. Upload the PDF and we will fill in your score, active EMIs, and loan history automatically.
        </p>
      </div>
      <p aria-live="polite" className="sr-only">
        {busy ? "Reading your credit report" : ""}
      </p>

      {error && <p className="text-[0.8125rem] font-medium text-danger">{error}</p>}
    </div>
  );
}
