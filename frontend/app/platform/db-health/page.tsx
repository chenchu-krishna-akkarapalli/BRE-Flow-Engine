"use client";

import { Activity, CheckCircle, Database, HardDrive, Layers, RefreshCw, Server, Zap } from "lucide-react";

export default function DbHealthMonitorPage() {
  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-6 px-4 sm:px-6 py-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-ink font-display">
              Database Infrastructure & Connection Pool Health
            </h1>
            <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[0.625rem] font-bold text-indigo-600 border border-indigo-500/20">
              DB_ADMIN Scope
            </span>
          </div>
          <p className="text-xs text-ink-subtle mt-0.5">
            Real-time asyncpg connection pooling, Row-Level Security (RLS) enforcement, and PostgreSQL latency SLAs
          </p>
        </div>

        <button
          type="button"
          className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold text-ink shadow-xs hover:bg-bg-raised transition-all self-start sm:self-auto"
        >
          <RefreshCw size={14} />
          <span>Refresh Pool State</span>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-subtle">Pool Size & Utilization</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600">
              <Layers size={14} />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-ink">4 / 20</p>
          <span className="text-[0.6875rem] text-emerald-600 font-bold flex items-center gap-1 mt-1">
            <CheckCircle size={12} />
            <span>20% Pool Saturation (Max 30)</span>
          </span>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-subtle">Mean Query Latency</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <Zap size={14} />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-emerald-600">1.84 ms</p>
          <span className="text-[0.6875rem] text-ink-subtle flex items-center gap-1 mt-1">
            <span>SLA Target: &lt; 10.0 ms</span>
          </span>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-subtle">Active Transactions</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-indigo/10 text-brand-indigo">
              <Activity size={14} />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-ink">12 TPS</p>
          <span className="text-[0.6875rem] text-emerald-600 font-bold flex items-center gap-1 mt-1">
            <span>Zero Deadlocks / Zero Lock Waits</span>
          </span>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-subtle">Redis Singleflight Nonces</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <Database size={14} />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-ink">100% Hit Rate</p>
          <span className="text-[0.6875rem] text-emerald-600 font-bold flex items-center gap-1 mt-1">
            <span>0.42 ms Redis Nonce Lookup</span>
          </span>
        </div>
      </div>

      {/* Table Bloat & Partition Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs">
          <h2 className="text-sm font-extrabold text-ink font-display mb-3">
            PostgreSQL 16 Tables & Storage
          </h2>
          <div className="space-y-3">
            {[
              { table: "application", rows: "14,892", size: "18.4 MB", rls: "Active (tenant_id)" },
              { table: "rule_execution", rows: "58,190", size: "32.1 MB", rls: "Active (tenant_id)" },
              { table: "user_account", rows: "124", size: "128 kB", rls: "Active (tenant_id)" },
              { table: "user_session", rows: "1,420", size: "840 kB", rls: "Active (user_id)" },
              { table: "telemetry_log", rows: "84,912", size: "64.2 MB", rls: "Active (tenant_id)" },
              { table: "navigation_node", rows: "48", size: "64 kB", rls: "Global Platform" },
            ].map((row) => (
              <div key={row.table} className="flex items-center justify-between border-b border-line pb-2 text-xs">
                <div>
                  <span className="font-mono font-bold text-ink">{row.table}</span>
                  <span className="ml-2 text-[0.625rem] text-ink-subtle">{row.rows} rows</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-ink-muted">{row.size}</span>
                  <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[0.625rem] font-bold text-emerald-600">
                    {row.rls}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs">
          <h2 className="text-sm font-extrabold text-ink font-display mb-3">
            Connection Parameters & Tuning
          </h2>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between border-b border-line pb-2">
              <span className="text-ink-subtle">Engine Driver</span>
              <span className="font-mono font-bold text-ink">asyncpg (SQLAlchemy 2.0 Async)</span>
            </div>
            <div className="flex justify-between border-b border-line pb-2">
              <span className="text-ink-subtle">Max Overflow Limit</span>
              <span className="font-mono font-bold text-ink">10 Connections</span>
            </div>
            <div className="flex justify-between border-b border-line pb-2">
              <span className="text-ink-subtle">Pool Recycle Interval</span>
              <span className="font-mono font-bold text-ink">3600 seconds</span>
            </div>
            <div className="flex justify-between border-b border-line pb-2">
              <span className="text-ink-subtle">Isolation Level</span>
              <span className="font-mono font-bold text-ink">READ COMMITTED</span>
            </div>
            <div className="flex justify-between border-b border-line pb-2">
              <span className="text-ink-subtle">Redis PubSub Channels</span>
              <span className="font-mono font-bold text-brand-600">alerts:super_admin:sla_breach</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
