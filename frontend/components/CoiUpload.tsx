"use client";

import { useRef, useState } from "react";
import { BadgeCheck, FileText, Loader2, RotateCcw } from "lucide-react";
import { extractCoiReport } from "@/lib/api";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import { CoiStructuredView } from "./CoiStructuredView";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB cap

// single concise context line
export function CoiUpload() {
  const verified = useOnboardingStore((s) => s.coiVerified);
  const apply = useOnboardingStore((s) => s.applyCoiExtraction);
  const clear = useOnboardingStore((s) => s.clearCoiExtraction);

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
      setError("Upload the Computation of Income (COI) report as a PDF.");
      return;
    }

    setBusy(true);
    try {
      const result = await extractCoiReport(file);
      if (result.extraction_status !== "SUCCESS") {
        setError(result.message || "That COI report could not be read.");
        return;
      }
      apply(result.extracted, result.filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The COI report could not be parsed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-bg-raised p-4">
      <input
        ref={inputRef}
        id="coiReport"
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
              {busy ? "Reading your COI report…" : "Upload COI PDF"}
            </button>
            <p className="text-[0.8125rem] text-ink">
              Optional. Upload your Computation of Income PDF to auto-fill business/salaried income.
            </p>
          </div>

          {error && (
            <div className="rounded-md border border-danger/30 bg-danger-bg p-3 text-[0.8125rem] text-danger">
              {error}
            </div>
          )}
        </>
      )}

      {verified && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-success-bg px-3 py-1 text-[0.8125rem] font-medium text-success">
              <BadgeCheck size={15} aria-hidden />
              Verified via COI PDF
            </span>
            <span className="numeric text-[0.8125rem] font-medium text-ink">{verified.filename}</span>
            <button
              type="button"
              onClick={clear}
              className="ml-auto flex min-h-[44px] items-center gap-1.5 text-[0.8125rem] text-brand-600 underline underline-offset-2"
            >
              <RotateCcw size={14} aria-hidden />
              Clear
            </button>
          </div>

          <CoiStructuredView data={verified.evidence} filename={verified.filename} onClear={clear} />
        </div>
      )}
    </div>
  );
}
