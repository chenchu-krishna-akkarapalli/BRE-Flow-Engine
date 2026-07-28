"use client";

import { useState } from "react";
import {
  CheckCircle2, ChevronDown, ChevronRight, Download, FileSpreadsheet, XCircle,
} from "lucide-react";
import { downloadApplicationExport } from "@/lib/api";
import { BANK_LABELS } from "@/lib/form-schema";
import { BANK_CODES } from "@/lib/types";
import type { BankCode, EvaluationResponse, RuleOutcome } from "@/lib/types";

function RuleTable({ rules, passed }: { rules: RuleOutcome[]; passed: boolean }) {
  if (rules.length === 0) return null;
  return (
    <div className="mt-3">
      <h4 className={`text-[0.8125rem] font-semibold ${passed ? "text-success" : "text-danger"}`}>
        {passed ? "Passed" : "Failed"} ({rules.length})
      </h4>
      {/* Wide rule tables scroll inside their own container so the card never
          forces the page to scroll horizontally. */}
      <div className="mt-1 overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-[0.8125rem]">
          <thead>
            <tr className="text-left text-ink-subtle">
              <th className="py-1 pr-3 font-normal">Rule</th>
              <th className="py-1 pr-3 font-normal">Your value</th>
              <th className="py-1 font-normal">Bank limit</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.rule_id} className="border-t border-line align-top">
                <td className="py-1.5 pr-3">
                  <span className="flex items-start gap-2">
                    {passed ? (
                      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success" aria-hidden />
                    ) : (
                      <XCircle size={14} className="mt-0.5 shrink-0 text-danger" aria-hidden />
                    )}
                    <span>
                      <span className="text-ink">{rule.name}</span>
                      <span className="numeric ml-2 text-ink-subtle">{rule.rule_id}</span>
                      {rule.message && (
                        <span className="mt-0.5 block text-ink-muted">{rule.message}</span>
                      )}
                    </span>
                  </span>
                </td>
                <td className="numeric py-1.5 pr-3 text-ink">{rule.value}</td>
                <td className="numeric py-1.5 text-ink-muted">{rule.limit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BankCard({ bank, result }: { bank: BankCode; result: EvaluationResponse }) {
  const [open, setOpen] = useState(false);
  const report = result.evaluation_report?.[bank];
  const eligible = report?.is_eligible ?? result.bank_eligibility[bank];
  const passedCount = report?.passed_rules.length ?? 0;
  const failedCount = report?.failed_rules.length ?? 0;

  return (
    <li className="glass rounded-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[44px] w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
          <span className="text-[0.9375rem] text-ink">{BANK_LABELS[bank]}</span>
        </span>
        <span className="flex items-center gap-3">
          <span className="numeric text-[0.8125rem] text-ink-subtle">
            {passedCount}✓ {failedCount}✕
          </span>
          <span
            className={`flex items-center gap-1.5 text-[0.8125rem] font-medium ${
              eligible ? "text-success" : "text-danger"
            }`}
          >
            {eligible ? <CheckCircle2 size={16} aria-hidden /> : <XCircle size={16} aria-hidden />}
            {eligible ? "ELIGIBLE" : "NOT ELIGIBLE"}
          </span>
        </span>
      </button>

      {open && report && (
        <div className="border-t border-line px-4 pb-4">
          <RuleTable rules={report.failed_rules} passed={false} />
          <RuleTable rules={report.passed_rules} passed />
        </div>
      )}
    </li>
  );
}

/** Per-bank audit cards plus the document export actions. */
export function AuditCards({ result }: { result: EvaluationResponse }) {
  const [busy, setBusy] = useState<"pdf" | "excel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function exportAs(format: "pdf" | "excel") {
    if (!result.application_id) return;
    setBusy(format);
    setError(null);
    try {
      await downloadApplicationExport(result.application_id, format);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  }

  // Eligible banks first — a rejected applicant should see their options, not
  // a wall of red.
  const banks = [...BANK_CODES].sort(
    (a, b) => Number(result.bank_eligibility[b]) - Number(result.bank_eligibility[a]),
  );

  return (
    <section aria-label="Evaluation audit" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[1.25rem] font-semibold">Evaluation audit</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => exportAs("pdf")}
            disabled={!result.application_id || busy !== null}
            className="flex min-h-[44px] items-center gap-2 rounded-md border border-line px-4 py-2 text-[0.8125rem] text-ink transition-colors hover:border-line-strong disabled:opacity-40"
          >
            <Download size={14} aria-hidden />
            {busy === "pdf" ? "Preparing…" : "Export PDF"}
          </button>
          <button
            type="button"
            onClick={() => exportAs("excel")}
            disabled={!result.application_id || busy !== null}
            className="flex min-h-[44px] items-center gap-2 rounded-md border border-line px-4 py-2 text-[0.8125rem] text-ink transition-colors hover:border-line-strong disabled:opacity-40"
          >
            <FileSpreadsheet size={14} aria-hidden />
            {busy === "excel" ? "Preparing…" : "Export Excel"}
          </button>
        </div>
      </div>

      {!result.application_id && (
        <p className="text-[0.8125rem] text-ink-subtle">
          Exports need a stored application reference; this verdict was not persisted.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-danger-bg p-3 text-[0.8125rem] text-danger">
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {banks.map((bank) => (
          <BankCard key={bank} bank={bank} result={result} />
        ))}
      </ul>
    </section>
  );
}
