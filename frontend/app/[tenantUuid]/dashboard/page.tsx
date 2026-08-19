"use client";

import { use } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  FileText,
  GitPullRequest,
  ShieldCheck,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

export default function TenantDashboardPage({
  params,
}: {
  params: Promise<{ tenantUuid: string }>;
}) {
  const { tenantUuid } = use(params);

  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-6 px-4 sm:px-6 py-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-ink font-display">
              Portal Dashboard
            </h1>
            <span className="rounded-md bg-brand-500/10 px-2 py-0.5 text-xs font-mono font-bold text-brand-600 border border-brand-500/20">
              {tenantUuid}
            </span>
          </div>
          <p className="text-xs text-ink-subtle mt-0.5">
            Real-time multi-bank rule evaluation metrics, throughput, and decision telemetry.
          </p>
        </div>

        <Link
          href={`/${tenantUuid}`}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-xs font-bold text-white shadow-glow hover:bg-brand-600 transition-all"
        >
          <FileText size={16} />
          <span>New Application</span>
        </Link>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs transition-all hover:scale-[1.01] duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-subtle">Mean SLA Verdict Time</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning/10 text-warning">
              <Clock size={14} />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-ink">8.4 ms</p>
          <span className="text-[0.6875rem] text-success font-bold flex items-center gap-1 mt-1">
            <CheckCircle2 size={12} />
            <span>100% compliant (&lt; 30ms limit)</span>
          </span>
        </div>

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

        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs transition-all hover:scale-[1.01] duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-subtle">Underwriting Queue</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/10 text-success">
              <ShieldCheck size={14} />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-success">14 Pending</p>
          <span className="text-[0.6875rem] text-ink-subtle flex items-center gap-1 mt-1">
            <span>Requires exception sign-off</span>
          </span>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link
          href={`/${tenantUuid}/pipeline`}
          className="group rounded-2xl border border-line bg-white p-5 shadow-xs hover:border-brand-500/30 transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 group-hover:scale-105 transition-transform">
              <GitPullRequest size={18} />
            </span>
            <ArrowRight size={16} className="text-ink-subtle group-hover:text-brand-600 transition-colors" />
          </div>
          <h3 className="font-bold text-sm text-ink group-hover:text-brand-600 transition-colors">
            Sales Pipeline
          </h3>
          <p className="text-xs text-ink-subtle mt-1">
            View 7-stage lead origination pipeline and priority queues.
          </p>
        </Link>

        <Link
          href={`/${tenantUuid}/approvals`}
          className="group rounded-2xl border border-line bg-white p-5 shadow-xs hover:border-brand-500/30 transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 group-hover:scale-105 transition-transform">
              <CheckCircle2 size={18} />
            </span>
            <ArrowRight size={16} className="text-ink-subtle group-hover:text-emerald-600 transition-colors" />
          </div>
          <h3 className="font-bold text-sm text-ink group-hover:text-emerald-600 transition-colors">
            Underwriting Approvals
          </h3>
          <p className="text-xs text-ink-subtle mt-1">
            Sign off FOIR overrides, CIBIL overlays, and exceptions.
          </p>
        </Link>

        <Link
          href={`/${tenantUuid}/telemetry`}
          className="group rounded-2xl border border-line bg-white p-5 shadow-xs hover:border-brand-500/30 transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 group-hover:scale-105 transition-transform">
              <Activity size={18} />
            </span>
            <ArrowRight size={16} className="text-ink-subtle group-hover:text-amber-600 transition-colors" />
          </div>
          <h3 className="font-bold text-sm text-ink group-hover:text-amber-600 transition-colors">
            Telemetry & Perfect Logs
          </h3>
          <p className="text-xs text-ink-subtle mt-1">
            Real-time trace logs, latency budgets, and SLA breach monitors.
          </p>
        </Link>
      </div>
    </div>
  );
}
