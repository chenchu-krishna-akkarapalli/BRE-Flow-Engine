---
name: frontend-principles
description: Next.js App Router engineering standards — navigation/caching for sub-30ms transitions, state boundaries, request batching, pnpm workspaces, TypeScript 7.0 native compiler and Turbopack build pipeline, SOLID for components, CSS tokens, a11y, and resiliency. Load for any frontend implementation or review task.
---

# Frontend Principles — Next.js App Router

Stack in this repo: Next.js 16.2, React 19.2, Tailwind v4, pnpm workspaces, TypeScript 5 (7.0 migration pending).

## 1. Navigation & caching — sub-30ms transitions

At a 30ms budget the network is not in the path; the payload must already be on the client.

- `<Link href prefetch>` — segments prefetch as links enter the viewport. Keep prefetched RSC payloads small.
- **Parallel Routes** (`@slot`) and **Intercepting Routes** (`(.)folder`) for modals that preserve navigation state.
- `fetch` is deduped per render pass via React `cache()`.
- Revalidation: `fetch(url, { next: { revalidate: 60 } })` (time) · `revalidateTag('user-profile')` from a Server Action (on-demand).

## 2. State boundaries

- **Server state** → TanStack Query / SWR / RSC cache. They own revalidation, SWR, refocus, retries. Never reimplement in `useEffect`.
- **UI state** → Zustand (~1kb) or `useState`, for ephemeral interaction only (drawer open, hover card).
- **URL is the source of truth** for filters, search, pagination, tabs — `useSearchParams()` / `useRouter()`. Shareable, back-button-correct.
- Subscribe atomically: `useStore(s => s.activeId)`, never the whole store.

## 3. Request efficiency

Debounce input (300ms) before URL/network writes; throttle continuous events (scroll, resize) — debounce drops frames you need.

```typescript
const handleSearch = useDebouncedCallback((term: string) => {
  const params = new URLSearchParams(searchParams);
  term ? params.set('q', term) : params.delete('q');
  replace(`${pathname}?${params.toString()}`);
}, 300);
```

Batch related widget calls into one endpoint. Never chain independent awaits — that is a waterfall:

```typescript
const [user, posts] = await Promise.all([getUser(id), getUserPosts(id)]);
```

## 4. pnpm

- Content-addressable store, hard-linked into `node_modules`.
- `.npmrc`: `hoist=false` or explicit patterns — blocks ghost dependencies.
- `pnpm-workspace.yaml` shares tokens/utils locally without publishing.

## 5. Build, compilation & assets

Two separate budgets — do not conflate:

| Budget | Owner | Affects |
|---|---|---|
| Dev loop (HMR, type feedback, CI) | Turbopack/SWC, TypeScript | Velocity |
| User transition (< 30ms) | Bundle size, splitting, assets | Core Web Vitals |

### TypeScript 7.0 — native compiler

Complete rewrite of the compiler in **Go** (native port, *Corsa*), replacing the JS implementation used from 1.0–6.x. **~10x average** full type-check speedup:

| Codebase | JS | Native (`tsgo`) | Gain |
|---|---|---|---|
| VS Code (~1.5M LOC) | 77.8s | 7.5s | 10.4x |
| TypeORM | 17.5s | 1.3s | 13.5x |
| Playwright | 11.1s | 1.1s | 10.1x |
| rxjs | 1.1s | 0.1s | 11.0x |

Source of the gain: native code (no JIT warmup/GC) + **parallel type checking across files and projects over shared memory**; the JS compiler was single-threaded. The JS codebase continues as the **6.x line** for API compatibility (ESLint type-aware rules, ts-morph, custom transformers) — verify toolchain support before switching.

**HMR is not affected.** Turbopack/SWC never type-check — they *strip* types syntactically. HMR latency is bundler work and does not change. What gets 10x:

- `tsc --noEmit` — the CI and pre-commit correctness gate.
- Editor IntelliSense (new Go language server; large-repo project load improves similarly).
- The dev-overlay error round trip, which Next.js runs as a type-check pass separate from the bundler.

**Build ceilings shift by your type-check share, not by 10x.** `next build` type-checks as a discrete phase; Rust bundling/minification is unchanged. Total gain is bounded by tsc's share — dominant in a monorepo, marginal in a small app. Measure before promising a number.

**Monorepos gain most**: project references parallelise across the project graph instead of walking it serially. Keep `.tsbuildinfo`; parallelism compounds with incrementality.

