"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Upload, X } from "lucide-react";
import { ACCEPTED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, extractDocument } from "@/lib/api";

// Upload + Review/Extract modal for a scanned document (add-on.md §1.3, §2.1).
// The preview is a local object URL, so Review costs no round trip and the file
// only leaves the browser when the applicant asks for Extract.
export function DocumentUpload({
  id, documentType, label, helper, onExtracted,
}: {
  id: string;
  documentType: "pan" | "aadhaar";
  label: string;
  helper?: string;
  // Called with the OCR fields; the caller decides which to write into the form.
  onExtracted?: (fields: Record<string, string | null>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [simulated, setSimulated] = useState(false);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Escape closes the modal, matching every other dialog the applicant meets.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function choose(selected: File | undefined) {
    setError(null);
    setDone(null);
    if (!selected) return;
    if (selected.size > MAX_UPLOAD_BYTES) {
      setError(`That file is ${(selected.size / 1_048_576).toFixed(1)} MB. The limit is 5 MB.`);
      return;
    }
    if (!ACCEPTED_UPLOAD_TYPES.includes(selected.type)) {
      setError("Upload a JPEG, PNG or PDF.");
      return;
    }
    setFile(selected);
    setReviewing(false);
    setOpen(true);
  }

  async function extract() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const result = await extractDocument(documentType, file);
      if (!result.populated) {
        setError(
          result.simulated
            ? "Document reading is switched off on this server, so nothing was filled in. Enter the details by hand."
            : "Nothing could be read from that image. Enter the details by hand.",
        );
        return;
      }
      onExtracted?.(result.extracted);
      setSimulated(result.simulated);
      setDone(result.filename);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={ACCEPTED_UPLOAD_TYPES.join(",")}
        className="sr-only"
        onChange={(e) => choose(e.target.files?.[0])}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-h-[44px] items-center gap-2 rounded-md border border-line px-4 py-2 text-[0.875rem] text-ink transition-colors hover:border-line-strong"
        >
          <Upload size={15} aria-hidden />
          {label}
        </button>
        {done && (
          <span
            className={`flex items-center gap-1.5 text-[0.8125rem] font-medium ${
              simulated ? "text-warning" : "text-success"
            }`}
          >
            <CheckCircle2 size={15} aria-hidden />
            {done}
          </span>
        )}
        {file && !done && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-h-[44px] text-[0.8125rem] text-brand-600 underline underline-offset-2"
          >
            Review or extract
          </button>
        )}
      </div>
      {helper && !error && <p className="text-[0.8125rem] text-ink">{helper}</p>}
      {/* A filename-derived value is a guess, not a reading. Say so, or the
          applicant signs off on a number nobody checked against the card. */}
      {simulated && (
        <p className="text-[0.8125rem] font-medium text-warning">
          Document reading is switched off on this server. We filled this in from the file name —
          please check it against your card before continuing.
        </p>
      )}
      {error && <p className="text-[0.8125rem] font-medium text-danger">{error}</p>}

      {open && file && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${label} — review or extract`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex w-full max-w-[560px] flex-col gap-4 rounded-lg bg-bg-surface p-6 shadow-float"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[1.125rem] font-semibold text-ink-muted">{label}</h2>
                <p className="numeric mt-0.5 text-[0.8125rem] text-ink">
                  {file.name} · {(file.size / 1024).toFixed(0)} KB
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="min-h-[44px] min-w-[44px] text-ink"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            {reviewing && previewUrl && (
              <div className="max-h-[50vh] overflow-auto rounded-md border border-line bg-bg-raised p-2">
                {file.type === "application/pdf" ? (
                  <object data={previewUrl} type="application/pdf" className="h-[45vh] w-full">
                    <p className="p-4 text-[0.875rem] text-ink">
                      This browser cannot preview PDFs inline.
                    </p>
                  </object>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={previewUrl} alt={`Preview of ${file.name}`} className="mx-auto max-w-full" />
                )}
              </div>
            )}

            {error && <p className="text-[0.8125rem] font-medium text-danger">{error}</p>}

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setReviewing((r) => !r)}
                className="min-h-[44px] rounded-md border border-line px-5 py-2 text-[0.9375rem] text-ink transition-colors hover:border-line-strong"
              >
                {reviewing ? "Hide preview" : "Review"}
              </button>
              <button
                type="button"
                onClick={extract}
                disabled={busy}
                className="min-h-[44px] rounded-md bg-brand-600 px-5 py-2 text-[0.9375rem] font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
              >
                {busy ? "Reading…" : "Extract"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
