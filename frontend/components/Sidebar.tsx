"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Building2,
  Clock,
  DollarSign,
  FileText,
  Layers,
  ShieldCheck,
  Sliders,
  User,
  UserCheck,
  X,
  Zap,
} from "lucide-react";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import { useSidebarStore } from "@/store/useSidebarStore";

export interface NavItem {
  name: string;
  href: string;
  icon: typeof Zap;
  badge?: string;
  badgeType?: "brand" | "warning" | "success" | "neutral" | "danger";
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAVIGATION_SECTIONS: NavSection[] = [
  {
    title: "Core Workflows",
    items: [
      {
        name: "Onboarding Wizard",
        href: "/",
        icon: FileText,
        badge: "Steps 1–6",
        badgeType: "brand",
      },
      {
        name: "Case Pipeline",
        href: "/pipeline",
        icon: Layers,
        badge: "Live",
        badgeType: "neutral",
      },
      {
        name: "Eligible Bank Matcher",
        href: "/matcher",
        icon: Zap,
        badge: "CRE Console",
        badgeType: "success",
      },
    ],
  },
  {
    title: "Management & Approvals",
    items: [
      {
        name: "Approval & Overrides",
        href: "/approvals",
        icon: ShieldCheck,
        badge: "5 Pending",
        badgeType: "warning",
      },
      {
        name: "Agent Assignment",
        href: "/assignments",
        icon: UserCheck,
        badge: "Matrix",
        badgeType: "neutral",
      },
    ],
  },
  {
    title: "Business & Analytics",
    items: [
      {
        name: "Telemetry Dashboard",
        href: "/telemetry",
        icon: BarChart3,
        badge: "Analytics",
        badgeType: "brand",
      },
      {
        name: "Commission & Ledgers",
        href: "/commissions",
        icon: DollarSign,
        badge: "₹ 4.82 Cr",
        badgeType: "success",
      },
      {
        name: "Regional Performance",
        href: "/regional",
        icon: Building2,
        badge: "14 Branches",
        badgeType: "neutral",
      },
    ],
  },
  {
    title: "Rule & System Settings",
    items: [
      {
        name: "CRE Rule Configurator",
        href: "/configurator",
        icon: Sliders,
        badge: "v2.4",
        badgeType: "brand",
      },
      {
        name: "API Health Monitor",
        href: "/health",
        icon: Activity,
        badge: "8/8 Online",
        badgeType: "success",
      },
    ],
  },
];

function BadgePill({
  text,
  type = "neutral",
}: {
  text: string;
  type?: "brand" | "warning" | "success" | "neutral" | "danger";
}) {
  const colorMap = {
    brand: "bg-brand-500/10 text-brand-600 border-brand-500/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    success: "bg-success/10 text-success border-success/20",
    neutral: "bg-bg-raised text-ink-subtle border-line",
    danger: "bg-danger/10 text-danger border-danger/20",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider ${colorMap[type]}`}
    >
      {text}
    </span>
  );
}

/**
 * Smart State Summary Widget (Miller's Law)
 * Compact collapsed summary card of the active applicant draft.
 */
function SmartStateSummary() {
  const draft = useOnboardingStore((s) => s.draft);
  const stepId = useOnboardingStore((s) => s.stepId);
  const result = useOnboardingStore((s) => s.result);

  const applicantDisplayName =
    draft.entityType === "Individual"
      ? draft.applicantName || "New Applicant"
      : draft.companyName || "New Company";

  const applicantIdentifier =
    draft.entityType === "Individual"
      ? draft.pan ? `PAN: ${draft.pan}` : "Awaiting PAN"
      : draft.companyPan ? `PAN: ${draft.companyPan}` : "Awaiting Co. PAN";

  const cibilScore = draft.bureauCibilScore || 750;

  return (
    <div className="mx-3 my-2 rounded-xl border border-line bg-white/80 p-3 shadow-xs backdrop-blur-md">
      <div className="flex items-center justify-between">
        <span className="text-[0.625rem] font-extrabold uppercase tracking-wider text-ink-subtle">
          Applicant Context
        </span>
        <span className="inline-flex items-center gap-1 text-[0.625rem] font-semibold text-brand-600">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
          Step {stepId}/6
        </span>
      </div>

      <div className="mt-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 font-bold text-xs">
            {draft.entityType === "Individual" ? <User size={14} /> : <Building2 size={14} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-ink" title={applicantDisplayName}>
              {applicantDisplayName}
            </p>
            <p className="truncate text-[0.625rem] font-mono text-ink-subtle">
              {draft.entityType} &bull; {applicantIdentifier}
            </p>
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-1.5 border-t border-line/60 pt-2 text-[0.625rem]">
          <div className="rounded bg-bg-raised/70 px-2 py-1">
            <span className="text-ink-subtle block text-[0.5625rem]">CIBIL Score</span>
            <span className="font-mono font-bold text-ink">{cibilScore}</span>
          </div>
          <div className="rounded bg-bg-raised/70 px-2 py-1">
            <span className="text-ink-subtle block text-[0.5625rem]">Status</span>
            <span className="font-bold text-brand-600">
              {result ? (result.overall_eligible ? "Eligible" : "Reviewed") : "Draft"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Real-time SLA Micro Ticker Widget
 */
function RealtimeSlaTicker() {
  return (
    <div className="mx-3 my-2 rounded-xl border border-warning/30 bg-warning/5 p-3 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[0.625rem] font-extrabold uppercase tracking-wider text-warning">
          <Clock size={12} />
          SLA Tracker
        </span>
        <span className="rounded-full bg-warning/20 px-1.5 py-0.2 text-[0.5625rem] font-bold text-warning">
          24h SLA
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <div>
          <span className="font-mono text-sm font-extrabold text-ink">4 Cases</span>
          <p className="text-[0.625rem] text-ink-muted">&lt; 3h deadline</p>
        </div>
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-warning/10 text-warning font-mono text-[0.6875rem] font-bold">
          !
        </div>
      </div>
    </div>
  );
}

/**
 * Sidebar Navigation Content Body (Shared between fixed desktop and slide-out mobile drawer)
 */
function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white/90 backdrop-blur-2xl">
      {/* Brand Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
        <Link href="/" onClick={onClose} className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-500 via-brand-indigo to-brand-violet text-white shadow-glow transition-transform group-hover:scale-105">
            <Zap size={18} fill="currentColor" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold tracking-tight text-base text-ink font-display">
                Flow<span className="text-gradient">BRE</span>
              </span>
              <span className="rounded-full bg-brand-500/10 px-1.5 py-0.2 text-[0.625rem] font-bold text-brand-600 border border-brand-500/20">
                Portal
              </span>
            </div>
            <p className="text-[0.625rem] font-medium text-ink-subtle">
              Multi-Bank Rule Engine
            </p>
          </div>
        </Link>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-subtle transition-all hover:bg-bg-raised hover:text-ink xl:hidden"
            aria-label="Close navigation sidebar"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3">
        <div className="space-y-4">
          {NAVIGATION_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="px-3 pb-1">
                <p className="text-[0.625rem] font-extrabold uppercase tracking-wider text-ink-subtle">
                  {section.title}
                </p>
              </div>

              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`group flex min-h-[48px] w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs transition-all duration-200 hover:scale-[1.01] ${
                        isActive
                          ? "border-l-2 border-brand-500 bg-gradient-to-r from-brand-500/10 to-brand-indigo/5 font-bold text-brand-600 shadow-xs"
                          : "text-ink-muted hover:bg-bg-raised hover:text-ink"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Icon
                          size={16}
                          className={`shrink-0 transition-colors ${
                            isActive
                              ? "text-brand-500"
                              : "text-ink-subtle group-hover:text-ink"
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

        {/* Dynamic Widgets */}
        <div className="mt-4 border-t border-line/60 pt-3">
          <SmartStateSummary />
          <RealtimeSlaTicker />
        </div>
      </div>

      {/* Footer System Status */}
      <div className="shrink-0 border-t border-line bg-white/50 p-3 backdrop-blur-md">
        <Link
          href="/health"
          onClick={onClose}
          className="flex items-center justify-between rounded-xl border border-line bg-white/80 px-3 py-2 shadow-xs hover:border-brand-500/30 transition-all group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            <span className="text-[0.6875rem] font-bold text-ink truncate group-hover:text-brand-600 transition-colors">
              8 Bank APIs Online
            </span>
          </div>
          <span className="rounded bg-success/10 px-1.5 py-0.5 text-[0.625rem] font-mono font-extrabold text-success">
            99.9%
          </span>
        </Link>
      </div>
    </div>
  );
}

/**
 * Responsive Navigation Sidebar
 * - Fixed persistent column on desktop displays (>= 1280px / xl:flex): w-[260px] shrink-0
 * - Slide-out overlay drawer on mobile & tablet displays (< 1280px / xl:hidden)
 */
export function Sidebar() {
  const isDrawerOpen = useSidebarStore((s) => s.isDrawerOpen);
  const closeDrawer = useSidebarStore((s) => s.closeDrawer);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isDrawerOpen) {
        closeDrawer();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen, closeDrawer]);

  return (
    <>
      {/* Persistent Fixed Desktop Column (xl and up) */}
      <aside className="hidden h-full w-[260px] shrink-0 flex-col border-r border-line bg-white/80 xl:flex">
        <SidebarContent />
      </aside>

      {/* Collapsible Mobile / Tablet Drawer (< 1280px) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex xl:hidden animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={closeDrawer}
            aria-hidden="true"
          />

          <aside
            className="relative flex h-full w-[280px] max-w-[85vw] shrink-0 flex-col border-r border-line bg-white shadow-2xl animate-in slide-in-from-left duration-300"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation Sidebar"
          >
            <SidebarContent onClose={closeDrawer} />
          </aside>
        </div>
      )}
    </>
  );
}
