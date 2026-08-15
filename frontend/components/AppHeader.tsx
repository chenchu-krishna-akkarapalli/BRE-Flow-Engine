"use client";

import { usePathname } from "next/navigation";
import { ChevronRight, Menu, Zap } from "lucide-react";
import { useSidebarStore } from "@/store/useSidebarStore";

const ROUTE_TITLES: Record<string, { title: string; subtitle: string; category: string }> = {
  "/": {
    title: "Onboarding Wizard",
    subtitle: "Instant Multi-Bank Onboarding & Eligibility Wizard",
    category: "Core Workflows",
  },
  "/pipeline": {
    title: "Case Pipeline",
    subtitle: "Real-time loan applications status & stage pipeline",
    category: "Core Workflows",
  },
  "/matcher": {
    title: "Eligible Bank Matcher",
    subtitle: "CRE Engine multi-lender comparison & eligibility simulation",
    category: "Core Workflows",
  },
  "/approvals": {
    title: "Approval & Override Queue",
    subtitle: "Manual sign-off desk for non-terminating rule deviations",
    category: "Management & Approvals",
  },
  "/assignments": {
    title: "Agent Assignment Matrix",
    subtitle: "Lead allocation & workload balancing for underwriting agents",
    category: "Management & Approvals",
  },
  "/telemetry": {
    title: "Telemetry & Decision Analytics",
    subtitle: "Rule pass/fail metrics, rejection code telemetry & API latencies",
    category: "Business & Analytics",
  },
  "/commissions": {
    title: "Commission & Disbursal Ledgers",
    subtitle: "Financial reconciliation, payout slabs & bank commission tracker",
    category: "Business & Analytics",
  },
  "/regional": {
    title: "Regional Performance & SLA",
    subtitle: "Branch-level conversion matrices & turnaround time benchmarking",
    category: "Business & Analytics",
  },
  "/configurator": {
    title: "CRE Rule Engine Configurator",
    subtitle: "Dynamic policy threshold configuration without code deployment",
    category: "Rule & System Settings",
  },
  "/health": {
    title: "API Health & Diagnostics Monitor",
    subtitle: "Live telemetry and uptime tracking across 8 partner bank endpoints",
    category: "Rule & System Settings",
  },
};

export function AppHeader() {
  const pathname = usePathname();
  const toggleDrawer = useSidebarStore((s) => s.toggleDrawer);

  const routeInfo = ROUTE_TITLES[pathname] || {
    title: "FlowBRE Portal",
    subtitle: "Multi-Bank Rule Evaluation System",
    category: "Workspace",
  };

  return (
    <header className="border-b border-line bg-white/90 backdrop-blur-xl sticky top-0 z-30 shadow-xs shrink-0">
      <div className="mx-auto flex w-full max-w-[var(--shell-max)] items-center justify-between px-4 sm:px-6 py-3.5">
        {/* Left: Mobile Drawer Trigger + Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={toggleDrawer}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-ink shadow-xs transition-all hover:border-line-strong hover:bg-bg-raised xl:hidden"
            aria-label="Toggle navigation drawer"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-2.5 min-w-0">
            <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-500 via-brand-indigo to-brand-violet text-white shadow-glow">
              <Zap size={18} fill="currentColor" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-ink-subtle">
                <span className="font-semibold">{routeInfo.category}</span>
                <ChevronRight size={12} />
                <span className="font-extrabold text-ink font-display truncate">
                  {routeInfo.title}
                </span>
                <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[0.625rem] font-bold text-brand-600 border border-brand-500/20 hidden md:inline">
                  v2.4 Live
                </span>
              </div>
              <p className="text-xs text-ink-subtle font-medium hidden sm:block truncate">
                {routeInfo.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Right: API Status Badge */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="flex items-center gap-1.5 rounded-full border border-success/30 bg-success-bg px-3 py-1 text-xs font-bold text-success">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="hidden sm:inline">8 Bank APIs</span> Online
          </span>
        </div>
      </div>
    </header>
  );
}
