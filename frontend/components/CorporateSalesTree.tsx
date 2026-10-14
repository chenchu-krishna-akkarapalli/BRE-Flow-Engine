"use client";

import React, { useMemo } from "react";
import {
  Building,
  Building2,
  Briefcase,
  ChevronDown,
  CreditCard,
  Cpu,
  Globe,
  Info,
  Layers,
  Lock,
  Network,
  Shield,
  ShieldCheck,
  User,
  UserCheck,
  Users,
} from "lucide-react";
import {
  RoleHierarchyNode,
  useRoleHierarchyStore,
} from "@/store/useRoleHierarchyStore";
import { useAuthStore } from "@/store/useAuthStore";

function getRoleIcon(roleKey: string) {
  switch (roleKey) {
    case "SUPER_ADMIN":
      return Building;
    case "REGIONAL_DIRECTOR":
      return Network;
    case "OPERATIONS_HEAD":
      return Briefcase;
    case "ACCOUNTS_HEAD":
      return CreditCard;
    case "AREA_MANAGER":
      return UserCheck;
    case "TEAM_LEADER":
      return Users;
    case "SALES_MANAGER":
      return Briefcase;
    case "CHANNEL_ADMIN":
      return Shield;
    case "TRANSACTIONAL_USER":
      return User;
    default:
      return Layers;
  }
}

function getIconAccent(role: RoleHierarchyNode) {
  if (role.roleKey === "SUPER_ADMIN") {
    return {
      border: "border-indigo-500",
      bg: "bg-indigo-50 text-indigo-700",
      ring: "ring-2 ring-indigo-300 shadow-sm",
    };
  }
  if (role.department === "CORPORATE") {
    if (role.roleKey === "OPERATIONS_HEAD") {
      return {
        border: "border-amber-400",
        bg: "bg-amber-50 text-amber-700",
        ring: "ring-2 ring-amber-200",
      };
    }
    return {
      border: "border-rose-400",
      bg: "bg-rose-50 text-rose-700",
      ring: "ring-2 ring-rose-200",
    };
  }
  return {
    border: "border-emerald-400",
    bg: "bg-emerald-50 text-emerald-700",
    ring: "ring-2 ring-emerald-200",
  };
}

