# FlowBRE Frontend Architecture and Upgrade Plan

- **Status:** implementation blueprint
- **Scope:** `frontend/`, with documented backend contract dependencies
- **Last verified:** 2026-09-23
- **Target runtime:** Next.js 16 App Router, React 19, TypeScript 7, Zustand 5

## 1. Executive decision

FlowBRE will remain one **domain-modular Next.js application** with one build and deployment unit. Upgrade in this order:

1. Establish contracts, route ownership, security, tests, and vertical domain slices inside the existing application.
2. Move server-capable work from Client Components to App Router layouts and Server Components.
3. Add route-level and interaction-level code splitting.
4. Measure bundle, runtime, and operational boundaries.

## 2. Goals and non-goals

### Goals

- Give each business domain an owner, route boundary, public interface, and test surface.
- Remove duplicated policy calculations and hardcoded business thresholds from the browser.
- Make tenant and authorization context consistent for every API request.
- Reduce the initial client bundle and hydration surface.
- Replace seed/localStorage fallbacks with explicit loading, empty, unavailable, and error states.
- Provide safe incremental migration without a flag-day rewrite.
- Define measurable end-to-end deliverables and acceptance criteria.

### Non-goals

- No backend rule-engine rewrite or visual redesign is included.
- Do not add state, request, validation, or UI libraries before native Next.js/React and existing dependencies are exhausted.
- Client-side entitlement checks are not a security boundary; backend authorization remains authoritative.

## 3. Verified current state

### 3.1 Runtime and build

| Area | Current implementation |
|---|---|
| Framework | Next.js `16.2.12`, React `19.2.4` |
| Language | TypeScript 7, strict mode, no emit |
| Styling | Tailwind CSS 4 plus tokens/utilities in `app/globals.css` |
| State | Zustand stores |
| Icons | `lucide-react`, optimized through `optimizePackageImports` |
| Output | Next.js standalone image on Node 22 Alpine |
| Package manager | Declared `pnpm@9.15.4`; both pnpm and npm lockfiles exist |
| Tests | No frontend unit, component, integration, or browser tests are present |
| Route boundaries | No `error.tsx`, `loading.tsx`, or `not-found.tsx` files are present |
| Lazy loading | No `next/dynamic` feature boundaries are present |

Verification on the stated date:

- `npm run typecheck` passes.
- `npm run lint` cannot start because `typescript-eslint@8.65.0` rejects the installed TypeScript `7.0.2` API.
- `npm run build` reaches the production compiler but fails in the restricted/offline environment because `next/font/google` fetches Inter, JetBrains Mono, and Outfit from Google Fonts.

### 3.2 Current topology

```text
RootLayout (Server Component)
└── PortalShell (Client Component)
    ├── client-side authentication redirect
    ├── AppHeader
    ├── Sidebar -> useModuleStore -> GET /api/v1/navigation/modules
    └── active public, onboarding, tenant, or platform page

Browser state
├── useAuthStore -> JWT/session in localStorage
├── useModuleStore -> dynamic navigation with static fallback
├── useOnboardingStore -> draft, evidence, calculations, result, navigation
├── useRoleHierarchyStore -> seeded roles/users in localStorage
└── useSidebarStore

Backend
├── auth and session profile
├── onboarding evaluation, extraction, OTP, income, and FOIR
├── navigation and entitlements
├── tenants and users
└── workflow, telemetry, and reporting endpoints
```

### 3.3 Current route ownership

