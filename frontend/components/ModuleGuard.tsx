"use client";

import React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, Lock } from "lucide-react";
import { useModuleStore } from "@/store/useModuleStore";
import { useAuthStore } from "@/store/useAuthStore";

interface ModuleGuardProps {
  moduleCode: string;
  requiredPermission?: "view" | "create" | "edit" | "approve";
  children: React.ReactNode;
}

export default function ModuleGuard({
  moduleCode,
  requiredPermission = "view",
  children,
}: ModuleGuardProps) {
  const { role, tenantUuid } = useAuthStore();
  const { hasModule, canPerform } = useModuleStore();

  const isSuperAdmin = role === "SUPER_ADMIN";
  const isAuthorized =
    isSuperAdmin ||
    (hasModule(moduleCode) && canPerform(moduleCode, requiredPermission));

  if (!isAuthorized) {
    const homeHref = tenantUuid && tenantUuid !== "platform" ? `/${tenantUuid}/dashboard` : "/dashboard";

    return (
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center animate-fade-in">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-500/10 text-rose-600 border border-rose-500/20 shadow-glow">
          <ShieldAlert size={32} />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 font-mono text-[0.6875rem] font-bold uppercase text-rose-700 border border-rose-200">
            <Lock size={12} />
            <span>403 Access Restricted</span>
          </div>
          <h2 className="text-xl font-extrabold text-ink font-display">
            Module Not Entitled
          </h2>
          <p className="text-xs text-ink-subtle max-w-md">
            Your assigned role (<span className="font-bold text-ink font-mono">{role || "GUEST"}</span>) does not have operational permissions to access the{" "}
            <span className="font-bold text-ink font-mono">{moduleCode}</span> module.
          </p>
        </div>

        <Link
          href={homeHref}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-xs font-bold text-white shadow-glow hover:bg-brand-600 transition-all"
        >
          <ArrowLeft size={15} />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
