"use client";

import { AlertTriangle, CheckCircle, FileCheck, Lock, RefreshCw, Shield, ShieldAlert, Zap } from "lucide-react";

export default function CyberSecurityCellPage() {
  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-6 px-4 sm:px-6 py-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-ink font-display">
              Cyber Security Operations Center (SOC)
            </h1>
            <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[0.625rem] font-bold text-rose-600 border border-rose-500/20">
              SOC_ANALYST Scope
            </span>
          </div>
          <p className="text-xs text-ink-subtle mt-0.5">
            Live PDF upload firewall, anti-tampering guards, rate limiting, and cryptographic challenge monitoring
          </p>
        </div>

        <button
          type="button"
          className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold text-ink shadow-xs hover:bg-bg-raised transition-all self-start sm:self-auto"
        >
          <RefreshCw size={14} />
          <span>Scan Audit Log</span>
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-subtle">PDF Firewall Blocks</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
              <FileCheck size={14} />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-ink">0 Threat PDFs</p>
          <span className="text-[0.6875rem] text-emerald-600 font-bold flex items-center gap-1 mt-1">
            <CheckCircle size={12} />
            <span>100% Signature Verified</span>
          </span>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-subtle">Cross-Tenant Spoofing</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600">
              <ShieldAlert size={14} />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-emerald-600">0 Violations</p>
          <span className="text-[0.6875rem] text-ink-subtle flex items-center gap-1 mt-1">
            <span>Header & JWT Scope Binding Enforced</span>
          </span>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-subtle">Rate Limiter State</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <Zap size={14} />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-ink">Healthy</p>
          <span className="text-[0.6875rem] text-emerald-600 font-bold flex items-center gap-1 mt-1">
            <span>60 req/min per Tenant Window</span>
          </span>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-subtle">Replay Attack Mitigations</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600">
              <Lock size={14} />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-ink">100% Single-Use</p>
          <span className="text-[0.6875rem] text-emerald-600 font-bold flex items-center gap-1 mt-1">
            <span>Atomic Check-and-Delete Active</span>
          </span>
        </div>
      </div>

      {/* Security Incident Stream */}
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-extrabold text-ink font-display">
            Security Telemetry & Threat Assessment
          </h2>
          <p className="text-[0.6875rem] text-ink-subtle">
            Real-time defensive monitoring across all API gateways
          </p>
        </div>

        <div className="p-5 space-y-3">
          {[
            {
              event: "Argon2 Cryptographic Proof Verified",
              actor: "channel.admin@boi.com",
              ip: "103.21.124.5",
              severity: "INFO",
              time: "Just now",
            },
            {
              event: "PDF Magic Header Conformance Verified (application/pdf)",
              actor: "agent.john@boi.com",
              ip: "49.36.110.24",
              severity: "INFO",
              time: "2 mins ago",
            },
            {
              event: "Single-Use Nonce Consumed & Invalidated in Redis",
              actor: "super.admin@flowbre.com",
              ip: "127.0.0.1",
              severity: "INFO",
              time: "5 mins ago",
            },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center justify-between border-b border-line pb-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[0.625rem] font-bold text-emerald-600">
                  {item.severity}
                </span>
                <span className="font-bold text-ink">{item.event}</span>
              </div>
              <div className="text-[0.6875rem] text-ink-subtle font-mono">
                {item.actor} • {item.ip} • {item.time}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