| Route family | Purpose | Data maturity |
|---|---|---|
| `/auth/login` | Challenge-response login and channel signup | API-backed with demo identities |
| `/new-channel` | Public tenant/channel signup | API-backed; failures become simulated success |
| `/health` | Product health display | Simulated client data/delay |
| `/` and `/{tenantUuid}` | Multi-step onboarding wizard | Core APIs live; significant client rule duplication |
| `/{tenantUuid}/dashboard` | Tenant dashboard | Primarily presentation data |
| `/{tenantUuid}/pipeline` | Lead pipeline | Seeded client state |
| `/{tenantUuid}/approvals` | Underwriting and channel approvals | Mixed seed/live APIs; 3.5-second polling |
| `/{tenantUuid}/commissions` | Commission operations | Primarily presentation data |
| `/{tenantUuid}/regional` | Regional reporting | Client guarded; presentation data |
| `/{tenantUuid}/logs` | Log search/display | Seeded client data |
| `/{tenantUuid}/telemetry` | SLA/telemetry display | Presentation data |
| `/{tenantUuid}/assignments` | User/role assignment | localStorage-backed hierarchy |
| `/{tenantUuid}/platformoverview` | Platform tenant overview | Seeded tenant/audit data |
| `/{tenantUuid}/platformoverview/{channelUuid}/{channelSlug}/workspace` | Channel users | Mixed live CRUD and seed fallback |
| `/platform/modules` | Module/entitlement studio | Live navigation APIs |
| `/platform/dashboard` | Platform dashboard | Duplicates seeded tenant/audit data |
| `/platform/user-management` | Assignment-page alias | Uses mock route parameters |
| `/platform/billing`, `/platform/db-health`, `/platform/cyber-cell` | Operational views | Presentation/demo data |

### 3.4 Integrated APIs

**Authentication**

- `POST /api/v1/auth/challenge`
- `POST /api/v1/auth/verify`
- `GET /api/v1/auth/me`

**Onboarding**

- `POST /api/v1/onboarding/evaluate/form`
- `GET /api/v1/onboarding/applications/{id}/export`
- document extraction endpoints for generic, CIBIL, payslip, COI, and ITR uploads
- OTP send/verify endpoints
- Phase 1 income and Phase 2 FOIR endpoints

**Navigation and tenancy**

- dynamic modules, catalog, permission matrix, and tenant-entitlement APIs
- tenant signup, approval/history, and user CRUD APIs

API calls are split across `lib/api.ts`, `lib/uas-client.ts`, stores, and pages. There is no single adapter for auth, tenant scope, timeouts, response parsing, or typed errors.

## 4. Confirmed architecture gaps

### 4.1 Excessive client surface

Nearly every route and reusable component is a Client Component. The root shell is client-rendered, so authenticated chrome and most page trees hydrate in the browser. Server Components are not a meaningful boundary yet.

### 4.2 Cross-domain hotspots

| File | Approx. lines | Mixed responsibilities |
|---|---:|---|
| `components/steps/Steps.tsx` | 1,375 | six steps, lookup, uploads, validation, UI |
| `store/useOnboardingStore.ts` | 1,121 | draft, navigation, mapping, policy, extraction, submission |
| Channel workspace page | 897 | users, roles, audit, CRUD, modal UI |
| Platform dashboard | 867 | tenant data, workflow, dialogs, audit |
| Login page | 831 | login, signup, demos, orchestration, UI |
| Approvals page | 804 | underwriting, channel approval, polling, mutations |
| Module manager page | 721 | catalog, matrix, entitlements, editing UI |

### 4.3 Browser policy duplication

`useOnboardingStore.ts` contains age, co-applicant, ITR, salary, income, and FOIR thresholds/calculations. These duplicate backend business logic and may produce different preview and submitted decisions. Authoritative thresholds must come from backend metadata or calculation results. Any client preview must be labelled non-authoritative and contract-tested.

### 4.4 Inconsistent authentication and tenancy

- Access and refresh tokens are JavaScript-readable in `localStorage`.
- Protected routes redirect only after client hydration.
- `lib/api.ts` uses a build-time `NEXT_PUBLIC_TENANT_ID` default instead of authenticated tenant context.
- Several module/tenant/user calls omit `Authorization` and/or explicit tenant context.
- Request and error behavior varies by page.

### 4.5 Incomplete authorization coverage

Dynamic navigation hides links, but only the regional page visibly uses `ModuleGuard`. Hidden navigation is not route protection. Every restricted route/mutation needs backend authorization, route/layout gating for UX, and action-level permission checks.

### 4.6 Demo fallbacks masquerade as success

