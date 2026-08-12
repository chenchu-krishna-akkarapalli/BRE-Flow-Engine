"use client";

import { useRef, useState } from "react";
import { BadgeCheck, FileText, Loader2, RotateCcw } from "lucide-react";
import { MAX_UPLOAD_BYTES, extractPayslipReport } from "@/lib/api";
import { useOnboardingStore } from "@/store/useOnboardingStore";

export function PayslipUpload() {
  const verified = useOnboardingStore((s) => s.payslipVerified);
  const apply = useOnboardingStore((s) => s.applyPayslipExtraction);
  const clear = useOnboardingStore((s) => s.clearPayslipExtraction);

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
      setError("Upload the payslip report as a PDF.");
      return;
    }

    setBusy(true);
    try {
      const result = await extractPayslipReport(file);
      if (result.extraction_status !== "SUCCESS") {
        setError(result.message || "That payslip report could not be read.");
        return;
      }
      apply(result.extracted, result.filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The payslip could not be parsed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const evidence = (verified?.evidence ?? {}) as Record<string, any>;
  const evaluated = (evidence.evaluated ?? {}) as Record<string, any>;
  const breakdown = (evidence.transparentBreakdown ?? {}) as Record<string, any>;
  const metadata = (breakdown.employeeMetadata ?? {}) as Record<string, any>;

  const monthlyGross = Number(evaluated.monthlyGrossSalary ?? evidence.grossSalary ?? 0);
  const annualGross = Number(evaluated.annualGrossSalary ?? (monthlyGross * 12));
  const paymentMethod = String(evaluated.salaryPaymentMethod ?? evidence.salaryPaymentMethod ?? "Bank Account");
  const monthlyNet = Number(breakdown.monthlyNetSalary ?? evidence.netSalary ?? 0);
  const totalEarnings = Number(breakdown.totalEarnings ?? monthlyGross);
  const totalDeductions = Number(breakdown.totalDeductions ?? 0);

  const earningsList: Array<{ label: string; amount: number | null }> = breakdown.earningsBreakdown ?? [];
  const deductionsList: Array<{ label: string; amount: number | null }> = breakdown.deductionsBreakdown ?? [];

  const [expanded, setExpanded] = useState(true);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-bg-raised p-4">
      <input
        ref={inputRef}
        id="payslipReport"
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
              {busy ? "Reading your payslip…" : "Upload Payslip PDF"}
            </button>
            <p className="text-[0.8125rem] text-ink">
              Optional. Upload your payslip PDF to auto-fill your gross salary & receive mode.
            </p>
          </div>
          <p aria-live="polite" className="sr-only">
            {busy ? "Reading your payslip" : ""}
          </p>
        </>
      )}

      {verified && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-success-bg px-3 py-1 text-[0.8125rem] font-medium text-success">
              <BadgeCheck size={15} aria-hidden />
              Verified via Payslip PDF
            </span>
            <span className="numeric text-[0.8125rem] text-ink font-medium">{verified.filename}</span>
            <button
              type="button"
              onClick={clear}
              className="ml-auto flex min-h-[44px] items-center gap-1.5 text-[0.8125rem] text-brand-600 underline underline-offset-2"
            >
              <RotateCcw size={14} aria-hidden />
              Clear
            </button>
          </div>

          <div className="rounded-lg border border-line bg-white p-3.5 text-[0.8125rem] text-ink">
            <div className="flex items-center justify-between font-semibold">
              <span>Payslip Transparency Breakdown</span>
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="text-[0.75rem] text-brand-600 underline"
              >
                {expanded ? "Hide details" : "Show details"}
              </button>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 text-[0.8125rem] sm:grid-cols-3">
              <div>
                <span className="text-ink-muted block text-[0.75rem]">Monthly Gross Salary</span>
                <span className="font-semibold text-success">₹{monthlyGross.toLocaleString("en-IN")}</span>
              </div>
              <div>
                <span className="text-ink-muted block text-[0.75rem]">Annual Gross Projection</span>
                <span className="font-semibold">₹{annualGross.toLocaleString("en-IN")}</span>
              </div>
              <div>
                <span className="text-ink-muted block text-[0.75rem]">Salary Receive Mode</span>
                <span className="font-semibold">{paymentMethod}</span>
              </div>
            </div>

            {expanded && (
              <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
                <div className="flex justify-between text-[0.8125rem] font-medium">
                  <span>Total Earnings: ₹{totalEarnings.toLocaleString("en-IN")}</span>
                  <span>Total Deductions: ₹{totalDeductions.toLocaleString("en-IN")}</span>
                  <span>Monthly Net Pay: ₹{monthlyNet.toLocaleString("en-IN")}</span>
                </div>

                {metadata.employerName || metadata.applicantName ? (
                  <div className="rounded-md bg-bg-raised p-2 text-[0.75rem]">
                    {metadata.employerName && <div><strong>Employer:</strong> {metadata.employerName}</div>}
                    {metadata.applicantName && <div><strong>Employee:</strong> {metadata.applicantName}</div>}
                    {metadata.panNumber && <div><strong>PAN:</strong> {metadata.panNumber}</div>}
                    {metadata.bankAccount && <div><strong>Bank Account:</strong> {metadata.bankAccount}</div>}
                    {metadata.uan && <div><strong>UAN:</strong> {metadata.uan}</div>}
                  </div>
                ) : null}

                {earningsList.length > 0 && (
                  <div>
                    <div className="font-medium text-[0.75rem] text-ink-muted mb-1">Itemized Earnings:</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[0.75rem]">
                      {earningsList.map((item, idx) => (
                        <div key={idx} className="flex justify-between border-b border-dashed border-line pb-0.5">
                          <span>{item.label}</span>
                          <span className="font-mono">₹{(item.amount ?? 0).toLocaleString("en-IN")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {deductionsList.length > 0 && (
                  <div>
                    <div className="font-medium text-[0.75rem] text-ink-muted mb-1">Itemized Deductions:</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[0.75rem]">
                      {deductionsList.map((item, idx) => (
                        <div key={idx} className="flex justify-between border-b border-dashed border-line pb-0.5 text-danger">
                          <span>{item.label}</span>
                          <span className="font-mono">-₹{(item.amount ?? 0).toLocaleString("en-IN")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-[0.8125rem] font-medium text-danger">{error}</p>}
    </div>
  );
}
