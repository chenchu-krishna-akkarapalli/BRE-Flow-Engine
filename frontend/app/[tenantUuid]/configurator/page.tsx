"use client";

import { use, useState } from "react";
import { Save, Sliders } from "lucide-react";

export default function TenantConfiguratorPage({
  params,
}: {
  params: Promise<{ tenantUuid: string }>;
}) {
  const { tenantUuid } = use(params);
  const [cibilOverlay, setCibilOverlay] = useState(15);
  const [maxFoir, setMaxFoir] = useState(65);
  const [allowSiblingCoapp, setAllowSiblingCoapp] = useState(false);
  const [slaBudgetMs, setSlaBudgetMs] = useState(30);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-6 px-4 sm:px-6 py-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-ink font-display">
              BRE Policy & Tenant Configurator
            </h1>
            <span className="rounded-md bg-brand-500/10 px-2 py-0.5 text-xs font-mono font-bold text-brand-600 border border-brand-500/20">
              {tenantUuid}
            </span>
          </div>
          <p className="text-xs text-ink-subtle mt-0.5">
            Configure partner bank overlays, risk weighting buffers, and SLA thresholds.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-2xl border border-line bg-white p-6 shadow-xs space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-ink">CIBIL Score Overlay Margin</label>
              <span className="font-mono text-xs font-bold text-brand-600">+{cibilOverlay} points</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              step="5"
              value={cibilOverlay}
              onChange={(e) => setCibilOverlay(Number(e.target.value))}
              className="w-full accent-brand-500"
            />
            <p className="text-[0.6875rem] text-ink-subtle mt-1">
              Buffer added on top of bank minimum score before approval.
            </p>
          </div>

          <div className="pt-4 border-t border-line">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-ink">Maximum Allowed FOIR Ceiling</label>
              <span className="font-mono text-xs font-bold text-brand-600">{maxFoir}%</span>
            </div>
            <input
              type="range"
              min="40"
              max="80"
              step="5"
              value={maxFoir}
              onChange={(e) => setMaxFoir(Number(e.target.value))}
              className="w-full accent-brand-500"
            />
          </div>

          <div className="pt-4 border-t border-line flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-ink">Sibling Co-Applicant Guarantee</p>
              <p className="text-[0.6875rem] text-ink-subtle">Permit sibling income pooling for salaried borrowers.</p>
            </div>
            <input
              type="checkbox"
              checked={allowSiblingCoapp}
              onChange={(e) => setAllowSiblingCoapp(e.target.checked)}
              className="h-4 w-4 rounded accent-brand-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-xs font-bold text-success animate-fade-in">Configuration Saved!</span>}
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-xs font-bold text-white shadow-glow hover:bg-brand-600 transition-all"
          >
            <Save size={16} />
            <span>Save Rules</span>
          </button>
        </div>
      </form>
    </div>
  );
}