Channel signup converts any network/server failure into a successful pending ticket. Other screens silently fall back to seed users, tenants, logs, leads, and roles. Demo behavior must be behind an explicit non-production flag and visibly labelled.

### 4.7 Polling and lifecycle inefficiency

Approvals perform three calls every 3.5 seconds plus focus/visibility refreshes. Until server push is complete, polling needs backoff, hidden-tab suspension, request deduplication, and stale-data indicators.

### 4.8 Missing reliability controls

- No automated frontend tests or route error/loading boundaries.
- No common cancellation, timeout, retry, or idempotency policy.
- No frontend telemetry/Web Vitals contract.
- No route bundle budget or analyzer gate.
- No generated/validated frontend-backend contract artifact.

### 4.9 Toolchain and build reproducibility

- The declared TypeScript 7 compiler is ahead of the installed ESLint TypeScript parser support, so lint is currently unusable.
- Production builds depend on live Google Fonts downloads and are not hermetic/offline reproducible.
- Two lockfiles permit npm and pnpm dependency resolution to drift.

Phase 0 must choose a supported lint/compiler pairing, self-host/subset the required font files, and retain one canonical lockfile.

## 5. Target architecture

### 5.1 Domain modules

```text
frontend/
├── app/                              # routing/composition only
│   ├── (public)/                     # auth, signup, health
│   ├── (authenticated)/
│   │   ├── layout.tsx                # authenticated server-aware shell
│   │   ├── [tenantUuid]/
│   │   └── platform/
│   ├── error.tsx
│   ├── loading.tsx
│   └── not-found.tsx
├── modules/
│   ├── identity/                     # session, roles, permissions
│   ├── onboarding/                   # wizard and submission
│   ├── documents/                    # upload/extraction adapters and views
│   ├── income/                       # Phase 1/2 result presentation
│   ├── tenant-operations/            # dashboard, pipeline, approvals, commissions
│   ├── workforce/                    # users, roles, hierarchy
│   ├── platform-governance/          # tenants, modules, entitlements
│   └── observability/                # health, telemetry, logs
├── shared/
│   ├── api/                          # request adapter and transport DTOs
│   ├── auth/                         # session interface and route policy
│   ├── config/                       # validated public configuration
│   ├── ui/                           # primitives only
│   ├── observability/                # logging and Web Vitals
│   └── testing/                      # fixtures/render helpers
└── styles/
```

This is an incremental target. Compatibility re-exports preserve imports while files move.

### 5.2 Module contract and import rules

```text
modules/<domain>/
├── index.ts                 # public exports
├── components/
├── server/
├── client/
├── model/
├── contracts/
└── tests/
```

- `app/` imports module public interfaces and `shared/` only.
- Modules import `shared/`, never another module's private files.
- Cross-domain operations use public functions, DTOs, URLs, or event contracts.
- `shared/` never imports a business module.
- Business thresholds do not live in shared code or frontend stores.
- ESLint `no-restricted-imports` enforces boundaries.

### 5.3 Route ownership

| Domain | Route ownership |
|---|---|
| Identity | `/auth/*`, `/new-channel` |
| Onboarding | `/{tenant}/onboarding/*` |
| Tenant operations | dashboard, pipeline, approvals, commissions, regional |
| Workforce | assignments and channel-user workspace |
| Platform governance | `/platform/*`, platform overview, modules |
| Observability | health, telemetry, logs |

### 5.4 Rendering model

- Layouts, access resolution, initial reads, metadata, and static presentation default to Server Components.
- Client Components are leaf islands for forms, uploads, dialogs, filters, and browser APIs.
- Route groups provide separate public/authenticated shells.
- Heavy secondary views load with `next/dynamic` when opened.
- Avoid `ssr: false` unless a dependency requires the browser.
- Use route `loading.tsx` and scoped `Suspense` boundaries.

Initial lazy candidates: `CoiStructuredView`, `CibilBureauSummaryCard`, expanded audit/bank matrices, `CorporateSalesTree`, permission-matrix editor, and administration dialogs.

### 5.5 State ownership

