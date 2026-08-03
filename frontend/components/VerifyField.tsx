"use client";

import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import { sendOtp, verifyOtp } from "@/lib/api";

// Verify button + OTP challenge for PAN (email) and mobile (add-on.md §1.3, §1.4).
// Verification is a demo flow: it records that the applicant completed the
// challenge, and gates nothing in the eligibility decision.
export function VerifyField({
  channel, target, verified, onVerified, label = "Verify",
}: {
  channel: "email" | "mobile";
  target: string;
  verified: boolean;
  onVerified: (v: boolean) => void;
  label?: string;
}) {
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (verified) {
    return (
      <span className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-success">
        <BadgeCheck size={16} aria-hidden />
        Verified
      </span>
    );
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const challenge = await sendOtp(channel, target);
      setChallengeId(challenge.challenge_id);
      setSentTo(challenge.sent_to);
      setDemoCode(challenge.demo_code ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send a code.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!challengeId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await verifyOtp(challengeId, code);
      if (result.verified) {
        onVerified(true);
        return;
      }
      setError(
        result.attempts_remaining > 0
          ? `That code is not right. ${result.attempts_remaining} attempts left.`
          : "That code is not right.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
      setChallengeId(null);
    } finally {
      setBusy(false);
    }
  }

  if (!challengeId) {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={start}
          disabled={busy || target.trim() === ""}
          className="min-h-[44px] rounded-md border border-line px-4 py-2 text-[0.875rem] text-ink transition-colors hover:border-line-strong disabled:opacity-40"
        >
          {busy ? "Sending…" : label}
        </button>
        {error && <p className="text-[0.8125rem] font-medium text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-bg-raised p-3">
      <p className="text-[0.8125rem] text-ink">
        We sent a 6-digit code to <span className="numeric font-medium">{sentTo}</span>.
      </p>
      {/* Demo builds echo the code back; a real provider delivers it out of band. */}
      {demoCode && (
        <p className="numeric text-[0.8125rem] text-info">Demo code: {demoCode}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          maxLength={6}
          aria-label="Enter the code we sent you"
          placeholder="000000"
          className="numeric w-[140px] rounded-sm border border-line bg-bg-surface px-[14px] py-[10px] text-ink"
        />
        <button
          type="button"
          onClick={confirm}
          disabled={busy || code.trim().length === 0}
          className="min-h-[44px] rounded-md bg-brand-600 px-4 py-2 text-[0.875rem] font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? "Checking…" : "Submit code"}
        </button>
        <button
          type="button"
          onClick={() => { setChallengeId(null); setCode(""); setError(null); }}
          className="min-h-[44px] text-[0.8125rem] text-ink underline underline-offset-2"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-[0.8125rem] font-medium text-danger">{error}</p>}
    </div>
  );
}
