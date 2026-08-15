"use client";

import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  Percent,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";

const REJECTION_CODES = [
  {
    code: "EMP-301",
    label: "Salary Payment Mode - Cash",
    count: 312,
    percent: 34.2,
    category: "Employment & Income",
    impact: "High",
  },
  {
    code: "BUR-401",
    label: "CIBIL Score Below Minimum Ceiling (<700)",
    count: 248,
    percent: 27.1,
    category: "Bureau Delinquency",
    impact: "High",
  },
  {
    code: "DPD-102",
    label: "Delinquency > 30 DPD in Past 12 Months",
    count: 154,
    percent: 16.8,
    category: "Credit Track Record",
    impact: "Medium",
  },
  {
    code: "AGE-101",
    label: "Age at Loan Maturity Exceeds 60/65 Limit",
    count: 118,
    percent: 12.9,
    category: "Demographic Floor",
    impact: "Low",
  },
  {
    code: "INC-202",
    label: "Gross Annual Income Below ₹3.0L Minimum",
    count: 81,
    percent: 8.9,
    category: "Financial Capacity",
    impact: "Low",
  },
];

const BANK_LATENCY_METRICS = [
  { code: "HDFC", name: "HDFC Bank", latency: 142, uptime: 99.98, passRate: 78.4 },
  { code: "BOI", name: "Bank of India", latency: 185, uptime: 99.92, passRate: 82.1 },
  { code: "AXIS", name: "Axis Bank", latency: 158, uptime: 99.95, passRate: 74.6 },
  { code: "BOB", name: "Bank of Baroda", latency: 210, uptime: 99.85, passRate: 79.2 },
  { code: "KOTAK", name: "Kotak Mahindra", latency: 135, uptime: 99.99, passRate: 71.8 },
  { code: "IOB", name: "Indian Overseas Bank", latency: 245, uptime: 99.80, passRate: 76.3 },
  { code: "INDIAN_BANK", name: "Indian Bank", latency: 220, uptime: 99.88, passRate: 75.9 },
  { code: "BOM", name: "Bank of Maharashtra", latency: 195, uptime: 99.90, passRate: 73.4 },
];

export default function TelemetryPage() {
  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-6 px-4 sm:px-6 py-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold text-ink font-display">
          Telemetry &amp; Rule Engine Analytics
        </h1>
        <p className="text-xs text-ink-subtle">
          Real-time execution telemetry, rejection code Pareto analysis &amp; multi-bank latency benchmarks
        </p>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-4.5 shadow-xs">
          <span className="text-xs font-bold text-ink-subtle">Evaluations Processed (24h)</span>
          <p className="mt-1 font-mono text-2xl font-extrabold text-ink">4,892</p>
          <span className="text-[0.6875rem] text-success font-bold">+14.2% vs yesterday</span>
        </div>

        <div className="rounded-2xl border border-line bg-white p-4.5 shadow-xs">
          <span className="text-xs font-bold text-ink-subtle">Overall First-Pass Yield</span>
          <p className="mt-1 font-mono text-2xl font-extrabold text-brand-600">76.8%</p>
          <span className="text-[0.6875rem] text-success font-bold">Passed &gt;= 1 Bank Rules</span>
        </div>

        <div className="rounded-2xl border border-line bg-white p-4.5 shadow-xs">
          <span className="text-xs font-bold text-ink-subtle">Mean Rule Execution Time</span>
          <p className="mt-1 font-mono text-2xl font-extrabold text-ink">14.8 ms</p>
          <span className="text-[0.6875rem] text-success font-bold">Sub-millisecond rule check</span>
        </div>

        <div className="rounded-2xl border border-line bg-white p-4.5 shadow-xs">
          <span className="text-xs font-bold text-ink-subtle">8-Bank API Mean Latency</span>
          <p className="mt-1 font-mono text-2xl font-extrabold text-ink">186 ms</p>
          <span className="text-[0.6875rem] text-success font-bold">99.93% Network Uptime</span>
        </div>
      </div>

      {/* Rejection Pareto Analysis & API Latency Comparison Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Top Rejection Codes */}
        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                <AlertTriangle size={16} className="text-danger" />
                <span>Top Rejection Codes Pareto</span>
              </h2>
              <span className="text-[0.6875rem] font-mono text-ink-subtle">Last 30 Days</span>
            </div>

            <div className="mt-4 space-y-3.5">
              {REJECTION_CODES.map((item) => (
                <div key={item.code} className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-danger bg-danger-bg px-1.5 py-0.5 rounded text-[0.6875rem]">
                        {item.code}
                      </span>
                      <span className="font-semibold text-ink truncate max-w-[200px] sm:max-w-none">
                        {item.label}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-ink">{item.count} cases ({item.percent}%)</span>
                  </div>

                  <div className="h-1.5 w-full rounded-full bg-bg-raised overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-danger to-brand-violet"
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-bg-raised p-3 text-[0.6875rem] text-ink-muted">
            💡 <strong>Insight:</strong> 61.3% of non-eligible cases are due to cash salary payment modes and CIBIL floor deviations.
          </div>
        </div>

        {/* Right: Bank API Response Matrix */}
        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h2 className="text-sm font-bold text-ink flex items-center gap-2">
              <Activity size={16} className="text-brand-500" />
              <span>Partner Bank API Integration Metrics</span>
            </h2>
            <span className="text-[0.6875rem] font-mono text-success">8 of 8 Live</span>
          </div>

          <div className="mt-4 space-y-3">
            {BANK_LATENCY_METRICS.map((bank) => (
              <div
                key={bank.code}
                className="flex items-center justify-between rounded-xl border border-line/60 p-3 text-xs bg-bg-surface hover:border-line-strong transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-2 w-2 rounded-full bg-success animate-pulse" />
                  <div>
                    <strong className="text-ink">{bank.name}</strong>
                    <span className="block font-mono text-[0.625rem] text-ink-subtle">
                      Code: {bank.code}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 font-mono text-[0.6875rem]">
                  <div className="text-right">
                    <span className="text-ink-subtle block text-[0.5625rem]">Latency</span>
                    <span className="font-bold text-ink">{bank.latency} ms</span>
                  </div>
                  <div className="text-right">
                    <span className="text-ink-subtle block text-[0.5625rem]">Uptime</span>
                    <span className="font-bold text-success">{bank.uptime}%</span>
                  </div>
                  <div className="text-right">
                    <span className="text-ink-subtle block text-[0.5625rem]">Rule Pass %</span>
                    <span className="font-bold text-brand-600">{bank.passRate}%</span>
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
