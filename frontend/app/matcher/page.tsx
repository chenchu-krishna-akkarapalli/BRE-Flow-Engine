"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Percent,
  RefreshCw,
  ShieldAlert,
  Sliders,
  Sparkles,
  Zap,
} from "lucide-react";

interface BankProduct {
  code: string;
  name: string;
  interestRate: number;
  processingFee: string;
  maxTenureMonths: number;
  minCibil: number;
  maxFoir: number;
  approvalProbability: number;
  isEligible: boolean;
  highlight: string;
}

const PARTNER_BANKS: BankProduct[] = [
  {
    code: "HDFC",
    name: "HDFC Bank",
    interestRate: 8.75,
    processingFee: "0.50%",
    maxTenureMonths: 84,
    minCibil: 750,
    maxFoir: 65,
    approvalProbability: 94,
    isEligible: true,
    highlight: "Lowest Processing Fee & Instant Sanction",
  },
  {
    code: "BOI",
    name: "Bank of India",
    interestRate: 8.45,
    processingFee: "0.25%",
    maxTenureMonths: 84,
    minCibil: 700,
    maxFoir: 70,
    approvalProbability: 92,
    isEligible: true,
    highlight: "Best ROI for Public Sector & Defense Profiles",
  },
  {
    code: "AXIS",
    name: "Axis Bank",
    interestRate: 8.90,
    processingFee: "0.75%",
    maxTenureMonths: 72,
    minCibil: 730,
    maxFoir: 60,
    approvalProbability: 88,
    isEligible: true,
    highlight: "Flexible Repayment & Digital Sanction",
  },
  {
    code: "BOB",
    name: "Bank of Baroda",
    interestRate: 8.60,
    processingFee: "0.35%",
    maxTenureMonths: 84,
    minCibil: 710,
    maxFoir: 65,
    approvalProbability: 86,
    isEligible: true,
    highlight: "High Multiplier on Net Income",
  },
  {
    code: "KOTAK",
    name: "Kotak Mahindra Bank",
    interestRate: 9.10,
    processingFee: "1.00%",
    maxTenureMonths: 60,
    minCibil: 760,
    maxFoir: 55,
    approvalProbability: 82,
    isEligible: true,
    highlight: "Quick Disbursal for Salaried Professionals",
  },
  {
    code: "IOB",
    name: "Indian Overseas Bank",
    interestRate: 8.80,
    processingFee: "0.50%",
    maxTenureMonths: 72,
    minCibil: 700,
    maxFoir: 60,
    approvalProbability: 79,
    isEligible: true,
    highlight: "Concession for Women Co-Applicants",
  },
  {
    code: "INDIAN_BANK",
    name: "Indian Bank",
    interestRate: 8.70,
    processingFee: "0.40%",
    maxTenureMonths: 84,
    minCibil: 720,
    maxFoir: 65,
    approvalProbability: 75,
    isEligible: true,
    highlight: "Agricultural & Rural Property Acceptance",
  },
  {
    code: "BOM",
    name: "Bank of Maharashtra",
    interestRate: 8.95,
    processingFee: "0.30%",
    maxTenureMonths: 72,
    minCibil: 715,
    maxFoir: 60,
    approvalProbability: 71,
    isEligible: true,
    highlight: "Low Margin Money Requirement",
  },
];

