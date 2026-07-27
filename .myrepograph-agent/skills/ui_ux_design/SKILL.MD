---
name: ui_ux_design
description: UI/UX design tokens and interaction contract for the FlowBRE onboarding wizard (POST /api/v1/onboarding/evaluate/form) — CSS-variable tokens, entity-aware step/progress model, rule-level validation telemetry, 8-bank eligibility matrix, and the Step 5 review/decision screen. Load for any onboarding wizard UI work in frontend/ or flow.html.
---

# UI/UX — FlowBRE Onboarding Wizard

Two consumers, one token source: `flow.html` (Tailwind CDN + vanilla JS, dark glass) and `frontend/` (Next.js 16 + Tailwind v4). Next maps tokens via `@theme`, flow.html via `tailwind.config.extend`. No hardcoded hex anywhere.

## 1. Tokens

```css
:root {
  /* Surfaces (dark is default) */
  --color-bg-deep:      #0f172a;   --color-bg-surface: #1e293b;
  --color-bg-raised:    #334155;
  --color-border:       rgba(255,255,255,.08);
  --color-border-strong:rgba(255,255,255,.16);
  --glass-fill: rgba(30,41,59,.7); --glass-blur: 12px;

  /* Brand */
  --color-brand-50:#eef2ff; --color-brand-100:#e0e7ff;
  --color-brand-400:#818cf8;  /* TEXT + links on dark */
  --color-brand-500:#6366f1;  /* fills, borders, focus ring — NEVER text */
  --color-brand-600:#4f46e5;  /* primary button fill */
  --color-brand-700:#4338ca; --color-brand-900:#312e81;

  /* Text */
  --color-text-primary:#f1f5f9; --color-text-muted:#94a3b8;
  --color-text-subtle:#64748b;  /* decorative/disabled only — 3.75:1 */

  /* Verdict semantics */
  --color-success:#4ade80; --color-success-bg:rgba(74,222,128,.12);
  --color-danger: #f87171; --color-danger-bg: rgba(248,113,113,.12);
  --color-warning:#fbbf24; --color-warning-bg:rgba(251,191,36,.12);
  --color-info:   #38bdf8; --color-info-bg:   rgba(56,189,248,.12);

  /* Type */
  --font-sans: Inter, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  --text-display: 1.75rem/2.125rem  var(--font-sans);  /* 700 */
  --text-heading: 1.25rem/1.75rem   var(--font-sans);  /* 600 */
  --text-body:    0.9375rem/1.5rem  var(--font-sans);  /* 400 */
  --text-caption: 0.8125rem/1.25rem var(--font-sans);  /* 400 */
  --text-mono:    0.875rem/1.25rem  var(--font-mono);  /* 500 */

  /* Space (4px base) */
  --space-1:.25rem; --space-2:.5rem;  --space-3:.75rem; --space-4:1rem;
  --space-6:1.5rem; --space-8:2rem;   --space-12:3rem;  --space-16:4rem;
  --shell-max:1200px; --form-col:640px; --telemetry-col:380px;

  /* Radius + elevation */
  --radius-sm:6px; --radius-md:10px; --radius-lg:16px; --radius-full:9999px;
  --shadow-card: 0 4px 24px rgba(0,0,0,.28);
  --shadow-float:0 12px 40px rgba(0,0,0,.40);

  /* Motion */
  --dur-instant:120ms; --dur-fast:180ms; --dur-step:240ms;
  --ease-out:    cubic-bezier(.16,1,.3,1);      /* entrances */
  --ease-in-out: cubic-bezier(.65,0,.35,1);     /* step transitions */
  --ease-spring: cubic-bezier(.34,1.56,.64,1);  /* verdict stamp ONLY */
}
.numeric { font: var(--text-mono); font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: reduce) {
  *,*::before,*::after { animation-duration:.01ms!important; transition-duration:.01ms!important; }
}
```

**Hard rules**
- `--color-brand-500` is 4.00:1 on `--color-bg-deep` → fails AA for text. Use `--color-brand-400` (5.98:1).
- Verdict state is never color-only — always icon + text label.
- All numerics (CIBIL, DPD, ₹, rule IDs, latency) use `.numeric` for tabular alignment.
- Step transitions slide X in direction of travel at `--dur-step`. `--ease-spring` only on the decision stamp.

**Layout:** 12-col inside `--shell-max`. ≥1024px = form column (`--form-col`) + sticky telemetry rail (`--telemetry-col`). Below 1024px the rail becomes a bottom sheet with a persistent summary bar — never drop it.

## 2. Step model & progress

