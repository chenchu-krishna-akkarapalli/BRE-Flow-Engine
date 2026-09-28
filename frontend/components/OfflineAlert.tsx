"use client";

import { useState, useEffect } from "react";
import { WifiOff, Wifi, CheckCircle2 } from "lucide-react";

export function OfflineAlert() {
  const [isOffline, setIsOffline] = useState(false);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    // Initial check
    if (typeof navigator !== "undefined") {
      setIsOffline(!navigator.onLine);
    }

    const handleOnline = () => {
      setIsOffline(false);
      setShowRestored(true);
      const timer = setTimeout(() => setShowRestored(false), 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowRestored(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline && !showRestored) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="w-full transition-all duration-300 animate-in fade-in slide-in-from-top-2"
    >
      {isOffline && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50/95 px-4 py-3 text-xs text-amber-900 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-amber-200/60 text-amber-800">
              <WifiOff size={16} />
            </div>
            <div>
              <span className="font-bold">Offline Mode:</span> Internet connection was lost. Your form progress is auto-saved locally on your device and will be evaluated once connection is restored.
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-amber-200/80 px-2 py-0.5 text-[0.6875rem] font-bold text-amber-800">
            Offline
          </span>
        </div>
      )}

      {showRestored && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-50/95 px-4 py-3 text-xs text-emerald-900 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-emerald-200/60 text-emerald-800">
              <CheckCircle2 size={16} />
            </div>
            <div>
              <span className="font-bold">Connection Restored:</span> You are back online. Form evaluation and document uploads are ready.
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-emerald-200/80 px-2 py-0.5 text-[0.6875rem] font-bold text-emerald-800">
            Online
          </span>
        </div>
      )}
    </div>
  );
}

export default OfflineAlert;
