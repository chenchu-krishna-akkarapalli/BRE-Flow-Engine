"use client";

import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  FileSpreadsheet,
  Filter,
  TrendingUp,
} from "lucide-react";

interface DisbursalRecord {
  id: string;
  applicant: string;
  bank: string;
  disbursedAmount: string;
  commissionRate: string;
  commissionEarned: string;
  disbursalDate: string;
  payoutStatus: "Settled" | "Accrued" | "Processing";
}

const DISBURSAL_RECORDS: DisbursalRecord[] = [
  {
    id: "DISB-9012",
    applicant: "Vikram Malhotra",
    bank: "BOI",
    disbursedAmount: "₹ 50,00,000",
    commissionRate: "1.25%",
    commissionEarned: "₹ 62,500",
    disbursalDate: "12 Aug 2026",
    payoutStatus: "Settled",
  },
  {
    id: "DISB-9008",
    applicant: "Apex Logistics Ltd",
    bank: "BOB",
    disbursedAmount: "₹ 1,20,00,000",
    commissionRate: "1.10%",
    commissionEarned: "₹ 1,32,000",
    disbursalDate: "10 Aug 2026",
    payoutStatus: "Accrued",
  },
  {
    id: "DISB-8994",
    applicant: "Ananya Deshmukh",
    bank: "KOTAK",
    disbursedAmount: "₹ 42,00,000",
    commissionRate: "1.50%",
    commissionEarned: "₹ 63,000",
    disbursalDate: "08 Aug 2026",
    payoutStatus: "Processing",
  },
  {
    id: "DISB-8982",
    applicant: "Meera Krishnan",
    bank: "AXIS",
    disbursedAmount: "₹ 18,50,000",
    commissionRate: "1.35%",
    commissionEarned: "₹ 24,975",
    disbursalDate: "05 Aug 2026",
    payoutStatus: "Settled",
  },
  {
    id: "DISB-8975",
    applicant: "Zenith Agro Exports",
    bank: "INDIAN_BANK",
    disbursedAmount: "₹ 80,00,000",
    commissionRate: "1.15%",
    commissionEarned: "₹ 92,000",
    disbursalDate: "02 Aug 2026",
    payoutStatus: "Settled",
  },
];

export default function CommissionsPage() {
  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-6 px-4 sm:px-6 py-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink font-display">
            Commission &amp; Disbursal Ledgers
          </h1>
          <p className="text-xs text-ink-subtle">
            Audit ledger of bank payouts, channel commissions &amp; net accrued disbursal margins
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-xs font-bold text-ink shadow-xs transition-all hover:bg-bg-raised"
          >
            <Download size={14} />
            <span>Export CSV Ledger</span>
          </button>
        </div>
      </div>

      {/* Financial Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs">
          <span className="text-xs font-bold text-ink-subtle">Total Gross Disbursals (MTD)</span>
          <p className="mt-1 font-mono text-2xl font-extrabold text-ink">₹ 4,82,50,000</p>
          <span className="text-[0.6875rem] text-success font-bold">+22.4% vs last month</span>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs">
          <span className="text-xs font-bold text-ink-subtle">Total Partner Bank Commission</span>
          <p className="mt-1 font-mono text-2xl font-extrabold text-brand-600">₹ 6,18,450</p>
          <span className="text-[0.6875rem] text-ink-subtle font-medium">Weighted avg slab: 1.28%</span>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs">
          <span className="text-xs font-bold text-ink-subtle">Settled Channel Payouts</span>
          <p className="mt-1 font-mono text-2xl font-extrabold text-success">₹ 4,23,475</p>
          <span className="text-[0.6875rem] text-warning font-bold">₹ 1,94,975 in processing</span>
        </div>
      </div>

      {/* Disbursal Ledger Table */}
      <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <h2 className="text-sm font-bold text-ink">Active Multi-Bank Disbursal Log</h2>
          <span className="text-xs font-mono text-ink-subtle">5 Records MTD</span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line/80 text-[0.6875rem] font-extrabold uppercase tracking-wider text-ink-subtle">
                <th className="pb-3">Disbursal Ref</th>
                <th className="pb-3">Applicant / Entity</th>
                <th className="pb-3">Partner Bank</th>
                <th className="pb-3">Disbursed Amount</th>
                <th className="pb-3">Payout Slab</th>
                <th className="pb-3">Commission Earned</th>
                <th className="pb-3">Date</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {DISBURSAL_RECORDS.map((rec) => (
                <tr key={rec.id} className="hover:bg-bg-raised/40 transition-colors">
                  <td className="py-3 font-mono font-bold text-brand-600">{rec.id}</td>
                  <td className="py-3 font-semibold text-ink">{rec.applicant}</td>
                  <td className="py-3 font-mono text-ink">{rec.bank}</td>
                  <td className="py-3 font-mono font-bold text-ink">{rec.disbursedAmount}</td>
                  <td className="py-3 font-mono text-ink-subtle">{rec.commissionRate}</td>
                  <td className="py-3 font-mono font-extrabold text-success">{rec.commissionEarned}</td>
                  <td className="py-3 text-ink-subtle">{rec.disbursalDate}</td>
                  <td className="py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[0.625rem] font-bold border ${
                        rec.payoutStatus === "Settled"
                          ? "bg-success-bg text-success border-success/20"
                          : rec.payoutStatus === "Accrued"
                          ? "bg-brand-500/10 text-brand-600 border-brand-500/20"
                          : "bg-warning-bg text-warning border-warning/20"
                      }`}
                    >
                      {rec.payoutStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