| Step | Title | Collected |
|---|---|---|
| 1 | Identity Details | Name, entity type, PAN, DOB, contact |
| 2 | Address & Residence | Pincode, city/state, residence tenure |
| 3 | Occupation & Business | Employment or business profile, income proof |
| 4 | Banking & Bureau | Bank, loan type, CIBIL, DPD, write-offs |
| 5 | Co-Applicant Mapping | Co-applicant, then review & submit |

**Progress is entity-aware — a fixed 20% ladder is wrong.** Company skips steps 2 and 5 (the API rejects them if sent) and completes 3 steps, so a hardcoded ladder strands it at 60%.

```typescript
const STEP_PLAN = {
  Individual: [1, 2, 3, 4, 5],
  HUF:        [1, 2, 3, 4, 5],
  Company:    [1, 3, 4],
} as const;
// Individual/HUF -> 20/40/60/80/100 · Company -> 33/67/100
const progress = (entity: EntityType, stepId: number) => {
  const plan = STEP_PLAN[entity];
  return Math.round(((plan.indexOf(stepId) + 1) / plan.length) * 100);
};
```

Entity type is chosen in Step 1, so the rail is indeterminate until then: render 5 slots with the tail 2 dimmed, animate their removal at `--dur-fast` on Company selection.

Stepper states: `upcoming` (`--color-text-subtle`) · `active` (brand-400 label, brand-500 ring) · `complete` (success check) · `error` (danger). Never lock a user forward past a failing step.

## 3. Validation telemetry

Surface `rule_id` + `category` + `message` from `rejection_reasons` — never collapse to "ineligible".

| Rule IDs | Category | Step | Icon (lucide) |
|---|---|---|---|
| `DEM-101` `DEM-102` `DEM-103` | Age & EMI maturity | 1 | `calendar-x` |
| `DEM-104` `DEM-105` | NRI residency | 1 | `globe` |
| `BUR-401` `BUR-401B` `BUR-401D` | Write-offs | 4 | `file-x` |
| `BUR-402` `BUR-403` | DPD history | 4 | `calendar-clock` |
| `BUR-404` | Currently overdue | 4 | `alert-octagon` |
| `BUR-405` | CIBIL floor | 4 | `gauge` |
| `BUR-406` | Open loan enquiries | 4 | `search-x` |
| `EMP-SAL-202`…`EMP-SAL-208` | Salaried employment | 3 | `briefcase` |
| `EMP-SE-301`…`EMP-SE-307` | Self-employed vintage/ITR/proof | 3 | `building-2` |
| `INC-601` | Secondary rental income | 3 | `home` |
| `ENT-501` `ENT-502` | Entity class (HUF, agriculture) | 1/3 | `landmark` |
| `RES-205` `RES-206` | Residence & guarantor | 2+3 | `key-round` |
| `COA-801` | Co-applicant relationship | 5 | `users` |
| `EXB-702` | Existing car loan | 4 | `car` |

`frontend/` uses `lucide-react`; `flow.html` uses Font Awesome equivalents (`fa-gauge`, `fa-calendar-xmark`, `fa-file-circle-xmark`, `fa-briefcase`, `fa-building`, `fa-users`, `fa-car`).

**Banner:** show value against threshold — "CIBIL 685 — BOI requires 701", not "score too low". Include category, rule ID (mono, `--text-caption`, muted), the delta, and a deep link to the owning step.

**Reserve height (CLS):** `.validation-slot { min-height: 96px }`, `.matrix-slot { min-height: 320px }`. Render the 8-row matrix skeleton with dashed values before first submit so the panel fills in place.

**Latency-driven interaction** (backend: CRUD < 80ms, eval < 10ms, e2e < 100ms — verdict lands inside the ~100ms "instant" window):
- **No submit spinner** — mounting and unmounting in 80ms reads as a glitch. Use a disabled button with a pending label.
- Skeletons gated behind 200ms so they never render on the happy path.
- Show `execution_time_ms` in the rail (`--color-info`, mono) — sub-100ms is a product claim.
- Past 400ms (Doherty threshold) show real progress; the SLA has been missed.
- Format validation (PAN, pincode, phone, email) is client-side on blur against the API's regexes — never spend a round trip on a format error.

## 4. Bank eligibility matrix

Banks: `BOI` `INDIAN_BANK` `IOB` `BOB` `BOM` `HDFC` `AXIS` `KOTAK`. One row each in the telemetry rail, eligible sorted first.

