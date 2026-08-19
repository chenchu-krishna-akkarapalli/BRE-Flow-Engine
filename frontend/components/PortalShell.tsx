"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Sidebar } from "@/components/Sidebar";
import { useAuthStore } from "@/store/useAuthStore";

/**
 * Shell layout controller that handles:
 * 1. Conditionally hiding Sidebar and Header on public auth & registration pages (/auth/login, /new-channel, /health).
 * 2. Role-based client route protection and redirection.
 */
export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, role, tenantUuid, roleNodes } = useAuthStore();
  const isPublicPage = pathname.startsWith("/auth") || pathname === "/new-channel" || pathname === "/health";

  // Collect all authorized route paths for the user
  const authorizedPaths = useMemo(() => {
    if (!roleNodes || roleNodes.length === 0) return [];
    const paths: string[] = [];
    for (const group of roleNodes) {
      for (const item of group.items) {
        paths.push(item.href);
      }
    }
    return paths;
  }, [roleNodes]);

  useEffect(() => {
    // If not authenticated and attempting to view internal workspace, redirect to login
    if (!isAuthenticated && !isPublicPage) {
      router.replace("/auth/login");
      return;
    }

    // If authenticated and on login page, redirect to scoped dashboard
    if (isAuthenticated && pathname.startsWith("/auth")) {
      const isPlatform = role === "SUPER_ADMIN" || tenantUuid === "platform" || !tenantUuid;
      const target = isPlatform ? "/platform/dashboard" : `/${tenantUuid}/dashboard`;
      router.replace(target);
      return;
    }
  }, [isAuthenticated, isPublicPage, pathname, router, tenantUuid]);

  if (isPublicPage) {
    return (
      <main className="h-full w-full overflow-y-auto bg-bg-deep">
        {children}
      </main>
    );
  }

  return (
    <div className="relative flex h-full w-full overflow-hidden">
      {/* Subtle Ambient Light Backdrop Glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-brand-500/5 blur-[140px]" />
      <div className="pointer-events-none absolute top-1/3 -right-40 -z-10 h-[500px] w-[500px] rounded-full bg-brand-indigo/5 blur-[130px]" />

      {/* Persistent Fixed Desktop Sidebar (xl) & Slide-out Drawer (< xl) */}
      <Sidebar />

      {/* Main Workspace Panel Guard */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden h-full">
        <AppHeader />
        <main className="flex-1 overflow-y-auto min-w-0 flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
