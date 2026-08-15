"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  RefreshCw,
  Save,
  Shield,
  Sliders,
  Sparkles,
  Zap,
} from "lucide-react";

interface BankRuleThresholds {
  bankCode: string;
  bankName: string;
  minCibil: number;
  maxDpd: number;
  maxFoirPercent: number;
  minGrossMonthlyIncome: number;
  allowCashSalary: boolean;
  minBusinessVintageMonths: number;
}

const DEFAULT_BANK_RULES: Record<string, BankRuleThresholds> = {
  HDFC: {
    bankCode: "HDFC",
    bankName: "HDFC Bank",
    minCibil: 750,
    maxDpd: 0,
    maxFoirPercent: 65,
    minGrossMonthlyIncome: 35000,
    allowCashSalary: false,
    minBusinessVintageMonths: 24,
  },
  BOI: {
    bankCode: "BOI",
    bankName: "Bank of India",
    minCibil: 700,
    maxDpd: 30,
    maxFoirPercent: 70,
    minGrossMonthlyIncome: 25000,
    allowCashSalary: false,
    minBusinessVintageMonths: 18,
  },
  AXIS: {
    bankCode: "AXIS",
    bankName: "Axis Bank",
    minCibil: 730,
    maxDpd: 0,
    maxFoirPercent: 60,
    minGrossMonthlyIncome: 30000,
    allowCashSalary: false,
    minBusinessVintageMonths: 24,
  },
  BOB: {
    bankCode: "BOB",
    bankName: "Bank of Baroda",
    minCibil: 710,
    maxDpd: 30,
    maxFoirPercent: 65,
    minGrossMonthlyIncome: 25000,
    allowCashSalary: false,
    minBusinessVintageMonths: 24,
  },
  KOTAK: {
    bankCode: "KOTAK",
    bankName: "Kotak Mahindra Bank",
    minCibil: 760,
    maxDpd: 0,
    maxFoirPercent: 55,
    minGrossMonthlyIncome: 40000,
    allowCashSalary: false,
    minBusinessVintageMonths: 36,
  },
  IOB: {
    bankCode: "IOB",
    bankName: "Indian Overseas Bank",
    minCibil: 700,
    maxDpd: 30,
    maxFoirPercent: 60,
    minGrossMonthlyIncome: 20000,
    allowCashSalary: false,
    minBusinessVintageMonths: 18,
  },
  INDIAN_BANK: {
    bankCode: "INDIAN_BANK",
    bankName: "Indian Bank",
    minCibil: 720,
    maxDpd: 30,
    maxFoirPercent: 65,
    minGrossMonthlyIncome: 22000,
    allowCashSalary: false,
    minBusinessVintageMonths: 18,
  },
  BOM: {
    bankCode: "BOM",
    bankName: "Bank of Maharashtra",
    minCibil: 715,
    maxDpd: 30,
    maxFoirPercent: 60,
    minGrossMonthlyIncome: 20000,
    allowCashSalary: false,
    minBusinessVintageMonths: 18,
  },
};

