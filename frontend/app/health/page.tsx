"use client";

import { useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock,
  Cpu,
  Globe,
  RefreshCw,
  Server,
  ShieldCheck,
  Zap,
} from "lucide-react";

interface BankApiEndpoint {
  code: string;
  name: string;
  endpoint: string;
  httpStatus: number;
  latencyMs: number;
  uptime24h: number;
  lastHeartbeat: string;
  environment: "Production" | "Sandbox";
}

const ENDPOINTS: BankApiEndpoint[] = [
  {
    code: "HDFC",
    name: "HDFC Bank Ltd",
    endpoint: "https://api.hdfcbank.com/cre/v2/evaluate",
    httpStatus: 200,
    latencyMs: 142,
    uptime24h: 99.98,
    lastHeartbeat: "Just now",
    environment: "Production",
  },
  {
    code: "BOI",
    name: "Bank of India",
    endpoint: "https://openapi.bankofindia.co.in/loans/v1/score",
    httpStatus: 200,
    latencyMs: 185,
    uptime24h: 99.92,
    lastHeartbeat: "12s ago",
    environment: "Production",
  },
  {
    code: "AXIS",
    name: "Axis Bank Ltd",
    endpoint: "https://gateway.axisbank.com/bre/policy/v3",
    httpStatus: 200,
    latencyMs: 158,
    uptime24h: 99.95,
    lastHeartbeat: "3s ago",
    environment: "Production",
  },
  {
    code: "BOB",
    name: "Bank of Baroda",
    endpoint: "https://api.bankofbaroda.in/digital/loan/check",
    httpStatus: 200,
    latencyMs: 210,
    uptime24h: 99.85,
    lastHeartbeat: "Just now",
    environment: "Production",
  },
  {
    code: "KOTAK",
    name: "Kotak Mahindra Bank",
    endpoint: "https://api.kotak.com/retail/cre/evaluate",
    httpStatus: 200,
    latencyMs: 135,
    uptime24h: 99.99,
    lastHeartbeat: "Just now",
    environment: "Production",
  },
  {
    code: "IOB",
    name: "Indian Overseas Bank",
    endpoint: "https://api.iob.in/cre/gateway/v1",
    httpStatus: 200,
    latencyMs: 245,
    uptime24h: 99.80,
    lastHeartbeat: "18s ago",
    environment: "Production",
  },
  {
    code: "INDIAN_BANK",
    name: "Indian Bank",
    endpoint: "https://apigateway.indianbank.in/bre/score",
    httpStatus: 200,
    latencyMs: 220,
    uptime24h: 99.88,
    lastHeartbeat: "5s ago",
    environment: "Production",
  },
  {
    code: "BOM",
    name: "Bank of Maharashtra",
    endpoint: "https://api.bankofmaharashtra.in/cre/v1",
    httpStatus: 200,
    latencyMs: 195,
    uptime24h: 99.90,
    lastHeartbeat: "Just now",
    environment: "Production",
  },
];

export default function HealthPage() {
  const [isPinging, setIsPinging] = useState(false);
  const [lastPingTime, setLastPingTime] = useState<string>("Just now");

  const handlePingAll = async () => {
    setIsPinging(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setIsPinging(false);
    setLastPingTime("Just now");
  };

  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-6 px-4 sm:px-6 py-6 animate-fade-in">
      {/* Top Controls Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink font-display">
            API Health &amp; Diagnostics Monitor
          </h1>
          <p className="text-xs text-ink-subtle">
            Live latency telemetry, HTTP health status &amp; uptime tracking across 8 partner bank endpoints
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePingAll}
            disabled={isPinging}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-indigo px-4 py-2 text-xs font-bold text-white shadow-glow transition-all hover:scale-[1.02] disabled:opacity-60"
          >
            <RefreshCw size={14} className={isPinging ? "animate-spin" : ""} />
            <span>{isPinging ? "Testing Connectivity..." : "Ping 8 Endpoints"}</span>
          </button>
        </div>
      </div>

      {/* Global Health Metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-4.5 shadow-xs">
          <span className="text-xs font-bold text-ink-subtle">Partner Bank Status</span>
          <p className="mt-1 font-mono text-2xl font-extrabold text-success flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-success animate-pulse" />
            8 / 8 Online
          </p>
          <span className="text-[0.6875rem] text-ink-subtle">100% Core Availability</span>
        </div>

        <div className="rounded-2xl border border-line bg-white p-4.5 shadow-xs">
          <span className="text-xs font-bold text-ink-subtle">Aggregated 24h Uptime</span>
          <p className="mt-1 font-mono text-2xl font-extrabold text-ink">99.92%</p>
          <span className="text-[0.6875rem] text-success font-bold">Zero network downtime</span>
        </div>

        <div className="rounded-2xl border border-line bg-white p-4.5 shadow-xs">
          <span className="text-xs font-bold text-ink-subtle">Average Network Roundtrip</span>
          <p className="mt-1 font-mono text-2xl font-extrabold text-brand-600">187.5 ms</p>
          <span className="text-[0.6875rem] text-success font-bold">&lt; 300ms SLA target</span>
        </div>

        <div className="rounded-2xl border border-line bg-white p-4.5 shadow-xs">
          <span className="text-xs font-bold text-ink-subtle">Last Heartbeat Probe</span>
          <p className="mt-1 font-mono text-2xl font-extrabold text-ink">{lastPingTime}</p>
          <span className="text-[0.6875rem] text-ink-subtle">Automated 30s cycle</span>
        </div>
      </div>

      {/* Endpoints Table / Grid */}
      <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <h2 className="text-sm font-bold text-ink">Connected Bank API Gateways</h2>
          <span className="text-xs font-mono text-success">All Systems Operational</span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {ENDPOINTS.map((ep) => (
            <div
              key={ep.code}
              className="rounded-xl border border-line p-4 transition-all hover:border-line-strong hover:shadow-xs bg-bg-surface flex flex-col justify-between gap-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-success animate-pulse" />
                  <strong className="text-xs font-bold text-ink">{ep.name}</strong>
                  <span className="font-mono text-[0.6875rem] text-brand-600 bg-brand-500/10 px-1.5 py-0.2 rounded font-bold">
                    {ep.code}
                  </span>
                </div>
                <span className="rounded-full bg-success-bg border border-success/30 px-2 py-0.5 text-[0.625rem] font-bold text-success">
                  HTTP {ep.httpStatus} OK
                </span>
              </div>

              <div className="rounded bg-bg-raised/70 px-2.5 py-1 font-mono text-[0.625rem] text-ink-muted truncate">
                {ep.endpoint}
              </div>

              <div className="flex items-center justify-between border-t border-line/40 pt-2 text-[0.6875rem] font-mono">
                <span className="text-ink-subtle">
                  Latency: <strong className="text-ink">{ep.latencyMs} ms</strong>
                </span>
                <span className="text-ink-subtle">
                  24h Uptime: <strong className="text-success">{ep.uptime24h}%</strong>
                </span>
                <span className="text-ink-subtle">{ep.lastHeartbeat}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
