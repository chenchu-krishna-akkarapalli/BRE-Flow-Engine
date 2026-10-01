"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Mail,
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  User,
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useSidebarStore } from "@/store/useSidebarStore";
import { getTenantByUuidOrCode } from "@/lib/tenants-data";

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

export function AppHeader() {
  const pathname = usePathname();
  const currentPath = pathname || "";
  const router = useRouter();
  const toggleDrawer = useSidebarStore((s) => s.toggleDrawer);
  const { user, role, tenantUuid, logout } = useAuthStore();

  // User Profile Dropdown State
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // 1. Resolve active tenant UUID from pathname, store, or user profile
  const activeTenantUuid = (() => {
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

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
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
    if ((user as any)?.name) {
      const parts = (user as any).name.trim().split(/\s+/).filter(Boolean);
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    }
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

  return (
    <header className="h-[52px] border-b border-slate-200/80 bg-white sticky top-0 z-30 shadow-2xs shrink-0 px-4 sm:px-6 flex items-center justify-between gap-4 select-none">
      {/* Left: Mobile Drawer Trigger (< xl) */}
      <div className="flex items-center gap-2 min-w-0 shrink-0 xl:hidden">
        <button
          type="button"
          onClick={toggleDrawer}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 shrink-0 transition"
          aria-label="Toggle navigation drawer"
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>

      {/* Spacer to push actions cleanly to the right */}
      <div className="flex-1" />

      {/* Right: Divider + Mail, Bell + User Profile Dropdown */}
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

          {/* Account & Profile Dropdown */}
          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-52 rounded-xl bg-white border border-slate-200 shadow-xl py-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
              {/* Edit Profile Action Button (Navigates to Profile Page) */}
              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  const profileHref = activeTenantUuid ? `/${activeTenantUuid}/profile` : "/profile";
                  router.push(profileHref);
                }}
                className="w-full text-left px-3.5 py-2.5 text-slate-800 hover:bg-slate-50 flex items-center justify-between group transition border-b border-slate-100"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 transition truncate">
                      Edit Profile
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono uppercase truncate">
                      {role ? role.replace(/_/g, " ") : "User Profile"}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 group-hover:text-indigo-600 transition font-mono shrink-0 ml-1">
                  &rarr;
                </span>
              </button>

              {/* Sign Out Button */}
              <button
                type="button"
                onClick={handleLogout}
                className="w-full text-left px-3.5 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="font-medium text-xs">Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
