"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Mail,
  Bell,
  Moon,
  ChevronDown,
  LogOut,
  Menu,
  X,
  FileText,
  LayoutDashboard,
  GitPullRequest,
  CheckCircle2,
  Users,
  CreditCard,
  Activity,
  Building2,
  ShieldCheck,
  ShieldAlert,
  Crown,
  Sliders,
  Database,
  User,
  CornerDownLeft,
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useSidebarStore } from "@/store/useSidebarStore";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import { getTenantByUuidOrCode } from "@/lib/tenants-data";

interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  category: "System Modules" | "Applications & Leads" | "Policies & Rules" | "Quick Actions";
  href: string;
  icon: any;
  badge?: string;
  badgeColor?: string;
  keywords: string[];
}

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const toggleDrawer = useSidebarStore((s) => s.toggleDrawer);
  const { user, role, tenantUuid, logout } = useAuthStore();
  const draft = useOnboardingStore((s) => s.draft);
  const stepId = useOnboardingStore((s) => s.stepId);

  // Search Engine States
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // User Profile Dropdown State
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // 1. Resolve active tenant UUID from pathname, store, or user profile
  const activeTenantUuid = (() => {
    const match = pathname.match(/^\/([a-zA-Z0-9_-]{8,36})(\/.*)?$/);
    if (
      match &&
      !pathname.startsWith("/platform") &&
      !pathname.startsWith("/auth") &&
      !pathname.startsWith("/new-channel") &&
      !pathname.startsWith("/health")
    ) {
      return match[1];
    }
    if (tenantUuid && tenantUuid !== "platform") {
      return tenantUuid;
    }
    if (user?.tenant_id && user.tenant_id !== "platform") {
      return user.tenant_id;
    }
    return null;
  })();

  // 2. Resolve channel name with fallback tiers (local registry -> API -> email heuristic)
  const [channelName, setChannelName] = useState<string | null>(() => {
    if (activeTenantUuid) {
      const record = getTenantByUuidOrCode(activeTenantUuid);
      if (record?.name) return record.name;
    }
    if (user?.email?.includes("@boi.com") || user?.username?.includes("boi.com")) {
      return "Bank of India Channel";
    }
    return null;
  });

  useEffect(() => {
    let isMounted = true;
    if (!activeTenantUuid) {
      if (user?.email?.includes("@boi.com") || user?.username?.includes("boi.com")) {
        setChannelName("Bank of India Channel");
      }
      return;
    }

    const localRecord = getTenantByUuidOrCode(activeTenantUuid);
    if (localRecord?.name) {
      setChannelName(localRecord.name);
      return;
    }

    fetch(`/api/v1/tenants/${activeTenantUuid}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.name) {
          setChannelName(data.name);
        }
      })
      .catch(() => {
        if (isMounted && (user?.email?.includes("@boi.com") || user?.username?.includes("boi.com"))) {
          setChannelName("Bank of India Channel");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeTenantUuid, user?.email, user?.username]);

  // 3. Construct Unified Search Catalog
  const basePrefix = activeTenantUuid ? `/${activeTenantUuid}` : "";

  const allSearchItems = useMemo<SearchResultItem[]>(() => {
    const items: SearchResultItem[] = [
      // --- System Modules ---
      {
        id: "module-dashboard",
        title: "Executive Dashboard",
        subtitle: "Real-time pipeline metrics, SLA health & decision throughput",
        category: "System Modules",
        href: `${basePrefix}/dashboard` || "/dashboard",
        icon: LayoutDashboard,
        badge: "Module",
        badgeColor: "bg-teal-50 text-teal-700 border-teal-200",
        keywords: ["module", "modules", "dashboard", "metrics", "overview", "executive", "home", "analytics", "kpi"],
      },
      {
        id: "module-wizard",
        title: "Onboarding Wizard",
        subtitle: "Instant 6-step multi-bank loan application & credit evaluation",
        category: "System Modules",
        href: `${basePrefix}?step=1` || "/?step=1",
        icon: FileText,
        badge: "Module",
        badgeColor: "bg-brand-500/10 text-brand-600 border-brand-500/20",
        keywords: ["module", "modules", "onboarding", "wizard", "apply", "application", "form", "step", "income", "salary", "loan"],
      },
      {
        id: "module-pipeline",
        title: "Sales & Origination Pipeline",
        subtitle: "7-stage loan origination pipeline, lead statuses & priority queues",
        category: "System Modules",
        href: `${basePrefix}/pipeline` || "/pipeline",
        icon: GitPullRequest,
        badge: "Module",
        badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
        keywords: ["module", "modules", "pipeline", "sales", "leads", "cases", "sourcing", "underwriting", "sanctioned", "disbursed", "origination"],
      },
      {
        id: "module-approvals",
        title: "Underwriting & Approval Queue",
        subtitle: "Exception sign-off desk for FOIR waivers, CIBIL overlays & manual overrides",
        category: "System Modules",
        href: `${basePrefix}/approvals` || "/approvals",
        icon: CheckCircle2,
        badge: "Module",
        badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
        keywords: ["module", "modules", "approvals", "underwriting", "exceptions", "queue", "foir", "cibil", "override", "waiver", "manual", "underwriter"],
      },
      {
        id: "module-assignments",
        title: "User Management & Role Assignments",
        subtitle: "Channel team members, operational hierarchy, and RBAC assignments",
        category: "System Modules",
        href: `${basePrefix}/assignments` || "/assignments",
        icon: Users,
        badge: "Module",
        badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
        keywords: ["module", "modules", "users", "assignments", "user management", "team", "roles", "agents", "managers", "rbac", "hierarchy"],
      },
      {
        id: "module-commissions",
        title: "Commission & Disbursal Ledgers",
        subtitle: "Financial reconciliation, partner payout slabs & commission tracker",
        category: "System Modules",
        href: `${basePrefix}/commissions` || "/commissions",
        icon: CreditCard,
        badge: "Module",
        badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
        keywords: ["module", "modules", "commissions", "disbursal", "payout", "finance", "ledgers", "slabs", "partner"],
      },
      {
        id: "module-platform-overview",
        title: "Platform Overview",
        subtitle: "Ecosystem control room & multi-channel operational matrix",
        category: "System Modules",
        href: `${basePrefix}/platformoverview` || "/platformoverview",
        icon: Crown,
        badge: "Module",
        badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
        keywords: ["module", "modules", "platform overview", "platform", "overview", "governance", "control room"],
      },
      {
        id: "module-manager-studio",
        title: "Dynamic Module Manager Studio",
        subtitle: "Configure custom navigation modules, role entitlements & matrix",
        category: "System Modules",
        href: "/platform/modules",
        icon: Sliders,
        badge: "Module",
        badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
        keywords: ["module", "modules", "module manager", "studio", "catalog", "matrix", "entitlements", "navigation"],
      },
      {
        id: "module-telemetry",
        title: "Telemetry & Latency Engine",
        subtitle: "Microsecond profiling, SLA breach alerts (> 400ms) & error traces",
        category: "System Modules",
        href: `${basePrefix}/telemetry` || "/telemetry",
        icon: Activity,
        badge: "Module",
        badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
        keywords: ["module", "modules", "telemetry", "latency", "sla", "profiling", "breach", "ram", "performance", "timing"],
      },
      {
        id: "module-logs",
        title: "Live API Logs & Audit Stream",
        subtitle: "Immutable telemetry feed capturing API latencies & audit records",
        category: "System Modules",
        href: `${basePrefix}/logs` || "/logs",
        icon: Activity,
        badge: "Module",
        badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
        keywords: ["module", "modules", "logs", "audit", "security", "stream", "api", "traces", "requests", "errors"],
      },
      {
        id: "module-health",
        title: "API Health & Diagnostics Monitor",
        subtitle: "Live telemetry and uptime tracking across 8 partner bank endpoints",
        category: "System Modules",
        href: "/health",
        icon: ShieldCheck,
        badge: "Module",
        badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
        keywords: ["module", "modules", "health", "api", "diagnostics", "endpoints", "uptime", "status", "banks"],
      },
      {
        id: "module-cyber-cell",
        title: "Cyber Cell Threat Matrix",
        subtitle: "Real-time security events, intrusion defense and anomaly telemetry",
        category: "System Modules",
        href: "/platform/cyber-cell",
        icon: ShieldAlert,
        badge: "Module",
        badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
        keywords: ["module", "modules", "cyber", "threat", "security", "defense", "anomalies", "matrix"],
      },
      {
        id: "module-db-health",
        title: "Database Health & Pools",
        subtitle: "Postgres connection pools, buffer cache hit rates & lock telemetry",
        category: "System Modules",
        href: "/platform/db-health",
        icon: Database,
        badge: "Module",
        badgeColor: "bg-cyan-50 text-cyan-700 border-cyan-200",
        keywords: ["module", "modules", "database", "db", "postgres", "replication", "cache", "pools", "sql"],
      },

      // --- Applications & Leads ---
      {
        id: "lead-9821",
        title: "LD-9821 — Ananya Deshmukh",
        subtitle: "Auto Loan • ₹12,50,000 • CIBIL: 785 • Stage: Underwriting",
        category: "Applications & Leads",
        href: `${basePrefix}/pipeline?lead=LD-9821` || "/pipeline",
        icon: User,
        badge: "Priority High",
        badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
        keywords: ["ananya", "deshmukh", "ld-9821", "9821", "auto loan", "underwriting", "785", "lead"],
      },
      {
        id: "lead-9822",
        title: "LD-9822 — Apex Logistics LLP",
        subtitle: "Commercial Vehicle • ₹45,00,000 • CIBIL: 742 • Stage: Data Enrichment",
        category: "Applications & Leads",
        href: `${basePrefix}/pipeline?lead=LD-9822` || "/pipeline",
        icon: Building2,
        badge: "Commercial",
        badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
        keywords: ["apex", "logistics", "ld-9822", "9822", "commercial vehicle", "enrichment", "742", "lead"],
      },
      {
        id: "lead-9823",
        title: "LD-9823 — Rohan Verma",
        subtitle: "Personal Loan • ₹5,00,000 • CIBIL: 690 • Stage: Sourcing",
        category: "Applications & Leads",
        href: `${basePrefix}/pipeline?lead=LD-9823` || "/pipeline",
        icon: User,
        badge: "Sourcing",
        badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
        keywords: ["rohan", "verma", "ld-9823", "9823", "personal loan", "sourcing", "690", "lead"],
      },
      {
        id: "lead-9824",
        title: "LD-9824 — Sunil Kumar",
        subtitle: "Home Loan • ₹65,00,000 • CIBIL: 810 • Stage: Sanctioned",
        category: "Applications & Leads",
        href: `${basePrefix}/pipeline?lead=LD-9824` || "/pipeline",
        icon: User,
        badge: "Sanctioned",
        badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
        keywords: ["sunil", "kumar", "ld-9824", "9824", "home loan", "sanctioned", "810", "lead"],
      },
      {
        id: "lead-9825",
        title: "LD-9825 — Kavita Reddy",
        subtitle: "Auto Loan • ₹8,50,000 • CIBIL: 765 • Stage: Disbursed",
        category: "Applications & Leads",
        href: `${basePrefix}/pipeline?lead=LD-9825` || "/pipeline",
        icon: User,
        badge: "Disbursed",
        badgeColor: "bg-teal-50 text-teal-700 border-teal-200",
        keywords: ["kavita", "reddy", "ld-9825", "9825", "auto loan", "disbursed", "765", "lead"],
      },

      // --- Policies & Rules ---
      {
        id: "policy-hdfc",
        title: "HDFC Bank Policy Matrix",
        subtitle: "FOIR Tier-1 limits (65%), min CIBIL 700, salary cutoff ₹25k",
        category: "Policies & Rules",
        href: `${basePrefix}/configurator` || "/configurator",
        icon: Building2,
        badge: "Policy Matrix",
        badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
        keywords: ["hdfc", "policy", "matrix", "foir", "salary", "tier-1", "cutoff", "threshold"],
      },
      {
        id: "policy-icici",
        title: "ICICI CRE Wealth Rules",
        subtitle: "High-value commercial rules, CIBIL overlay +15, property matrices",
        category: "Policies & Rules",
        href: `${basePrefix}/configurator` || "/configurator",
        icon: Building2,
        badge: "Commercial",
        badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
        keywords: ["icici", "cre", "commercial", "wealth", "overlay", "valuation"],
      },
      {
        id: "policy-sbi",
        title: "State Bank of India (SBI) Matrix",
        subtitle: "Government employee concessions, prime home loan FOIR up to 70%",
        category: "Policies & Rules",
        href: `${basePrefix}/configurator` || "/configurator",
        icon: Building2,
        badge: "Mortgage",
        badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
        keywords: ["sbi", "state bank", "government", "concession", "prime", "home loan"],
      },

      // --- Quick Actions ---
      {
        id: "action-new-application",
        title: "Start New Loan Application",
        subtitle: "Launch polymorphic applicant onboarding form (Step 1)",
        category: "Quick Actions",
        href: `${basePrefix}?step=1` || "/?step=1",
        icon: FileText,
        badge: "Action",
        badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
        keywords: ["action", "new", "start", "create", "applicant", "application", "loan"],
      },
      {
        id: "action-check-health",
        title: "Run Bank API Health Check",
        subtitle: "Immediate ping evaluation across partner endpoints",
        category: "Quick Actions",
        href: "/health",
        icon: ShieldCheck,
        badge: "Action",
        badgeColor: "bg-teal-50 text-teal-700 border-teal-200",
        keywords: ["action", "health", "ping", "test", "status", "uptime"],
      },
    ];

    // Prepend active in-memory application draft if exists
    if (draft?.applicantName || draft?.pan) {
      items.unshift({
        id: "active-draft-application",
        title: `Active Draft: ${draft.applicantName || "In-Progress Application"}`,
        subtitle: `PAN: ${draft.pan || "Pending"} • Resume Step ${stepId || 1}`,
        category: "Applications & Leads",
        href: `${basePrefix}?step=${stepId || 1}`,
        icon: FileText,
        badge: "In-Memory Draft",
        badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
        keywords: ["draft", "active", "lead", draft.applicantName || "", draft.pan || "", draft.phone || ""],
      });
    }

    return items;
  }, [basePrefix, draft, stepId]);

  // Filtered Results - strictly empty when no search query typed
  const filteredResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      return [];
    }
    return allSearchItems
      .filter((item) => {
        return (
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.keywords.some((k) => k.toLowerCase().includes(q))
        );
      })
      .slice(0, 10);
  }, [searchQuery, allSearchItems]);

  // Dropdown popover is ONLY visible when user has actually typed something
  const hasTypedQuery = searchQuery.trim().length > 0;
  const isDropdownVisible = isSearchOpen && hasTypedQuery;

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Keyboard navigation & global ⌘K shortcut
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      // ⌘K or Ctrl+K to open & focus search
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        if (searchQuery.trim().length > 0) {
          setIsSearchOpen(true);
        }
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [searchQuery]);

  // Keyboard controls within search input
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownVisible && hasTypedQuery && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setIsSearchOpen(true);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filteredResults.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % filteredResults.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (filteredResults.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + filteredResults.length) % filteredResults.length);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filteredResults[selectedIndex];
      if (target) {
        handleSelectItem(target);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsSearchOpen(false);
      searchInputRef.current?.blur();
    }
  };

  const handleSelectItem = (item: SearchResultItem) => {
    router.push(item.href);
    setIsSearchOpen(false);
    setSearchQuery("");
    searchInputRef.current?.blur();
  };

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsSearchOpen(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  const avatarInitials = (() => {
    if (role === "SUPER_ADMIN") return "SA";
    if (role === "TEAM_LEADER") return "TE";
    if (role === "SALES_MANAGER") return "SM";
    if (role === "CHANNEL_ADMIN") return "CA";
    if (user?.username) {
      const parts = user.username.split(/[._@\s-]+/).filter(Boolean);
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return user.username.slice(0, 2).toUpperCase();
    }
    return "TE";
  })();

  const brandLinkHref = activeTenantUuid
    ? `/${activeTenantUuid}/dashboard`
    : "/dashboard";

  return (
    <header className="h-[52px] border-b border-slate-200/80 bg-white sticky top-0 z-30 shadow-2xs shrink-0 px-4 sm:px-6 flex items-center justify-between gap-4 select-none">
      {/* Left: Mobile Drawer Trigger + Channel Name / Brand */}
      <div className="flex items-center gap-2.5 min-w-0 shrink-0">
        {/* Mobile Navigation Drawer Trigger (< xl) */}
        <button
          type="button"
          onClick={toggleDrawer}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 xl:hidden shrink-0 transition"
          aria-label="Toggle navigation drawer"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Brand Lockup Link */}
        <Link href={brandLinkHref} className="flex items-center gap-2.5 min-w-0 group">
          {/* FlowBRE Geometric Hexagon Logo */}
          <div className="h-8 w-8 rounded-lg bg-slate-950 flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-105">
            <svg
              className="h-4.5 w-4.5 text-emerald-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path
                d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
                fill="rgba(16, 185, 129, 0.2)"
              />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
            </svg>
          </div>

          {/* Dynamic: Channel Name who logged in, or FlowBRE / Console fallback */}
          {channelName ? (
            <span
              className="font-bold text-[16px] sm:text-[17px] tracking-tight text-slate-950 font-display truncate max-w-[180px] sm:max-w-xs md:max-w-sm"
              title={channelName}
            >
              {channelName}
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-bold text-[17px] tracking-tight text-slate-950 font-display">
                Flow<span className="text-emerald-500">BRE</span>
              </span>
              <span className="text-slate-300 font-light text-base select-none">/</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200/60">
                Console
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Center: Functional Quick Search Engine */}
      <div className="flex-1 max-w-sm mx-2 sm:mx-6 relative" ref={searchContainerRef}>
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Quick search..."
            value={searchQuery}
            onFocus={() => {
              if (searchQuery.trim().length > 0) {
                setIsSearchOpen(true);
              }
            }}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              setIsSearchOpen(val.trim().length > 0);
            }}
            onKeyDown={handleInputKeyDown}
            className="w-full bg-slate-50/80 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-lg pl-8.5 pr-14 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition shadow-2xs"
            aria-autocomplete="list"
            aria-expanded={isDropdownVisible}
          />
          {/* Quick Clear or ⌘K Hint */}
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setIsSearchOpen(false);
                searchInputRef.current?.focus();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 transition"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono text-slate-400 bg-slate-100 border border-slate-200 rounded absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
              ⌘K
            </kbd>
          )}
        </div>

        {/* Search Results Dropdown Popover - ONLY rendered if user types */}
        {isDropdownVisible && (
          <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200/90 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 max-h-[390px] flex flex-col">
            <div className="px-3 py-1.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-medium">
              <span>Results for &ldquo;{searchQuery}&rdquo;</span>
              <span className="hidden sm:inline">Use ↑ ↓ to navigate, ↵ to select</span>
            </div>

            <div className="overflow-y-auto divide-y divide-slate-50 p-1 flex-1">
              {filteredResults.length > 0 ? (
                filteredResults.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  const IconComponent = item.icon || FileText;

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectItem(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg cursor-pointer transition ${
                        isSelected
                          ? "bg-slate-100 text-slate-900 border-l-2 border-emerald-500 pl-2.5"
                          : "hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected ? "bg-emerald-500 text-white shadow-xs" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <IconComponent className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.badge && (
                          <span
                            className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                              item.badgeColor || "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                        {isSelected && (
                          <CornerDownLeft className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">
                  <p>No matching modules or records found for &ldquo;{searchQuery}&rdquo;.</p>
                  <p className="text-[10px] text-slate-400 mt-1">Try searching for &quot;module&quot;, &quot;dashboard&quot;, &quot;pipeline&quot;, or &quot;approvals&quot;.</p>
                </div>
              )}
            </div>

            <div className="px-3 py-1.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>{filteredResults.length} matching result{filteredResults.length === 1 ? "" : "s"}</span>
              <span>ESC to close</span>
            </div>
          </div>
        )}
      </div>

      {/* Right: Divider + Mail, Bell, Moon + User Profile Dropdown */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Subtle Vertical Divider */}
        <div className="h-5 w-[1px] bg-slate-200 hidden sm:block mr-1" />

        {/* Message / Mail Icon with Green Badge */}
        <button
          type="button"
          className="relative p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
          aria-label="Messages"
        >
          <Mail className="w-4 h-4" />
          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-white" />
        </button>

        {/* Notification Bell Icon with Red Badge */}
        <button
          type="button"
          className="relative p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>

        {/* Moon / Theme Toggle Icon */}
        <button
          type="button"
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
          aria-label="Toggle theme"
        >
          <Moon className="w-4 h-4" />
        </button>

        {/* User Profile Pill Avatar & Chevron Dropdown */}
        <div className="relative ml-0.5" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-1 p-0.5 rounded-lg hover:bg-slate-100 transition"
            aria-label="User profile menu"
            aria-expanded={isUserMenuOpen}
          >
            <div className="h-7 w-7 rounded-md bg-slate-950 text-white flex items-center justify-center font-bold text-[11px] font-mono tracking-tight shadow-xs">
              {avatarInitials}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          </button>

          {/* Account & Logout Dropdown */}
          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white border border-slate-200 shadow-xl py-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="font-semibold text-slate-900 truncate">
                  {user?.username || "Channel User"}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  {role || "TEAM_LEADER"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