| State | Owner |
|---|---|
| Auth session | Secure server-managed session; minimal client projection |
| Tenant/role context | Authenticated layout/session contract |
| Server resources | Server query or domain request hook with explicit cache policy |
| Onboarding draft | Onboarding store/reducer scoped by draft/application ID |
| Wizard step | URL where useful; otherwise onboarding state machine |
| Upload progress | Document interaction component |
| Extracted evidence | Document domain referenced by draft/application |
| Income/FOIR result | Server response; labelled client preview only if retained |
| Sidebar drawer | Small UI store |
| Catalog/matrix | Platform-governance domain |

Split onboarding state into draft/mutations, navigation/state machine, server payload mapper, extraction adapters, and server-result state.

### 5.6 Unified API boundary

Create one request adapter:

```ts
type RequestContext = {
  tenantId?: string;
  signal?: AbortSignal;
  idempotencyKey?: string;
};

request<TResponse, TBody = never>(
  path: string,
  options: RequestInit & RequestContext & { body?: TBody },
): Promise<TResponse>;
```

It must:

- derive tenant scope from the authenticated session;
- attach authorization through the secure session model;
- normalize backend error envelopes and validation issues;
- support cancellation and documented timeouts;
- handle `204`, JSON, blob, and multipart responses;
- propagate operation/correlation IDs;
- redact PII from diagnostics;
- never convert a failed mutation into success;
- expose domain adapters rather than raw `fetch` to components.

Direct page fetches move to domain adapters under `modules/*/client/api.ts`.

### 5.7 Contract strategy

- Backend OpenAPI is the transport DTO source.
- Generate TypeScript DTOs in CI or validate maintained DTOs against an exported OpenAPI artifact.
- Domain models stay separate from transport DTOs and use explicit mappers.
- Contract changes fail CI before deployment.
- Upload variants use discriminated types.
- Money/identifiers are never inferred from display strings.
- Dates use documented ISO/timezone semantics.

### 5.8 Authentication, security, and tenancy

1. Prefer an `HttpOnly`, `Secure`, `SameSite` session cookie or backend-for-frontend exchange over JavaScript-readable long-lived tokens.
2. Enforce auth before rendering protected route groups.
3. Resolve tenant membership and permissions server-side.
4. Keep backend authorization authoritative for every operation.
5. Add CSRF protection for cookie-authenticated mutations.
6. Define expiry, refresh, logout, revocation, and multi-tab behavior.
7. Never log PAN, Aadhaar, DOB, documents, tokens, or proof material.
8. Apply CSP, frame restrictions, referrer policy, and MIME-sniffing protection.
9. Validate upload type/size/status on client and server.
10. Remove demo credentials and OTP echoing from production builds.

The URL tenant UUID is routing context, not proof of access. Authenticated scope must match backend membership. Platform context switches are explicit and audited. Tenant/user/role-sensitive cache keys include scope. Logout or tenant switching clears scoped stores and in-flight work.

### 5.9 Onboarding workflow

```text
identity -> address -> occupation -> banking -> co-applicant
         -> document income -> review -> submitting -> decision
```

- Server metadata determines applicable steps and conditional requirements.
- One schema maps backend validation locations to owned fields/steps.
- Step transitions run scoped validation.
- Submission is idempotent and cancel-safe.
- Draft identity is stable and can support later server persistence.
- Extraction changes only explicitly mapped fields.
- Verified evidence and editable values cannot silently diverge.
- Backend responses own income, FOIR, and eligibility decisions.
- Reset cleans object URLs, timers, requests, evidence, and sensitive memory.

### 5.10 UX reliability and accessibility

Each domain route provides loading, empty, error, forbidden, stale, and retry states. Dialogs, menus, uploads, and tables are keyboard-operable; focus restores after dialogs/steps; labels and errors are programmatic; live regions announce uploads/validation/submission; reduced motion and mobile/tablet/desktop layouts are verified.

### 5.11 Observability

Capture without PII:

- LCP, INP, and CLS by route/domain;
- navigation and API duration;
- upload duration/outcome by document type;
- frontend errors with release, route, safe tenant identifier, and correlation ID;
- auth/session failures and fallback/demo activation;
- route/shared bundle size.

