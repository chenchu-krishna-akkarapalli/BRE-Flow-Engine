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
 * Streamlined Single-Column Bank Eligibility Telemetry Panel
 * Ultra-compact header and vertical slim single-line rows to maximize horizontal space for the form.
 */
export function BankMatrix({ result }: { result: EvaluationResponse | null }) {
  const evaluated = result !== null;

  return (
    <section
      aria-label="Bank eligibility telemetry"
      className="glass-panel overflow-hidden rounded-2xl p-4 shadow-sm flex flex-col gap-3 border border-line bg-white/90 backdrop-blur-xl w-full"
    >
      {/* Ultra-Compact Header */}
      <div className="flex flex-col gap-1.5 border-b border-line pb-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-500/10 text-brand-600">
              <Zap size={12} fill="currentColor" />
            </div>
            <h2 className="text-sm font-extrabold tracking-tight text-ink font-display">
              Bank Eligibility
            </h2>
          </div>
          <span className="numeric text-[0.625rem] font-bold text-ink-subtle bg-bg-raised px-2 py-0.5 rounded-full border border-line">
            8 Partner Banks
          </span>
        </div>

        {/* Compact Metadata Row */}
        <div className="flex items-center justify-between text-[0.6875rem] font-mono text-ink-subtle">
          {evaluated ? (
            <>
              <span className="flex items-center gap-1 text-ink font-semibold">
                <ShieldCheck size={12} className="text-brand-600" />
                {result.executed_rules_count} Rules Evaluated
              </span>
              <span className="text-brand-600 font-bold">
                {result.execution_time_ms.toFixed(1)} ms SLA
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1 text-ink-muted font-sans font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                8 Bank APIs Online
              </span>
              <span className="text-brand-600 font-semibold">Instant Evaluation</span>
            </>
          )}
        </div>

        {/* Compact Alternative Recommendation Banner */}
        {evaluated && !result.overall_eligible && (
          <div className="mt-1 rounded-lg border border-warning/30 bg-warning-bg p-2 text-[0.6875rem] font-medium text-warning leading-tight">
            {alternatives(result).length > 0
              ? `${BANK_LABELS[result.selected_bank]} declined, but ${listBanks(alternatives(result))} approve.`
              : `${BANK_LABELS[result.selected_bank]} declined; no other partner matches.`}
          </div>
        )}
      </div>

      {/* Single-Column Vertical Stack of Slim Bank Rows */}
      <div className="flex flex-col gap-1.5">
        {BANK_CODES.map((code, index) => {
          const isEligible = result?.bank_eligibility[code] ?? false;
          const isPrimary = result?.selected_bank === code;

          return (
            <div
              key={code}
              style={{ animationDelay: `${index * 25}ms` }}
              className={`telemetry-card-enter group flex min-h-[38px] items-center justify-between rounded-xl px-3 py-2 text-xs border transition-all duration-200 ${
                !evaluated
                  ? "border-line bg-white hover:border-line-strong hover:bg-bg-raised/70"
                  : isEligible
                  ? isPrimary
                    ? "border-success/60 bg-gradient-to-r from-success-bg/80 to-emerald-50/50 shadow-xs ring-1 ring-success/30"
                    : "border-success/30 bg-success-bg/30 hover:border-success/50"
                  : "border-danger/25 bg-danger-bg/30 hover:border-danger/40"
              }`}
            >
              {/* Left: Bank full name and code inline + micro Primary badge */}
              <div className="flex items-center gap-1.5 min-w-0 pr-2">
                <span className="truncate text-xs font-bold text-ink" title={`${BANK_LABELS[code]} (${code})`}>
                  {BANK_LABELS[code]} <span className="font-mono text-[0.6875rem] font-medium text-ink-subtle">({code})</span>
                </span>
                {isPrimary && (
                  <span className="shrink-0 rounded bg-brand-500/10 border border-brand-500/30 px-1 py-0.2 text-[0.5625rem] font-bold text-brand-600 uppercase tracking-wider">
                    Primary
                  </span>
                )}
              </div>

              {/* Right: High-visibility state indicator */}
              <div className="shrink-0 flex items-center">
                {!evaluated ? (
                  <span className="flex items-center gap-1 font-mono text-[0.625rem] font-bold text-ink-subtle bg-bg-raised px-1.5 py-0.5 rounded border border-line/60">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                    <span>PENDING</span>
                  </span>
                ) : isEligible ? (
                  <span className="flex items-center gap-1 font-mono text-[0.6875rem] font-extrabold text-success bg-success/10 border border-success/20 px-1.5 py-0.5 rounded">
                    <CheckCircle2 size={13} className="shrink-0 text-success" />
                    <span>ELIGIBLE</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 font-mono text-[0.6875rem] font-extrabold text-danger bg-danger/10 border border-danger/20 px-1.5 py-0.5 rounded">
                    <XCircle size={13} className="shrink-0 text-danger" />
                    <span>DECLINED</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
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