export default function CorporateSalesTree() {
  const { role: currentAuthRole } = useAuthStore();
  const { roles, selectedRoleId, selectRole, canSeeUser } = useRoleHierarchyStore();

  const visibleRoles = useMemo(() => {
    return roles.filter((r) => canSeeUser(currentAuthRole, r.roleKey));
  }, [roles, currentAuthRole, canSeeUser]);

  const selectedRole = useMemo(() => {
    return visibleRoles.find((r) => r.id === selectedRoleId) || visibleRoles[0] || roles[0];
  }, [visibleRoles, selectedRoleId, roles]);

  const tier0Roles = useMemo(
    () => visibleRoles.filter((r) => r.tierLevel === 0),
    [visibleRoles]
  );
  const tier1Roles = useMemo(
    () => visibleRoles.filter((r) => r.tierLevel === 1),
    [visibleRoles]
  );
  const tier2PlusSales = useMemo(() => {
    // Collect all visible roles with tier >= 2, sorted by tier level
    return visibleRoles
      .filter((r) => r.tierLevel >= 2)
      .sort((a, b) => a.tierLevel - b.tierLevel);
  }, [visibleRoles]);

  const parentRole = useMemo(() => {
    if (!selectedRole || !selectedRole.parentRoleKey) return null;
    return roles.find((r) => r.roleKey === selectedRole.parentRoleKey);
  }, [selectedRole, roles]);

  const subordinateRoles = useMemo(() => {
    if (!selectedRole) return [];
    return roles.filter((r) => r.parentRoleKey === selectedRole.roleKey);
  }, [selectedRole, roles]);

  return (
    <div className="flex flex-col gap-6">
      {/* Visual Tree & Inspector Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Flow Tree Diagram (8 cols) */}
        <div className="lg:col-span-8 rounded-3xl border border-line bg-white/90 backdrop-blur-xs p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-line gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600">
                <Network size={18} />
              </div>
              <h2 className="text-base font-extrabold text-ink font-display">
                Corporate & Sales reporting Tree
              </h2>
            </div>
            <span className="text-xs text-ink-subtle font-mono">
              Hover/Click nodes to trace validation flow
            </span>
          </div>

          {/* 3 Tier Columns Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 items-start">
            {/* LEADERSHIP */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[0.6875rem] font-mono font-extrabold uppercase tracking-wider text-ink-subtle">
                  Corporate Leadership
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {tier0Roles.length > 0 ? (
                  tier0Roles.map((role) => {
                    const Icon = getRoleIcon(role.roleKey);
                    const isSelected = selectedRoleId === role.id;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => selectRole(role.id)}
                        className={`text-left w-full rounded-2xl border p-4 transition-all duration-150 relative ${
                          isSelected
                            ? "border-brand-600 ring-2 ring-brand-200 bg-brand-50/20 shadow-sm"
                            : "border-line bg-white hover:border-brand-300 hover:shadow-xs"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0">
                            <Icon size={18} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <h3 className="text-xs font-extrabold text-ink truncate">
                                {role.displayName}
                              </h3>
                              <span className="shrink-0 text-[0.625rem] font-mono font-bold uppercase rounded-md bg-indigo-50 text-indigo-700 px-1.5 py-0.5 border border-indigo-200">
                                {role.department}
                              </span>
                            </div>
                            <p className="text-[0.6875rem] font-mono font-medium text-ink-subtle mt-0.5">
                              {role.roleKey}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-line p-5 text-center text-xs text-ink-subtle bg-slate-50/50 flex flex-col items-center justify-center gap-1.5 py-8">
                    <Lock size={16} className="text-ink-subtle" />
                    <span className="font-bold text-ink">Restricted</span>
                    <span className="text-[0.6875rem]">Superior tiers hidden</span>
                  </div>
                )}
              </div>
            </div>

            {/* PARALLEL HEADS */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[0.6875rem] font-mono font-extrabold uppercase tracking-wider text-ink-subtle">
                  Parallel Department Heads
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {tier1Roles.length > 0 ? (
                  tier1Roles.map((role) => {
                    const Icon = getRoleIcon(role.roleKey);
                    const isSelected = selectedRoleId === role.id;
                    const accent = getIconAccent(role);
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => selectRole(role.id)}
                        className={`text-left w-full rounded-2xl border p-3.5 transition-all duration-150 ${
                          isSelected
                            ? "border-brand-600 ring-2 ring-brand-200 bg-brand-50/20 shadow-sm"
                            : "border-line bg-white hover:border-brand-300 hover:shadow-xs"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`p-2 rounded-xl border shrink-0 ${accent.bg} border-line/50`}
                          >
                            <Icon size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <h3 className="text-xs font-extrabold text-ink truncate">
                                {role.displayName}
                              </h3>
                              <span
                                className={`shrink-0 text-[0.5625rem] font-mono font-bold uppercase rounded-md px-1.5 py-0.5 border ${
                                  role.department === "SALES"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                }`}
                              >
                                {role.department}
                              </span>
                            </div>
                            <p className="text-[0.6875rem] font-mono font-medium text-ink-subtle mt-0.5">
                              {role.roleKey}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-line p-5 text-center text-xs text-ink-subtle bg-slate-50/50 flex flex-col items-center justify-center gap-1.5 py-8">
                    <Lock size={16} className="text-ink-subtle" />
                    <span className="font-bold text-ink">Restricted</span>
                    <span className="text-[0.6875rem]">Superior tiers hidden</span>
                  </div>
                )}
              </div>
            </div>

            {/* SALES FUNCTION */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[0.6875rem] font-mono font-extrabold uppercase tracking-wider text-ink-subtle">
                  Sales Operations Flow
                </span>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                {tier2PlusSales.map((role, idx) => {
                  const Icon = getRoleIcon(role.roleKey);
                  const isSelected = selectedRoleId === role.id;
                  return (
                    <React.Fragment key={role.id}>
                      <button
                        type="button"
                        onClick={() => selectRole(role.id)}
                        className={`text-left w-full rounded-2xl border p-3.5 transition-all duration-150 ${
                          isSelected
                            ? "border-brand-600 ring-2 ring-brand-200 bg-brand-50/20 shadow-sm"
                            : "border-line bg-white hover:border-brand-300 hover:shadow-xs"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
                            <Icon size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <h3 className="text-xs font-extrabold text-ink truncate">
                                {role.displayName}
                              </h3>
                              <span className="shrink-0 text-[0.5625rem] font-mono font-bold uppercase rounded-md bg-emerald-50 text-emerald-700 px-1.5 py-0.5 border border-emerald-200">
                                {role.department}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <p className="text-[0.6875rem] font-mono font-medium text-ink-subtle">
                                {role.roleKey}
                              </p>
                              <span className="text-[0.625rem] font-mono text-ink-muted">
                                Tier {role.tierLevel}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>

                      {idx < tier2PlusSales.length - 1 && (
                        <div className="flex items-center justify-center text-ink-subtle py-0.5">
                          <ChevronDown size={14} className="text-slate-400" />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Role Inspector Card (4 cols) */}
        <div className="lg:col-span-4 rounded-3xl border border-line bg-white p-6 shadow-xs flex flex-col gap-5 sticky top-6">
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <h3 className="text-sm font-extrabold text-ink font-display">
              Role Inspector
            </h3>
            <div className="text-ink-subtle hover:text-ink transition-colors cursor-pointer">
              <Info size={16} />
            </div>
          </div>

          {selectedRole ? (
            <div className="flex flex-col gap-4">
              {/* Department pill & Authority Status */}
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="inline-block rounded-md bg-indigo-50 px-2 py-0.5 font-mono text-[0.625rem] font-bold tracking-wide uppercase text-indigo-700 border border-indigo-200">
                    {selectedRole.department} DEPARTMENT
                  </span>
                  {currentAuthRole && (
                    selectedRole.tierLevel < (useRoleHierarchyStore.getState().getTierLevel(currentAuthRole)) ? (
                      <span className="inline-block rounded-md bg-amber-50 px-2 py-0.5 font-mono text-[0.625rem] font-bold text-amber-700 border border-amber-200">
                        SUPERIOR (READ-ONLY)
                      </span>
                    ) : selectedRole.tierLevel === (useRoleHierarchyStore.getState().getTierLevel(currentAuthRole)) ? (
                      <span className="inline-block rounded-md bg-blue-50 px-2 py-0.5 font-mono text-[0.625rem] font-bold text-blue-700 border border-blue-200">
                        YOUR LEVEL
                      </span>
                    ) : (
                      <span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 font-mono text-[0.625rem] font-bold text-emerald-700 border border-emerald-200">
                        SUBORDINATE (MANAGEABLE)
                      </span>
                    )
                  )}
                </div>
                <h4 className="text-base font-extrabold text-ink mt-2">
                  {selectedRole.displayName}
                </h4>
                <p className="text-xs font-mono font-bold text-ink-subtle">
                  {selectedRole.roleKey} • {selectedRole.department}
                </p>
              </div>

              {/* Description box */}
              <div className="rounded-2xl bg-slate-50 border border-line/60 p-3.5 text-xs text-ink-muted leading-relaxed">
                {selectedRole.description ||
                  "No role description specified for this organizational node."}
              </div>

              {/* Hierarchy Rule */}
              <div className="space-y-2 text-xs">
                <span className="text-[0.6875rem] font-mono font-bold uppercase tracking-wider text-ink-subtle block">
                  Hierarchy Rule
                </span>
                <div className="flex items-start justify-between py-1 border-b border-line/60">
                  <span className="text-ink-subtle">Reports Directly To:</span>
                  <span className="font-mono font-bold text-ink text-right">
                    {parentRole
                      ? `${parentRole.displayName} (${parentRole.roleKey})`
                      : "Super Admin (Root)"}
                  </span>
                </div>
                <div className="flex flex-col gap-1 py-1">
                  <span className="text-ink-subtle">Next Subordinates:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {subordinateRoles.length > 0 ? (
                      subordinateRoles.map((s) => (
                        <span
                          key={s.id}
                          className="font-mono text-[0.625rem] font-bold bg-slate-100 text-ink px-1.5 py-0.5 rounded border border-line"
                        >
                          {s.roleKey}
                        </span>
                      ))
                    ) : (
                      <span className="font-mono text-[0.625rem] text-ink-subtle italic">
                        None (Terminal operational node)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Validation Constraints */}
              <div className="rounded-2xl bg-sky-50/60 border border-sky-100 p-4 flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-sky-800 font-bold text-xs">
                  <Lock size={13} />
                  <span>Validation Constraints</span>
                </div>
                <ul className="space-y-1.5 text-[0.6875rem] text-sky-900 list-disc list-inside">
                  {selectedRole.validationConstraints &&
                  selectedRole.validationConstraints.length > 0 ? (
                    selectedRole.validationConstraints.map((vc, idx) => (
                      <li key={idx} className="leading-tight">
                        {vc}
                      </li>
                    ))
                  ) : (
                    <li>Strict RBAC assignment hierarchy enforcement.</li>
                  )}
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-xs text-ink-subtle">
              Select any role node from the hierarchy tree to inspect its validation flow.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
