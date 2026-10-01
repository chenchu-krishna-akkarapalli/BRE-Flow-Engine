"use client";

import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getTenantByUuidOrCode, INITIAL_TENANTS, TenantRecord } from "@/lib/tenants-data";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  Check,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Crown,
  Database,
  DollarSign,
  ExternalLink,
  FileText,
  FolderLock,
  GitPullRequest,
  HelpCircle,
  Layers,
  LayoutDashboard,
  Lock,
  LucideIcon,
  Mail,
  MapPin,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Radio,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useSidebarStore } from "@/store/useSidebarStore";
import { useModuleStore, DynamicNavItem, DynamicNavSection } from "@/store/useModuleStore";
import { useRoleHierarchyStore, INITIAL_USERS, TenantUser } from "@/store/useRoleHierarchyStore";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  Sliders,
  Settings,
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
  Bell,
  Database,
  FolderLock,
  Layers,
  Lock,
  Radio,
  Sparkles,
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

function getUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return (name[0] || "U").toUpperCase();
}

const ROLE_ORDER: Record<string, number> = {
  SUPER_ADMIN: 0,
  REGIONAL_DIRECTOR: 1,
  OPERATIONS_HEAD: 1,
  ACCOUNTS_HEAD: 1,
  AREA_MANAGER: 2,
  TEAM_LEADER: 3,
  SALES_MANAGER: 4,
  CHANNEL_ADMIN: 5,
  TRANSACTIONAL_USER: 6,
};

function getRoleBadge(role: string): { label: string; className: string } {
  const norm = (role || "").toUpperCase();
  switch (norm) {
    case "SUPER_ADMIN":
      return { label: "Super Admin", className: "bg-purple-50 text-purple-700 border-purple-200/80" };
    case "REGIONAL_DIRECTOR":
      return { label: "Regional Director", className: "bg-indigo-50 text-indigo-700 border-indigo-200/80" };
    case "AREA_MANAGER":
      return { label: "Area Manager", className: "bg-violet-50 text-violet-700 border-violet-200/80" };
    case "TEAM_LEADER":
      return { label: "Team Leader", className: "bg-blue-50 text-blue-700 border-blue-200/80" };
    case "SALES_MANAGER":
      return { label: "Sales Manager", className: "bg-teal-50 text-teal-700 border-teal-200/80" };
    case "CHANNEL_ADMIN":
      return { label: "Channel Admin", className: "bg-emerald-50 text-emerald-700 border-emerald-200/80" };
    case "TRANSACTIONAL_USER":
      return { label: "Loan Officer", className: "bg-slate-50 text-slate-600 border-slate-200/80" };
    default:
      return {
        label: role ? role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : "Member",
        className: "bg-slate-50 text-slate-600 border-slate-200/80",
      };
  }
}

const KNOWN_STATIC_ROUTES = new Set([
  "assignments",
  "dashboard",
  "pipeline",
  "approvals",
  "commissions",
  "configurator",
  "telemetry",
  "logs",
  "platformoverview",
  "profile",
  "regional",
  "platform",
  "auth",
  "new-channel",
  "health",
  "login",
]);

