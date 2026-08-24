"use client";

import { CheckCircle, CreditCard, DollarSign, Download, Plus, TrendingUp, Users } from "lucide-react";

export default function PlatformBillingPage() {
  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-6 px-4 sm:px-6 py-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-ink font-display">
              Multi-Tenant Platform Billing & SaaS Tiers
            </h1>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.625rem] font-bold text-emerald-600 border border-emerald-500/20">
              ACCOUNTS_HEAD Scope
            </span>
          </div>
          <p className="text-xs text-ink-subtle mt-0.5">
            Global billing ledgers, SaaS tier subscription status, and tenant API evaluation usage billing
          </p>
        </div>

        <button
          type="button"
          className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-xs font-bold text-white shadow-glow hover:bg-brand-600 transition-all self-start sm:self-auto"
        >
          <Download size={14} />
          <span>Export Monthly Invoice</span>
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs">
          <span className="text-xs font-bold text-ink-subtle">Total Gross Sourced Volume (MTD)</span>
          <p className="mt-2 font-mono text-2xl font-extrabold text-ink">₹ 14.82 Cr</p>
          <span className="text-[0.6875rem] text-emerald-600 font-bold flex items-center gap-1 mt-1">
            <TrendingUp size={12} />
            <span>+18.4% vs last month</span>
          </span>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs">
          <span className="text-xs font-bold text-ink-subtle">Platform Evaluation Fees</span>
          <p className="mt-2 font-mono text-2xl font-extrabold text-brand-600">₹ 3.42 Lakhs</p>
          <span className="text-[0.6875rem] text-ink-subtle flex items-center gap-1 mt-1">
            <span>₹ 50 per BRE API Evaluation</span>
          </span>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs">
          <span className="text-xs font-bold text-ink-subtle">Paid SaaS Subscriptions</span>
          <p className="mt-2 font-mono text-2xl font-extrabold text-emerald-600">3 Enterprise</p>
          <span className="text-[0.6875rem] text-emerald-600 font-bold flex items-center gap-1 mt-1">
            <CheckCircle size={12} />
            <span>100% On-Time Settlement</span>
          </span>
        </div>
      </div>

      {/* Tenant Invoices Table */}
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-extrabold text-ink font-display">
            Tenant Usage Ledgers & Invoices
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-bg-deep/50 text-[0.625rem] font-extrabold uppercase tracking-wider text-ink-subtle">
              <tr>
                <th className="px-4 py-3">Tenant Organization</th>
                <th className="px-4 py-3">Subscription Tier</th>
                <th className="px-4 py-3">Monthly Evals</th>
                <th className="px-4 py-3">Current Amount</th>
                <th className="px-4 py-3">Payment Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[
                { name: "Bank of India North Channel", tier: "Enterprise DSA", evals: 42800, amount: "₹ 2,14,000", status: "Paid" },
                { name: "HDFC Apex Retail Channel", tier: "Fintech Growth", evals: 68100, amount: "₹ 3,40,500", status: "Paid" },
                { name: "SBI National Direct Sourcing", tier: "Enterprise Bank", evals: 51200, amount: "₹ 2,56,000", status: "Pending Settlement" },
              ].map((inv) => (
                <tr key={inv.name} className="transition-colors hover:bg-bg-raised/60">
                  <td className="px-4 py-3 font-bold text-ink">{inv.name}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-bg-raised px-2 py-0.5 text-[0.625rem] font-bold text-ink-muted border border-line">
                      {inv.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-ink">{inv.evals.toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono font-extrabold text-brand-600">{inv.amount}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 font-bold uppercase text-[0.625rem] border ${
                        inv.status === "Paid"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                      }`}
                    >
                      {inv.status}
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
