"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Phone,
  Briefcase,
  Shield,
  ShieldCheck,
  Building2,
  Check,
  CheckCircle2,
  ArrowLeft,
  Bell,
  Clock,
  KeyRound,
  RotateCcw,
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { getTenantByUuidOrCode } from "@/lib/tenants-data";

export function ProfileSettingsView({ tenantUuid }: { tenantUuid?: string }) {
  const router = useRouter();
  const { user, role, tenantUuid: storeTenantUuid, permissions, updateProfile } = useAuthStore();

  const activeTenant = tenantUuid || storeTenantUuid || user?.tenant_id || "platform";
  const channelRecord = getTenantByUuidOrCode(activeTenant);
  const channelName =
    channelRecord?.name ||
    (user?.email?.includes("@boi.com") ? "Bank of India Channel" : "FlowBRE Platform Governance");

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [designation, setDesignation] = useState("");

  // Notification toggles
  const [notifyUnderwriting, setNotifyUnderwriting] = useState(true);
  const [notifyPipeline, setNotifyPipeline] = useState(true);
  const [notifyTelemetry, setNotifyTelemetry] = useState(false);

  // Status feedback
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Hydrate fields from current auth state
  useEffect(() => {
    if (user) {
      const defaultName =
        (user as any)?.name ||
        (user.username
          ? user.username.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
          : "Super Admin");
      const defaultEmail =
        user.email ||
        (user.username && user.username.includes("@") ? user.username : "super.admin@flowbre.com");
      const defaultPhone = (user as any)?.phone || "+91 98765 43210";
      const defaultDesignation =
        (user as any)?.designation ||
        (role === "SUPER_ADMIN" ? "Platform System Administrator" : "Channel Lead Officer");

      setName(defaultName);
      setEmail(defaultEmail);
      setPhone(defaultPhone);
      setDesignation(defaultDesignation);
    }
  }, [user, role]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setIsSubmitting(true);

    updateProfile({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      designation: designation.trim(),
    });

    setTimeout(() => {
      setIsSubmitting(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    }, 400);
  };

  const handleReset = () => {
    if (user) {
      const defaultName =
        (user as any)?.name ||
        (user.username
          ? user.username.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
          : "Super Admin");
      const defaultEmail =
        user.email ||
        (user.username && user.username.includes("@") ? user.username : "super.admin@flowbre.com");
      const defaultPhone = (user as any)?.phone || "+91 98765 43210";
      const defaultDesignation =
        (user as any)?.designation ||
        (role === "SUPER_ADMIN" ? "Platform System Administrator" : "Channel Lead Officer");

      setName(defaultName);
      setEmail(defaultEmail);
      setPhone(defaultPhone);
      setDesignation(defaultDesignation);
    }
  };

  const avatarInitials = (() => {
    if (name.trim()) {
      const parts = name.trim().split(/\s+/).filter(Boolean);
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    }
    if (role === "SUPER_ADMIN") return "SA";
    if (role === "TEAM_LEADER") return "TE";
    if (role === "SALES_MANAGER") return "SM";
    if (role === "CHANNEL_ADMIN") return "CA";
    return "SA";
  })();

  const backHref =
    activeTenant && activeTenant !== "platform"
      ? `/${activeTenant}/dashboard`
      : "/dashboard";

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/70 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Navigation Breadcrumb / Back Link */}
        <div className="flex items-center justify-between">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <span>Settings</span>
            <span>/</span>
            <span className="text-slate-800 font-medium">User Profile</span>
          </div>
        </div>

        {/* Success Alert Banner */}
        {saveSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-[13px]">Profile updated successfully!</p>
                <p className="text-[11px] text-emerald-700">
                  Your updated personal name, contact details, and session identity are saved and active.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSaveSuccess(false)}
              className="text-emerald-700 hover:text-emerald-950 font-bold px-2 py-1 text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Profile Identity Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5 min-w-0">
            {/* Big Avatar Pill */}
            <div className="h-16 w-16 rounded-2xl bg-slate-950 text-white flex items-center justify-center font-extrabold text-xl font-mono shadow-md shrink-0 ring-4 ring-slate-100">
              {avatarInitials}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 truncate">
                  {name || "User Profile"}
                </h1>
                <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider shrink-0">
                  {role ? role.replace(/_/g, " ") : "SUPER ADMIN"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">{email}</p>
              <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-600 font-medium truncate">{channelName}</span>
                <span>&bull;</span>
                <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active Session
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <button
              type="button"
              onClick={handleReset}
              className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isSubmitting ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </div>

        {/* Profile Edit Form */}
        <form onSubmit={handleSave} className="space-y-6">
          {/* Section 1: Personal Details */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Personal Details</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Update your display name and verified contact coordinates.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Full Display Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Super Admin"
                    className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition shadow-2xs font-medium"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. super.admin@flowbre.com"
                    className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition shadow-2xs font-medium"
                  />
                </div>
              </div>

              {/* Direct Phone / Mobile */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Direct Phone / Mobile
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition shadow-2xs font-medium"
                  />
                </div>
              </div>

              {/* Designation / Job Title */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Designation / Role Title
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Platform System Administrator"
                    className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition shadow-2xs font-medium"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Enterprise Role & Governance Context */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Organization & Security Governance</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Assigned RBAC governance credentials, cryptographic session parameters, and tenant context.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/80">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span className="text-[11px] font-bold">Assigned Role</span>
                </div>
                <p className="text-xs font-extrabold text-slate-900 font-mono">
                  {role || "SUPER_ADMIN"}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {role === "SUPER_ADMIN" ? "Unrestricted Platform Governance" : "Channel Partner Execution"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/80">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <KeyRound className="w-4 h-4 text-emerald-600" />
                  <span className="text-[11px] font-bold">Session Security</span>
                </div>
                <p className="text-xs font-bold text-slate-900">
                  Zero-Password Proof
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                  Argon2 &bull; 1440m TTL
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/80">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <Shield className="w-4 h-4 text-amber-600" />
                  <span className="text-[11px] font-bold">Active Capabilities</span>
                </div>
                <p className="text-xs font-bold text-slate-900 font-mono">
                  {permissions?.length || 14} Entitlements
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  RBAC Matrix Enforced
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Notification Preferences */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Notification & Alert Preferences</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure dispatch channels for workflow approvals, origination pipeline, and system SLA alerts.
              </p>
            </div>

            <div className="divide-y divide-slate-100 pt-1">
              <label className="flex items-center justify-between py-3 cursor-pointer group">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition">
                      Underwriting Sign-Offs & Exception Waivers
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Receive immediate notifications when loan files trigger manual CIBIL or FOIR overrides.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notifyUnderwriting}
                  onChange={(e) => setNotifyUnderwriting(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 accent-slate-900"
                />
              </label>

              <label className="flex items-center justify-between py-3 cursor-pointer group">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 mt-0.5">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-700 transition">
                      Pipeline Status Shifts & Sanction Letters
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Get informed when leads transition from Underwriting to Sanctioned or Disbursed.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notifyPipeline}
                  onChange={(e) => setNotifyPipeline(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 accent-slate-900"
                />
              </label>

              <label className="flex items-center justify-between py-3 cursor-pointer group">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-50 text-amber-600 mt-0.5">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 group-hover:text-amber-700 transition">
                      High-Priority SLA & Engine Breach Alerts (&gt; 400ms)
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Dispatch telemetry notifications when rule evaluation latencies cross SLA boundaries.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notifyTelemetry}
                  onChange={(e) => setNotifyTelemetry(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 accent-slate-900"
                />
              </label>
            </div>
          </div>

          {/* Form Bottom Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-white hover:text-slate-900 transition"
            >
              Discard Changes
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition shadow-xs flex items-center gap-2 disabled:opacity-50"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{isSubmitting ? "Saving Profile..." : "Save Profile Details"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
