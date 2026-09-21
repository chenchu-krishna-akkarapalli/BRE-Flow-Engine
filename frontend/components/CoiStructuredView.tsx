"use client";

import { useState } from "react";
import {
  Calculator,
  Coins,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

interface CoiStructuredViewProps {
  data: Record<string, any>;
  filename: string;
  onClear?: () => void;
}

function formatCurrency(val: any): string {
  if (val === null || val === undefined || val === "") return "—";
  const num = Number(val);
  if (isNaN(num)) return String(val);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
}

function renderValue(val: any): string {
  if (val === null || val === undefined || val === "") return "—";
  return String(val);
}

// single concise context line
export function CoiStructuredView({ data, filename, onClear }: CoiStructuredViewProps) {
  // Only two modules: Computation of Income (Other Sources) and Capital Gains & VDA
  const [activeTab, setActiveTab] = useState<"income" | "capital_gains">("income");

  const summary = data.summary ?? {};
  const assessee = data.assessee_info ?? {};
  const computation = data.computation_of_total_income ?? {};
  const taxComp = computation.computation_of_tax_on_total_income ?? data.tax_computation ?? {};

  // Income from Other Sources extraction
  const otherSourcesSection = computation.income_from_other_sources ?? data.income_from_other_sources ?? {};
  const otherSources = otherSourcesSection.details ?? data.other_sources_breakdown ?? {};
  const otherSourcesTotal =
    otherSourcesSection.total ??
    summary.total_other_sources ??
    otherSources.total_other_sources ??
    otherSources.total;

  // Capital Gains & VDA extraction
  const capitalGains = computation.income_from_capital_gain ?? data.income_from_capital_gain ?? {};
  const stcg = capitalGains.short_term_capital_gain ?? {};
  const ltcg = capitalGains.long_term_capital_gain ?? {};
  const vda = capitalGains.virtual_digital_assets_115bbh ?? data.virtual_digital_assets_115bbh ?? null;
  const capitalGainsTotal = capitalGains.total ?? ((Number(stcg.total) || 0) + (Number(ltcg.total) || 0));

  const name = summary.assessee_name ?? assessee.name ?? "Assessee";
  const pan = summary.pan ?? assessee.pan ?? "—";
  const ay = summary.assessment_year ?? assessee.assessment_year ?? "—";
  const regime = summary.tax_regime ?? computation.tax_regime ?? "—";

  const grossTotalIncome = summary.gross_total_income ?? computation.gross_total_income;
  const totalIncome = summary.total_income ?? computation.total_income?.amount ?? grossTotalIncome;
  const refundAmount = summary.refundable_amount ?? computation.refund?.amount ?? taxComp.refundable;

  return (
    <div className="flex flex-col gap-5 text-ink">
      {/* Assessee & Financial Overview Card */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 rounded-xl border border-line bg-slate-50/50 p-4 sm:p-5 shadow-xs">
        <div className="lg:col-span-5 flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 border border-brand-500/20">
            <ShieldCheck size={22} aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-ink text-base truncate">{name}</h3>
              <span className="rounded-md bg-brand-50 border border-brand-200/80 px-2 py-0.5 text-xs font-mono font-bold text-brand-700">
                {pan}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-ink-subtle flex-wrap">
              <span>AY: <strong className="text-ink font-semibold">{ay}</strong></span>
              <span>•</span>
              <span>Regime: <strong className="text-ink font-semibold">{regime}</strong></span>
            </div>
          </div>
        </div>

        {/* Financial KPI Cards */}
        <div className="lg:col-span-7 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl border border-line bg-white p-3 shadow-2xs">
            <span className="text-[0.6875rem] font-semibold text-ink-subtle uppercase tracking-wider block">
              Gross Total
            </span>
            <span className="font-mono text-xs sm:text-sm font-bold text-ink mt-0.5 block truncate">
              {formatCurrency(grossTotalIncome)}
            </span>
          </div>

          <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-3 shadow-2xs">
            <span className="text-[0.6875rem] font-semibold text-brand-700 uppercase tracking-wider block">
              Total Taxable
            </span>
            <span className="font-mono text-xs sm:text-sm font-bold text-brand-600 mt-0.5 block truncate">
              {formatCurrency(totalIncome)}
            </span>
          </div>

          <div className={`rounded-xl border p-3 shadow-2xs ${
            Number(refundAmount) < 0
              ? "border-danger/20 bg-danger-bg/40 text-danger"
              : "border-success/20 bg-success-bg/40 text-success"
          }`}>
            <span className="text-[0.6875rem] font-semibold uppercase tracking-wider block">
              {Number(refundAmount) < 0 ? "Tax Due" : "Refund Amount"}
            </span>
            <span className="font-mono text-xs sm:text-sm font-bold mt-0.5 block truncate">
              {formatCurrency(Math.abs(Number(refundAmount) || 0))}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-line pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("income")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === "income"
              ? "bg-brand-500 text-white shadow-xs"
              : "bg-slate-100 text-ink-subtle hover:bg-slate-200 hover:text-ink"
          }`}
        >
          <Calculator size={15} />
          <span>Computation of Income</span>
          {otherSourcesTotal !== null && otherSourcesTotal !== undefined && Number(otherSourcesTotal) > 0 && (
            <span className={`rounded-full px-2 py-0.5 font-mono text-[0.6875rem] font-bold ${
              activeTab === "income" ? "bg-white/20 text-white" : "bg-white text-ink border border-slate-200"
            }`}>
              {formatCurrency(otherSourcesTotal)}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("capital_gains")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === "capital_gains"
              ? "bg-brand-500 text-white shadow-xs"
              : "bg-slate-100 text-ink-subtle hover:bg-slate-200 hover:text-ink"
          }`}
        >
          <TrendingUp size={15} />
          <span>Capital Gains & VDA</span>
          {(capitalGainsTotal > 0 || (vda !== null && vda !== undefined && Number(vda) > 0)) && (
            <span className={`rounded-full px-2 py-0.5 font-mono text-[0.6875rem] font-bold ${
              activeTab === "capital_gains" ? "bg-white/20 text-white" : "bg-white text-ink border border-slate-200"
            }`}>
              {formatCurrency(capitalGainsTotal || vda)}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="rounded-xl border border-line bg-white p-4 sm:p-5 shadow-xs">
        {/* MODULE 1: Computation of Income (Income from Other Sources) */}
        {activeTab === "income" && (
          <div className="flex flex-col gap-4 text-xs">
            {/* Income from Other Sources Card */}
            <div className="rounded-xl border border-line overflow-hidden shadow-2xs">
              <div className="bg-slate-50/80 px-4 py-3.5 border-b border-line flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-ink text-sm">Income from Other Sources (Chapter IV F)</h4>
                  <p className="text-[0.6875rem] text-ink-subtle">Bank interest, fixed deposits, dividends, and miscellaneous receipts</p>
                </div>
                <div className="text-right">
                  <span className="text-[0.6875rem] text-ink-subtle block">Total Other Sources</span>
                  <span className="font-mono text-sm font-bold text-brand-600">
                    {formatCurrency(otherSourcesTotal)}
                  </span>
                </div>
              </div>

              <div className="divide-y divide-line/60 bg-white">
                <div className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/50 transition-colors">
                  <span className="text-ink-muted">Saving Bank Interest:</span>
                  <span className="font-mono font-medium text-ink">
                    {formatCurrency(otherSources.interest_from_saving_bank_accounts)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/50 transition-colors">
                  <span className="text-ink-muted">FD / Time Deposit Interest:</span>
                  <span className="font-mono font-medium text-ink">
                    {formatCurrency(otherSources.interest_from_time_deposit ?? otherSources.interest_on_fdr)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/50 transition-colors">
                  <span className="text-ink-muted">Tax Refund Interest:</span>
                  <span className="font-mono font-medium text-ink">
                    {formatCurrency(otherSources.interest_on_income_tax_refund)}
                  </span>
                </div>
                {(otherSources.dividend_from_shares || otherSources.dividend_from_companies) && (
                  <div className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/50 transition-colors">
                    <span className="text-ink-muted">Dividend Income:</span>
                    <span className="font-mono font-medium text-ink">
                      {formatCurrency(otherSources.dividend_from_shares ?? otherSources.dividend_from_companies)}
                    </span>
                  </div>
                )}
                {otherSources.rental_income && (
                  <div className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/50 transition-colors">
                    <span className="text-ink-muted">Rental Income:</span>
                    <span className="font-mono font-medium text-ink">
                      {formatCurrency(otherSources.rental_income)}
                    </span>
                  </div>
                )}
                {otherSources.commission_income && (
                  <div className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/50 transition-colors">
                    <span className="text-ink-muted">Commission Income:</span>
                    <span className="font-mono font-medium text-ink">
                      {formatCurrency(otherSources.commission_income)}
                    </span>
                  </div>
                )}
                {otherSources.income_from_job_work && (
                  <div className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/50 transition-colors">
                    <span className="text-ink-muted">Income from Job Work:</span>
                    <span className="font-mono font-medium text-ink">
                      {formatCurrency(otherSources.income_from_job_work)}
                    </span>
                  </div>
                )}
                {(otherSources.other_misc_income || otherSources.other_item) && (
                  <div className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/50 transition-colors">
                    <span className="text-ink-muted">Other Misc Income:</span>
                    <span className="font-mono font-medium text-ink">
                      {formatCurrency(otherSources.other_misc_income ?? otherSources.other_item)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between bg-slate-50/90 px-4 py-3 text-xs font-bold text-ink border-t border-line">
                  <span>Net Total Other Sources:</span>
                  <span className="font-mono text-sm font-extrabold text-brand-600">{formatCurrency(otherSourcesTotal)}</span>
                </div>
              </div>
            </div>

            {/* Quick Access to Capital Gains & VDA */}
            <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600">
                  <TrendingUp size={16} />
                </div>
                <div>
                  <span className="font-bold text-ink text-xs block">
                    Capital Gains & Virtual Digital Assets (VDA)
                  </span>
                  <p className="text-[0.6875rem] text-ink-subtle mt-0.5">
                    STCG, LTCG (112A/112), and Crypto / VDA (Section 115BBH)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("capital_gains")}
                className="rounded-xl bg-brand-500 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-brand-600 transition-colors cursor-pointer"
              >
                View Capital Gains & VDA Module →
              </button>
            </div>
          </div>
        )}

        {activeTab === "capital_gains" && (
          <div className="flex flex-col gap-4 text-xs">
            {/* Top Overview KPI Banner */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-line bg-gray-50/80 p-3">
                <span className="mb-1 block font-semibold text-ink-muted uppercase tracking-wider text-[0.6875rem]">
                  Total Capital Gains (IV E)
                </span>
                <span className="font-mono text-base font-bold text-ink">
                  {formatCurrency(capitalGainsTotal)}
                </span>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                <span className="mb-1 block font-semibold text-blue-900 uppercase tracking-wider text-[0.6875rem]">
                  Short Term (STCG)
                </span>
                <span className="font-mono text-base font-bold text-blue-900">
                  {formatCurrency(stcg.total ?? 0)}
                </span>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                <span className="mb-1 block font-semibold text-emerald-900 uppercase tracking-wider text-[0.6875rem]">
                  Long Term (LTCG)
                </span>
                <span className="font-mono text-base font-bold text-emerald-900">
                  {formatCurrency(ltcg.total ?? 0)}
                </span>
              </div>
              <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3">
                <span className="mb-1 block font-semibold text-purple-900 uppercase tracking-wider text-[0.6875rem]">
                  Virtual Digital Assets (115BBH)
                </span>
                <span className="font-mono text-base font-bold text-purple-900">
                  {formatCurrency(vda ?? 0)}
                </span>
              </div>
            </div>

            {/* STCG and LTCG Detailed Breakdown Panels */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Short Term Capital Gains Panel */}
              <div className="flex flex-col gap-3 rounded-lg border border-line p-4 bg-white shadow-2xs">
                <div className="flex items-center justify-between border-b border-line pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 text-blue-700 font-bold text-[0.6875rem]">
                      ST
                    </span>
                    <span className="text-sm font-bold text-ink">Short Term Capital Gains (STCG)</span>
                  </div>
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 font-mono text-xs font-bold text-blue-800">
                    {formatCurrency(stcg.total ?? 0)}
                  </span>
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex items-center justify-between py-1 border-b border-line/60">
                    <span className="text-ink-muted">Section 111A (@ 15% STT Paid):</span>
                    <span className="font-mono font-medium text-ink">{formatCurrency(stcg.stcg_111a_15pct)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-line/60">
                    <span className="text-ink-muted">Section 111A (@ 20%):</span>
                    <span className="font-mono font-medium text-ink">{formatCurrency(stcg.stcg_111a_20pct)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-line/60">
                    <span className="text-ink-muted">Listed Securities (STT Paid):</span>
                    <span className="font-mono font-medium text-ink">{formatCurrency(stcg.stcg_listed_securities_stt_paid)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-line/60">
                    <span className="text-ink-muted">STCG Other Than 111A (Normal Slabs):</span>
                    <span className="font-mono font-medium text-ink">{formatCurrency(stcg.stcg_other_than_111a)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-line/60">
                    <span className="text-ink-muted">As Per Details Attached:</span>
                    <span className="font-mono font-medium text-ink">{formatCurrency(stcg.capital_gain_as_per_details_attached)}</span>
                  </div>
                  {stcg.short_term_capital_loss_cf !== null && stcg.short_term_capital_loss_cf !== undefined && (
                    <div className="flex items-center justify-between py-1 text-danger font-medium">
                      <span>STCG Loss Carried Forward:</span>
                      <span className="font-mono">{formatCurrency(stcg.short_term_capital_loss_cf)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Long Term Capital Gains Panel */}
              <div className="flex flex-col gap-3 rounded-lg border border-line p-4 bg-white shadow-2xs">
                <div className="flex items-center justify-between border-b border-line pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 font-bold text-[0.6875rem]">
                      LT
                    </span>
                    <span className="text-sm font-bold text-ink">Long Term Capital Gains (LTCG)</span>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-800">
                    {formatCurrency(ltcg.total ?? 0)}
                  </span>
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex items-center justify-between py-1 border-b border-line/60">
                    <span className="text-ink-muted">Section 112A (@ 10% on Listed Equity):</span>
                    <span className="font-mono font-medium text-ink">{formatCurrency(ltcg.ltcg_112a_10pct)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-line/60">
                    <span className="text-ink-muted">Section 112A (@ 12.5% Post 23/07/2024):</span>
                    <span className="font-mono font-medium text-ink">{formatCurrency(ltcg.ltcg_112a_12_5pct)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-line/60">
                    <span className="text-ink-muted">Section 112 (@ 20% with/without Indexation):</span>
                    <span className="font-mono font-medium text-ink">{formatCurrency(ltcg.ltcg_20pct)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-line/60">
                    <span className="text-ink-muted">LTCG Other Than 112A:</span>
                    <span className="font-mono font-medium text-ink">{formatCurrency(ltcg.ltcg_other_than_112a)}</span>
                  </div>
                  {ltcg.threshold_limit !== null && ltcg.threshold_limit !== undefined && (
                    <div className="flex items-center justify-between py-1 border-b border-line/60">
                      <span className="text-ink-muted">Threshold Exemption Limit:</span>
                      <span className="font-mono font-medium text-ink">{formatCurrency(ltcg.threshold_limit)}</span>
                    </div>
                  )}
                  {ltcg.long_term_capital_gain_u_s_112A_before_23_07_2024 !== null &&
                    ltcg.long_term_capital_gain_u_s_112A_before_23_07_2024 !== undefined && (
                      <div className="flex items-center justify-between py-1 border-b border-line/60">
                        <span className="text-ink-muted">112A Gains (Before 23/07/2024):</span>
                        <span className="font-mono font-medium text-ink">
                          {formatCurrency(ltcg.long_term_capital_gain_u_s_112A_before_23_07_2024)}
                        </span>
                      </div>
                    )}
                  {ltcg.brought_forward_long_term_capital_loss !== null &&
                    ltcg.brought_forward_long_term_capital_loss !== undefined && (
                      <div className="flex items-center justify-between py-1 border-b border-line/60 text-danger">
                        <span>Brought Forward LTCG Loss:</span>
                        <span className="font-mono font-medium">
                          {formatCurrency(ltcg.brought_forward_long_term_capital_loss)}
                        </span>
                      </div>
                    )}
                  {ltcg.long_term_capital_loss_cf !== null && ltcg.long_term_capital_loss_cf !== undefined && (
                    <div className="flex items-center justify-between py-1 text-danger font-medium">
                      <span>LTCG Loss Carried Forward:</span>
                      <span className="font-mono">{formatCurrency(ltcg.long_term_capital_loss_cf)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Virtual Digital Assets (Section 115BBH) Module */}
            <div className="flex flex-col gap-3 rounded-lg border border-purple-200 bg-purple-50/25 p-4">
              <div className="flex flex-wrap items-center justify-between border-b border-purple-100 pb-2.5 gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-100 text-purple-700">
                    <Coins size={14} />
                  </span>
                  <div>
                    <span className="text-sm font-bold text-purple-950">
                      Virtual Digital Assets (VDA / Crypto) — Section 115BBH
                    </span>
                    <p className="text-[0.6875rem] text-purple-800/80">
                      Income from cryptocurrency, NFTs, tokens, and digital assets
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-purple-100 px-3 py-0.5 font-mono text-xs font-bold text-purple-900 border border-purple-200">
                  Taxable Amount: {formatCurrency(vda ?? 0)}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="flex flex-col justify-center">
                  <h5 className="font-semibold text-purple-950 mb-1">Statutory Tax Treatment</h5>
                  <p className="text-ink-muted leading-relaxed text-[0.75rem]">
                    Under the Income Tax Act, gains from transfer of virtual digital assets are separated from normal income slabs and subject to strict provisions:
                  </p>
                  <ul className="mt-2 list-disc pl-4 text-ink-subtle space-y-1 text-[0.6875rem]">
                    <li>Taxed at a flat statutory rate of <strong>30%</strong> (plus surcharge & cess).</li>
                    <li>No deductions or expenditure allowed (except the actual cost of acquisition).</li>
                    <li>Losses cannot be set off against any other head of income or carried forward.</li>
                  </ul>
                </div>

                <div className="flex flex-col justify-center rounded-lg border border-purple-200 bg-white p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-line">
                    <span className="text-ink-muted">Declared VDA Income:</span>
                    <span className="font-mono font-bold text-ink">{formatCurrency(vda ?? 0)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-line">
                    <span className="text-ink-muted">Statutory Tax Rate:</span>
                    <span className="font-semibold text-purple-700">30% Flat</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-line">
                    <span className="text-ink-muted">Estimated Tax Payable:</span>
                    <span className="font-mono font-bold text-purple-900">
                      {formatCurrency(vda && Number(vda) > 0 ? Math.round(Number(vda) * 0.3) : 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1.5 text-[0.6875rem] text-ink-subtle">
                    <span>Applicable Section:</span>
                    <span className="font-mono font-semibold text-ink">Sec 115BBH / 194S</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