Events use a versioned schema and correlation IDs connect browser/backend traces.

## 6. Performance budgets

| Metric | Target |
|---|---:|
| LCP, p75 production | <= 2.5 s |
| INP, p75 production | <= 200 ms |
| CLS, p75 production | <= 0.1 |
| Public login initial JS | <= 170 KB gzip |
| Onboarding entry initial JS | <= 230 KB gzip |
| Administration initial JS | <= 250 KB gzip |
| Unplanned long tasks | none > 200 ms during normal step navigation |

Measure production builds. Phase 0 records current baselines; later phases prevent regression and move toward targets.

## 7. Testing strategy

| Layer | Coverage |
|---|---|
| Unit | mappers, reducers/state machines, permissions, redaction, field ownership |
| Component | forms, uploads, guards, tables, dialogs, error states |
| Contract | frontend DTOs against OpenAPI/representative responses |
| Integration | domain state plus mocked network behavior |
| Browser E2E | auth, tenant routing, onboarding, uploads, evaluation, approvals, entitlements |
| Accessibility | automation plus keyboard/focus scenarios |
| Visual | shell, wizard, decision, and governance screens |
| Performance | route bundle budgets and Web Vitals smoke checks |

Minimum E2E journeys:

1. Login, restore, expiry, logout, and unauthorized redirect.
2. Tenant user cannot switch tenants by editing the URL.
3. Complete each supported onboarding profile branch.
4. Upload valid, invalid, and oversized supported documents.
5. Backend validation returns to the owning field.
6. Repeated submit creates one application.
7. Export uses tenant/auth context.
8. Missing entitlement produces forbidden UI and backend denial.
9. Module/matrix/tenant entitlement changes refresh navigation.
10. Approval updates do not overlap polling requests.

## 8. CI/CD and release controls

Pull-request checks:

1. Frozen pnpm install with one lockfile.
2. Lint and typecheck.
3. Unit/component tests with changed-module coverage.
4. Production build.
5. Contract compatibility.
6. Browser smoke tests against an ephemeral stack.
7. Accessibility smoke tests.
8. Route bundle-budget comparison.
9. Secret/PII logging scan.

Release controls: immutable release ID, validated environment, frontend health signal, backward-compatible deployment order, feature flags for migrated routes, canary rollout for auth/onboarding, and one-step image/route rollback.

## 9. Phased deliverables

### Phase 0 — Baseline and guardrails

**Deliverables**

- Accept this document as the frontend architecture decision record.
- Keep one canonical pnpm lockfile after reproducibility verification.
- Align TypeScript and `typescript-eslint` to a supported combination so lint runs in CI.
- Self-host/subset Inter, JetBrains Mono, and Outfit so production builds require no external font download.
- Add bundle analyzer/baseline, route/request/env inventories, import-boundary lint rules, test/E2E harnesses, root route boundaries, and an explicit non-production demo flag.

**Acceptance**

- Existing routes lint, typecheck, and build without network access.
- No production failure path returns simulated success.
- Bundle/Web Vitals baselines are recorded.
- CI blocks boundary violations and failed tests.

### Phase 1 — Request and session boundary

**Deliverables**

- Validated runtime configuration and unified request adapter.
- Common error, validation, blob, multipart, timeout, and cancellation behavior.
- Authenticated tenant context on all protected requests.
- Domain adapters replace direct page fetches.
- Secure session/route-protection model implemented.

**Acceptance**

- No raw `fetch` outside approved adapters.
- Protected requests carry correct auth and tenant scope.
- 401 expires predictably, 403 renders forbidden, and 422 maps fields.
- Network failures remain visible/retryable failures.

### Phase 2 — Domain slices

**Deliverables**

- Create the eight target domain modules.
- Move components, DTOs, mappers, and state behind public interfaces.
- Split onboarding state and the six workflow steps.
- Split login, approvals, platform overview, module studio, and channel workspace into orchestration plus focused modules.
- Remove compatibility re-exports after callers migrate.

**Acceptance**

- No private cross-domain imports.
- Orchestration files meet an initial 300-line review ceiling.
- Every module tests its public interface.
- URLs and visible workflows remain compatible.