function checkItemActive(itemHref: string, currentPath: string, homeHref: string): boolean {
  if (!itemHref || !currentPath) return false;

  const cleanItem = itemHref.replace(/\/+$/, "") || "/";
  const cleanPath = currentPath.replace(/\/+$/, "") || "/";
  const cleanHome = homeHref.replace(/\/+$/, "") || "/";

  // Exact route match
  if (cleanPath === cleanItem) return true;

  // Root or Home/Onboarding link must never prefix-match other modules
  if (cleanItem === "/" || cleanItem === cleanHome) {
    return cleanPath === cleanItem;
  }

  // Nested sub-routes match (e.g. /pipeline/lead-123 under /pipeline)
  return cleanPath.startsWith(`${cleanItem}/`);
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const currentPath = pathname || "";
  const [optimisticPath, setOptimisticPath] = useState<string | null>(null);

  // Sync / clear optimistic path whenever actual pathname changes
  useEffect(() => {
    setOptimisticPath(null);
  }, [pathname]);

  const activePath = optimisticPath || currentPath;

  const handleItemClick = useCallback(
    (href: string) => {
      setOptimisticPath(href);
      if (onClose) onClose();
    },
    [onClose]
  );

  const router = useRouter();
  const { user, role, tenantUuid, roleNodes, setSession } = useAuthStore();
  const sections = useModuleStore((s) => s.sections);

  // Sidebar Store
  const {
    isCollapsed,
    toggleCollapsed,
    expandedSections,
    toggleSection,
    searchQuery,
    setSearchQuery,
    clearSearch,
    isTenantMenuOpen,
    setTenantMenuOpen,
    toggleTenantMenu,
  } = useSidebarStore();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const tenantMenuRef = useRef<HTMLDivElement>(null);

  // 1. Resolve active tenant UUID from pathname, store, or user profile
  const activeTenantUuid = (() => {
    if ((role === "CHANNEL_ADMIN" || role === "TRANSACTIONAL_USER") && (user?.tenant_id || tenantUuid)) {
      return user?.tenant_id || tenantUuid;
    }
    const match = currentPath.match(/^\/([a-zA-Z0-9_-]{8,36})(\/.*)?$/);
    if (
      match &&
      !KNOWN_STATIC_ROUTES.has(match[1].toLowerCase()) &&
      !currentPath.startsWith("/platform") &&
      !currentPath.startsWith("/auth") &&
      !currentPath.startsWith("/new-channel") &&
      !currentPath.startsWith("/health")
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

  const effectiveTenantUuid = activeTenantUuid || "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f";

  // User Management Team Users
  const roleHierarchyUsers = useRoleHierarchyStore((s) => s.users);
  const fetchRoleUsers = useRoleHierarchyStore((s) => s.fetchUsers);
  const canSeeUser = useRoleHierarchyStore((s) => s.canSeeUser);

  useEffect(() => {
    if (effectiveTenantUuid) {
      fetchRoleUsers(effectiveTenantUuid);
    }
  }, [effectiveTenantUuid, fetchRoleUsers]);

  const teamUsers = useMemo(() => {
    const pool = roleHierarchyUsers && roleHierarchyUsers.length > 0 ? roleHierarchyUsers : INITIAL_USERS;

    // Filter users matching effective tenant
    const matched = pool.filter((u) => {
      const uTenant = u.tenantId || (u as any).tenant_id;
      if (!uTenant) return false;
      if (uTenant === effectiveTenantUuid) return true;
      const tenantA = getTenantByUuidOrCode(uTenant);
      const tenantB = getTenantByUuidOrCode(effectiveTenantUuid);
      if (tenantA && tenantB && tenantA.id === tenantB.id) return true;
      return false;
    });

    const displayList = matched.length > 0 ? matched : INITIAL_USERS.filter((u) => {
      const uTenant = u.tenantId;
      if (uTenant === effectiveTenantUuid) return true;
      const tenantA = getTenantByUuidOrCode(uTenant);
      const tenantB = getTenantByUuidOrCode(effectiveTenantUuid);
      return tenantA && tenantB && tenantA.id === tenantB.id;
    });

    const candidateList = displayList.length > 0 ? displayList : pool;

    // Filter by role hierarchy visibility (cannot see superiors, e.g. Regional Director cannot see Super Admin)
    const visibleList = candidateList.filter((u) => canSeeUser(role, u.role));

    // Sort strictly according to role hierarchy rank (Senior -> Junior)
    return [...visibleList].sort((a, b) => {
      const rankA = ROLE_ORDER[a.role.toUpperCase()] ?? 99;
      const rankB = ROLE_ORDER[b.role.toUpperCase()] ?? 99;
      if (rankA !== rankB) return rankA - rankB;
      return a.name.localeCompare(b.name);
    });
  }, [roleHierarchyUsers, effectiveTenantUuid, canSeeUser, role]);

  // 2. Resolve channel name with fallback tiers
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

  // Click outside listener for tenant dropdown menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tenantMenuRef.current && !tenantMenuRef.current.contains(event.target as Node)) {
        setTenantMenuOpen(false);
      }
    }
    if (isTenantMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isTenantMenuOpen, setTenantMenuOpen]);

  // Global keyboard shortcut: Cmd+K / Ctrl+K to focus search input
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isCollapsed) {
          toggleCollapsed();
        }
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleCollapsed();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCollapsed, toggleCollapsed]);

  const homeHref = activeTenantUuid
    ? `/${activeTenantUuid}`
    : tenantUuid && tenantUuid !== "platform"
    ? `/${tenantUuid}`
    : effectiveTenantUuid
    ? `/${effectiveTenantUuid}`
    : "/";

  // Navigation Data Structure
  const { topFlatItems, collapsibleSections } = useMemo(() => {
    const prefix = activeTenantUuid
      ? `/${activeTenantUuid}`
      : tenantUuid && tenantUuid !== "platform"
      ? `/${tenantUuid}`
      : effectiveTenantUuid
      ? `/${effectiveTenantUuid}`
      : "";
    const defaultPlatformUuid = "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f";
    const platformUuid = activeTenantUuid || (tenantUuid && tenantUuid !== "platform" ? tenantUuid : defaultPlatformUuid);

    type NormalizedItem = {
      code?: string;
      name: string;
      href: string;
      icon: string;
      badge?: string;
      badgeType?: "brand" | "emerald" | "amber" | "rose" | "warning" | "success" | "neutral" | "danger";
    };

    type NormalizedSection = {
      title: string;
      sectionKey?: string;
      items: NormalizedItem[];
    };

    let rawSections: NormalizedSection[] = [];
    if (sections && sections.length > 0) {
      rawSections = sections;
    } else if (roleNodes && roleNodes.length > 0) {
      rawSections = roleNodes;
    } else {
      rawSections = [
        {
          title: "Portal Navigation",
          sectionKey: "portal",
          items: [
            { code: "DASHBOARD", name: "Dashboard", href: `${prefix}/dashboard` || "/dashboard", icon: "LayoutDashboard" },
            { code: "ONBOARDING", name: "Onboarding Wizard", href: prefix || "/", icon: "FileText", badge: "Steps 1–6", badgeType: "brand" },
            { code: "USER_MGMT", name: "User Management", href: `${prefix}/assignments` || "/assignments", icon: "Users" },
          ],
        },
        {
          title: "COMPLIANCE & UNDERWRITING",
          sectionKey: "compliance",
          items: [
            { code: "APPROVALS", name: "Approvals & Risk", href: `${prefix}/approvals` || "/approvals", icon: "ShieldCheck", badge: "Underwriting", badgeType: "emerald" },
            { code: "CIBIL", name: "Credit Bureau Rules", href: `${prefix}/configurator` || "/configurator", icon: "Shield" },
            { code: "TELEMETRY", name: "Risk Telemetry", href: `${prefix}/telemetry` || "/telemetry", icon: "Activity" },
          ],
        },
        {
          title: "OPERATIONS & SALES",
          sectionKey: "operations",
          items: [
            { code: "PIPELINE", name: "Sales Pipeline", href: `${prefix}/pipeline` || "/pipeline", icon: "GitPullRequest" },
            { code: "COMMISSIONS", name: "Commissions", href: `${prefix}/commissions` || "/commissions", icon: "CreditCard" },
          ],
        },
        {
          title: "ORGANIZATION & PLATFORM",
          sectionKey: "governance",
          items: [
            { code: "PLATFORM_OVERVIEW", name: "Platform Overview", href: `/${platformUuid}/platformoverview`, icon: "Crown", badge: "Owner", badgeType: "amber" },
            { code: "LOGS", name: "Live Logs & Audit", href: `${prefix}/logs` || "/logs", icon: "Activity", badge: "Live", badgeType: "amber" },
          ],
        },
      ];
    }

    // Isolate top flat items (Dashboard & Onboarding Wizard)
    const topItems: NormalizedItem[] = [
      { code: "DASHBOARD", name: "Dashboard", href: `${prefix}/dashboard` || "/dashboard", icon: "LayoutDashboard" },
      { code: "ONBOARDING", name: "Onboarding Wizard", href: prefix || "/", icon: "FileText", badge: "Steps 1–6", badgeType: "brand" },
    ];

    // Filter out top items from sections to prevent duplication
    const dropdownGroups: { title: string; sectionKey: string; icon: string; items: NormalizedItem[] }[] = [];

    const sectionIconMap: Record<string, string> = {
      compliance: "Shield",
      operations: "GitPullRequest",
      governance: "Building2",
      portal: "Users",
    };

    rawSections.forEach((sec, idx) => {
      const remainingItems = sec.items.filter(
        (it) => it.name !== "Dashboard" && it.name !== "Onboarding Wizard"
      );

      if (remainingItems.length > 0) {
        let secKey = sec.sectionKey || `section-${idx}`;
        let iconName = "Shield";
        const lowerTitle = sec.title.toLowerCase();
        if (lowerTitle.includes("operation") || lowerTitle.includes("sales") || lowerTitle.includes("pipeline")) {
          iconName = "GitPullRequest";
        } else if (lowerTitle.includes("govern") || lowerTitle.includes("org") || lowerTitle.includes("platform")) {
          iconName = "Building2";
        } else if (lowerTitle.includes("monitor") || lowerTitle.includes("audit") || lowerTitle.includes("log")) {
          iconName = "Activity";
        } else if (lowerTitle.includes("portal") || lowerTitle.includes("user")) {
          iconName = "Users";
        }

        dropdownGroups.push({
          title: sec.title.toUpperCase(),
          sectionKey: secKey,
          icon: iconName,
          items: remainingItems,
        });
      }
    });

    return { topFlatItems: topItems, collapsibleSections: dropdownGroups };
  }, [sections, roleNodes, tenantUuid, activeTenantUuid, effectiveTenantUuid]);

  // Search Filter Computation
  const query = searchQuery.trim().toLowerCase();

  const filteredTopItems = useMemo(() => {
    if (!query) return topFlatItems;
    return topFlatItems.filter(
      (it) => it.name.toLowerCase().includes(query) || (it.badge && it.badge.toLowerCase().includes(query))
    );
  }, [topFlatItems, query]);

  const filteredDropdownGroups = useMemo(() => {
    if (!query) return collapsibleSections;
    return collapsibleSections
      .map((group) => {
        const matchingItems = group.items.filter(
          (it) =>
            it.name.toLowerCase().includes(query) ||
            (it.badge && it.badge.toLowerCase().includes(query)) ||
            group.title.toLowerCase().includes(query)
        );
        return {
          ...group,
          items: matchingItems,
        };
      })
      .filter((group) => group.items.length > 0);
  }, [collapsibleSections, query]);

  const hasAnyResults = filteredTopItems.length > 0 || filteredDropdownGroups.length > 0;

  // Handler to switch tenant from dropdown
  const handleSelectTenant = useCallback(
    (tenant: TenantRecord) => {
      setTenantMenuOpen(false);
      if (onClose) onClose();
      router.push(`/${tenant.tenant_uuid}/dashboard`);
    },
    [router, setTenantMenuOpen, onClose]
  );

  return (
    <div
      onScroll={(e) => {
        if (e.currentTarget.scrollTop !== 0) e.currentTarget.scrollTop = 0;
      }}
      className="flex h-full flex-col overflow-hidden bg-white/95 backdrop-blur-2xl select-none"
    >
      {/* 1. Header: Workspace / Tenant Switcher */}
      <div
        className={`relative flex h-14 shrink-0 items-center border-b border-line px-3 ${
          isCollapsed ? "justify-center" : "justify-between"
        }`}
      >
        {/* Workspace / Tenant Trigger & Header Block */}
        <div
          ref={tenantMenuRef}
          className={isCollapsed ? "flex items-center justify-center w-full" : "relative min-w-0 flex-1"}
        >
          {isCollapsed ? (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/80 shadow-2xs transition group"
              title="Expand sidebar (Ctrl+B)"
              aria-label="Expand sidebar"
            >
              <PanelLeft size={16} className="text-slate-500 group-hover:text-slate-900 transition-transform group-hover:scale-105" />
            </button>
          ) : (
            <div
              className={`group flex items-center gap-2 rounded-lg p-1.5 transition-colors text-left ${
                isTenantMenuOpen ? "bg-slate-100" : "hover:bg-slate-100/80"
              }`}
            >
              {/* Logo Mark */}
              <button
                type="button"
                onClick={toggleTenantMenu}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white shadow-xs shrink-0 transition-transform hover:scale-105"
                title="Click to switch organization or channel"
              >
                {channelName ? (
                  <Building2 size={15} className="text-emerald-400" />
                ) : (
                  <Zap size={15} className="text-teal-400" fill="currentColor" />
                )}
              </button>

              {/* Label and Dropdown Chevron + Role with Resize Button */}
              <div className="min-w-0 flex-1">
                {/* Row 1: Channel Name + Chevron + Resize Button in the white space */}
                <div className="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={toggleTenantMenu}
                    className="flex items-center gap-1.5 text-left min-w-0 group/tenant"
                    title="Click to switch organization or channel"
                  >
                    <span className="font-extrabold tracking-tight text-xs text-slate-900 font-display truncate group-hover/tenant:text-teal-600 transition-colors">
                      {channelName || "FlowBRE"}
                    </span>
                    <ChevronDown
                      size={13}
                      className={`text-slate-400 transition-transform duration-200 shrink-0 ${
                        isTenantMenuOpen ? "rotate-180 text-slate-700" : "group-hover/tenant:text-slate-600"
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onClose) onClose();
                      else toggleCollapsed();
                    }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/80 border border-slate-200/80 shadow-2xs transition shrink-0 ml-1.5 -mr-1"
                    title="Resize / Collapse sidebar (Ctrl+B)"
                    aria-label="Resize sidebar"
                  >
                    <PanelLeftClose size={16} />
                  </button>
                </div>
                {/* Row 2: Role Name */}
                <p className="text-[0.625rem] font-medium text-slate-400 truncate mt-0.5">
                  {role ? role.replace(/_/g, " ") : "Credit Rule Engine"}
                </p>
              </div>
            </div>
          )}

          {/* User Management & Team Popover Menu */}
          {isTenantMenuOpen && (
            <div
              className={`z-50 rounded-2xl border border-line bg-white/98 shadow-2xl backdrop-blur-xl animate-fade-in p-2 ${
                isCollapsed
                  ? "fixed left-[76px] top-3 w-[250px]"
                  : "absolute left-0 top-12 w-[236px]"
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-2 py-1.5 border-b border-line mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-teal-50 text-teal-600 border border-teal-200/80 shrink-0">
                    <Users size={11} />
                  </div>
                  <span className="text-[0.6875rem] font-bold tracking-tight text-slate-800 font-display truncate">
                    Team Directory
                  </span>
                </div>
                <span className="rounded-full bg-teal-50 px-1.5 py-0.5 text-[0.5625rem] font-mono font-bold text-teal-700 border border-teal-200 shrink-0">
                  {teamUsers.length} Users
                </span>
              </div>

              {/* Users Cards List */}
              <div className="max-h-72 overflow-y-auto space-y-1.5 py-0.5 pr-0.5">
                {teamUsers.map((u) => {
                  const initials = getUserInitials(u.name);
                  return (
                    <div
                      key={u.id}
                      className="group rounded-xl border border-slate-100 hover:border-teal-200/80 bg-slate-50/50 hover:bg-white p-2 transition-all shadow-2xs hover:shadow-xs space-y-1.5"
                    >
                      {/* Top: Avatar, Name & Role, Action Buttons */}
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="relative shrink-0">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-700 font-bold text-xs ring-1 ring-teal-200/80 shadow-2xs">
                              {initials}
                            </div>
                            {u.status === "ACTIVE" && (
                              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-1.5 ring-white" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold text-slate-800 leading-tight">
                              {u.name}
                            </p>
                            {(() => {
                              const badge = getRoleBadge(u.role);
                              return (
                                <div className="mt-0.5">
                                  <span
                                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold border ${badge.className}`}
                                  >
                                    {badge.label}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Action Buttons: Email & Static WhatsApp */}
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Direct Email Action Button */}
                          <a
                            href={`mailto:${u.email}`}
                            className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-800 border border-indigo-200/70 shadow-2xs transition"
                            title={`Send Email to ${u.email}`}
                            aria-label={`Send Email to ${u.email}`}
                          >
                            <Mail size={11} />
                          </a>

                          {/* Static WhatsApp Logo Button */}
                          <span
                            className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200/70 shadow-2xs transition cursor-default"
                            title="WhatsApp"
                            aria-label="WhatsApp"
                          >
                            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.842-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                            </svg>
                          </span>
                        </div>
                      </div>

                      {/* Bottom: Clickable Mail Link with Address */}
                      <a
                        href={`mailto:${u.email}`}
                        className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-teal-700 font-mono truncate transition pt-1 border-t border-slate-100 group-hover:border-slate-200/60"
                        title={`Click to email ${u.email}`}
                      >
                        <Mail size={10} className="text-slate-400 group-hover:text-teal-600 shrink-0" />
                        <span className="truncate">{u.email}</span>
                      </a>
                    </div>
                  );
                })}
              </div>

              {/* Footer link to open User Management */}
              <div className="mt-1.5 border-t border-line pt-1">
                <Link
                  href={`/${effectiveTenantUuid}/assignments`}
                  scroll={false}
                  onClick={() => {
                    setTenantMenuOpen(false);
                    if (onClose) onClose();
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-teal-800 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <Users size={12} className="text-teal-600" />
                    <span>Open User Management</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400">&rarr;</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Drawer Close (X) Button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-900 xl:hidden shrink-0"
            aria-label="Close navigation sidebar"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* 2. Search Bar Component */}
      {!isCollapsed ? (
        <div className="px-3 pt-2.5 pb-1 shrink-0">
          <div className="relative flex items-center">
            <Search size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-lg border border-line bg-slate-50/60 py-1.5 pl-8 pr-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-teal-500/20 transition-all font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2.5 flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                title="Clear search"
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex justify-center py-2 shrink-0">
          <button
            type="button"
            onClick={toggleCollapsed}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            title="Search"
          >
            <Search size={15} />
          </button>
        </div>
      )}

      {/* 3. Navigation Items Scroll Area */}
      <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-4">
        {/* A. Flat Primary Items (Dashboard, Documents / Wizard) */}
        {filteredTopItems.length > 0 && (
          <div className="space-y-0.5">
            {filteredTopItems.map((item) => {
              const Icon = ICON_MAP[item.icon] || Zap;
              const isActive = checkItemActive(item.href, activePath, homeHref);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  scroll={false}
                  onMouseDown={() => setOptimisticPath(item.href)}
                  onClick={() => handleItemClick(item.href)}
                  title={item.name}
                  className={`group flex items-center rounded-lg text-xs font-medium transition-colors duration-100 ${
                    isCollapsed ? "h-9 w-9 mx-auto justify-center" : "min-h-[36px] w-full justify-between px-2.5 py-1.5"
                  } ${
                    isActive
                      ? "bg-teal-50/80 text-teal-800 font-semibold border border-teal-200/80 shadow-2xs"
                      : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Icon
                      size={15}
                      className={`shrink-0 transition-colors ${
                        isActive ? "text-teal-600" : "text-slate-400 group-hover:text-slate-700"
                      }`}
                    />
                    {!isCollapsed && <span className="truncate">{item.name}</span>}
                  </div>

                  {!isCollapsed && item.badge && (
                    <div className="shrink-0 ml-1.5">
                      <BadgePill text={item.badge} type={item.badgeType} />
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {/* B. Hierarchical Collapsible Dropdown Sections (Tree Guides) */}
        {filteredDropdownGroups.map((group) => {
          const SectionIcon = ICON_MAP[group.icon] || Shield;
          // Auto-expand if search query matches, else use store state (default true)
          const isExpanded = query ? true : expandedSections[group.sectionKey] !== false;
          const hasActiveChild = group.items.some((item) =>
            checkItemActive(item.href, activePath, homeHref)
          );

          return (
            <div key={group.sectionKey} className="space-y-0.5">
              {/* Section Header Accordion Trigger */}
              {!isCollapsed ? (
                <button
                  type="button"
                  onClick={() => toggleSection(group.sectionKey)}
                  className={`group flex w-full items-center justify-between rounded-md px-2 py-1 text-left transition-colors ${
                    hasActiveChild ? "bg-slate-100/70 hover:bg-slate-100/90" : "hover:bg-slate-100/60"
                  }`}
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <SectionIcon
                      size={13}
                      className={`shrink-0 transition-colors ${
                        hasActiveChild
                          ? "text-slate-800"
                          : "text-slate-500 group-hover:text-slate-800"
                      }`}
                    />
                    <span
                      className={`text-[0.625rem] font-bold uppercase tracking-wider truncate transition-colors ${
                        hasActiveChild
                          ? "text-slate-800"
                          : "text-slate-500 group-hover:text-slate-800"
                      }`}
                    >
                      {group.title}
                    </span>
                  </div>
                  <ChevronDown
                    size={12}
                    className={`transition-transform duration-200 shrink-0 ${
                      hasActiveChild
                        ? "text-slate-700"
                        : "text-slate-400 group-hover:text-slate-700"
                    } ${isExpanded ? "rotate-0" : "-rotate-90"}`}
                  />
                </button>
              ) : (
                <div className="flex justify-center py-1">
                  <div className="h-px w-5 bg-line" />
                </div>
              )}

              {/* Nested Children Items with Connecting Tree Line */}
              {isExpanded && (
                <div
                  className={`${
                    isCollapsed
                      ? "space-y-1"
                      : `ml-3.5 pl-3 border-l ${
                          hasActiveChild ? "border-slate-600" : "border-slate-500"
                        } py-0.5 space-y-0.5 transition-colors duration-150`
                  }`}
                >
                  {group.items.map((item) => {
                    const ItemIcon = ICON_MAP[item.icon] || Zap;
                    const isActive = checkItemActive(item.href, activePath, homeHref);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        scroll={false}
                        onMouseDown={() => setOptimisticPath(item.href)}
                        onClick={() => handleItemClick(item.href)}
                        title={item.name}
                        className={`group flex items-center rounded-lg text-xs font-medium transition-colors duration-100 ${
                          isCollapsed
                            ? "h-9 w-9 mx-auto justify-center"
                            : "min-h-[32px] w-full justify-between px-2 py-1"
                        } ${
                          isActive
                            ? "bg-teal-50/80 text-teal-800 font-semibold border border-teal-200/70"
                            : "text-slate-600 hover:bg-slate-100/60 hover:text-slate-900"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          {isCollapsed && (
                            <ItemIcon
                              size={14}
                              className={`shrink-0 ${
                                isActive ? "text-teal-600" : "text-slate-400 group-hover:text-slate-700"
                              }`}
                            />
                          )}
                          {!isCollapsed && <span className="truncate">{item.name}</span>}
                        </div>

                        {!isCollapsed && item.badge && (
                          <div className="shrink-0 ml-1.5">
                            <BadgePill text={item.badge} type={item.badgeType} />
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Empty Search Fallback */}
        {query && !hasAnyResults && (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-slate-500 font-medium">No links matching &ldquo;{searchQuery}&rdquo;</p>
            <button
              type="button"
              onClick={clearSearch}
              className="mt-2 text-xs font-semibold text-teal-600 hover:text-teal-700"
            >
              Clear search
            </button>
          </div>
        )}
      </div>



      {/* Footer Brand Lockup */}
      <div className="shrink-0 border-t border-line bg-white/70 p-2.5 backdrop-blur-md">
        <div
          className={`flex items-center rounded-xl border border-line bg-white px-2.5 py-2 shadow-2xs ${
            isCollapsed ? "justify-center" : "justify-start"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-600 text-white font-black text-[0.6875rem] shadow-2xs shrink-0">
              DF
            </div>
            {!isCollapsed && (
              <span className="text-xs font-bold text-slate-800 truncate font-display tracking-tight">
                debt factory
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const isDrawerOpen = useSidebarStore((s) => s.isDrawerOpen);
  const closeDrawer = useSidebarStore((s) => s.closeDrawer);
  const isCollapsed = useSidebarStore((s) => s.isCollapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);
  const { role, tenantUuid } = useAuthStore();
  const fetchModules = useModuleStore((s) => s.fetchModules);

  // Single parent-level dynamic modules hydration
  useEffect(() => {
    fetchModules(role, tenantUuid);
  }, [role, tenantUuid, fetchModules]);

  return (
    <>
      {/* Desktop Persistent Sidebar (Expands/Collapses smoothly) */}
      <aside
        onScroll={(e) => {
          if (e.currentTarget.scrollTop !== 0) e.currentTarget.scrollTop = 0;
        }}
        className={`relative hidden h-screen shrink-0 border-r border-line bg-white/80 backdrop-blur-md transition-[width] duration-200 ease-in-out xl:block ${
          isCollapsed ? "w-[68px]" : "w-[260px]"
        }`}
      >
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
