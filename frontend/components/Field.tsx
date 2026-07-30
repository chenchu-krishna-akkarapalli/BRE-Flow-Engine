"use client";

import { ReactNode, useState, useEffect, useRef } from "react";

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
      onWheel={(e) => type === "number" && e.currentTarget.blur()}
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

  // Sync searchQuery with value when closed
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery(value || "");
    }
  }, [value, isOpen]);

  // Click outside handler
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

  // Filter options based on query
  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(q)
  );

  // If search query has 2 or more letters, sort matching options to the top
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

  // Reset highlighted index when options change
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
          value={isOpen ? searchQuery : (value || "")}
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
          className={`${CONTROL} pr-10`}
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
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink cursor-pointer"
        >
          <svg
            className={`h-4 w-4 transform transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {isOpen && displayOptions.length > 0 && (
        <ul className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-sm border border-line bg-bg-surface py-1 shadow-float no-scrollbar">
          {displayOptions.map((opt, index) => {
            const isSelected = opt === value;
            const isHighlighted = index === highlightedIndex;
            return (
              <li
                key={opt}
                onClick={() => handleSelect(opt)}
                className={`cursor-pointer px-4 py-2 text-[0.9375rem] transition-colors ${
                  isHighlighted
                    ? "bg-brand-500/20 text-ink"
                    : isSelected
                    ? "bg-brand-500/15 text-brand-400 font-medium"
                    : "text-ink-muted hover:bg-brand-500/10 hover:text-ink"
                }`}
              >
                {opt}
              </li>
            );
          })}
        </ul>
      )}
      {isOpen && displayOptions.length === 0 && (
        <div className="absolute left-0 right-0 z-50 mt-1 rounded-sm border border-line bg-bg-surface px-4 py-3 text-center text-sm text-ink-subtle shadow-float">
          No results found
        </div>
      )}
    </div>
  );
}
