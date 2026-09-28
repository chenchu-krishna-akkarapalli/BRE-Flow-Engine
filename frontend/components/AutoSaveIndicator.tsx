"use client";

import { ShieldCheck } from "lucide-react";

export function AutoSaveIndicator() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1.5 rounded-full border border-teal-200/80 bg-teal-50/80 px-2.5 py-1 text-[0.6875rem] font-semibold text-teal-700 shadow-2xs backdrop-blur-xs select-none"
    >
      <ShieldCheck size={12} className="text-teal-600" />
      <span>Session Active (In-Memory)</span>
    </div>
  );
}

export default AutoSaveIndicator;
