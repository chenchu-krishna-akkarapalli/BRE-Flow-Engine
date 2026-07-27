"use client";

import type { ReactNode } from "react";

/** Form primitives. Every control carries a real <label for>, and spacing /
 *  radius come from tokens (Rules: input padding 10px 14px, radius 6px). */

const CONTROL =
  "w-full rounded-sm border border-line bg-bg-raised px-[14px] py-[10px] " +
  "text-ink placeholder:text-ink-subtle transition-colors " +
  "focus:border-brand-500 disabled:opacity-50";

export function Field({
  label, htmlFor, hint, error, children,
}: {
  label: string; htmlFor: string; hint?: string; error?: string; children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[6px]">
      <label htmlFor={htmlFor} className="text-[0.8125rem] text-ink-muted">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-[0.8125rem] text-ink-subtle">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} className="text-[0.8125rem] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput({
  id, value, onChange, placeholder, type = "text", error, numeric = false,
}: {
  id: string; value: string | number; onChange: (v: string) => void;
  placeholder?: string; type?: string; error?: string; numeric?: boolean;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      placeholder={placeholder}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      onChange={(e) => onChange(e.target.value)}
      className={`${CONTROL} ${numeric ? "numeric" : ""} ${error ? "border-danger" : ""}`}
    />
  );
}

export function Select({
  id, value, onChange, options, placeholder,
}: {
  id: string; value: string; onChange: (v: string) => void;
  options: readonly (string | { value: string; label: string })[];
  placeholder?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={CONTROL}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => {
        const v = typeof opt === "string" ? opt : opt.value;
        const l = typeof opt === "string" ? opt : opt.label;
        return <option key={v} value={v}>{l}</option>;
      })}
    </select>
  );
}

export function Checkbox({
  id, checked, onChange, label,
}: {
  id: string; checked: boolean; onChange: (v: boolean) => void; label: string;
}) {
  return (
    // 44px minimum touch target (ui_ux_design §6).
    <label htmlFor={id} className="flex min-h-[44px] cursor-pointer items-center gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-[18px] accent-brand-500"
      />
      <span className="text-[0.9375rem] text-ink">{label}</span>
    </label>
  );
}

export function RadioCards({
  name, value, onChange, options,
}: {
  name: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div role="radiogroup" aria-label={name} className="grid gap-3 sm:grid-cols-3">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <label
            key={opt.value}
            className={`flex min-h-[44px] cursor-pointer items-center justify-center rounded-md border px-4 py-3 text-center text-[0.9375rem] transition-colors ${
              active
                ? "border-brand-500 bg-brand-500/15 text-ink"
                : "border-line bg-bg-raised text-ink-muted hover:border-line-strong"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={active}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            {opt.label}
          </label>
        );
      })}
    </div>
  );
}
