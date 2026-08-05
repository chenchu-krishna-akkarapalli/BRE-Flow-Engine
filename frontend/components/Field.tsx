"use client";

import { ReactNode, useState, useEffect, useRef } from "react";
import { Check, ChevronDown } from "lucide-react";

// Form Primitives with 48px touch targets and day mode light styling

const CONTROL_BASE =
  "w-full min-h-[48px] rounded-xl border border-line-strong bg-white px-4 py-3 " +
  "text-[0.9375rem] text-ink placeholder:text-ink-subtle backdrop-blur-md transition-all duration-200 " +
  "hover:border-brand-500/50 focus:border-brand-500 focus:bg-white focus:shadow-[0_0_15px_rgba(13,148,136,0.15)] focus:outline-none disabled:opacity-50";

export function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={htmlFor}
        className="text-[0.9375rem] font-semibold leading-snug text-ink tracking-wide"
      >
        {label}
      </label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} className="text-[0.8125rem] font-medium text-danger animate-pulse flex items-center gap-1">
          <span>⚠️</span> {error}
        </p>
      )}
    </div>
  );
}

// `verified` paints the state an OTP challenge earns: green border, green tint
// and a tick. The tick is decorative — the adjacent "Verified" label announces it.
export function TextInput({
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  error,
  numeric = false,
  verified = false,
  disabled = false,
}: {
  id: string;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  error?: string;
  numeric?: boolean;
  verified?: boolean;
  disabled?: boolean;
}) {
  const state = error
    ? "border-danger focus:border-danger focus:shadow-none"
    : verified
    ? "border-success bg-success-bg pr-11"
    : "";
  return (
    <div className="relative w-full">
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        onWheel={(e) => type === "number" && e.currentTarget.blur()}
        className={`${CONTROL_BASE} ${numeric ? "numeric" : ""} ${state}`}
      />
      {verified && !error && (
        <Check
          size={18}
          strokeWidth={3}
          aria-hidden
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-success"
        />
      )}
    </div>
  );
}

export function Select({
  id,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly (string | { value: string; label: string })[];
  placeholder?: string;
}) {
  return (
    <div className="relative w-full">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${CONTROL_BASE} appearance-none pr-10 cursor-pointer`}
      >
        {placeholder && (
          <option value="" className="bg-white text-ink-subtle">
            {placeholder}
          </option>
        )}
        {options.map((opt) => {
          const v = typeof opt === "string" ? opt : opt.value;
          const l = typeof opt === "string" ? opt : opt.label;
          return (
            <option key={v} value={v} className="bg-white text-ink">
              {l}
            </option>
          );
        })}
      </select>
      <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-subtle">
        <ChevronDown size={18} />
      </div>
    </div>
  );
}

export function Checkbox({
  id,
  checked,
  onChange,
  label,
  disabled = false,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={`group flex min-h-[48px] items-center gap-3 rounded-xl border p-3.5 transition-all duration-200 ${
        disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"
      } ${
        checked
          ? "border-brand-500 bg-brand-500/10 text-ink font-medium shadow-sm"
          : "border-line bg-white text-ink-muted hover:border-line-strong hover:bg-bg-raised"
      }`}
    >
      <div className="relative flex items-center justify-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <div
          className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all ${
            checked
              ? "border-brand-500 bg-brand-500 text-white"
              : "border-line-strong bg-white group-hover:border-brand-500"
          }`}
        >
          {checked && <Check size={14} strokeWidth={3} />}
        </div>
      </div>
      <span className="text-[0.9375rem] font-medium leading-snug">{label}</span>
    </label>
  );
}

// Answer cards: Large, touch-target-rich interactive cards for Day Mode
export function RadioCards({
  name,
  value,
  onChange,
  options,
  label,
  disabled = false,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
  label?: string;
  disabled?: boolean;
}) {
  const columns =
    options.length === 2
      ? "sm:grid-cols-2"
      : options.length === 3
      ? "sm:grid-cols-3"
      : "sm:grid-cols-2";

  return (
    <div role="radiogroup" aria-label={label ?? name} className={`grid gap-3 ${columns}`}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <label
            key={opt.value}
            className={`group relative flex min-h-[52px] items-center justify-between rounded-xl border px-4 py-3.5 text-left transition-all duration-200 ${
              disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"
            } ${
              active
                ? "border-brand-500 bg-gradient-to-r from-brand-500/15 to-brand-indigo/10 font-semibold text-ink shadow-[0_2px_12px_rgba(13,148,136,0.15)] ring-1 ring-brand-500/40 scale-[1.01]"
                : "border-line bg-white text-ink-muted hover:scale-[1.01] hover:border-line-strong hover:bg-bg-raised hover:text-ink"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={active}
              disabled={disabled}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            <span className="text-[0.9375rem] leading-snug">{opt.label}</span>
            <div
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all ${
                active
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-line-strong bg-white group-hover:border-brand-500"
              }`}
            >
              {active && <Check size={12} strokeWidth={3} />}
            </div>
          </label>
        );
      })}
    </div>
  );
}

export function SearchableSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  inputRef: externalInputRef,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  placeholder?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const localInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef || localInputRef;

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery(value || "");
    }
  }, [value, isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const q = searchQuery.toLowerCase().trim();
  const filteredOptions = options.filter((opt) => opt.toLowerCase().includes(q));

  const displayOptions = [...filteredOptions];
  if (q.length >= 2) {
    displayOptions.sort((a, b) => {
      const aStarts = a.toLowerCase().startsWith(q);
      const bStarts = b.toLowerCase().startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.localeCompare(b);
    });
  }

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchQuery]);

  const handleSelect = (opt: string) => {
    onChange(opt);
    setSearchQuery(opt);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          displayOptions.length > 0 ? (prev + 1) % displayOptions.length : -1
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          displayOptions.length > 0
            ? (prev - 1 + displayOptions.length) % displayOptions.length
            : -1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < displayOptions.length) {
          handleSelect(displayOptions[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          id={id}
          ref={inputRef}
          type="text"
          value={isOpen ? searchQuery : value || ""}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setSearchQuery(value || "");
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`${CONTROL_BASE} pr-10`}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) {
              inputRef.current?.focus();
            }
          }}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink cursor-pointer"
        >
          <ChevronDown
            size={18}
            className={`transform transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {isOpen && displayOptions.length > 0 && (
        <ul className="absolute left-0 right-0 z-50 mt-2 max-h-60 overflow-auto rounded-xl border border-line-strong bg-white py-2 shadow-float backdrop-blur-xl no-scrollbar">
          {displayOptions.map((opt, index) => {
            const isSelected = opt === value;
            const isHighlighted = index === highlightedIndex;
            return (
              <li
                key={opt}
                onClick={() => handleSelect(opt)}
                className={`flex cursor-pointer items-center justify-between px-4 py-2.5 text-[0.9375rem] transition-colors ${
                  isHighlighted
                    ? "bg-brand-500/10 text-ink font-medium"
                    : isSelected
                    ? "bg-brand-500/15 text-brand-600 font-semibold"
                    : "text-ink-muted hover:bg-bg-raised hover:text-ink"
                }`}
              >
                <span>{opt}</span>
                {isSelected && <Check size={16} className="text-brand-500" />}
              </li>
            );
          })}
        </ul>
      )}
      {isOpen && displayOptions.length === 0 && (
        <div className="absolute left-0 right-0 z-50 mt-2 rounded-xl border border-line-strong bg-white px-4 py-3 text-center text-sm text-ink-subtle shadow-float">
          No matching localities found
        </div>
      )}
    </div>
  );
}
