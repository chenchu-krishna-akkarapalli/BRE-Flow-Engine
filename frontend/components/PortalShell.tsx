"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { HeaderErrorBoundary } from "@/components/HeaderErrorBoundary";
import { Sidebar } from "@/components/Sidebar";
import { useAuthStore } from "@/store/useAuthStore";

/**
 * Shell layout controller that handles:
 * 1. Conditionally hiding Sidebar and Header on public auth & registration pages (/auth/login, /new-channel, /health).
 * 2. Role-based client route protection and redirection.
 * 3. Scroll reset & sticky top bar preservation across client-side route transitions.
 */
export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentPath = pathname || "";
  const router = useRouter();
  const { isAuthenticated, role, tenantUuid, roleNodes } = useAuthStore();
  const isPublicPage = currentPath.startsWith("/auth") || currentPath === "/new-channel" || currentPath === "/health";

  const panelRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

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

  // Prevent scroll drift on client navigation: guarantee header remains pinned at (0, 0)
  useEffect(() => {
    if (panelRef.current) {
      panelRef.current.scrollTop = 0;
      panelRef.current.scrollLeft = 0;
    }
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    // If not authenticated and attempting to view internal workspace, redirect to login
    if (!isAuthenticated && !isPublicPage) {
      router.replace("/auth/login");
      return;
    }

    // If authenticated and on login page, redirect to scoped dashboard
    if (isAuthenticated && currentPath.startsWith("/auth")) {
      const isPlatform = role === "SUPER_ADMIN" || tenantUuid === "platform" || !tenantUuid;
      const defaultPlatformUuid = "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f";
      const activePlatformUuid = tenantUuid && tenantUuid !== "platform" ? tenantUuid : defaultPlatformUuid;
      const target = isPlatform ? `/${activePlatformUuid}/platformoverview` : `/${tenantUuid}/dashboard`;
      router.replace(target);
      return;
    }
  }, [isAuthenticated, isPublicPage, currentPath, router, tenantUuid, role]);

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

      {/* Main Workspace Panel Guard with strictly pinned Header */}
      <div ref={panelRef} className="flex min-w-0 flex-1 flex-col overflow-hidden h-full">
        <HeaderErrorBoundary>
          <div className="shrink-0 sticky top-0 z-30">
            <AppHeader />
          </div>
        </HeaderErrorBoundary>
        <main ref={mainRef} className="flex-1 overflow-y-auto min-w-0 flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
