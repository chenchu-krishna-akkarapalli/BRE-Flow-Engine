"use client";

import { use, useState } from "react";
import { Activity, Clock, RefreshCw, Search, ShieldCheck } from "lucide-react";

interface LogEntry {
  id: string;
  traceId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  actor: string;
  timestamp: string;
}

const INITIAL_LOGS: LogEntry[] = [
  { id: "log-1", traceId: "req-98f1c8b3", endpoint: "/api/v1/onboarding/evaluate/form", method: "POST", statusCode: 200, latencyMs: 7.8, actor: "rajesh.sharma", timestamp: "2026-08-18T21:45:10Z" },
  { id: "log-2", traceId: "req-98f1c8b4", endpoint: "/api/v1/onboarding/documents/cibil/extract", method: "POST", statusCode: 200, latencyMs: 142.5, actor: "arun.patel", timestamp: "2026-08-18T21:44:32Z" },
  { id: "log-3", traceId: "req-98f1c8b5", endpoint: "/api/v1/auth/verify", method: "POST", statusCode: 200, latencyMs: 18.2, actor: "priya.nair", timestamp: "2026-08-18T21:43:05Z" },
  { id: "log-4", traceId: "req-98f1c8b6", endpoint: "/api/v1/onboarding/verification/otp/verify", method: "POST", statusCode: 200, latencyMs: 12.1, actor: "rajesh.sharma", timestamp: "2026-08-18T21:40:18Z" },
];

export default function TenantLogsPage({
  params,
}: {
  params: Promise<{ tenantUuid: string }>;
}) {
  const { tenantUuid } = use(params);
  const [logs] = useState<LogEntry[]>(INITIAL_LOGS);

  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-6 px-4 sm:px-6 py-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-ink font-display">
              Live API Logs & Audit Stream
            </h1>
            <span className="rounded-md bg-brand-500/10 px-2 py-0.5 text-xs font-mono font-bold text-brand-600 border border-brand-500/20">
              {tenantUuid}
            </span>
          </div>
          <p className="text-xs text-ink-subtle mt-0.5">
            Real-time stream of tenant API executions, latencies, and user actions.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
        <table className="w-full text-left text-xs font-mono">
          <thead className="border-b border-line bg-slate-50 text-[0.6875rem] font-extrabold uppercase tracking-wider text-ink-subtle">
            <tr>
              <th className="px-5 py-3 font-sans">Trace ID</th>
              <th className="px-5 py-3 font-sans">Endpoint</th>
              <th className="px-5 py-3 font-sans">Method</th>
              <th className="px-5 py-3 font-sans">Status</th>
              <th className="px-5 py-3 font-sans">Latency</th>
              <th className="px-5 py-3 font-sans">Actor</th>
              <th className="px-5 py-3 font-sans">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-5 py-3.5 text-brand-600 font-bold">{log.traceId}</td>
                <td className="px-5 py-3.5 text-ink">{log.endpoint}</td>
                <td className="px-5 py-3.5">
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[0.625rem] font-bold text-ink">
                    {log.method}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="rounded-md bg-success/10 px-1.5 py-0.5 text-[0.625rem] font-bold text-success border border-success/20">
                    {log.statusCode}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-ink-muted">{log.latencyMs} ms</td>
                <td className="px-5 py-3.5 text-ink font-sans">{log.actor}</td>
                <td className="px-5 py-3.5 text-ink-subtle text-[0.6875rem] font-sans">{log.timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
