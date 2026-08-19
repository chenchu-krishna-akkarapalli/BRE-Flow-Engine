"use client";

import { use } from "react";
import { MapPin, TrendingUp, Users } from "lucide-react";

interface BranchItem {
  code: string;
  name: string;
  region: string;
  area: string;
  targetMonthlyVolume: number;
  achievedVolume: number;
  manager: string;
}

const BRANCHES: BranchItem[] = [
  { code: "BR-DEL-01", name: "Delhi Connaught Place", region: "North", area: "Delhi NCR", targetMonthlyVolume: 50000000, achievedVolume: 42500000, manager: "Rajesh Sharma" },
  { code: "BR-MUM-01", name: "Mumbai Nariman Point", region: "West", area: "Mumbai Metro", targetMonthlyVolume: 75000000, achievedVolume: 68000000, manager: "Arun Patel" },
  { code: "BR-BLR-01", name: "Bengaluru Indiranagar", region: "South", area: "Bengaluru Urban", targetMonthlyVolume: 60000000, achievedVolume: 59000000, manager: "Priya Nair" },
];

export default function TenantRegionalPage({
  params,
}: {
  params: Promise<{ tenantUuid: string }>;
}) {
  const { tenantUuid } = use(params);

  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-6 px-4 sm:px-6 py-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-ink font-display">
              Regional Sales Hierarchy
            </h1>
            <span className="rounded-md bg-brand-500/10 px-2 py-0.5 text-xs font-mono font-bold text-brand-600 border border-brand-500/20">
              {tenantUuid}
            </span>
          </div>
          <p className="text-xs text-ink-subtle mt-0.5">
            Manage multi-region branch structures, volume quotas, and area directors.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-line bg-slate-50 text-[0.6875rem] font-extrabold uppercase tracking-wider text-ink-subtle">
            <tr>
              <th className="px-5 py-3">Branch Code</th>
              <th className="px-5 py-3">Branch Name</th>
              <th className="px-5 py-3">Region / Area</th>
              <th className="px-5 py-3">Monthly Target</th>
              <th className="px-5 py-3">Achieved Volume</th>
              <th className="px-5 py-3">Branch Manager</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {BRANCHES.map((b) => {
              const pct = Math.round((b.achievedVolume / b.targetMonthlyVolume) * 100);
              return (
                <tr key={b.code} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-mono font-bold text-brand-600">{b.code}</td>
                  <td className="px-5 py-3.5 font-bold text-ink">{b.name}</td>
                  <td className="px-5 py-3.5 text-ink-muted">{b.region} — {b.area}</td>
                  <td className="px-5 py-3.5 font-mono text-ink">₹{(b.targetMonthlyVolume / 100000).toFixed(0)} Lakh</td>
                  <td className="px-5 py-3.5 font-mono">
                    <span className="font-bold text-emerald-600">₹{(b.achievedVolume / 100000).toFixed(0)} Lakh</span>
                    <span className="text-[0.6875rem] text-ink-subtle ml-1.5">({pct}%)</span>
                  </td>
                  <td className="px-5 py-3.5 text-ink-muted">{b.manager}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