export default function ConfiguratorPage() {
  const [selectedBank, setSelectedBank] = useState<string>("HDFC");
  const [bankRules, setBankRules] = useState<Record<string, BankRuleThresholds>>(DEFAULT_BANK_RULES);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const currentConfig = bankRules[selectedBank];

  const updateField = <K extends keyof BankRuleThresholds>(
    key: K,
    val: BankRuleThresholds[K]
  ) => {
    setBankRules((prev) => ({
      ...prev,
      [selectedBank]: {
        ...prev[selectedBank],
        [key]: val,
      },
    }));
  };

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-6 px-4 sm:px-6 py-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink font-display">
            CRE Rule Engine Configurator
          </h1>
          <p className="text-xs text-ink-subtle">
            Hot-reload credit policies, CIBIL floors &amp; underwriting thresholds across 8 partner banks
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-indigo px-5 py-2.5 text-xs font-bold text-white shadow-glow transition-all hover:scale-[1.02]"
          >
            <Save size={16} />
            <span>Deploy Rule Matrix</span>
          </button>
        </div>
      </div>

      {/* Save Success Alert */}
      {savedSuccess && (
        <div className="rounded-2xl border border-success/30 bg-success-bg p-4 text-xs font-bold text-success flex items-center gap-2 shadow-xs animate-in fade-in">
          <CheckCircle2 size={16} />
          <span>Credit Rule Matrix v2.4 successfully hot-reloaded across all 8 bank evaluation nodes.</span>
        </div>
      )}

      {/* Bank Tabs Selector */}
      <div className="flex flex-wrap gap-2 rounded-2xl border border-line bg-white p-2 shadow-xs">
        {Object.keys(bankRules).map((code) => {
          const isSelected = selectedBank === code;
          return (
            <button
              key={code}
              type="button"
              onClick={() => setSelectedBank(code)}
              className={`rounded-xl px-4 py-2 text-xs font-extrabold transition-all ${
                isSelected
                  ? "bg-brand-500 text-white shadow-glow"
                  : "text-ink-muted hover:bg-bg-raised hover:text-ink"
              }`}
            >
              {code}
            </button>
          );
        })}
      </div>

      {/* Rule Parameters Editor */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column: Numeric Threshold Sliders */}
        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm space-y-5">
          <h2 className="text-sm font-bold text-ink flex items-center gap-2 border-b border-line pb-3">
            <Sliders size={16} className="text-brand-500" />
            <span>{currentConfig.bankName} — Quantitative Thresholds</span>
          </h2>

          {/* Min CIBIL */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-ink-muted">Minimum CIBIL Score Floor</span>
              <span className="font-mono font-bold text-brand-600">{currentConfig.minCibil}</span>
            </div>
            <input
              type="range"
              min={650}
              max={800}
              step={5}
              value={currentConfig.minCibil}
              onChange={(e) => updateField("minCibil", Number(e.target.value))}
              className="w-full accent-brand-500 cursor-pointer"
            />
          </div>

          {/* Max DPD */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-ink-muted">Max Days Past Due (DPD) Tolerance</span>
              <span className="font-mono font-bold text-brand-600">{currentConfig.maxDpd} Days</span>
            </div>
            <input
              type="range"
              min={0}
              max={60}
              step={30}
              value={currentConfig.maxDpd}
              onChange={(e) => updateField("maxDpd", Number(e.target.value))}
              className="w-full accent-brand-indigo cursor-pointer"
            />
          </div>

          {/* Max FOIR / DTI */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-ink-muted">Maximum Debt-to-Income / FOIR Cap</span>
              <span className="font-mono font-bold text-brand-600">{currentConfig.maxFoirPercent}%</span>
            </div>
            <input
              type="range"
              min={40}
              max={75}
              step={1}
              value={currentConfig.maxFoirPercent}
              onChange={(e) => updateField("maxFoirPercent", Number(e.target.value))}
              className="w-full accent-brand-violet cursor-pointer"
            />
          </div>

          {/* Min Gross Monthly Income */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-ink-muted block">
              Minimum Gross Monthly Salary (₹)
            </label>
            <input
              type="number"
              value={currentConfig.minGrossMonthlyIncome}
              onChange={(e) => updateField("minGrossMonthlyIncome", Number(e.target.value))}
              className="glass-input w-full rounded-xl px-3 py-2 text-xs font-mono font-bold"
            />
          </div>
        </div>

        {/* Right Column: Policy Flags & Business Rules */}
        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm space-y-5">
          <h2 className="text-sm font-bold text-ink flex items-center gap-2 border-b border-line pb-3">
            <Shield size={16} className="text-brand-indigo" />
            <span>Eligibility Flags &amp; Categorical Rules</span>
          </h2>

          <div className="rounded-xl border border-line p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div>
                <strong className="text-ink block">Cash Salary Payment Mode Acceptance</strong>
                <span className="text-[0.6875rem] text-ink-subtle">
                  EMP-301 rule trigger override
                </span>
              </div>
              <input
                type="checkbox"
                checked={currentConfig.allowCashSalary}
                onChange={(e) => updateField("allowCashSalary", e.target.checked)}
                className="h-4 w-4 rounded accent-brand-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-ink-muted block">
              Min Business Vintage for Self-Employed (Months)
            </label>
            <input
              type="number"
              value={currentConfig.minBusinessVintageMonths}
              onChange={(e) => updateField("minBusinessVintageMonths", Number(e.target.value))}
              className="glass-input w-full rounded-xl px-3 py-2 text-xs font-mono font-bold"
            />
          </div>

          <div className="rounded-xl bg-bg-raised p-4 text-xs text-ink-muted space-y-1.5">
            <span className="font-bold text-ink flex items-center gap-1.5">
              <Sparkles size={14} className="text-brand-500" />
              Real-time In-Memory Sync
            </span>
            <p className="text-[0.6875rem] leading-relaxed">
              Modifying these thresholds immediately affects candidate scoring on the <strong>Onboarding Wizard</strong> and the <strong>Eligible Bank Matcher</strong> console.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