| State | Chip | Icon | Token |
|---|---|---|---|
| Eligible | `ELIGIBLE` | `check-circle-2` | `--color-success` |
| Rejected | `blocked by BUR-405` | `x-circle` | `--color-danger` |
| Not evaluated | `—` | `minus` | `--color-text-subtle` |

**Contract constraint:** `bank_eligibility[X]` is bank X's verdict **ANDed with the selected bank's**. When the selected bank rejects, all 8 return `false` — including banks that would accept on their own policy. Rendering that as a standalone matrix falsely tells the applicant no bank will take them.

- Title the panel **"Eligibility with {selected_bank} as your primary bank"** — never a bare "Bank Eligibility".
- When `overall_eligible` is false, replace the 8 rows with the blocking-rule summary + "Other banks are evaluated once your primary bank's checks pass".
- The Step 4 bank selector is a live control — changing it re-evaluates.

## 5. Step 5 — review & decision

**Summary card:** all inputs grouped by originating step, each group with an Edit affordance returning to that step with state intact. Groups: Identity (name, entity, PAN, DOB) · Address (pincode, city/state, tenure) · Occupation (profile, tenure/vintage, income proof) · Banking (bank, loan type, CIBIL, DPD, write-offs) · Co-Applicant.

**PII masked by default**, matching backend `redact_pii` exactly: PAN `AB******4F`, DOB `****-**-15`, Aadhaar `****-****-1234`. Per-field reveal (`eye`/`eye-off`) on deliberate press only — this is the most screenshotted surface in the flow.

**Decision panel**, on `status`, with `application_id` in mono as the support reference:

| Status | Treatment |
|---|---|
| `APPROVED` | `--color-success` border + `--color-success-bg`, `badge-check`, "Approved with {selected_bank}", stamp animates once on `--ease-spring` |
| `REJECTED` | `--color-danger` border + `--color-danger-bg`, `circle-slash`, followed by grouped rejection banners (§3) |

Rejection is never a dead end: render a **remediation block** with the smallest verdict-flipping change ("Add a guarantor" for `RES-205`; "BOM accepts 650" for `BUR-405`). Surface `persisted: false` when present — the verdict is valid but the audit trail did not write.

## 6. Accessibility (WCAG 2.1 AA)

| Pair | Ratio | Use |
|---|---|---|
| text-primary / bg-deep | 16.30:1 | Body, headings |
| text-primary / bg-surface | 13.35:1 | Card content |
| text-muted / bg-surface | 5.71:1 | Hints, captions |
| text-subtle / bg-deep | 3.75:1 | **Non-text only** |
| brand-500 / bg-deep | 4.00:1 | **Fills/borders only** |
| brand-400 / bg-deep | 5.98:1 | Links, brand text |
| #fff / brand-600 | 6.29:1 | Button label |
| success / bg-deep | 10.25:1 | Eligible |
| danger / bg-deep | 6.45:1 | Rejection |
| warning / bg-deep | 10.69:1 | Attention |
| info / bg-deep | 8.33:1 | Telemetry |

- Focus ring: 2px `--color-brand-500` at 2px offset. Never `outline:none` without a replacement.
- Touch targets ≥ 44x44px including stepper dots and matrix rows.
- Decision panel `role="status" aria-live="polite"`; mid-flow rejection banner `aria-live="assertive"`.
- Write-off checkbox cluster in Step 4 wraps in `<fieldset>` + `<legend>`.
- Errors bind via `aria-describedby`; failing steps carry `aria-invalid`.

## 7. Open questions — resolve before building

1. Is the indigo ramp committed, or does a bank-partner brand guide override it (would make tokens runtime, not build-time)?
2. **Is light mode required?** Currently dark-only; the §6 ratios do not transfer and the token surface roughly doubles.
3. Is glassmorphism intended for a regulated lending product, or should review/decision surfaces be opaque for legibility and print?
4. Does partial progress persist across sessions (needs a draft-state API)?
5. Free navigation between completed steps, or forward-gating on validity?
6. Does changing the primary bank re-evaluate live or only on submit?
7. **How much rejection reasoning goes to an applicant vs. an internal operator?** Exposing "BOB requires combined ITR ₹600,000" is a lending-policy disclosure decision with regulatory weight.
8. Should the API expose an un-ANDed per-bank verdict so §4 can show genuine per-bank outcomes? (Backend change.)
9. On rejection, do we surface alternative banks, or is cross-selling out of scope?
10. Delivery target: `flow.html`, `frontend/` (currently an unmodified scaffold), or both?
11. Locale/currency: Indian numbering (`₹1,20,000`) differs from Western grouping and affects every numeric token.