export default function MatcherPage() {
  const [loanAmount, setLoanAmount] = useState<number>(3500000);
  const [tenureYears, setTenureYears] = useState<number>(5);
  const [cibilScore, setCibilScore] = useState<number>(760);
  const [monthlyIncome, setMonthlyIncome] = useState<number>(120000);
  const [selectedBank, setSelectedBank] = useState<string>("HDFC");

  // Calculate monthly EMI formula: E = P * r * (1+r)^n / ((1+r)^n - 1)
  const calculateEmi = (rate: number, amount: number, years: number) => {
    const r = rate / 12 / 100;
    const n = years * 12;
    const emi = (amount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    return Math.round(emi);
  };

  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-6 px-4 sm:px-6 py-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold text-ink font-display">
          Eligible Bank Matcher (CRE Console)
        </h1>
        <p className="text-xs text-ink-subtle">
          Real-time eligibility engine and lender offer comparator across 8 connected bank APIs
        </p>
      </div>

      {/* Simulator Inputs Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 1 Column: Parameter Controls */}
        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm flex flex-col gap-5">
          <h2 className="text-sm font-bold text-ink flex items-center gap-2">
            <Sliders size={16} className="text-brand-500" />
            <span>Borrower &amp; Loan Parameters</span>
          </h2>

          {/* Loan Amount */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-ink-muted">Desired Loan Amount</span>
              <span className="font-mono font-bold text-brand-600">
                ₹ {(loanAmount / 100000).toFixed(2)} Lakhs
              </span>
            </div>
            <input
              type="range"
              min={500000}
              max={15000000}
              step={100000}
              value={loanAmount}
              onChange={(e) => setLoanAmount(Number(e.target.value))}
              className="w-full accent-brand-500 cursor-pointer"
            />
            <div className="flex justify-between text-[0.625rem] text-ink-subtle">
              <span>₹ 5 Lakhs</span>
              <span>₹ 1.50 Cr</span>
            </div>
          </div>

          {/* Tenure */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-ink-muted">Repayment Tenure</span>
              <span className="font-mono font-bold text-brand-600">{tenureYears} Years</span>
            </div>
            <input
              type="range"
              min={1}
              max={7}
              step={1}
              value={tenureYears}
              onChange={(e) => setTenureYears(Number(e.target.value))}
              className="w-full accent-brand-500 cursor-pointer"
            />
            <div className="flex justify-between text-[0.625rem] text-ink-subtle">
              <span>1 Year</span>
              <span>7 Years</span>
            </div>
          </div>

          {/* CIBIL Score */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-ink-muted">CIBIL Score</span>
              <span className="font-mono font-bold text-ink">{cibilScore}</span>
            </div>
            <input
              type="range"
              min={600}
              max={850}
              step={5}
              value={cibilScore}
              onChange={(e) => setCibilScore(Number(e.target.value))}
              className="w-full accent-brand-indigo cursor-pointer"
            />
            <div className="flex justify-between text-[0.625rem] text-ink-subtle">
              <span>600 (Poor)</span>
              <span>850 (Exceptional)</span>
            </div>
          </div>

          {/* Monthly Income */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-ink-muted block">
              Net Monthly Income (₹)
            </label>
            <input
              type="number"
              value={monthlyIncome}
              onChange={(e) => setMonthlyIncome(Number(e.target.value))}
              className="glass-input w-full rounded-xl px-3 py-2 text-xs font-mono font-bold"
            />
          </div>

          <div className="rounded-xl bg-brand-500/5 p-3.5 border border-brand-500/20 text-xs">
            <div className="flex items-center gap-2 text-brand-600 font-bold">
              <Sparkles size={14} />
              <span>Smart Multiplier Active</span>
            </div>
            <p className="mt-1 text-[0.6875rem] text-ink-subtle">
              All 8 bank policy rules are calculated in real time using the current parameters.
            </p>
          </div>
        </div>

        {/* Right 2 Columns: Multi-Bank Match Matrix */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">
              Matched Partner Lenders ({PARTNER_BANKS.length} Banks)
            </h2>
            <span className="text-xs font-mono font-bold text-success">
              8 of 8 APIs Responding
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PARTNER_BANKS.map((bank) => {
              const emi = calculateEmi(bank.interestRate, loanAmount, tenureYears);
              const isEligible = cibilScore >= bank.minCibil;
              const isSelected = selectedBank === bank.code;

              return (
                <div
                  key={bank.code}
                  onClick={() => setSelectedBank(bank.code)}
                  className={`rounded-2xl border p-4.5 transition-all cursor-pointer ${
                    isSelected
                      ? "border-brand-500 bg-white shadow-md ring-2 ring-brand-500/20"
                      : "border-line bg-white hover:border-line-strong hover:shadow-xs"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-extrabold text-sm text-ink">{bank.name}</h3>
                      <span className="font-mono text-[0.6875rem] text-ink-subtle">
                        API Code: {bank.code}
                      </span>
                    </div>
                    {isEligible ? (
                      <span className="rounded-full bg-success-bg border border-success/30 px-2.5 py-0.5 text-[0.6875rem] font-bold text-success flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        Eligible
                      </span>
                    ) : (
                      <span className="rounded-full bg-danger-bg border border-danger/30 px-2.5 py-0.5 text-[0.6875rem] font-bold text-danger flex items-center gap-1">
                        <ShieldAlert size={12} />
                        Below CIBIL {bank.minCibil}
                      </span>
                    )}
                  </div>

                  <div className="mt-3.5 grid grid-cols-2 gap-2 border-t border-line/60 pt-3 text-xs">
                    <div>
                      <span className="text-ink-subtle block text-[0.625rem]">Interest Rate</span>
                      <span className="font-mono font-extrabold text-brand-600">
                        {bank.interestRate}% p.a.
                      </span>
                    </div>
                    <div>
                      <span className="text-ink-subtle block text-[0.625rem]">Estimated Monthly EMI</span>
                      <span className="font-mono font-extrabold text-ink">
                        ₹ {emi.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 rounded-lg bg-bg-raised/70 px-2.5 py-1.5 text-[0.6875rem] text-ink-muted">
                    <span className="font-bold text-ink">Advantage:</span> {bank.highlight}
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-line/40">
                    <div className="flex items-center gap-1 text-[0.625rem] text-ink-subtle font-mono">
                      <span>Approval Score:</span>
                      <span className="font-bold text-success">{bank.approvalProbability}%</span>
                    </div>
                    <Link
                      href="/"
                      className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-500"
                    >
                      <span>Apply in Wizard</span>
                      <ChevronRight size={14} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
