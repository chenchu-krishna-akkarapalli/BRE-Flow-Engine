"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Building2,
  CheckCircle,
  CheckCircle2,
  CreditCard,
  Crown,
  DollarSign,
  FileText,
  GitPullRequest,
  LayoutDashboard,
  LucideIcon,
  MapPin,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useSidebarStore } from "@/store/useSidebarStore";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  Sliders,
  GitPullRequest,
  CheckCircle,
  CheckCircle2,
  CreditCard,
  MapPin,
  Activity,
  ShieldAlert,
  ShieldCheck,
  DollarSign,
  Shield,
  Building2,
  Zap,
};

function BadgePill({
  text,
  type = "neutral",
}: {
  text: string;
  type?: "brand" | "emerald" | "amber" | "rose" | "warning" | "success" | "neutral" | "danger";
}) {
  const colorMap: Record<string, string> = {
    brand: "bg-teal-50 text-teal-700 border-teal-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    neutral: "bg-slate-100 text-slate-600 border-slate-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[0.5625rem] font-mono font-bold uppercase tracking-wider ${
        colorMap[type] || colorMap.neutral
      }`}
    >
      {text}
    </span>
  );
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { role, tenantUuid, roleNodes, isAuthenticated } = useAuthStore();

  const homeHref = tenantUuid && tenantUuid !== "platform" ? `/${tenantUuid}` : "/";
  const isSuperAdmin = role === "SUPER_ADMIN" || role === "OPERATIONS_HEAD";

  // Hydrate full 3-category navigation schema if roleNodes not yet loaded
  const navSections = useMemo(() => {
    if (roleNodes && roleNodes.length > 0) {
      return roleNodes;
    }
    const prefix = tenantUuid && tenantUuid !== "platform" ? `/${tenantUuid}` : "";
    return [
      {
        title: "Portal Navigation",
        items: [
          { name: "Dashboard", href: `${prefix}/dashboard` || "/dashboard", icon: "LayoutDashboard" },
          { name: "Onboarding Wizard", href: prefix || "/", icon: "FileText", badge: "Steps 1–6", badgeType: "brand" as const },
          { name: "User Management", href: `${prefix}/assignments` || "/assignments", icon: "Users" },
          { name: "Analytics", href: `${prefix}/telemetry` || "/telemetry", icon: "BarChart3" },
          { name: "Settings", href: `${prefix}/configurator` || "/configurator", icon: "Sliders" },
        ],
      },
      {
        title: "Operations & Sales",
        items: [
          { name: "Sales Pipeline", href: `${prefix}/pipeline` || "/pipeline", icon: "GitPullRequest" },
          { name: "Approvals", href: `${prefix}/approvals` || "/approvals", icon: "CheckCircle", badge: "Underwriting", badgeType: "emerald" as const },
          { name: "Commissions", href: `${prefix}/commissions` || "/commissions", icon: "CreditCard" },
          { name: "Regional Hierarchy", href: `${prefix}/regional` || "/regional", icon: "MapPin" },
        ],
      },
      {
        title: "Platform Governance",
        items: [
          { name: "Platform Overview", href: "/platform/dashboard", icon: "Crown", badge: "Owner", badgeType: "amber" as const },
          { name: "Live Logs & Audit", href: `${prefix}/logs` || "/logs", icon: "Activity", badge: "Live", badgeType: "amber" as const },
          { name: "Database Health", href: "/platform/db-health", icon: "Activity" },
          { name: "Cyber Security Cell", href: "/platform/cyber-cell", icon: "ShieldAlert", badge: "SOC", badgeType: "rose" as const },
          { name: "Platform Billing", href: "/platform/billing", icon: "DollarSign" },
        ],
      },
    ];
  }, [roleNodes, tenantUuid]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white/95 backdrop-blur-2xl">
      {/* Brand Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
        <Link href={homeHref} onClick={onClose} className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs transition-transform group-hover:scale-105">
            <Zap size={18} className="text-teal-400" fill="currentColor" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold tracking-tight text-base text-slate-900 font-display">
                Flow<span className="text-teal-600">BRE</span>
              </span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[0.5625rem] font-mono font-bold text-slate-600 border border-slate-200">
                {tenantUuid && tenantUuid !== "platform" ? "Tenant" : "UAS"}
              </span>
            </div>
            <p className="text-[0.625rem] font-medium text-slate-500 truncate max-w-[130px]">
              {tenantUuid && tenantUuid !== "platform" ? tenantUuid : "Decision Engine Core"}
            </p>
          </div>
        </Link>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-900 xl:hidden"
            aria-label="Close navigation sidebar"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Platform Master Console Banner for Super Admins */}
      {isSuperAdmin && (
        <div className="px-3 pt-3">
          <Link
            href="/platform/dashboard"
            onClick={onClose}
            className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition-all border ${
              pathname.startsWith("/platform")
                ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <div className="flex items-center gap-2">
              <Crown size={14} className={pathname.startsWith("/platform") ? "text-amber-400" : "text-amber-600"} />
              <span>Platform Console</span>
            </div>
            <span className="text-[0.5625rem] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
              Master
            </span>
          </Link>
        </div>
      )}

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3">
        <div className="space-y-4">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="px-3 pb-1">
                <p className="text-[0.625rem] font-extrabold uppercase tracking-wider text-slate-400">
                  {section.title}
                </p>
              </div>

              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = ICON_MAP[item.icon] || Zap;
                  const isRootLink = item.href === "/" || (tenantUuid && item.href === `/${tenantUuid}`);
                  
                  // Precision active link matching without false-positive prefix leaks
                  const isActive = isRootLink
                    ? pathname === "/" || (Boolean(tenantUuid) && pathname === `/${tenantUuid}`)
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`group flex min-h-[44px] w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all duration-150 ${
                        isActive
                          ? "bg-slate-900 text-white font-bold shadow-xs"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Icon
                          size={15}
                          className={`shrink-0 transition-colors ${
                            isActive ? "text-teal-400" : "text-slate-400 group-hover:text-slate-700"
                          }`}
                        />
                        <span className="truncate">{item.name}</span>
                      </div>

                      {item.badge && (
                        <div className="shrink-0 ml-1.5">
                          <BadgePill text={item.badge} type={item.badgeType} />
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer System Status */}
      <div className="shrink-0 border-t border-line bg-white/70 p-3 backdrop-blur-md">
        <Link
          href="/health"
          onClick={onClose}
          className="flex items-center justify-between rounded-xl border border-line bg-white px-3 py-2 shadow-xs hover:border-slate-300 transition-all group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[0.6875rem] font-bold text-slate-800 truncate group-hover:text-teal-600 transition-colors">
              Health Monitor
            </span>
          </div>
          <span className="font-mono text-[0.625rem] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
            99.98% SLA
          </span>
        </Link>
      </div>
    </div>
  );
}

export function Sidebar() {
  const isDrawerOpen = useSidebarStore((s) => s.isDrawerOpen);
  const closeDrawer = useSidebarStore((s) => s.closeDrawer);

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden h-screen w-[260px] shrink-0 border-r border-line bg-white/80 backdrop-blur-md xl:block">
        <SidebarContent />
      </aside>

      {/* Mobile Backdrop & Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex xl:hidden animate-fade-in">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={closeDrawer}
          />
          <div className="relative z-50 h-full w-[280px] max-w-[85vw] bg-white shadow-2xl animate-slide-in">
            <SidebarContent onClose={closeDrawer} />
          </div>
        </div>
      )}
    </>
  );
}
