"use client";

import { use } from "react";
import { CreditCard, DollarSign, TrendingUp, Users } from "lucide-react";

interface CommissionItem {
  id: string;
  applicantName: string;
  disbursedAmount: number;
  ratePct: number;
  commissionAmount: number;
  payoutStatus: "CALCULATED" | "APPROVED" | "PAID";
  disbursedAt: string;
}

const COMMISSIONS: CommissionItem[] = [
  { id: "COMM-801", applicantName: "Ananya Deshmukh", disbursedAmount: 1250000, ratePct: 1.5, commissionAmount: 18750, payoutStatus: "PAID", disbursedAt: "2026-08-14" },
  { id: "COMM-802", applicantName: "Kavita Reddy", disbursedAmount: 850000, ratePct: 1.25, commissionAmount: 10625, payoutStatus: "APPROVED", disbursedAt: "2026-08-16" },
  { id: "COMM-803", applicantName: "Sunil Kumar", disbursedAmount: 6500000, ratePct: 0.75, commissionAmount: 48750, payoutStatus: "CALCULATED", disbursedAt: "2026-08-17" },
];

export default function TenantCommissionsPage({
  params,
}: {
  params: Promise<{ tenantUuid: string }>;
}) {
  const { tenantUuid } = use(params);

  const totalDisbursed = COMMISSIONS.reduce((acc, c) => acc + c.disbursedAmount, 0);
  const totalCommission = COMMISSIONS.reduce((acc, c) => acc + c.commissionAmount, 0);

  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-6 px-4 sm:px-6 py-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-ink font-display">
              Commission & Payout Ledgers
            </h1>
            <span className="rounded-md bg-brand-500/10 px-2 py-0.5 text-xs font-mono font-bold text-brand-600 border border-brand-500/20">
              {tenantUuid}
            </span>
          </div>
          <p className="text-xs text-ink-subtle mt-0.5">
            Track DSA partner payouts, disbursed loan volumes, and settlement audits.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs">
          <span className="text-xs font-bold text-ink-subtle">Total Disbursed Volume</span>
          <p className="mt-2 font-mono text-2xl font-extrabold text-ink">₹{totalDisbursed.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs">
          <span className="text-xs font-bold text-ink-subtle">Earned Commission</span>
          <p className="mt-2 font-mono text-2xl font-extrabold text-emerald-600">₹{totalCommission.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs">
          <span className="text-xs font-bold text-ink-subtle">Effective Yield</span>
          <p className="mt-2 font-mono text-2xl font-extrabold text-brand-600">0.91%</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-line bg-slate-50 text-[0.6875rem] font-extrabold uppercase tracking-wider text-ink-subtle">
            <tr>
              <th className="px-5 py-3">Ledger ID</th>
              <th className="px-5 py-3">Applicant</th>
              <th className="px-5 py-3">Disbursed Amount</th>
              <th className="px-5 py-3">Rate</th>
              <th className="px-5 py-3">Commission</th>
              <th className="px-5 py-3">Payout Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {COMMISSIONS.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-5 py-3.5 font-mono font-bold text-brand-600">{c.id}</td>
                <td className="px-5 py-3.5 font-bold text-ink">{c.applicantName}</td>
                <td className="px-5 py-3.5 font-mono text-ink">₹{c.disbursedAmount.toLocaleString("en-IN")}</td>
                <td className="px-5 py-3.5 font-mono text-ink-muted">{c.ratePct}%</td>
                <td className="px-5 py-3.5 font-mono font-bold text-emerald-600">₹{c.commissionAmount.toLocaleString("en-IN")}</td>
                <td className="px-5 py-3.5">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[0.625rem] font-bold uppercase ${
                      c.payoutStatus === "PAID"
                        ? "bg-success/10 text-success border border-success/20"
                        : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                    }`}
                  >
                    {c.payoutStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
