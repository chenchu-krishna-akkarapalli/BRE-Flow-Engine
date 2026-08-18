"use client";

import { Activity, BarChart3, CheckCircle2, Clock, ShieldCheck, TrendingUp, Users, Zap } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-6 px-4 sm:px-6 py-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold text-ink font-display">
          Portal Dashboard
        </h1>
        <p className="text-xs text-ink-subtle">
          Main portal dashboard showing overview metrics, active evaluation counts, and status charts
        </p>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Active Evaluations */}
        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs transition-all hover:scale-[1.01] duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-subtle">Active Evaluations (24h)</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600">
              <Zap size={14} fill="currentColor" />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-ink">1,482</p>
          <span className="text-[0.6875rem] text-success font-bold flex items-center gap-1 mt-1">
            <TrendingUp size={12} />
            <span>+8.4% vs last week</span>
          </span>
        </div>

        {/* Card 2: SLA Verdict Time */}
        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs transition-all hover:scale-[1.01] duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-subtle">Mean SLA Verdict Time</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning/10 text-warning">
              <Clock size={14} />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-ink">14.8 ms</p>
          <span className="text-[0.6875rem] text-success font-bold flex items-center gap-1 mt-1">
            <CheckCircle2 size={12} />
            <span>100% compliant (&lt; 30ms limit)</span>
          </span>
        </div>

        {/* Card 3: Rule Pass Rate */}
        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs transition-all hover:scale-[1.01] duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-subtle">CRE First-Pass Yield</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-indigo/10 text-brand-indigo">
              <BarChart3 size={14} />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-brand-600">76.8%</p>
          <span className="text-[0.6875rem] text-ink-subtle flex items-center gap-1 mt-1">
            <span>Matches at least 1 partner bank</span>
          </span>
        </div>

        {/* Card 4: Active Agents */}
        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs transition-all hover:scale-[1.01] duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-subtle">Online Agents</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-success-bg text-success">
              <Users size={14} />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-ink">4 / 4</p>
          <span className="text-[0.6875rem] text-success font-bold flex items-center gap-1 mt-1">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-ping" />
            <span>Auto-routing active</span>
          </span>
        </div>
      </div>

      {/* Grid for Charts & Status */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Pipeline status & overview */}
        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                <Activity size={16} className="text-brand-500" />
                <span>Evaluation Pipeline Status</span>
              </h2>
              <span className="text-[0.6875rem] font-mono text-success">System Healthy</span>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink">Income Verification Engine</span>
                <span className="font-mono text-success font-bold">100% Online</span>
              </div>
              <div className="h-2 w-full rounded-full bg-bg-raised">
                <div className="h-full rounded-full bg-brand-500" style={{ width: "100%" }} />
              </div>

              <div className="flex items-center justify-between text-xs mt-4">
                <span className="font-semibold text-ink">Credit Bureau (CIBIL) Connector</span>
                <span className="font-mono text-success font-bold">100% Online</span>
              </div>
              <div className="h-2 w-full rounded-full bg-bg-raised">
                <div className="h-full rounded-full bg-brand-indigo" style={{ width: "100%" }} />
              </div>

              <div className="flex items-center justify-between text-xs mt-4">
                <span className="font-semibold text-ink">Partner Bank API Endpoints (8 Banks)</span>
                <span className="font-mono text-success font-bold">8 / 8 Active</span>
              </div>
              <div className="h-2 w-full rounded-full bg-bg-raised">
                <div className="h-full rounded-full bg-brand-violet" style={{ width: "100%" }} />
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-bg-raised p-3 text-[0.6875rem] text-ink-muted">
            ℹ️ <strong>System Note:</strong> Mean API response latency across all endpoints is currently 186 ms, comfortably within the 300 ms SLA ceiling.
          </div>
        </div>

        {/* Right Col: Active Rules Config Overview */}
        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h2 className="text-sm font-bold text-ink flex items-center gap-2">
              <ShieldCheck size={16} className="text-brand-500" />
              <span>Active Rule Engine Configuration</span>
            </h2>
            <span className="rounded bg-brand-500/10 px-2 py-0.5 text-[0.625rem] font-mono font-extrabold text-brand-600">
              v2.4
            </span>
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-line/60 p-3 text-xs bg-bg-surface">
              <div className="flex justify-between font-bold text-ink">
                <span>Bureau Ceiling</span>
                <span className="font-mono text-brand-600">&gt;= 700 CIBIL</span>
              </div>
              <span className="block text-[0.625rem] text-ink-subtle mt-0.5">
                Stricter check for private banks, floor score is 700 for public banks.
              </span>
            </div>

            <div className="rounded-xl border border-line/60 p-3 text-xs bg-bg-surface">
              <div className="flex justify-between font-bold text-ink">
                <span>Maximum Repayment DPD</span>
                <span className="font-mono text-danger">0 DPD (HDFC / Axis)</span>
              </div>
              <span className="block text-[0.625rem] text-ink-subtle mt-0.5">
                Allows up to 30 DPD in 12 months for select public sector lenders.
              </span>
            </div>

            <div className="rounded-xl border border-line/60 p-3 text-xs bg-bg-surface">
              <div className="flex justify-between font-bold text-ink">
                <span>Monthly Income Floor</span>
                <span className="font-mono text-ink">₹25,000 / month</span>
              </div>
              <span className="block text-[0.625rem] text-ink-subtle mt-0.5">
                Hard termination floor inside Step 3 of the Onboarding Wizard.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