**Adoption cost, measured on this repo (TS 7.0.2, Next 16.2.12):**

- `next build` fails outright — TS 7 no longer exposes the in-process JS compiler API Next.js drives. Fix: `experimental.useTypeScriptCli: true`, which routes checking through the CLI. Type-check went **4.2s → 0.7s (6x)**.
- **ESLint is fully blocked.** `typescript-eslint` throws `does not support TS 7.0` at module load, and `eslint-config-next` imports it unconditionally, so no rule subset survives. `pnpm overrides` cannot fix it — `typescript` is a *peer* dependency and resolves from the root. Blocked on typescript-eslint#10940 (support targeted at TS ≥7.1). Use `tsc --noEmit` as the correctness gate until then.
- TS **6.x** (6.0.3) is the JS-codebase line: keeps the compiler API and sits inside typescript-eslint's `<6.1.0` range, so build *and* lint work. It is the staging step if you need lint.

**Turbopack is orthogonal by design** — run type checking as a separate concurrent process:

```jsonc
{ "scripts": {
    "dev": "next dev",
    "typecheck": "tsgo --noEmit --watch",
    "dev:all": "pnpm run '/^(dev|typecheck)$/'" } }
```

### Bundler, chunks, assets

- **Turbopack is the default in Next.js 16** — the `--turbo` flag from 13–15 is obsolete. SWC handles transpile/minify; Lightning CSS backs Tailwind v4.
- `experimental.optimizePackageImports: ['lucide-react', 'lodash-es', 'date-fns']` for barrel-file libraries. Prefer `import debounce from 'lodash/debounce'` over named barrel imports.
- `next/image` always, with explicit `width`/`height` or aspect-ratio wrapper → AVIF/WebP, edge resize, lazy load, zero CLS.
- Framework-native font loading (subset + inline) or `font-display: swap`.
- `next/dynamic` with `ssr: false` for heavy client-only widgets (editors, charts, maps).

## 6. Architecture, composition & SOLID

- **Presentational vs. container** — render UI *or* orchestrate data, never both.
- **Composition over inheritance**; **compound components** (`<Select.Trigger>`, `<Select.Option>`) over monolithic config props.
- Extract stateful logic into hooks (`useLocalStorage`, `useMediaQuery`); share **Zod schemas** between client forms and Server Actions, inferring types rather than duplicating interfaces.
- Abstract on the **Rule of Three**. Duplicating twice beats a wrong abstraction. No props for designs that do not exist.
- **KISS** — Tailwind utilities over JS style computation; no Redux where `useState` or a query param suffices.

| SOLID | Component application |
|---|---|
| **S** | One reason to change. Split fetch + validate + render into `useUserData()`, `userSchema`, `<UserProfileCard/>`. |
| **O** | Extend by composition — expose `<Modal.Header/Body/Footer>`, don't edit internals. |
| **L** | Primitives honour base HTML contracts: forward `type`, `disabled`, `aria-label`, `onClick`. |
| **I** | Depend on rendered fields (`{avatarUrl, name}`), not the 50-field domain object. |
| **D** | Inject service callers/render props so components mock in Storybook and Vitest. |

**Least surprise:** `onChange` passes the standard event/value; links change the URL, buttons act — never blur `<a href>` and `<button>`.

**Layering:** Presentation (JSX/CSS) → UI logic (hooks/local state) → Data access (Query/fetch/Actions) → Domain (types/Zod).

## 7. CSS

- Token-based only — no raw hex, no `padding: 17px`. Map to CSS variables or Tailwind theme tokens.
- Fluid scale: `font-size: clamp(1rem, 2vw + 0.5rem, 2.5rem)`.
- Reserve space for async content (skeletons, `aspect-ratio`) — layout stability is a rendering concern.

## 8. Accessibility

- Semantic HTML first (`<header>`, `<nav>`, `<button>`) — never clickable `<div>`s.
- WAI-ARIA patterns for dropdowns/accordions/dialogs; overlays trap focus (`aria-modal="true"`), restore it on close, clean up escape listeners.
- WCAG 2.1 AA: 4.5:1 text contrast, 44x44px touch targets.

## 9. Resiliency & security

- Error boundaries around feature blocks — no blank screens.
- Validate every external payload (API, webhook, form) with a runtime Zod schema at the boundary. TypeScript types are erased; they are not validation.
- DOMPurify before rendering user-supplied HTML.
- Progressive enhancement: native forms + Server Actions work pre-hydration; pair with skeletons, offline banners, boundaries.
