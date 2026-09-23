"use client";

import { useState } from "react";
import {
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileCheck,
  FileText,
  HelpCircle,
  Info,
  Layers,
  Loader2,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import { calculatePhase1Income } from "@/lib/api";
import type { YearlyIncomeInput } from "@/lib/types";

function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
}

export function Phase1IncomeCard() {
  const currentYearDocData = useOnboardingStore((s) => s.currentYearDocData);
  const prevYearDocData = useOnboardingStore((s) => s.prevYearDocData);
  const phase1Result = useOnboardingStore((s) => s.phase1IncomeResult);
  const updatePhase1DocData = useOnboardingStore((s) => s.updatePhase1DocData);
  const setField = useOnboardingStore((s) => s.setField);
  const draft = useOnboardingStore((s) => s.draft);
  const phase2FoirResult = useOnboardingStore((s) => s.phase2FoirResult);
  const setExistingEmi = useOnboardingStore((s) => s.setExistingEmi);


  const [showAdjustments, setShowAdjustments] = useState(false);
  const [serverVerifying, setServerVerifying] = useState(false);
  const [serverVerifiedMatch, setServerVerifiedMatch] = useState<boolean | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [appliedNotification, setAppliedNotification] = useState(false);

  const cyBreakdown = phase1Result.current_year_breakdown;
  const pyBreakdown = phase1Result.previous_year_breakdown;
  const avgIncome = phase1Result.average_income;

  async function handleVerifyWithServer() {
    setServerVerifying(true);
    setServerError(null);
    setServerVerifiedMatch(null);

    try {
      const response = await calculatePhase1Income({
        current_year: currentYearDocData,
        previous_year: prevYearDocData,
      });

      const matches =
        Math.abs(response.average_income - avgIncome) < 0.01 &&
        Math.abs(response.income_current_year - phase1Result.income_current_year) < 0.01 &&
        Math.abs(response.income_previous_year - phase1Result.income_previous_year) < 0.01;

      setServerVerifiedMatch(matches);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to verify with calculation server.");
    } finally {
      setServerVerifying(false);
    }
  }

  function handleApplyToApplication() {
    // Sync the computed net operational income to current and previous ITR draft fields
    if (phase1Result.income_current_year > 0) {
      setField("currentITRAmount", Math.round(phase1Result.income_current_year));
    }
    if (phase1Result.income_previous_year > 0) {
      setField("prevITRAmount", Math.round(phase1Result.income_previous_year));
    }
    if (phase1Result.average_income > 0) {
      const avgMonthly = Math.round((phase1Result.average_income / 12) * 100) / 100;
      setField("grossSalary", avgMonthly);
    }
    setAppliedNotification(true);
    setTimeout(() => setAppliedNotification(false), 3500);
  }

  const handleInputChange = (
    year: "current" | "previous",
    field: keyof YearlyIncomeInput,
    rawVal: string
  ) => {
    const parsed = parseFloat(rawVal.replace(/[^0-9.-]/g, ""));
    const val = isNaN(parsed) ? 0 : parsed;
    updatePhase1DocData(year, { [field]: val });
    setServerVerifiedMatch(null);
  };

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-brand-200 bg-gradient-to-b from-brand-50/50 via-white to-white p-5 shadow-sm transition-all sm:p-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-brand-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
            <Calculator size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-ink">
                Phase 1: 2-Year Document-Based Income Assessment
              </h3>
              <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-[0.6875rem] font-semibold text-brand-700">
                ITR + COI
              </span>
            </div>
            <p className="text-xs text-ink-subtle">
              Automated operational income calculation derived from Current & Previous Year ITR and COI documents.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleVerifyWithServer}
            disabled={serverVerifying}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-2xs transition-colors hover:bg-slate-50 disabled:opacity-50"
            title="Verify live formula result with backend engine"
          >
            {serverVerifying ? (
              <Loader2 size={13} className="animate-spin text-brand-600" />
            ) : (
              <RefreshCw size={13} className="text-ink-subtle" />
            )}
            <span>Verify with Server</span>
          </button>
        </div>
      </div>

      {serverVerifiedMatch === true && (
        <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success-bg px-3.5 py-2 text-xs font-medium text-success">
          <CheckCircle2 size={15} />
          <span>Server calculation verified: Client and Engine formulas match 100%.</span>
        </div>
      )}

      {serverError && (
        <div className="rounded-xl border border-danger/30 bg-danger-bg px-3.5 py-2 text-xs font-medium text-danger">
          Server Verification Error: {serverError}
        </div>
      )}

      {/* 2-Year Average Income Hero Highlight */}
      <div className="grid gap-4 rounded-xl border border-brand-200 bg-brand-50/70 p-4 sm:grid-cols-3 sm:items-center">
        <div className="sm:col-span-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-700">
            <TrendingUp size={14} />
            <span>Assessed 2-Year Average Income</span>
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <span className="font-mono text-2xl sm:text-3xl font-black text-brand-950">
              {formatCurrency(avgIncome)}
            </span>
            <span className="text-xs text-brand-800 font-medium">
              / year average
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100/90 px-2.5 py-1 text-xs font-mono font-bold text-emerald-950 border border-emerald-300/80">
              ₹{Math.round(avgIncome / 12).toLocaleString("en-IN")} / mo (Step 7 Salary)
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[0.75rem] text-brand-800">
            <span>Formula:</span>
            <code className="rounded bg-brand-100/80 px-1.5 py-0.5 font-mono text-[0.6875rem] font-semibold">
              ({formatCurrency(cyBreakdown.final_yearly_income)} + {formatCurrency(pyBreakdown.final_yearly_income)}) / 2
            </code>
            <span className="text-brand-600 font-medium">•</span>
            <span>Monthly:</span>
            <code className="rounded bg-brand-100/80 px-1.5 py-0.5 font-mono text-[0.6875rem] font-semibold">
              {formatCurrency(Math.round(avgIncome / 12))} / mo
            </code>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <button
            type="button"
            onClick={handleApplyToApplication}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-brand-700 active:scale-[0.98]"
          >
            <FileCheck size={15} />
            <span>Apply Net Income to Loan</span>
          </button>
          {appliedNotification && (
            <span className="text-[0.6875rem] font-medium text-success animate-in fade-in">
              ✓ Applied: ITR & Monthly Salary (₹{Math.round(phase1Result.average_income / 12).toLocaleString("en-IN")}) updated!
            </span>
          )}
        </div>
      </div>

      {/* Phase 2: Existing Obligations & FOIR Eligibility */}
      <div className="rounded-xl border border-brand-200 bg-white p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-line pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-600 text-white text-xs">
                <Calculator size={14} />
              </span>
              <h4 className="text-sm font-bold text-ink">
                Phase 2: Existing Obligations & Bank FOIR Assessment
              </h4>
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[0.625rem] font-bold text-brand-700">
                FOIR Policy
              </span>
            </div>
            <p className="text-xs text-ink-subtle mt-0.5">
              FOIR tiers are evaluated for each partner bank based on assessed income. Deducting existing EMI calculates your final processed repayment capacity.
            </p>
          </div>
        </div>

        {/* Existing EMI Input Box */}
        <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="max-w-md">
            <label htmlFor="step6ExistingEmi" className="text-xs font-bold text-ink block">
              Existing Monthly Loan EMI (₹)
            </label>
            <span className="text-[0.6875rem] text-ink-subtle block mt-0.5">
              Enter applicant's total ongoing monthly loan EMI obligations (personal, car, or home loans).
            </span>
          </div>
          <div className="relative min-w-[200px] sm:max-w-[240px] w-full">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-muted text-sm font-semibold">
              ₹
            </div>
            <input
              id="step6ExistingEmi"
              type="number"
              min="0"
              value={draft.existingEmi || ""}
              onChange={(e) =>
                setExistingEmi(e.target.value === "" ? "" : Math.max(0, parseFloat(e.target.value)))
              }
              placeholder="e.g. 15000"
              className="w-full rounded-xl border border-line bg-white pl-8 pr-3 py-2 text-sm font-mono font-bold text-ink shadow-2xs outline-none transition-all focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        </div>

        {/* Bank FOIR & Processed Income Live Preview Matrix */}
        {phase2FoirResult && phase2FoirResult.bank_foir_results && (
          <div className="overflow-hidden rounded-xl border border-line bg-slate-50/50">
            <div className="bg-slate-100/70 px-3.5 py-2.5 border-b border-line flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-ink">
                Bank-Wise Processed Income Preview
              </span>
              <span className="text-[0.6875rem] font-mono text-ink-subtle">
                Formula: FOIR-Based Capacity - Existing EMI
              </span>
            </div>

            <div className="divide-y divide-line text-xs bg-white">
              {/* Header */}
              <div className="grid grid-cols-12 bg-slate-50/70 p-3 font-semibold text-ink-subtle text-[0.6875rem] uppercase tracking-wider">
                <div className="col-span-4 sm:col-span-3">Partner Bank</div>
                <div className="col-span-3 sm:col-span-2 text-right">FOIR %</div>
                <div className="hidden sm:block sm:col-span-3 text-right">FOIR Capacity</div>
                <div className="col-span-5 sm:col-span-4 text-right">Final Processed Income</div>
              </div>

              {/* Rows */}
              {Object.values(phase2FoirResult.bank_foir_results).map((item) => (
                <div
                  key={item.bank_code}
                  className="grid grid-cols-12 items-center p-3 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="col-span-4 sm:col-span-3">
                    <div className="font-bold text-ink">{item.bank_name}</div>
                    <div className="text-[0.625rem] text-ink-subtle truncate" title={item.bracket_description}>
                      {item.bracket_description}
                    </div>
                  </div>
                  <div className="col-span-3 sm:col-span-2 text-right">
                    <span className="inline-block rounded-md bg-brand-100/80 px-2 py-0.5 font-mono text-xs font-bold text-brand-700">
                      {Math.round(item.foir_percentage * 100)}%
                    </span>
                  </div>
                  <div className="hidden sm:block sm:col-span-3 text-right font-mono text-ink-subtle">
                    {formatCurrency(item.foir_based_income)}
                    <span className="text-[0.625rem] text-ink-muted ml-0.5">
                      {item.work_type === "Salaried" ? "/mo" : "/yr"}
                    </span>
                  </div>
                  <div className="col-span-5 sm:col-span-4 text-right">
                    <div className="font-mono text-xs sm:text-sm font-black text-emerald-950">
                      {formatCurrency(item.final_processed_income)}
                    </div>
                    {Number(item.existing_emi) > 0 && (
                      <div className="text-[0.625rem] text-danger font-mono">
                        (-{formatCurrency(item.existing_emi)} EMI)
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Side-by-Side Step-by-Step Calculation Audit Table */}
      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-2xs">

        <div className="bg-slate-50/80 px-4 py-3 border-b border-line">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-ink">
              Formula Breakdown & Audit Trail
            </span>
            <span className="text-[0.6875rem] text-ink-subtle">
              Phase 1 Computation Rules
            </span>
          </div>
        </div>

        <div className="divide-y divide-line text-xs">
          {/* Header Row */}
          <div className="grid grid-cols-12 bg-slate-50/40 p-3 font-semibold text-ink-subtle">
            <div className="col-span-6 sm:col-span-6">Calculation Step</div>
            <div className="col-span-3 sm:col-span-3 text-right">Current Year (CY)</div>
            <div className="col-span-3 sm:col-span-3 text-right">Previous Year (PY)</div>
          </div>

          {/* Step 1: Base from ITR */}
          <div className="grid grid-cols-12 items-center p-3">
            <div className="col-span-6">
              <div className="font-medium text-ink">1. Total Income (ITR)</div>
              <div className="text-[0.6875rem] text-ink-subtle">Gross annual taxable income declared</div>
            </div>
            <div className="col-span-3 text-right font-mono font-medium text-ink">
              {formatCurrency(cyBreakdown.total_income)}
            </div>
            <div className="col-span-3 text-right font-mono font-medium text-ink">
              {formatCurrency(pyBreakdown.total_income)}
            </div>
          </div>

          <div className="grid grid-cols-12 items-center p-3 bg-slate-50/20">
            <div className="col-span-6">
              <div className="font-medium text-danger">Less: Tax, Interest & Fees (ITR)</div>
              <div className="text-[0.6875rem] text-ink-subtle">total_tax_interest_and_fee_payable</div>
            </div>
            <div className="col-span-3 text-right font-mono font-medium text-danger">
              - {formatCurrency(cyBreakdown.total_tax_interest_and_fee_payable)}
            </div>
            <div className="col-span-3 text-right font-mono font-medium text-danger">
              - {formatCurrency(pyBreakdown.total_tax_interest_and_fee_payable)}
            </div>
          </div>

          <div className="grid grid-cols-12 items-center p-3 bg-brand-50/30 font-semibold">
            <div className="col-span-6">
              <div className="text-brand-900">= Post-Tax Base (income_from_calc)</div>
              <div className="text-[0.6875rem] text-brand-700">Total Income − Tax & Fees</div>
            </div>
            <div className="col-span-3 text-right font-mono text-brand-900">
              {formatCurrency(cyBreakdown.income_from_calc)}
            </div>
            <div className="col-span-3 text-right font-mono text-brand-900">
              {formatCurrency(pyBreakdown.income_from_calc)}
            </div>
          </div>

          {/* Step 2: Other Sources net of partner interest & remun */}
          <div className="grid grid-cols-12 items-center p-3">
            <div className="col-span-6">
              <div className="font-medium text-ink">2. Other Sources (COI)</div>
              <div className="text-[0.6875rem] text-ink-subtle">
                Other Interest − (Partner Capital Interest + Partner Remun)
              </div>
            </div>
            <div className="col-span-3 text-right font-mono font-medium text-ink">
              {formatCurrency(cyBreakdown.income_from_other_sources)}
            </div>
            <div className="col-span-3 text-right font-mono font-medium text-ink">
              {formatCurrency(pyBreakdown.income_from_other_sources)}
            </div>
          </div>

          {/* Step 3: Capital Gains */}
          <div className="grid grid-cols-12 items-center p-3">
            <div className="col-span-6">
              <div className="font-medium text-ink">3. Capital Gains (COI)</div>
              <div className="text-[0.6875rem] text-ink-subtle">Passive income excluded from assessment</div>
            </div>
            <div className="col-span-3 text-right font-mono font-medium text-ink">
              {formatCurrency(cyBreakdown.income_from_capital_gain)}
            </div>
            <div className="col-span-3 text-right font-mono font-medium text-ink">
              {formatCurrency(pyBreakdown.income_from_capital_gain)}
            </div>
          </div>

          {/* Step 4: Total Passive Deductions */}
          <div className="grid grid-cols-12 items-center p-3 bg-slate-50/20">
            <div className="col-span-6">
              <div className="font-medium text-danger">Less: Total Passive Deductions</div>
              <div className="text-[0.6875rem] text-ink-subtle">Other Sources + Capital Gains</div>
            </div>
            <div className="col-span-3 text-right font-mono font-medium text-danger">
              - {formatCurrency(cyBreakdown.total_passive_deductions)}
            </div>
            <div className="col-span-3 text-right font-mono font-medium text-danger">
              - {formatCurrency(pyBreakdown.total_passive_deductions)}
            </div>
          </div>

          {/* Final Yearly Income */}
          <div className="grid grid-cols-12 items-center p-3 bg-brand-100/40 font-bold">
            <div className="col-span-6">
              <div className="text-ink">4. Net Operational Annual Income</div>
              <div className="text-[0.6875rem] text-ink-subtle">income_from_calc − Passive Deductions</div>
            </div>
            <div className="col-span-3 text-right font-mono text-sm text-brand-900">
              {formatCurrency(cyBreakdown.final_yearly_income)}
            </div>
            <div className="col-span-3 text-right font-mono text-sm text-brand-900">
              {formatCurrency(pyBreakdown.final_yearly_income)}
            </div>
          </div>
        </div>
      </div>

      {/* Accordion / Drawer to View & Adjust Detailed Input Figures */}
      <div className="rounded-xl border border-line bg-white shadow-2xs">
        <button
          type="button"
          onClick={() => setShowAdjustments(!showAdjustments)}
          className="flex w-full items-center justify-between p-3.5 text-left text-xs font-semibold text-ink transition-colors hover:bg-slate-50 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Layers size={15} className="text-brand-600" />
            <span>Document Input Values & Manual Overrides</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.6875rem] text-ink-subtle">
              Fine-Tune Figures
            </span>
          </div>
          {showAdjustments ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showAdjustments && (
          <div className="border-t border-line p-4 animate-in fade-in duration-150">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Current Year Fields */}
              <div className="flex flex-col gap-3 rounded-lg border border-line bg-slate-50/50 p-3.5">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <span className="text-xs font-bold text-ink">Current Year Document Figures</span>
                  <span className="text-[0.6875rem] font-mono text-brand-600">CY Inputs</span>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[0.6875rem] font-medium text-ink-subtle">
                    Total Income (ITR) (₹)
                  </label>
                  <input
                    type="number"
                    value={currentYearDocData.total_income || ""}
                    onChange={(e) => handleInputChange("current", "total_income", e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-line bg-white px-3 py-1.5 font-mono text-xs text-ink outline-none focus:border-brand-500"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[0.6875rem] font-medium text-ink-subtle">
                    Total Tax, Interest & Fee Payable (ITR) (₹)
                  </label>
                  <input
                    type="number"
                    value={currentYearDocData.total_tax_interest_and_fee_payable || ""}
                    onChange={(e) =>
                      handleInputChange("current", "total_tax_interest_and_fee_payable", e.target.value)
                    }
                    placeholder="0"
                    className="w-full rounded-lg border border-line bg-white px-3 py-1.5 font-mono text-xs text-ink outline-none focus:border-brand-500"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[0.6875rem] font-medium text-ink-subtle">
                    Total Other Sources Income (COI) (₹)
                  </label>
                  <input
                    type="number"
                    value={currentYearDocData.total_other_interest_income || ""}
                    onChange={(e) =>
                      handleInputChange("current", "total_other_interest_income", e.target.value)
                    }
                    placeholder="0"
                    className="w-full rounded-lg border border-line bg-white px-3 py-1.5 font-mono text-xs text-ink outline-none focus:border-brand-500"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[0.6875rem] font-medium text-ink-subtle">
                    Interest on Partner's Capital (Add-back) (₹)
                  </label>
                  <input
                    type="number"
                    value={currentYearDocData.interest_on_partners_capital || ""}
                    onChange={(e) =>
                      handleInputChange("current", "interest_on_partners_capital", e.target.value)
                    }
                    placeholder="0"
                    className="w-full rounded-lg border border-line bg-white px-3 py-1.5 font-mono text-xs text-ink outline-none focus:border-brand-500"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[0.6875rem] font-medium text-ink-subtle">
                    Partner Remuneration (Add-back) (₹)
                  </label>
                  <input
                    type="number"
                    value={currentYearDocData.partner_remuneration || ""}
                    onChange={(e) =>
                      handleInputChange("current", "partner_remuneration", e.target.value)
                    }
                    placeholder="0"
                    className="w-full rounded-lg border border-line bg-white px-3 py-1.5 font-mono text-xs text-ink outline-none focus:border-brand-500"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[0.6875rem] font-medium text-ink-subtle">
                    Capital Gains Income (COI) (₹)
                  </label>
                  <input
                    type="number"
                    value={currentYearDocData.income_from_capital_gain || ""}
                    onChange={(e) =>
                      handleInputChange("current", "income_from_capital_gain", e.target.value)
                    }
                    placeholder="0"
                    className="w-full rounded-lg border border-line bg-white px-3 py-1.5 font-mono text-xs text-ink outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Previous Year Fields */}
              <div className="flex flex-col gap-3 rounded-lg border border-line bg-slate-50/50 p-3.5">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <span className="text-xs font-bold text-ink">Previous Year Document Figures</span>
                  <span className="text-[0.6875rem] font-mono text-brand-600">PY Inputs</span>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[0.6875rem] font-medium text-ink-subtle">
                    Total Income (ITR) (₹)
                  </label>
                  <input
                    type="number"
                    value={prevYearDocData.total_income || ""}
                    onChange={(e) => handleInputChange("previous", "total_income", e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-line bg-white px-3 py-1.5 font-mono text-xs text-ink outline-none focus:border-brand-500"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[0.6875rem] font-medium text-ink-subtle">
                    Total Tax, Interest & Fee Payable (ITR) (₹)
                  </label>
                  <input
                    type="number"
                    value={prevYearDocData.total_tax_interest_and_fee_payable || ""}
                    onChange={(e) =>
                      handleInputChange("previous", "total_tax_interest_and_fee_payable", e.target.value)
                    }
                    placeholder="0"
                    className="w-full rounded-lg border border-line bg-white px-3 py-1.5 font-mono text-xs text-ink outline-none focus:border-brand-500"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[0.6875rem] font-medium text-ink-subtle">
                    Total Other Sources Income (COI) (₹)
                  </label>
                  <input
                    type="number"
                    value={prevYearDocData.total_other_interest_income || ""}
                    onChange={(e) =>
                      handleInputChange("previous", "total_other_interest_income", e.target.value)
                    }
                    placeholder="0"
                    className="w-full rounded-lg border border-line bg-white px-3 py-1.5 font-mono text-xs text-ink outline-none focus:border-brand-500"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[0.6875rem] font-medium text-ink-subtle">
                    Interest on Partner's Capital (Add-back) (₹)
                  </label>
                  <input
                    type="number"
                    value={prevYearDocData.interest_on_partners_capital || ""}
                    onChange={(e) =>
                      handleInputChange("previous", "interest_on_partners_capital", e.target.value)
                    }
                    placeholder="0"
                    className="w-full rounded-lg border border-line bg-white px-3 py-1.5 font-mono text-xs text-ink outline-none focus:border-brand-500"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[0.6875rem] font-medium text-ink-subtle">
                    Partner Remuneration (Add-back) (₹)
                  </label>
                  <input
                    type="number"
                    value={prevYearDocData.partner_remuneration || ""}
                    onChange={(e) =>
                      handleInputChange("previous", "partner_remuneration", e.target.value)
                    }
                    placeholder="0"
                    className="w-full rounded-lg border border-line bg-white px-3 py-1.5 font-mono text-xs text-ink outline-none focus:border-brand-500"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[0.6875rem] font-medium text-ink-subtle">
                    Capital Gains Income (COI) (₹)
                  </label>
                  <input
                    type="number"
                    value={prevYearDocData.income_from_capital_gain || ""}
                    onChange={(e) =>
                      handleInputChange("previous", "income_from_capital_gain", e.target.value)
                    }
                    placeholder="0"
                    className="w-full rounded-lg border border-line bg-white px-3 py-1.5 font-mono text-xs text-ink outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
