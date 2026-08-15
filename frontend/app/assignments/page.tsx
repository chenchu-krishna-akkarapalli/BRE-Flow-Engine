"use client";

import { useState } from "react";
import {
  ArrowRightLeft,
  CheckCircle2,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Shield,
  TrendingUp,
  User,
  UserCheck,
  Users,
} from "lucide-react";

interface AgentProfile {
  id: string;
  name: string;
  role: string;
  territory: string;
  activeCases: number;
  maxCapacity: number;
  conversionRate: number;
  status: "Online" | "Busy" | "Offline";
}

const AGENTS: AgentProfile[] = [
  {
    id: "AGT-01",
    name: "Rohit Sharma",
    role: "Senior Transactional Staff",
    territory: "North Delhi / NCR",
    activeCases: 14,
    maxCapacity: 20,
    conversionRate: 68.4,
    status: "Online",
  },
  {
    id: "AGT-02",
    name: "Priya Nair",
    role: "Sales Underwriting Specialist",
    territory: "Mumbai Central",
    activeCases: 18,
    maxCapacity: 20,
    conversionRate: 74.2,
    status: "Busy",
  },
  {
    id: "AGT-03",
    name: "Amit Patel",
    role: "Field Onboarding Lead",
    territory: "Gujarat Region",
    activeCases: 9,
    maxCapacity: 15,
    conversionRate: 62.1,
    status: "Online",
  },
  {
    id: "AGT-04",
    name: "Sneha Sen",
    role: "Credit Verification Officer",
    territory: "Kolkata Hub",
    activeCases: 11,
    maxCapacity: 18,
    conversionRate: 70.8,
    status: "Online",
  },
];

export default function AssignmentsPage() {
  const [autoRouteEnabled, setAutoRouteEnabled] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-6 px-4 sm:px-6 py-6 animate-fade-in">
      {/* Top Controls Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink font-display">
            Agent Assignment Matrix
          </h1>
          <p className="text-xs text-ink-subtle">
            Allocation rules, territory routing &amp; workload distribution across underwriting agents
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAutoRouteEnabled(!autoRouteEnabled)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all border ${
              autoRouteEnabled
                ? "bg-brand-500/10 text-brand-600 border-brand-500/30"
                : "bg-white text-ink-subtle border-line"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${autoRouteEnabled ? "bg-brand-500 animate-pulse" : "bg-ink-subtle"}`} />
            <span>Auto-Routing Engine: {autoRouteEnabled ? "Active" : "Paused"}</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-4.5 shadow-xs">
          <span className="text-xs font-bold text-ink-subtle">Total Active Field Staff</span>
          <p className="mt-1 font-mono text-2xl font-extrabold text-ink">24 Agents</p>
          <span className="text-[0.6875rem] text-success font-medium">92% online capacity</span>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4.5 shadow-xs">
          <span className="text-xs font-bold text-ink-subtle">Avg Leads Handled / Agent</span>
          <p className="mt-1 font-mono text-2xl font-extrabold text-ink">13.2 Cases</p>
          <span className="text-[0.6875rem] text-ink-subtle">Balanced workload limit 20</span>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4.5 shadow-xs">
          <span className="text-xs font-bold text-ink-subtle">Avg Lead-to-Sanction Conversion</span>
          <p className="mt-1 font-mono text-2xl font-extrabold text-brand-600">68.9%</p>
          <span className="text-[0.6875rem] text-success font-medium">+4.2% this month</span>
        </div>
      </div>

      {/* Agent Roster Grid */}
      <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <h2 className="text-sm font-bold text-ink">Underwriting &amp; Lead Allocation Roster</h2>
          <span className="text-xs font-mono text-ink-subtle">Sorted by Capacity</span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {AGENTS.map((agent) => {
            const capacityPercent = Math.round((agent.activeCases / agent.maxCapacity) * 100);
            return (
              <div
                key={agent.id}
                className="rounded-xl border border-line/80 p-4 transition-all hover:border-line-strong hover:shadow-xs bg-bg-surface"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 font-bold text-xs">
                      <User size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-ink">{agent.name}</h3>
                      <p className="text-[0.625rem] text-ink-subtle">{agent.role}</p>
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-2 py-0.5 text-[0.625rem] font-bold ${
                      agent.status === "Online"
                        ? "bg-success-bg text-success border border-success/20"
                        : "bg-warning-bg text-warning border border-warning/20"
                    }`}
                  >
                    {agent.status}
                  </span>
                </div>

                <div className="mt-3.5 space-y-2 text-xs">
                  <div className="flex justify-between text-[0.6875rem]">
                    <span className="text-ink-subtle">Active Workload Capacity</span>
                    <span className="font-mono font-bold text-ink">
                      {agent.activeCases} / {agent.maxCapacity} Cases ({capacityPercent}%)
                    </span>
                  </div>

                  <div className="h-1.5 w-full rounded-full bg-bg-raised overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        capacityPercent > 80 ? "bg-warning" : "bg-brand-500"
                      }`}
                      style={{ width: `${capacityPercent}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-line/40 pt-2.5 text-[0.6875rem]">
                  <span className="text-ink-subtle">Territory: {agent.territory}</span>
                  <span className="font-mono font-bold text-success">
                    {agent.conversionRate}% Conversion
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
