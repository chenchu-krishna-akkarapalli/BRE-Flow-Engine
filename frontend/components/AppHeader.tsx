"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Building2,
  ChevronRight,
  Crown,
  ExternalLink,
  LogIn,
  LogOut,
  Menu,
  Shield,
  ShieldCheck,
  User,
  Zap,
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useSidebarStore } from "@/store/useSidebarStore";

const ROUTE_TITLES: Record<string, { title: string; subtitle: string; category: string }> = {
  "/": {
    title: "Onboarding Wizard",
    subtitle: "Instant Multi-Bank Polymorphic Onboarding & Eligibility Wizard",
    category: "Core Workflows",
  },
  "/dashboard": {
    title: "Executive Dashboard",
    subtitle: "Real-time Multi-Bank Pipeline, Throughput & Telemetry Metrics",
    category: "Operations",
  },
  "/pipeline": {
    title: "Sales Pipeline",
    subtitle: "Real-time 7-stage loan origination pipeline and priority queues",
    category: "Core Workflows",
  },
  "/approvals": {
    title: "Underwriting Exception Queue",
    subtitle: "Manual sign-off desk for FOIR overrides, CIBIL overlays & waivers",
    category: "Underwriting",
  },
  "/assignments": {
    title: "User Management & Role Assignments",
    subtitle: "Manage channel team members, RBAC roles & operational hierarchy",
    category: "Team & Access",
  },
  "/telemetry": {
    title: "Telemetry & Latency Engine",
    subtitle: "Microsecond profiling, SLA breach alerts (> 400ms) & error traces",
    category: "Observability",
  },
  "/commissions": {
    title: "Commission & Payout Ledgers",
    subtitle: "Financial reconciliation, payout slabs & partner commission tracker",
    category: "Finance & Ledgers",
  },
  "/regional": {
    title: "Regional Sales Hierarchy",
    subtitle: "Branch-level quota matrices, volume targets & area directors",
    category: "Regional Sales",
  },
  "/configurator": {
    title: "BRE Policy Configurator",
    subtitle: "Dynamic policy threshold configuration without code deployment",
    category: "Rule Engine",
  },
  "/logs": {
    title: "Live API Logs & Audit Stream",
    subtitle: "Immutable telemetry feed capturing API latencies & audit records",
    category: "Observability",
  },
  "/new-channel": {
    title: "Channel Partner Registration",
    subtitle: "Self-serve tenant provisioning with isolated dynamic UUID routing",
    category: "Channel Operations",
  },
  "/platform/dashboard": {
    title: "Platform Master Overview & Approval Queue",
    subtitle: "Omni-tenant governance console tracking tenant health, SLAs & provisioning",
    category: "Platform Governance",
  },
  "/platform/db-health": {
    title: "Database Infrastructure & Pool Health",
    subtitle: "Real-time asyncpg connection pooling & PostgreSQL latency SLAs",
    category: "Platform Infrastructure",
  },
  "/platform/cyber-cell": {
    title: "Cyber Security Operations Center (SOC)",
    subtitle: "PDF upload firewall, rate limiting & anti-tampering guards",
    category: "Platform Security",
  },
  "/platform/billing": {
    title: "Multi-Tenant Platform Billing & SaaS Tiers",
    subtitle: "Global billing ledgers, SaaS tier subscriptions & usage invoices",
    category: "Platform Finance",
  },
  "/health": {
    title: "API Health & Diagnostics Monitor",
    subtitle: "Live telemetry and uptime tracking across 8 partner bank endpoints",
    category: "System Health",
  },
};

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SUPER_ADMIN: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/30" },
  OPERATIONS_HEAD: { bg: "bg-indigo-500/10", text: "text-indigo-600", border: "border-indigo-500/30" },
  CHANNEL_ADMIN: { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500/30" },
  TRANSACTIONAL_USER: { bg: "bg-teal-500/10", text: "text-teal-600", border: "border-teal-500/30" },
};

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const toggleDrawer = useSidebarStore((s) => s.toggleDrawer);
  const { user, role, tenantUuid, isAuthenticated, logout } = useAuthStore();

  // Normalize tenant-scoped paths (e.g. /e4d9b2a1-87c3.../pipeline -> /pipeline)
  const normalizedPath = (() => {
    if (tenantUuid && pathname.startsWith(`/${tenantUuid}`)) {
      const rest = pathname.slice(`/${tenantUuid}`.length);
      return rest === "" ? "/" : rest;
    }
    // Also handle dynamic UUID prefix pattern if tenantUuid is not yet set
    const match = pathname.match(/^\/[a-zA-Z0-9_-]{8,36}(\/.*)?$/);
    if (match && !pathname.startsWith("/platform") && !pathname.startsWith("/auth") && !pathname.startsWith("/new-channel") && !pathname.startsWith("/health")) {
      return match[1] || "/";
    }
    return pathname;
  })();

  const routeInfo = ROUTE_TITLES[normalizedPath] || ROUTE_TITLES[pathname] || {
    title: "FlowBRE Portal",
    subtitle: "Multi-Bank Rule Evaluation & Decision Engine",
    category: "Workspace",
  };

  const isPlatformScope = role === "SUPER_ADMIN" || pathname.startsWith("/platform");
  const roleStyle = role ? ROLE_COLORS[role] || { bg: "bg-slate-500/10", text: "text-slate-600", border: "border-slate-500/30" } : null;

  const handleLogout = () => {
    logout();
    router.push("/auth/login");
  };

  return (
    <header className="border-b border-line bg-white/95 backdrop-blur-xl sticky top-0 z-30 shadow-xs shrink-0">
      <div className="mx-auto flex w-full max-w-[var(--shell-max)] items-center justify-between px-4 sm:px-6 py-3">
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
            <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs">
              <Zap size={17} className="text-teal-400" fill="currentColor" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-ink-subtle">
                <span className="font-semibold text-slate-500">{routeInfo.category}</span>
                <ChevronRight size={12} />
                {tenantUuid && tenantUuid !== "platform" && (
                  <>
                    <span className="rounded-md bg-teal-50 px-1.5 py-0.5 text-[0.625rem] font-mono font-bold text-teal-700 border border-teal-200 truncate max-w-[120px]">
                      🏢 {tenantUuid.slice(0, 10)}...
                    </span>
                    <ChevronRight size={12} />
                  </>
                )}
                <span className="font-extrabold text-ink font-display truncate">
                  {routeInfo.title}
                </span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[0.625rem] font-bold text-emerald-700 border border-emerald-200 hidden md:inline">
                  v2.4 Live
                </span>
              </div>
              <p className="text-xs text-ink-subtle font-medium hidden sm:block truncate mt-0.5">
                {routeInfo.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Authenticated User Pill + Health Badge */}
        <div className="flex items-center gap-2.5 shrink-0">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2.5 bg-slate-50 border border-line rounded-xl px-3 py-1.5 text-xs">
              <div className="h-7 w-7 rounded-lg bg-slate-900 flex items-center justify-center text-teal-400 font-bold text-xs shadow-xs">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-ink truncate max-w-[130px]">{user.username}</span>
                  {role && roleStyle && (
                    <span className={`text-[0.5625rem] font-mono font-bold px-1.5 py-0.5 rounded border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}>
                      {role}
                    </span>
                  )}
                </div>
                <span className="text-[0.5625rem] text-ink-subtle font-mono">
                  {tenantUuid === "platform" || !tenantUuid ? "👑 Platform Owner Scope" : `🏢 /${tenantUuid.slice(0, 12)}...`}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Log out of UAS"
                className="ml-1 p-1.5 rounded-lg text-ink-subtle hover:text-rose-600 hover:bg-rose-50 transition"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="flex items-center gap-1.5 rounded-xl border border-slate-900 bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition"
            >
              <LogIn size={14} />
              <span>Login to UAS</span>
            </Link>
          )}

          {/* Clickable System Health Pill */}
          <Link
            href="/health"
            className="hidden md:flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition shadow-xs"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>8 Bank APIs Online</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
