"use client";

import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  MapPin,
  TrendingUp,
  Users,
} from "lucide-react";

interface BranchMetric {
  id: string;
  name: string;
  region: string;
  activeAgents: number;
  monthlyDisbursal: string;
  avgTatHours: number;
  slaAdherencePercent: number;
  approvalRate: number;
}

const BRANCHES: BranchMetric[] = [
  {
    id: "BR-DEL-01",
    name: "North Delhi Hub (Connaught Place)",
    region: "Northern Region",
    activeAgents: 8,
    monthlyDisbursal: "₹ 1,42,00,000",
    avgTatHours: 14.2,
    slaAdherencePercent: 96.8,
    approvalRate: 81.4,
  },
  {
    id: "BR-MUM-02",
    name: "Mumbai BKC Commercial Hub",
    region: "Western Region",
    activeAgents: 10,
    monthlyDisbursal: "₹ 1,85,00,000",
    avgTatHours: 16.5,
    slaAdherencePercent: 94.2,
    approvalRate: 79.8,
  },
  {
    id: "BR-BLR-03",
    name: "Bangalore Tech Corridor (Indiranagar)",
    region: "Southern Region",
    activeAgents: 7,
    monthlyDisbursal: "₹ 1,15,00,000",
    avgTatHours: 12.8,
    slaAdherencePercent: 98.4,
    approvalRate: 84.6,
  },
  {
    id: "BR-HYD-04",
    name: "Hyderabad West (Hitec City)",
    region: "Southern Region",
    activeAgents: 6,
    monthlyDisbursal: "₹ 92,00,000",
    avgTatHours: 15.1,
    slaAdherencePercent: 93.5,
    approvalRate: 77.2,
  },
  {
    id: "BR-KOL-05",
    name: "Kolkata Central (Park Street)",
    region: "Eastern Region",
    activeAgents: 5,
    monthlyDisbursal: "₹ 64,50,000",
    avgTatHours: 19.4,
    slaAdherencePercent: 88.9,
    approvalRate: 72.1,
  },
];

export default function RegionalPage() {
  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-6 px-4 sm:px-6 py-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold text-ink font-display">
          Regional Performance &amp; SLA Benchmark
        </h1>
        <p className="text-xs text-ink-subtle">
          Branch territory comparison, turnaround time (TAT) adherence &amp; conversion matrices
        </p>
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs">
          <span className="text-xs font-bold text-ink-subtle">Total Active Branches</span>
          <p className="mt-1 font-mono text-2xl font-extrabold text-ink">14 Centers</p>
          <span className="text-[0.6875rem] text-success font-bold">Covering 180+ Pincodes</span>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs">
          <span className="text-xs font-bold text-ink-subtle">Network Mean Turnaround Time (TAT)</span>
          <p className="mt-1 font-mono text-2xl font-extrabold text-brand-600">15.6 Hours</p>
          <span className="text-[0.6875rem] text-success font-bold">&lt; 24h Bank SLA Target</span>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs">
          <span className="text-xs font-bold text-ink-subtle">24h SLA Adherence Rate</span>
          <p className="mt-1 font-mono text-2xl font-extrabold text-success">95.4%</p>
          <span className="text-[0.6875rem] text-ink-subtle">4.6% flagged for override</span>
        </div>
      </div>

      {/* Branch Grids */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <h2 className="text-sm font-bold text-ink">Territory Branch Scorecards</h2>
            <span className="text-xs font-mono text-ink-subtle">Monthly Refresh</span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {BRANCHES.map((br) => (
              <div
                key={br.id}
                className="rounded-2xl border border-line p-5 transition-all hover:border-line-strong hover:shadow-xs bg-bg-surface"
              >
                <div className="flex items-center justify-between border-b border-line/60 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                      <Building2 size={16} className="text-brand-500" />
                      {br.name}
                    </h3>
                    <span className="text-[0.6875rem] text-ink-subtle">{br.region}</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-brand-600">{br.id}</span>
                </div>

                <div className="mt-3.5 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-bg-raised p-2.5">
                    <span className="text-ink-subtle block text-[0.625rem]">Monthly Disbursal</span>
                    <span className="font-mono font-extrabold text-ink">{br.monthlyDisbursal}</span>
                  </div>
                  <div className="rounded-xl bg-bg-raised p-2.5">
                    <span className="text-ink-subtle block text-[0.625rem]">Average TAT</span>
                    <span className="font-mono font-extrabold text-brand-600">
                      {br.avgTatHours} Hours
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-line/40">
                  <span className="text-ink-subtle flex items-center gap-1">
                    <Users size={13} />
                    {br.activeAgents} Active Underwriters
                  </span>
                  <div className="flex items-center gap-3 font-mono text-[0.6875rem]">
                    <span>SLA: <strong className="text-success">{br.slaAdherencePercent}%</strong></span>
                    <span>Approval: <strong className="text-brand-600">{br.approvalRate}%</strong></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
