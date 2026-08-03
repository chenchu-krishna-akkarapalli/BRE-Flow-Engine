"use client";

import { AlertOctagon, CheckCircle2, CircleSlash, ShieldCheck, Zap, XCircle } from "lucide-react";
import { BANK_LABELS, stepForRule } from "@/lib/form-schema";
import { BANK_CODES } from "@/lib/types";
import type { BankCode, EvaluationResponse, RejectionReason } from "@/lib/types";

function alternatives(result: EvaluationResponse) {
  return BANK_CODES.filter(
    (code) => code !== result.selected_bank && result.bank_eligibility[code],
  );
}

function listBanks(codes: readonly BankCode[]) {
  const names = codes.map((code) => BANK_LABELS[code]);
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * 8-Card Bank Eligibility Grid Telemetry Component - Day Mode
 * Displays real-time eligibility evaluation results across all 8 partner banks.
 */
export function BankMatrix({ result }: { result: EvaluationResponse | null }) {
  return (
    <section
      aria-label="Bank eligibility telemetry"
      className="glass-panel overflow-hidden rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col gap-3.5 border border-line"
    >
      {/* Header section with telemetry badge */}
      <div className="flex flex-col gap-1.5 border-b border-line pb-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-brand-600 font-bold text-[0.6875rem] uppercase tracking-wider">
            <Zap size={12} className="animate-pulse" />
            <span>BRE Telemetry Matrix</span>
          </div>
          <span className="numeric text-[0.6875rem] text-ink-subtle bg-bg-raised px-2 py-0.5 rounded-full border border-line">
            8 Partner Banks
          </span>
        </div>

        <h2 className="text-base sm:text-lg font-bold tracking-tight text-ink">
          {result
            ? `Eligibility with ${BANK_LABELS[result.selected_bank]} as primary`
            : "Bank Eligibility Telemetry"}
        </h2>

        {!result && (
          <p className="text-[0.75rem] text-ink-muted leading-relaxed">
            Evaluated instantly across all 8 lender rule-sets upon form submission.
          </p>
        )}

        {result && !result.overall_eligible && (
          <div className="rounded-xl border border-warning/30 bg-warning-bg p-2.5 backdrop-blur-md">
            <p className="text-[0.75rem] font-semibold text-warning leading-snug">
              {alternatives(result).length > 0
                ? `${BANK_LABELS[result.selected_bank]} declined, but ${listBanks(alternatives(result))} approve based on these parameters.`
                : `${BANK_LABELS[result.selected_bank]} declined, and no other partner bank currently matches these parameters.`}
            </p>
          </div>
        )}
      </div>

      {/* 8-Card Grid Layout - 2 columns on tablet and desktop */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-2">
        {BANK_CODES.map((code, index) => {
          const evaluated = result !== null;
          const eligible = result?.bank_eligibility[code] ?? false;
          const isPrimary = result?.selected_bank === code;

          return (
            <div
              key={code}
              style={{ animationDelay: `${index * 40}ms` }}
              className={`telemetry-card-enter group relative flex min-h-[48px] sm:min-h-[50px] flex-col justify-between rounded-xl border p-2.5 transition-all duration-300 ${
                !evaluated
                  ? "border-line bg-white hover:border-line-strong hover:bg-bg-raised"
                  : eligible
                  ? isPrimary
                    ? "border-success/60 bg-gradient-to-br from-success-bg to-emerald-50 ring-1 ring-success/40 shadow-sm"
                    : "border-success/30 bg-success-bg/40 hover:border-success/50"
                  : "border-danger/25 bg-danger-bg/40 hover:border-danger/40"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[0.75rem] sm:text-xs font-semibold text-ink truncate">
                  {BANK_LABELS[code]}
                </span>
                {isPrimary && (
                  <span className="rounded bg-brand-500/10 border border-brand-500/30 px-1 py-0.5 text-[0.625rem] font-bold text-brand-600">
                    Primary
                  </span>
                )}
              </div>

              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="numeric text-[0.6875rem] font-bold text-ink-subtle uppercase tracking-wider">
                  {code}
                </span>

                {!evaluated ? (
                  <span className="flex items-center gap-1 text-[0.6875rem] text-ink-subtle font-mono">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                    <span>PENDING</span>
                  </span>
                ) : eligible ? (
                  <span className="flex items-center gap-1 text-success font-bold text-[0.6875rem] tracking-wide">
                    <CheckCircle2 size={13} className="shrink-0 text-success" />
                    <span>ELIGIBLE</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-danger font-bold text-[0.6875rem] tracking-wide">
                    <XCircle size={13} className="shrink-0 text-danger" />
                    <span>DECLINED</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* BRE Engine Performance SLA Telemetry */}
      {result && (
        <div className="mt-1 flex items-center justify-between rounded-xl border border-line bg-bg-raised p-2.5 backdrop-blur-md">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-brand-600" />
            <span className="numeric text-[0.6875rem] font-bold text-ink">
              {result.executed_rules_count} Rules Evaluated
            </span>
          </div>
          <div className="flex items-center gap-1 text-brand-600">
            <Zap size={12} />
            <span className="numeric text-[0.6875rem] font-extrabold">
              {result.execution_time_ms.toFixed(1)} ms SLA
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

export function ValidationBanner({
  reasons,
  onJump,
}: {
  reasons: RejectionReason[];
  onJump: (stepId: number) => void;
}) {
  if (reasons.length === 0) return null;

  const byCategory = reasons.reduce<Record<string, RejectionReason[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="validation-slot flex flex-col gap-3" aria-live="assertive">
      {Object.entries(byCategory).map(([category, items]) => (
        <div
          key={category}
          className="rounded-2xl border border-danger/30 bg-danger-bg p-5 shadow-sm"
        >
          <div className="flex items-center gap-2 text-danger">
            <AlertOctagon size={18} aria-hidden />
            <h3 className="text-base font-bold tracking-tight">{category}</h3>
          </div>
          <ul className="mt-3 flex flex-col gap-2.5 border-t border-danger/20 pt-3">
            {items.map((r) => (
              <li key={r.rule_id} className="flex flex-col gap-1 rounded-xl bg-white p-3 border border-danger/20">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-sm font-medium text-ink">{r.message}</span>
                  <span className="numeric shrink-0 rounded bg-danger/10 px-2 py-0.5 text-[0.75rem] font-bold text-danger">
                    {r.rule_id}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onJump(stepForRule(r.rule_id))}
                  className="mt-1 self-start text-xs font-bold text-brand-600 underline hover:text-brand-700 transition-colors"
                >
                  Review Step {stepForRule(r.rule_id)} &rarr;
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function DecisionPanel({ result }: { result: EvaluationResponse }) {
  const approved = result.status === "APPROVED";
  return (
    <section
      role="status"
      aria-live="polite"
      className={`rounded-2xl border p-6 shadow-sm transition-all duration-300 ${
        approved
          ? "border-success/40 bg-gradient-to-r from-success-bg via-emerald-50 to-white"
          : "border-danger/40 bg-gradient-to-r from-danger-bg via-rose-50 to-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
            approved ? "border-success/40 bg-success-bg text-success" : "border-danger/40 bg-danger-bg text-danger"
          }`}>
            {approved ? (
              <CheckCircle2 size={28} aria-hidden />
            ) : (
              <CircleSlash size={28} aria-hidden />
            )}
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-ink-subtle">
              Engine Decision
            </span>
            <h2 className={`text-2xl font-bold tracking-tight ${approved ? "text-success" : "text-danger"}`}>
              {result.status}
            </h2>
          </div>
        </div>

        {result.application_id && (
          <div className="text-right">
            <span className="text-xs text-ink-subtle font-medium">Ref ID</span>
            <p className="numeric text-xs font-bold text-ink bg-bg-raised px-3 py-1.5 rounded-lg border border-line">
              {result.application_id}
            </p>
          </div>
        )}
      </div>

      <p className="mt-4 text-sm font-semibold text-ink leading-relaxed border-t border-line pt-3">
        {approved
          ? `Application approved with ${BANK_LABELS[result.selected_bank]}. Parameters meet all risk threshold limits.`
          : `Application does not meet the eligibility limits for ${BANK_LABELS[result.selected_bank]}.`}
      </p>

      {!result.persisted && (
        <div className="mt-3 rounded-xl border border-warning/30 bg-warning-bg p-3 text-xs font-semibold text-warning">
          Verdict is valid, but the audit log write was bypassed in temporary execution mode.
        </div>
      )}
    </section>
  );
}
