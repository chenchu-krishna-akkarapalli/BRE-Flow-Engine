"use client";

import { useState } from "react";
import {
  CheckCircle2, ChevronDown, ChevronRight, Download, FileSpreadsheet, ShieldAlert, XCircle,
} from "lucide-react";
import { downloadApplicationExport } from "@/lib/api";
import { BANK_LABELS } from "@/lib/form-schema";
import { BANK_CODES } from "@/lib/types";
import type { BankCode, EvaluationResponse, RuleOutcome } from "@/lib/types";

function RuleTable({ rules, passed }: { rules: RuleOutcome[]; passed: boolean }) {
  if (rules.length === 0) return null;
  return (
    <div className="mt-3">
      <h4 className={`text-xs font-bold uppercase tracking-wider ${passed ? "text-success" : "text-danger"}`}>
        {passed ? "Passed Rules" : "Rejection Triggers"} ({rules.length})
      </h4>
      <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-bg-raised p-2">
        <table className="w-full min-w-[440px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-line text-left text-ink-subtle">
              <th className="py-2 px-3 font-semibold">Rule & Description</th>
              <th className="py-2 px-3 font-semibold">Applicant Value</th>
              <th className="py-2 px-3 font-semibold">Policy Threshold</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rules.map((rule) => (
              <tr key={rule.rule_id} className="hover:bg-white transition-colors">
                <td className="py-2 px-3">
                  <span className="flex items-start gap-2">
                    {passed ? (
                      <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success" />
                    ) : (
                      <XCircle size={15} className="mt-0.5 shrink-0 text-danger" />
                    )}
                    <span>
                      <span className="font-bold text-ink">{rule.parameter_name}</span>
                      <span className="numeric ml-2 rounded bg-white px-1.5 py-0.5 text-[0.6875rem] font-bold text-ink-subtle border border-line">
                        {rule.rule_id}
                      </span>
                      {rule.description && (
                        <span className="mt-0.5 block text-ink-muted leading-relaxed font-medium">{rule.description}</span>
                      )}
                    </span>
                  </span>
                </td>
                <td className="numeric py-2 px-3 font-bold text-ink">{rule.user_value}</td>
                <td className="numeric py-2 px-3 text-ink-muted">{rule.limit_value}</td>
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
    <li className="glass-card rounded-xl border border-line overflow-hidden shadow-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-bg-raised"
      >
        <span className="flex items-center gap-2.5">
          {open ? <ChevronDown size={18} className="text-brand-600" /> : <ChevronRight size={18} className="text-ink-subtle" />}
          <span className="text-sm font-bold text-ink">{BANK_LABELS[bank]}</span>
        </span>
        <span className="flex items-center gap-4">
          <span className="numeric text-xs font-mono text-ink-subtle bg-bg-raised px-2 py-1 rounded-md border border-line">
            {passedCount}✓ {failedCount}✕
          </span>
          <span
            className={`flex items-center gap-1.5 text-xs font-bold tracking-wider ${
              eligible ? "text-success" : "text-danger"
            }`}
          >
            {eligible ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            <span>{eligible ? "ELIGIBLE" : "NOT ELIGIBLE"}</span>
          </span>
        </span>
      </button>

      {open && report && (
        <div className="border-t border-line bg-white p-4">
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

  const banks = [...BANK_CODES].sort(
    (a, b) => Number(result.bank_eligibility[b]) - Number(result.bank_eligibility[a]),
  );

  return (
    <section aria-label="Evaluation audit" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <span className="text-xs uppercase tracking-wider text-brand-600 font-bold flex items-center gap-1">
            <ShieldAlert size={14} /> Full Audit Trail
          </span>
          <h2 className="text-xl font-bold tracking-tight text-ink mt-0.5">
            Bank Policy Rule Execution Audit
          </h2>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => exportAs("pdf")}
            disabled={!result.application_id || busy !== null}
            className="flex min-h-[44px] items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-xs font-bold text-ink transition-all hover:border-brand-500 hover:bg-brand-500/10 hover:text-brand-600 disabled:opacity-40"
          >
            <Download size={15} />
            {busy === "pdf" ? "Preparing PDF..." : "Export PDF Audit"}
          </button>
          <button
            type="button"
            onClick={() => exportAs("excel")}
            disabled={!result.application_id || busy !== null}
            className="flex min-h-[44px] items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-xs font-bold text-ink transition-all hover:border-brand-indigo hover:bg-brand-indigo/10 hover:text-brand-indigo disabled:opacity-40"
          >
            <FileSpreadsheet size={15} />
            {busy === "excel" ? "Preparing Excel..." : "Export Excel Audit"}
          </button>
        </div>
      </div>

      {!result.application_id && (
        <p className="text-xs text-ink-subtle">
          Audit exports require a persisted reference ID.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger-bg p-3.5 text-xs font-bold text-danger">
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-2.5">
        {banks.map((bank) => (
          <BankCard key={bank} bank={bank} result={result} />
        ))}
      </ul>
    </section>
  );
}
