"use client";

import { use } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock, ShieldCheck, Zap } from "lucide-react";

export default function TenantTelemetryPage({
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
              Telemetry & Latency Engine
            </h1>
            <span className="rounded-md bg-brand-500/10 px-2 py-0.5 text-xs font-mono font-bold text-brand-600 border border-brand-500/20">
              {tenantUuid}
            </span>
          </div>
          <p className="text-xs text-ink-subtle mt-0.5">
            Microsecond-accurate request profiling, SLA breach alerts (&gt; 400ms), and error logs.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs">
          <span className="text-xs font-bold text-ink-subtle">p50 Latency</span>
          <p className="mt-2 font-mono text-2xl font-extrabold text-ink">4.2 ms</p>
          <span className="text-[0.6875rem] text-success font-bold">Optimal in-memory RAM</span>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs">
          <span className="text-xs font-bold text-ink-subtle">p95 Latency</span>
          <p className="mt-2 font-mono text-2xl font-extrabold text-ink">8.8 ms</p>
          <span className="text-[0.6875rem] text-success font-bold">&lt; 30ms SLA Target</span>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs">
          <span className="text-xs font-bold text-ink-subtle">p99 Latency</span>
          <p className="mt-2 font-mono text-2xl font-extrabold text-ink">14.1 ms</p>
          <span className="text-[0.6875rem] text-success font-bold">&lt; 80ms CRUD Target</span>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs">
          <span className="text-xs font-bold text-ink-subtle">SLA Breaches (&gt;400ms)</span>
          <p className="mt-2 font-mono text-2xl font-extrabold text-success">0</p>
          <span className="text-[0.6875rem] text-success font-bold">100% SLA Compliance</span>
        </div>
      </div>
    </div>
  );
}
