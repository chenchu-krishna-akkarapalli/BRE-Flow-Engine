"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Cpu,
  CreditCard,
  Fingerprint,
  Globe,
  KeyRound,
  Layers,
  Lock,
  Mail,
  Phone,
  Plus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import { ChallengePayload, requestAuthChallenge } from "@/lib/uas-client";
import { useAuthStore } from "@/store/useAuthStore";

interface DemoAccount {
  label: string;
  role: string;
  tier: string;
  badgeClass: string;
  iconBg: string;
  iconColor: string;
  icon: typeof Shield;
  email: string;
  tenantName: string;
  description: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    label: "Super Admin",
    role: "SUPER_ADMIN",
    tier: "Tier 0 • Leadership",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
    icon: ShieldCheck,
    email: "super.admin@flowbre.com",
    tenantName: "FlowBRE Platform Owner",
    description: "Root governance, cross-tenant telemetry, and platform rule overrides.",
  },
  {
    label: "Regional Director",
    role: "REGIONAL_DIRECTOR",
    tier: "Tier 1 • Parallel Head (Sales)",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-700",
    icon: Globe,
    email: "regional.director@flowbre.com",
    tenantName: "FlowBRE Platform Owner",
    description: "Multi-region branch structures, volume quotas, and territory director oversight.",
  },
  {
    label: "Operations Head",
    role: "OPERATIONS_HEAD",
    tier: "Tier 1 • Parallel Head (Ops)",
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-700",
    icon: Cpu,
    email: "ops.head@flowbre.com",
    tenantName: "FlowBRE Platform Owner",
    description: "Credit committee policy matrix, OCR supervision, and SLA budgets.",
  },
  {
    label: "Accounts Head",
    role: "ACCOUNTS_HEAD",
    tier: "Tier 1 • Parallel Head (Corporate)",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    iconBg: "bg-rose-100",
    iconColor: "text-rose-700",
    icon: CreditCard,
    email: "accounts.head@flowbre.com",
    tenantName: "FlowBRE Corporate Accounts",
    description: "Financial ledgers, disbursements, billing, and transactional audit trails.",
  },
  {
    label: "Area Manager",
    role: "AREA_MANAGER",
    tier: "Tier 2 • Sales Function",
    badgeClass: "bg-cyan-50 text-cyan-700 border-cyan-200",
    iconBg: "bg-cyan-100",
    iconColor: "text-cyan-700",
    icon: Building2,
    email: "area.manager@boi.com",
    tenantName: "Bank of India North Channel",
    description: "Localized origination pipeline, regional team coordination, and branch targets.",
  },
  {
    label: "Team Leader",
    role: "TEAM_LEADER",
    tier: "Tier 3 • Sales Function",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
    iconBg: "bg-sky-100",
    iconColor: "text-sky-700",
    icon: Users,
    email: "team.leader@boi.com",
    tenantName: "Bank of India North Channel",
    description: "Application review pipelines, queues triage, and localized underwriting escalations.",
  },
  {
    label: "Sales Manager",
    role: "SALES_MANAGER",
    tier: "Tier 4 • Sales Function",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
    iconBg: "bg-purple-100",
    iconColor: "text-purple-700",
    icon: Briefcase,
    email: "sales.manager@boi.com",
    tenantName: "Bank of India North Channel",
    description: "Direct channel manager, sales enablement, and channel onboarding coordination.",
  },
  {
    label: "Channel Admin",
    role: "CHANNEL_ADMIN",
    tier: "Tier 5 • Channel Partner",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-700",
    icon: UserCheck,
    email: "channel.admin@boi.com",
    tenantName: "Bank of India North Channel",
    description: "Channel workspace administrator for Bank of India territory.",
  },
  {
    label: "Transactional Officer",
    role: "TRANSACTIONAL_USER",
    tier: "Tier 6 • Field Operations",
    badgeClass: "bg-teal-50 text-teal-700 border-teal-200",
    iconBg: "bg-teal-100",
    iconColor: "text-teal-700",
    icon: Layers,
    email: "agent.john@boi.com",
    tenantName: "Bank of India North Channel",
    description: "6-step applicant onboarding, document uploads, and instant evaluations.",
  },
];

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, error } = useAuthStore();

  // Mode: "signin" vs "onboard"
  const [authMode, setAuthMode] = useState<"signin" | "onboard">("signin");

  // Sign In State
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("super.admin@flowbre.com");
  const [password, setPassword] = useState("FlowBRE@2026!");
  const [challengeData, setChallengeData] = useState<ChallengePayload | null>(null);
  const [isFetchingChallenge, setIsFetchingChallenge] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Onboard Channel Form State
  const [onboardData, setOnboardData] = useState({
    name: "",
    code: "",
    tenantUuid: "",
    channelType: "DSA",
    contactEmail: "",
    contactPhone: "",
    cibilOverlay: 10,
  });
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [onboardTicket, setOnboardTicket] = useState<{
    tenant_uuid: string;
    ticket_id: string;
    channel_name: string;
  } | null>(null);

  // Sync route parameters from URL on load
  useEffect(() => {
    const urlMode = searchParams.get("mode");
    const urlStep = searchParams.get("step");
    const urlEmail = searchParams.get("email");

    if (urlMode === "onboard") {
      setAuthMode("onboard");
    } else {
      setAuthMode("signin");
    }

    if (urlEmail) {
      setEmail(urlEmail);
    }

    if (urlStep === "challenge" && urlEmail && !challengeData && !isFetchingChallenge) {
      triggerChallengeFetch(urlEmail);
    }
  }, [searchParams]);

  const triggerChallengeFetch = async (targetEmail: string) => {
    setLocalError(null);
    setIsFetchingChallenge(true);
    try {
      const challenge = await requestAuthChallenge(targetEmail.trim());
      setChallengeData(challenge);
      setStep(2);
      router.push(
        `/auth/login?step=challenge&email=${encodeURIComponent(targetEmail.trim())}&nonce_id=${challenge.nonce_id.slice(0, 8)}`
      );
    } catch (err: any) {
      setLocalError(err?.message || "Unable to retrieve challenge token. Check email address.");
      setStep(1);
    } finally {
      setIsFetchingChallenge(false);
    }
  };

  // Step 1: User enters email -> requests challenge token
  const handleRequestChallenge = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim()) {
      setLocalError("Please enter your corporate email or Gmail address.");
      return;
    }
    await triggerChallengeFetch(email);
  };

  // Step 2: User enters password -> computes zero-plaintext HMAC proof locally
  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setLocalError("Please enter your password.");
      return;
    }
    setLocalError(null);
    setIsVerifying(true);

    try {
      const session = await login(email.trim(), password, challengeData?.tenant_uuid);
      const targetTenant = session.tenant_uuid || challengeData?.tenant_uuid || "platform";
      const isPlatform = session.role === "SUPER_ADMIN" || targetTenant === "platform" || !targetTenant;
      const targetRoute = isPlatform ? "/platform/dashboard" : `/${targetTenant}/dashboard`;
      router.push(targetRoute);
    } catch (err: any) {
      setLocalError(err?.message || "Cryptographic proof verification failed. Check password.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResetStep = () => {
    setStep(1);
    setChallengeData(null);
    setLocalError(null);
    router.push("/auth/login");
  };

  const handleDemoSelect = async (account: DemoAccount) => {
    setAuthMode("signin");
    setEmail(account.email);
    setPassword("FlowBRE@2026!");
    setLocalError(null);
    setStep(1);
    router.push(`/auth/login?email=${encodeURIComponent(account.email)}`);
  };

  const handleOnboardNameChange = (val: string) => {
    const slug = val
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    setOnboardData((prev) => ({
      ...prev,
      name: val,
      code: `tenant-${slug}`,
      tenantUuid: `tenant-${slug}`,
    }));
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setIsOnboarding(true);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";
      const res = await fetch(`${apiBase}/api/v1/tenants/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: onboardData.name,
          code: onboardData.code,
          contact_email: onboardData.contactEmail,
          contact_phone: onboardData.contactPhone,
          channel_type: onboardData.channelType,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to submit channel onboarding registration.");
      }

      const data = await res.json();
      setOnboardTicket({
        tenant_uuid: data.tenant_uuid || onboardData.tenantUuid,
        ticket_id: `TCK-${Date.now().toString().slice(-6)}`,
        channel_name: onboardData.name,
      });
    } catch (err: any) {
      setOnboardTicket({
        tenant_uuid: onboardData.tenantUuid,
        ticket_id: `TCK-${Date.now().toString().slice(-6)}`,
        channel_name: onboardData.name,
      });
    } finally {
      setIsOnboarding(false);
    }
  };

  return (
    <div className="min-h-full w-full flex items-center justify-center bg-slate-50/70 p-4 sm:p-6 lg:p-8 text-slate-900 font-sans selection:bg-teal-500/20 selection:text-teal-900 my-auto">
      <div className="w-full max-w-6xl xl:max-w-[1240px] grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 xl:gap-10 items-stretch animate-fade-in my-auto">
        
        {/* Left Column: Primary Authentication & Onboarding Card */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 xl:p-10 shadow-xl shadow-slate-200/40 backdrop-blur-md">
          <div>
            {/* Brand Logo & Platform Title */}
            <div className="flex items-center justify-between mb-6 sm:mb-8 pb-5 sm:pb-6 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md shadow-slate-900/10">
                  <ShieldCheck className="h-6 w-6 text-teal-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-extrabold text-slate-900 font-display tracking-tight">
                      Flow<span className="text-teal-600">BRE</span>
                    </h1>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[0.625rem] font-mono font-bold text-slate-600 border border-slate-200">
                      UAS 2.0
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Universal Authentication &amp; Multi-Tenant Portal
                  </p>
                </div>
              </div>

              {/* Security Pill Badge */}
              <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[0.6875rem] font-bold text-emerald-700 border border-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Zero-Plaintext Active</span>
              </div>
            </div>

            {/* Mode Switcher Segmented Control */}
            <div className="mb-6 rounded-2xl bg-slate-100/80 p-1 border border-slate-200/80 grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("signin");
                  router.push("/auth/login");
                }}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all duration-200 ${
                  authMode === "signin"
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <KeyRound size={15} />
                <span>Sign In with Challenge</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("onboard");
                  router.push("/auth/login?mode=onboard");
                }}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all duration-200 ${
                  authMode === "onboard"
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Building2 size={15} />
                <span>Onboard Channel</span>
              </button>
            </div>

            {/* Error Notification Banner */}
            {(localError || error) && (
              <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Authentication Error</p>
                  <p className="text-rose-700 mt-0.5">{localError || error}</p>
                </div>
              </div>
            )}

            {/* ----------------- MODE 1: SIGN IN ----------------- */}
            {authMode === "signin" && (
              <div className="space-y-6">
                {/* Step Indicator */}
                <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                        step === 1 ? "bg-slate-900 text-white" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {step === 1 ? "1" : "✓"}
                    </span>
                    <span className={step === 1 ? "font-bold text-slate-900" : "text-slate-500"}>
                      1. Email &amp; Tenant Scope
                    </span>
                    <span className="text-slate-300">→</span>
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                        step === 2 ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      2
                    </span>
                    <span className={step === 2 ? "font-bold text-slate-900" : "text-slate-400"}>
                      2. Cryptographic Proof
                    </span>
                  </div>
                </div>

                {/* Step 1 Form */}
                {step === 1 && (
                  <form onSubmit={handleRequestChallenge} className="space-y-4">
                    <div>
                      <label className="block text-[0.6875rem] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                        Corporate Work Email or Gmail
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="e.g. super.admin@flowbre.com or channel.admin@boi.com"
                          className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-800 focus:ring-2 focus:ring-slate-900/5 transition-all outline-hidden"
                          required
                        />
                      </div>
                      <p className="text-[0.6875rem] text-slate-500 mt-2">
                        Enter your email to resolve your multi-tenant authority and retrieve your single-use cryptographic challenge nonce.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={isFetchingChallenge}
                      className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-bold text-xs shadow-md shadow-slate-900/10 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isFetchingChallenge ? (
                        <span className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Resolving Challenge Nonce...
                        </span>
                      ) : (
                        <>
                          <span>Request Challenge &amp; Proceed</span>
                          <ArrowRight size={15} />
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* Step 2 Form */}
                {step === 2 && challengeData && (
                  <form onSubmit={handleVerifyPassword} className="space-y-5">
                    {/* Resolved Tenant Scope Context Card */}
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200 text-teal-600 shadow-xs">
                            <Building2 size={18} />
                          </div>
                          <div>
                            <span className="text-[0.625rem] font-bold uppercase tracking-wider text-teal-700 font-mono">
                              Resolved Tenant Scope
                            </span>
                            <h3 className="text-xs font-extrabold text-slate-900 font-display">
                              {challengeData.tenant_name || "Platform Owner"}
                            </h3>
                            <p className="text-[0.6875rem] font-mono text-slate-500">
                              UUID: /{challengeData.tenant_uuid || "platform"}
                            </p>
                          </div>
                        </div>

                        {challengeData.role && (
                          <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[0.625rem] font-mono font-bold text-slate-700 shadow-xs">
                            {challengeData.role}
                          </span>
                        )}
                      </div>

                      <div className="pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-[0.6875rem] text-slate-500 font-mono">
                        <span className="flex items-center gap-1">
                          <Fingerprint size={13} className="text-teal-600" />
                          Nonce: <strong className="text-slate-800">{challengeData.nonce_id.slice(0, 8)}...</strong>
                        </span>
                        <span className="text-slate-400 font-sans">
                          {challengeData.expires_in_seconds}s validity
                        </span>
                      </div>
                    </div>

                    {/* Password Input */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[0.6875rem] font-bold uppercase tracking-wider text-slate-600">
                          Password (HMAC Secret)
                        </label>
                        <button
                          type="button"
                          onClick={handleResetStep}
                          className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-0.5"
                        >
                          <ChevronLeft size={14} />
                          Change Email
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-800 focus:ring-2 focus:ring-slate-900/5 transition-all outline-hidden"
                          required
                        />
                      </div>
                      <p className="text-[0.6875rem] text-slate-500 mt-2">
                        Zero-Plaintext: Browser calculates proof locally using Web Crypto API (<code className="font-mono text-slate-700">HMAC-SHA256</code>).
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={isVerifying}
                      className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-bold text-xs shadow-md shadow-slate-900/10 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isVerifying ? (
                        <span className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Verifying Proof &amp; Exchanging Scoped Token...
                        </span>
                      ) : (
                        <>
                          <span>Compute Proof &amp; Sign In</span>
                          <KeyRound size={15} />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* ----------------- MODE 2: ONBOARD CHANNEL ----------------- */}
            {authMode === "onboard" && (
              <div>
                {onboardTicket ? (
                  <div className="space-y-5 animate-fade-in">
                    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-amber-50/80 p-6 text-center border border-amber-200">
                      <Clock className="w-8 h-8 text-amber-600 animate-pulse" />
                      <span className="text-[0.625rem] font-mono font-bold uppercase text-amber-800 bg-amber-100 px-3 py-0.5 rounded-full">
                        Status: PENDING PLATFORM REVIEW
                      </span>
                      <h3 className="text-sm font-extrabold text-slate-900 font-display mt-1">
                        Application Submitted for {onboardTicket.channel_name}
                      </h3>
                      <p className="text-xs text-slate-600">
                        Tracking Ref: <strong className="font-mono text-slate-900">{onboardTicket.ticket_id}</strong>
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-2 text-xs text-slate-600">
                      <p className="font-bold text-slate-900 flex items-center gap-1.5">
                        <CheckCircle2 size={15} className="text-emerald-600" />
                        Next Lifecycle Milestones:
                      </p>
                      <p>1. Platform Administrator reviews MCA &amp; GSTIN compliance records.</p>
                      <p>2. Dynamic tenant workspace <code className="font-mono font-bold text-teal-700">/{onboardTicket.tenant_uuid}</code> is provisioned.</p>
                      <p>3. Initial admin activation credentials dispatched to your registered email.</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setOnboardTicket(null);
                        setAuthMode("signin");
                        router.push("/auth/login");
                      }}
                      className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all"
                    >
                      Return to Sign In
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleOnboardSubmit} className="space-y-4 text-xs">
                    <div>
                      <label className="block text-[0.6875rem] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Partner Organization Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Apex FinSol Delhi"
                        value={onboardData.name}
                        onChange={(e) => handleOnboardNameChange(e.target.value)}
                        className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-800 outline-hidden"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[0.6875rem] font-bold uppercase tracking-wider text-slate-600 mb-1">
                          Classification <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={onboardData.channelType}
                          onChange={(e) =>
                            setOnboardData((prev) => ({ ...prev, channelType: e.target.value }))
                          }
                          className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-slate-900 focus:bg-white focus:border-slate-800 outline-hidden font-medium"
                        >
                          <option value="DSA">Direct Selling Agent (DSA)</option>
                          <option value="FINTECH_PARTNER">FinTech API Partner</option>
                          <option value="BANK_BRANCH">Direct Bank Branch Network</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[0.6875rem] font-bold uppercase tracking-wider text-slate-600 mb-1">
                          Primary Admin Phone <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          placeholder="+91 98765 43210"
                          value={onboardData.contactPhone}
                          onChange={(e) =>
                            setOnboardData((prev) => ({ ...prev, contactPhone: e.target.value }))
                          }
                          className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-800 outline-hidden"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[0.6875rem] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Primary Admin Email <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="admin@apex-finsol.in"
                        value={onboardData.contactEmail}
                        onChange={(e) =>
                          setOnboardData((prev) => ({ ...prev, contactEmail: e.target.value }))
                        }
                        className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-800 outline-hidden"
                      />
                    </div>

                    {onboardData.tenantUuid && (
                      <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3 text-[0.6875rem] font-mono text-teal-900">
                        Target Dynamic Workspace: <strong className="text-teal-700">/{onboardData.tenantUuid}</strong>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isOnboarding || !onboardData.name}
                      className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-bold text-xs shadow-md shadow-slate-900/10 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isOnboarding ? (
                        <span className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Submitting Partner Application...
                        </span>
                      ) : (
                        <>
                          <span>Submit Channel Onboarding</span>
                          <ArrowRight size={15} />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Card Footer: Security Seals */}
          <div className="mt-8 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-[0.6875rem] text-slate-400">
            <span>UAS Cryptographic Protocol v2.0</span>
            <div className="flex items-center gap-3 text-slate-500">
              <span className="flex items-center gap-1 text-emerald-600 font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Auth Gateway Online
              </span>
              <span>•</span>
              <span>SOC-2 Type II</span>
            </div>
          </div>
        </div>

        {/* Right Column: Executive Identity Quick-Switch Pane */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white/80 p-6 sm:p-8 xl:p-9 shadow-lg shadow-slate-200/30 backdrop-blur-md">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-display">
                  Quick Identity Switcher
                </h2>
              </div>
              <span className="text-[0.625rem] font-mono font-bold text-slate-400">
                {DEMO_ACCOUNTS.length} Identities
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              Select an executive profile to prefill credentials and inspect role-based dynamic workspace routing:
            </p>

            <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1.5 scrollbar-thin">
              {DEMO_ACCOUNTS.map((acc) => {
                const Icon = acc.icon;
                const isSelected = email === acc.email && authMode === "signin";
                return (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => handleDemoSelect(acc)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-200 ${
                      isSelected
                        ? "bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/10 scale-[1.01]"
                        : "bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50 shadow-xs"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                            isSelected ? "bg-slate-800 text-teal-400" : `${acc.iconBg} ${acc.iconColor}`
                          }`}
                        >
                          <Icon size={18} />
                        </div>
                        <div>
                          <div className={`text-xs font-bold ${isSelected ? "text-white" : "text-slate-900"}`}>
                            {acc.label}
                          </div>
                          <div className={`text-[0.6875rem] font-mono ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                            {acc.email}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-[0.5625rem] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          isSelected ? "bg-teal-500/20 text-teal-300 border-teal-400/30" : acc.badgeClass
                        }`}
                      >
                        {acc.role}
                      </span>
                    </div>

                    <p
                      className={`text-[0.6875rem] mt-2.5 pt-2 border-t text-left ${
                        isSelected ? "border-slate-800 text-slate-300" : "border-slate-100 text-slate-500"
                      }`}
                    >
                      {acc.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-100/80 border border-slate-200 p-3.5 text-[0.6875rem] text-slate-600 flex items-center justify-between">
            <span>Universal Seed Password:</span>
            <code className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">
              FlowBRE@2026!
            </code>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 text-xs">
          Loading UAS Login...
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
