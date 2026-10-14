"use client";

import { useRef, useState } from "react";
import { AlertTriangle, BadgeCheck, FileText, Loader2, RotateCcw, UserCheck } from "lucide-react";
import { MAX_UPLOAD_BYTES, extractPayslipReport } from "@/lib/api";
import { useOnboardingStore } from "@/store/useOnboardingStore";

type Evidence = Record<string, any>;

// Backend gate reasons, in words an applicant can check against their payslip.
const REVIEW_REASON_TEXT: Record<string, string> = {
  earning_items_do_not_sum_to_gross: "The earnings listed don't add up to the gross salary.",
  deduction_items_do_not_sum_to_total: "The deductions listed don't add up to the total deductions.",
  gross_minus_deductions_does_not_equal_net: "Gross salary minus deductions doesn't equal the net pay.",
  gross_salary_missing: "The gross salary couldn't be found.",
  total_deductions_missing: "The total deductions couldn't be found.",
  net_pay_missing: "The net pay couldn't be found.",
  net_exceeds_gross: "The net pay is higher than the gross salary.",
  net_pay_not_positive: "The net pay couldn't be read correctly.",
  period_missing: "The pay month couldn't be found.",
  no_earning_items: "No earnings could be read.",
};

function reviewReasons(evidence: Evidence): string[] {
  const reasons: string[] = (evidence.reviewReasons ?? []).map((r: string) =>
    r.startsWith("llm_ungrounded") ? "Some figures couldn't be matched to the payslip text." : REVIEW_REASON_TEXT[r],
  );
  return Array.from(new Set(reasons.filter(Boolean)));
}

function Breakdown({ evidence }: { evidence: Evidence }) {
  const [expanded, setExpanded] = useState(true);
  const evaluated = (evidence.evaluated ?? {}) as Evidence;
  const breakdown = (evidence.transparentBreakdown ?? {}) as Evidence;
  const metadata = (breakdown.employeeMetadata ?? {}) as Evidence;

  const monthlyGross = Number(evaluated.monthlyGrossSalary ?? evidence.grossSalary ?? 0);
  const annualGross = Number(evaluated.annualGrossSalary ?? monthlyGross * 12);
  const paymentMethod = String(evaluated.salaryPaymentMethod ?? evidence.salaryPaymentMethod ?? "Bank Account");
  const monthlyNet = Number(breakdown.monthlyNetSalary ?? evidence.netSalary ?? 0);
  const totalEarnings = Number(breakdown.totalEarnings ?? monthlyGross);
  const totalDeductions = Number(breakdown.totalDeductions ?? 0);
  const earningsList: Array<{ label: string; amount: number | null }> = breakdown.earningsBreakdown ?? [];
  const deductionsList: Array<{ label: string; amount: number | null }> = breakdown.deductionsBreakdown ?? [];
  const verified = evidence.reviewRequired === false;

  return (
    <div className="rounded-lg border border-line bg-white p-3.5 text-[0.8125rem] text-ink">
      <div className="flex items-center justify-between font-semibold">
        <span>Payslip Transparency Breakdown</span>
        <button type="button" onClick={() => setExpanded(!expanded)} className="text-[0.75rem] text-brand-600 underline">
          {expanded ? "Hide details" : "Show details"}
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-[0.8125rem] sm:grid-cols-3">
        <div>
          <span className="text-ink-muted block text-[0.75rem]">Monthly Gross Salary</span>
          <span className={`font-semibold ${verified ? "text-success" : "text-warning"}`}>
            ₹{monthlyGross.toLocaleString("en-IN")}
          </span>
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
          <div className="flex flex-wrap justify-between gap-2 text-[0.8125rem] font-medium">
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
                    {/* A negative deduction is a refund (e.g. tax adjusted at broker). */}
                    <span className="font-mono">
                      {(item.amount ?? 0) < 0 ? "+" : "-"}₹{Math.abs(item.amount ?? 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PayslipUpload() {
  const verified = useOnboardingStore((s) => s.payslipVerified);
  const apply = useOnboardingStore((s) => s.applyPayslipExtraction);
  const clear = useOnboardingStore((s) => s.clearPayslipExtraction);

  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Figures the backend could not verify: shown for the applicant to check, and
  // applied to the application (salary feeds eligibility) only once they confirm.
  const [pending, setPending] = useState<{ evidence: Evidence; filename: string } | null>(null);

  async function upload(file: File | undefined) {
    setError(null);
    setPending(null);
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
      if (result.extracted.reviewRequired === false) {
        apply(result.extracted, result.filename);
      } else {
        setPending({ evidence: result.extracted, filename: result.filename });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "The payslip could not be parsed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const shown = verified ?? pending;
  const evidence = (shown?.evidence ?? {}) as Evidence;
  const confirmedByApplicant = Boolean(verified) && evidence.reviewRequired !== false;

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

      {!shown && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="flex min-h-[44px] items-center gap-2 rounded-md border border-line bg-white px-4 py-2 text-[0.875rem] text-ink transition-colors hover:border-line-strong disabled:opacity-60"
            >
              {busy ? <Loader2 size={15} aria-hidden className="animate-spin" /> : <FileText size={15} aria-hidden />}
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

      {shown && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {verified && !confirmedByApplicant && (
              <span className="flex items-center gap-1.5 rounded-full bg-success-bg px-3 py-1 text-[0.8125rem] font-medium text-success">
                <BadgeCheck size={15} aria-hidden />
                Verified via Payslip PDF
              </span>
            )}
            {confirmedByApplicant && (
              <span className="flex items-center gap-1.5 rounded-full bg-bg-raised px-3 py-1 text-[0.8125rem] font-medium text-ink">
                <UserCheck size={15} aria-hidden />
                Confirmed by applicant
              </span>
            )}
            {pending && !verified && (
              <span className="flex items-center gap-1.5 rounded-full bg-warning-bg px-3 py-1 text-[0.8125rem] font-medium text-warning">
                <AlertTriangle size={15} aria-hidden />
                Check these figures
              </span>
            )}
            <span className="numeric text-[0.8125rem] text-ink font-medium">{shown.filename}</span>
            <button
              type="button"
              onClick={() => {
                clear();
                setPending(null);
              }}
              className="ml-auto flex min-h-[44px] items-center gap-1.5 text-[0.8125rem] text-brand-600 underline underline-offset-2"
            >
              <RotateCcw size={14} aria-hidden />
              Clear
            </button>
          </div>

          {pending && !verified && (
            <div role="status" className="rounded-lg border border-line bg-warning-bg p-3 text-[0.8125rem] text-ink">
              <p className="font-medium">We read your payslip but couldn't verify these figures automatically:</p>
              <ul className="mt-1 list-disc pl-5">
                {reviewReasons(evidence).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <p className="mt-2">
                Compare them with your payslip. If they match, use them; otherwise enter your gross salary manually.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    apply(pending.evidence, pending.filename);
                    setPending(null);
                  }}
                  className="min-h-[44px] rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
                >
                  These figures match my payslip
                </button>
                <button
                  type="button"
                  onClick={() => setPending(null)}
                  className="min-h-[44px] rounded-md border border-line bg-white px-4 py-2 text-ink hover:border-line-strong"
                >
                  Enter salary manually
                </button>
              </div>
            </div>
          )}

          <Breakdown evidence={evidence} />
        </div>
      )}

      {error && <p className="text-[0.8125rem] font-medium text-danger">{error}</p>}
    </div>
  );
}
