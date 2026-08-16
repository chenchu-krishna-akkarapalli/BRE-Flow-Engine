"use client";

import { useState } from "react";
import {
  Building2,
  Calculator,
  ChevronDown,
  ChevronUp,
  CreditCard,
  FileCheck,
  Landmark,
  ShieldCheck,
  User,
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
  const [activeTab, setActiveTab] = useState<"assessee" | "income" | "tax" | "bs" | "annexures">("assessee");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    assessee: true,
    income: true,
    tax: true,
    bs: true,
    annexures: true,
  });

  const toggleSection = (sec: string) => {
    setExpandedSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  const summary = data.summary ?? {};
  const assessee = data.assessee_info ?? {};
  const bank = data.bank_details ?? {};
  const returns = data.return_details ?? {};
  const computation = data.computation_of_total_income ?? {};
  const taxComp = computation.computation_of_tax_on_total_income ?? data.tax_computation ?? {};
  const taxCalc = computation.tax_calculation ?? {};
  const financial = data.financial_particulars ?? {};
  const otherSources = data.other_sources_breakdown ?? {};
  const turnoverBlock = data.income_declared_business_turnover ?? computation.income_declared_business_turnover ?? {};
  const pgbp = computation.profits_and_gains_business_profession ?? {};
  const ca = data.ca_verification ?? {};

  const name = summary.assessee_name ?? assessee.name ?? "Assessee";
  const pan = summary.pan ?? assessee.pan ?? "—";
  const ay = summary.assessment_year ?? assessee.assessment_year ?? "—";
  const regime = summary.tax_regime ?? computation.tax_regime ?? "—";

  const grossTotalIncome = summary.gross_total_income ?? computation.gross_total_income;
  const totalIncome = summary.total_income ?? computation.total_income?.amount ?? grossTotalIncome;
  const refundAmount = summary.refundable_amount ?? computation.refund?.amount ?? taxComp.refundable;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-bg-raised p-4 sm:p-6 text-ink">
      {/* Header Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <ShieldCheck size={20} aria-hidden />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-ink text-base">{name}</h3>
              <span className="rounded bg-brand-100 px-2 py-0.5 text-xs font-mono font-semibold text-brand-700">
                {pan}
              </span>
            </div>
            <p className="text-xs text-ink-muted">
              AY: <span className="font-medium text-ink">{ay}</span> | Regime: <span className="font-medium text-ink">{regime}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-right">
          <div>
            <p className="text-xs text-ink-muted">Gross Total Income</p>
            <p className="font-semibold text-ink text-sm">{formatCurrency(grossTotalIncome)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">Total Taxable Income</p>
            <p className="font-semibold text-brand-700 text-sm">{formatCurrency(totalIncome)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">Refund / Tax Due</p>
            <p className={`font-semibold text-sm ${Number(refundAmount) < 0 ? "text-danger" : "text-success"}`}>
              {formatCurrency(refundAmount)}
            </p>
          </div>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="ml-2 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-gray-50"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-line gap-2 text-sm font-medium">
        <button
          type="button"
          onClick={() => setActiveTab("assessee")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 transition-colors whitespace-nowrap ${
            activeTab === "assessee" ? "border-brand-600 font-semibold text-brand-600" : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          <User size={15} />
          Assessee & Return Info
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("income")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 transition-colors whitespace-nowrap ${
            activeTab === "income" ? "border-brand-600 font-semibold text-brand-600" : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          <Calculator size={15} />
          Computation of Income
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("tax")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 transition-colors whitespace-nowrap ${
            activeTab === "tax" ? "border-brand-600 font-semibold text-brand-600" : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          <CreditCard size={15} />
          Tax Computation
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("bs")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 transition-colors whitespace-nowrap ${
            activeTab === "bs" ? "border-brand-600 font-semibold text-brand-600" : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          <Building2 size={15} />
          Balance Sheet
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("annexures")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 transition-colors whitespace-nowrap ${
            activeTab === "annexures" ? "border-brand-600 font-semibold text-brand-600" : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          <Landmark size={15} />
          Annexures & Summary
        </button>
      </div>

      {/* Tab Content */}
      <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
        {activeTab === "assessee" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded border border-line bg-gray-50/50">
                <span className="font-semibold text-ink-muted block mb-1">Assessee Name</span>
                <span className="font-medium text-ink text-sm">{renderValue(name)}</span>
              </div>
              <div className="p-3 rounded border border-line bg-gray-50/50">
                <span className="font-semibold text-ink-muted block mb-1">PAN Number</span>
                <span className="font-mono font-medium text-ink text-sm">{renderValue(pan)}</span>
              </div>
              <div className="p-3 rounded border border-line bg-gray-50/50">
                <span className="font-semibold text-ink-muted block mb-1">Father's Name</span>
                <span className="font-medium text-ink">{renderValue(assessee.father_name)}</span>
              </div>
              <div className="p-3 rounded border border-line bg-gray-50/50">
                <span className="font-semibold text-ink-muted block mb-1">Assessment Year</span>
                <span className="font-medium text-ink">{renderValue(ay)}</span>
              </div>
              <div className="p-3 rounded border border-line bg-gray-50/50">
                <span className="font-semibold text-ink-muted block mb-1">Financial Year</span>
                <span className="font-medium text-ink">{renderValue(assessee.financial_year)}</span>
              </div>
              <div className="p-3 rounded border border-line bg-gray-50/50">
                <span className="font-semibold text-ink-muted block mb-1">Status & Gender</span>
                <span className="font-medium text-ink">{renderValue(assessee.status)} ({renderValue(assessee.gender)})</span>
              </div>
              <div className="p-3 rounded border border-line bg-gray-50/50">
                <span className="font-semibold text-ink-muted block mb-1">Bank Name</span>
                <span className="font-medium text-ink">{renderValue(bank.bank_name ?? summary.bank_name)}</span>
              </div>
              <div className="p-3 rounded border border-line bg-gray-50/50">
                <span className="font-semibold text-ink-muted block mb-1">Account Number</span>
                <span className="font-mono font-medium text-ink">{renderValue(bank.account_no ?? summary.bank_account_no)}</span>
              </div>
              <div className="p-3 rounded border border-line bg-gray-50/50">
                <span className="font-semibold text-ink-muted block mb-1">IFSC Code</span>
                <span className="font-mono font-medium text-ink">{renderValue(bank.ifsc_code ?? summary.ifsc_code)}</span>
              </div>
            </div>

            {returns.acknowledgement_no && (
              <div className="rounded border border-line bg-blue-50/40 p-3 text-xs">
                <span className="font-semibold text-blue-900 block mb-1">Return Filing Details</span>
                <p className="text-blue-800">
                  Ack No: <span className="font-mono font-semibold">{returns.acknowledgement_no}</span> | Form: <span className="font-semibold">{returns.form_type ?? "ITR"}</span> | Filing Date: <span className="font-semibold">{returns.filing_date}</span>
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "income" && (
          <div className="flex flex-col gap-4 text-xs">
            {/* Business / 44AD Income */}
            <div className="rounded border border-line overflow-hidden">
              <div className="bg-gray-50 px-3 py-2 font-semibold text-ink flex items-center justify-between">
                <span>Income Declared u/s 44AD / Business Income</span>
                <span className="font-mono text-brand-700">{formatCurrency(summary.business_turnover ?? turnoverBlock.gross_receipts_turnover)}</span>
              </div>
              <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <span className="text-ink-muted block">Gross Receipts / Turnover</span>
                  <span className="font-medium">{formatCurrency(summary.business_turnover ?? turnoverBlock.gross_receipts_turnover ?? pgbp.turnover_base_44ad)}</span>
                </div>
                <div>
                  <span className="text-ink-muted block">Deemed Profit (44AD)</span>
                  <span className="font-medium">{formatCurrency(summary.deemed_profit_44ad ?? turnoverBlock.deemed_profit?.amount ?? pgbp.deemed_profit_44ad)}</span>
                </div>
                <div>
                  <span className="text-ink-muted block">Declared / Taxable Profit</span>
                  <span className="font-semibold text-ink">{formatCurrency(summary.taxable_business_profit ?? pgbp.taxable_business_profit ?? pgbp.section_total)}</span>
                </div>
              </div>
            </div>

            {/* Other Sources & Deductions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded border border-line p-3">
                <span className="font-semibold text-ink block mb-2">Income from Other Sources</span>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Saving Bank Interest:</span>
                    <span>{formatCurrency(otherSources.interest_from_saving_bank_accounts)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">FD / Time Deposit Interest:</span>
                    <span>{formatCurrency(otherSources.interest_from_time_deposit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Tax Refund Interest:</span>
                    <span>{formatCurrency(otherSources.interest_on_income_tax_refund)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t border-line pt-1">
                    <span>Total Other Sources:</span>
                    <span>{formatCurrency(summary.total_other_sources ?? otherSources.total_other_sources)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded border border-line p-3">
                <span className="font-semibold text-ink block mb-2">Chapter VI-A Deductions</span>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Total Deductions:</span>
                    <span className="font-semibold">{formatCurrency(summary.total_deductions_chapter_6a ?? computation.deductions?.total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Taxable Income (Rounded 288A):</span>
                    <span className="font-semibold text-brand-700">{formatCurrency(summary.total_income_rounded ?? computation.total_income_rounded_288a)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "tax" && (
          <div className="flex flex-col gap-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="p-3 rounded border border-line bg-gray-50/50">
                <span className="font-semibold text-ink-muted block mb-1">Gross Tax on Total Income</span>
                <span className="font-medium text-ink">{formatCurrency(taxComp.tax_on_total_income ?? taxComp.total_tax)}</span>
              </div>
              <div className="p-3 rounded border border-line bg-gray-50/50">
                <span className="font-semibold text-ink-muted block mb-1">Section 87A Rebate</span>
                <span className="font-medium text-ink">{formatCurrency(summary.rebate_87a ?? taxComp.rebate_u_s_87a)}</span>
              </div>
              <div className="p-3 rounded border border-line bg-gray-50/50">
                <span className="font-semibold text-ink-muted block mb-1">Agricultural Tax Rebate</span>
                <span className="font-medium text-ink">{formatCurrency(taxComp.agriculture_tax_rebate)}</span>
              </div>
            </div>

            {/* 140A Challan */}
            {taxComp.self_assessment_tax_details && (
              <div className="rounded border border-line p-3 bg-amber-50/40">
                <span className="font-semibold text-amber-900 block mb-2">Self Assessment Tax (140A) Challan Details</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-amber-900">
                  <div><span className="text-ink-muted">BSR Code:</span> <span className="font-mono font-semibold">{taxComp.self_assessment_tax_details.bsr_code}</span></div>
                  <div><span className="text-ink-muted">Challan No:</span> <span className="font-mono font-semibold">{taxComp.self_assessment_tax_details.challan_no}</span></div>
                  <div><span className="text-ink-muted">Date:</span> <span className="font-semibold">{taxComp.self_assessment_tax_details.date}</span></div>
                  <div><span className="text-ink-muted">Amount:</span> <span className="font-semibold">{formatCurrency(taxComp.self_assessment_tax_details.amount)}</span></div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "bs" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="rounded border border-line p-3">
              <span className="font-semibold text-ink block mb-2">Capital & Liabilities</span>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <span className="text-ink-muted">Sundry Creditors:</span>
                  <span>{formatCurrency(financial.sundry_creditors)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t border-line pt-1">
                  <span>Total Capital & Liabilities:</span>
                  <span>{formatCurrency(financial.total_capital_and_liabilities)}</span>
                </div>
              </div>
            </div>

            <div className="rounded border border-line p-3">
              <span className="font-semibold text-ink block mb-2">Assets</span>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <span className="text-ink-muted">Inventories / Stock:</span>
                  <span>{formatCurrency(financial.inventories)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Sundry Debtors:</span>
                  <span>{formatCurrency(financial.sundry_debtors)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Cash & Bank Balance:</span>
                  <span>{formatCurrency(financial.balance_with_banks ?? financial.cash_in_hand)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t border-line pt-1">
                  <span>Total Assets:</span>
                  <span>{formatCurrency(financial.total_assets)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "annexures" && (
          <div className="flex flex-col gap-4 text-xs">
            {ca.ca_name && (
              <div className="rounded border border-line bg-gray-50 p-3">
                <span className="font-semibold text-ink block mb-1">CA Verification Details</span>
                <p>
                  Verified by <span className="font-semibold">{ca.ca_name}</span> (Mem No: <span className="font-mono">{ca.membership_no}</span>) | Firm: <span className="font-semibold">{ca.firm_name}</span>
                </p>
              </div>
            )}

            {summary && Object.keys(summary).length > 0 && (
              <div className="rounded border border-line p-3">
                <span className="font-semibold text-ink block mb-2">BRE Credit Summary Payload (Zero-Null Addon)</span>
                <pre className="max-h-48 overflow-y-auto rounded bg-gray-900 p-3 font-mono text-[0.75rem] text-green-400">
                  {JSON.stringify(summary, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
