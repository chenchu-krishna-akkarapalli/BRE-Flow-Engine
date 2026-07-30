"use client";

import { AlertOctagon, CheckCircle2, CircleSlash, Minus, XCircle } from "lucide-react";
import { BANK_LABELS, stepForRule } from "@/lib/form-schema";
import { BANK_CODES } from "@/lib/types";
import type { BankCode, EvaluationResponse, RejectionReason } from "@/lib/types";

/** Live 8-bank eligibility panel.
 *
 * bank_eligibility[X] is bank X's own verdict, independent of the primary
 * bank's, so a decline at the primary bank does not blank out the rest — the
 * panel's whole value is showing where else the applicant qualifies. */
/** Partner banks that accept, excluding the one already named as primary. */
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

export function BankMatrix({ result }: { result: EvaluationResponse | null }) {
  return (
    <section
      aria-label="Bank eligibility"
      className="matrix-slot glass rounded-lg overflow-hidden flex flex-col p-0"
    >
      {/* Header section with distinct background color */}
      <div className="bg-gradient-to-br from-brand-50/50 to-brand-100/20 px-6 py-5 border-b border-line">
        <h2 className="text-[1.25rem] font-semibold text-ink-muted">
          {result
            ? `Eligibility with ${BANK_LABELS[result.selected_bank]} as primary`
            : "Bank eligibility"}
        </h2>

        {!result && (
          <p className="mt-1.5 text-[0.8125rem] text-ink font-medium">
            Evaluated across all 8 partner banks when you submit.
          </p>
        )}

        {result && !result.overall_eligible && (
          <p className="mt-2.5 rounded-md bg-warning-bg p-3 text-[0.8125rem] text-warning">
            {alternatives(result).length > 0
              ? `${BANK_LABELS[result.selected_bank]} declined, but ${listBanks(alternatives(result))} would lend on the same details.`
              : `${BANK_LABELS[result.selected_bank]} declined, and no other partner bank accepts these details.`}
          </p>
        )}
      </div>

      {/* Body section with standard list layout and tighter spacing */}
      <div className="p-6 pt-4 bg-bg-surface flex-1">
        <ul className="flex flex-col gap-0.5">
          {BANK_CODES.map((code) => {
            const evaluated = result !== null;
            const eligible = result?.bank_eligibility[code] ?? false;
            return (
              <li
                key={code}
                className="flex min-h-[36px] items-center justify-between rounded-md px-3 transition-colors hover:bg-brand-50/30"
              >
                <span className="text-[0.875rem] text-ink-muted font-medium">{BANK_LABELS[code]}</span>
                {!evaluated ? (
                  <span className="flex items-center gap-2 text-ink-subtle">
                    <Minus size={14} aria-hidden />
                    <span className="numeric text-[0.8125rem]">—</span>
                  </span>
                ) : eligible ? (
                  <span className="flex items-center gap-2 text-success">
                    <CheckCircle2 size={14} aria-hidden />
                    <span className="text-[0.75rem] font-bold tracking-wider">ELIGIBLE</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-danger">
                    <XCircle size={14} aria-hidden />
                    <span className="text-[0.75rem] font-bold tracking-wider">NOT ELIGIBLE</span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        {result && (
          <p className="numeric mt-4 border-t border-line pt-3 text-[0.8125rem] text-info font-medium">
            {result.executed_rules_count} rules · {result.execution_time_ms.toFixed(1)} ms
          </p>
        )}
      </div>
    </section>
  );
}

/** Grouped rule failures. Shows the rule ID and a deep link back to the step
 *  that owns the field, rather than collapsing everything to "ineligible". */
export function ValidationBanner({
  reasons, onJump,
}: {
  reasons: RejectionReason[]; onJump: (stepId: number) => void;
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
          className="rounded-md border border-danger/40 bg-danger-bg p-4"
        >
          <div className="flex items-center gap-2 text-danger">
            <AlertOctagon size={16} aria-hidden />
            <h3 className="text-[0.9375rem] font-semibold">{category}</h3>
          </div>
          <ul className="mt-2 flex flex-col gap-2">
            {items.map((r) => (
              <li key={r.rule_id} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[0.9375rem] text-ink">{r.message}</span>
                  <span className="numeric shrink-0 text-[0.8125rem] text-ink-muted">
                    {r.rule_id}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onJump(stepForRule(r.rule_id))}
                  className="self-start text-[0.8125rem] text-brand-400 underline underline-offset-2"
                >
                  Review step {stepForRule(r.rule_id)} →
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
      className={`rounded-lg border p-6 ${
        approved
          ? "border-success/40 bg-success-bg"
          : "border-danger/40 bg-danger-bg"
      }`}
    >
      <div className="flex items-center gap-3">
        {approved ? (
          <CheckCircle2 className="text-success" aria-hidden />
        ) : (
          <CircleSlash className="text-danger" aria-hidden />
        )}
        <h2
          className={`text-[1.75rem] font-bold ${approved ? "text-success" : "text-danger"}`}
        >
          {result.status}
        </h2>
      </div>
      <p className="mt-2 text-[0.9375rem] text-ink-muted">
        {approved
          ? `Approved with ${BANK_LABELS[result.selected_bank]}.`
          : `Not approved with ${BANK_LABELS[result.selected_bank]}.`}
      </p>
      {result.application_id && (
        <p className="numeric mt-3 text-[0.8125rem] text-ink-subtle">
          Reference {result.application_id}
        </p>
      )}
      {!result.persisted && (
        <p className="mt-3 rounded-md bg-warning-bg p-3 text-[0.8125rem] text-warning">
          Verdict is valid, but the audit trail did not write — quote this to support
          before relying on the reference.
        </p>
      )}
    </section>
  );
}