### Phase 3 — Server-first App Router

**Deliverables**

- Public/authenticated route groups and server-aware authenticated layout.
- Initial reads moved server-side where session design permits.
- Client islands restricted to interactive leaves.
- Suspense and dynamic-import boundaries.

**Acceptance**

- Protected content does not flash before redirect.
- Read-only pages avoid full-page hydration.
- Heavy review/tree/matrix code is absent until used.
- Route bundles meet or improve toward budgets.

### Phase 4 — Authoritative workflow contracts

**Deliverables**

- OpenAPI TypeScript generation/validation.
- Server-delivered onboarding metadata.
- Remove frontend-owned lending thresholds and authoritative FOIR/income logic.
- Draft/application state machine and idempotent submit.
- Typed extraction outcomes and server error-to-field mapping.

**Acceptance**

- Client/backend produce no conflicting FOIR/eligibility decision.
- Threshold search finds no authoritative lending policy in frontend code.
- All workflow branches pass contract/E2E tests.
- Repeated submit cannot duplicate applications.

### Phase 5 — Production data and observability

**Deliverables**

- Replace seeded tenant, pipeline, log, telemetry, role, user, billing, DB-health, and cyber-cell data with APIs or explicit unavailable states.
- Remove production localStorage business datasets.
- Complete SSE/event delivery or use bounded adaptive polling.
- Add versioned frontend events, correlation IDs, Web Vitals, error reporting, and PII-redaction tests.

**Acceptance**

- Production never silently shows seeds after API failure.
- No overlapping or hidden-tab polling.
- Failures include correlation ID without sensitive values.
- Telemetry distinguishes release and route/domain.

## 10. Delivery checklist

### Architecture

- [ ] Route/domain ownership agreed.
- [ ] Import boundaries enforced.
- [ ] Public module interfaces documented.

### Security and tenancy

- [ ] Secure session and protected route group implemented.
- [ ] Protected APIs receive auth and tenant context.
- [ ] Backend permissions remain authoritative.
- [ ] Demo credentials, OTP echo, and simulated success disabled in production.

### Onboarding

- [ ] Store split into draft, navigation, mapping, extraction, and result modules.
- [ ] Six step modules extracted.
- [ ] Server metadata owns workflow rules.
- [ ] Income, FOIR, and eligibility are server-authoritative.
- [ ] Submission is idempotent and tested.

### Reliability and quality

- [ ] Loading/error/not-found/forbidden/empty/stale states exist.
- [ ] Requests support cancellation/timeouts; failed mutations never become success.
- [ ] Seed data is absent from production paths.
- [ ] Object URLs, timers, listeners, subscriptions, and requests clean up.
- [ ] Typecheck, lint, tests, build, contracts, accessibility, E2E, and bundles run in CI.
- [ ] Web Vitals and bundles meet targets or an approved exception.
- [ ] PII and secrets are excluded from logs/telemetry.

## 11. Definition of done

The upgrade is complete when:

1. Production routes belong to explicit domain modules.
2. Protected content/operations use consistent server-authoritative auth, tenant, and permission checks.
3. Direct fetches, seed fallbacks, and duplicated lending policy calculations are absent from production paths.
4. Core journeys pass unit, component, contract, accessibility, and browser tests.
5. Production builds meet route bundle and Web Vitals budgets.
6. Deployments are observable, canaryable, and reversible.

## 12. Verification commands

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

`test` and `test:e2e` are Phase 0 target scripts; they do not exist in the current `package.json`.

## 13. Backend dependencies

Complete delivery depends on:

- secure cookie/BFF session support;
- consistent authorization on tenant, navigation, document, and workflow endpoints;
- OpenAPI publication in CI;
- server-owned onboarding metadata and removal of duplicated client policy;
- APIs for seeded operational routes;
- completed notification/SSE publishing if push replaces polling;
- idempotency for application and other high-value mutations;
- correlation-ID propagation and PII-safe telemetry ingestion.

Track these as linked deliverables, never hidden frontend fallback behavior.
