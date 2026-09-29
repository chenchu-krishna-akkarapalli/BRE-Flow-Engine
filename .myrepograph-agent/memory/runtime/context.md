# Short-Term Context — Active Checklists

Working state for the current task. Kept here rather than in the context window so long sessions do not carry their own history as ballast.

## Current task
- [x] Converted Live `tenant_status_history` Audit Log Timeline into Downwards Expandable Details:
  - Removed popup / slide-over drawer completely.
  - In [platformoverview/page.tsx](file:///c:/Users/DELL/Desktop/breflow/BRE-Flow-Engine/frontend/app/%5BtenantUuid%5D/platformoverview/page.tsx) and [dashboard/page.tsx](file:///c:/Users/DELL/Desktop/breflow/BRE-Flow-Engine/frontend/app/platform/dashboard/page.tsx), converted the section into a collapsible card:
    - Default collapsed state: compact bar with title, `Immutable Ledger` badge, live count pill (`{auditLogs.length} Events`), description, and `[View Details ▾]` button.
    - Clicking `View Details` smoothly expands downwards directly underneath inside the card, showing all historical events (partner names, status transition badges, compliance justifications, operator name, timestamp, and immutable ledger assurance).
    - Button toggles to `[Hide Details ▴]`, allowing easy collapse back up.
  - Verified with `npm --prefix frontend run build` (compiled all 26 routes in 5.8s with 0 errors), restarted `flowbre_frontend` Docker container, and confirmed HTTP 200.
- [x] Removed "Dynamic Tenant UUID" from Platform Overview Module:
  - Removed `<th className="px-4 py-3.5">Dynamic Tenant UUID</th>` column header and copyable UUID cell `<td className="px-4 py-3.5">` from the main channel roster table in [platformoverview/page.tsx](file:///c:/Users/DELL/Desktop/breflow/BRE-Flow-Engine/frontend/app/%5BtenantUuid%5D/platformoverview/page.tsx) and [dashboard/page.tsx](file:///c:/Users/DELL/Desktop/breflow/BRE-Flow-Engine/frontend/app/platform/dashboard/page.tsx).
  - Removed "Dynamic Tenant UUID" parameter block under Channel Registration Parameters in [workspace/page.tsx](file:///c:/Users/DELL/Desktop/breflow/BRE-Flow-Engine/frontend/app/%5BtenantUuid%5D/platformoverview/%5BchannelUuid%5D/%5BchannelSlug%5D/workspace/page.tsx).
  - Verified with `npm --prefix frontend run build` (compiled all 26 routes in 5.8s) and restarted `flowbre_frontend` Docker container (HTTP 200).
- [x] Rest of Page Clearly Visible & Elevated Floating Card Drawers:
  - Removed all `backdrop-blur-xs` masks across all drawer backdrops, replacing them with minimal transparent overlays (`bg-slate-900/10`) so the underlying page, tables, sidebar, and data remain 100% sharp, bright, legible, and visible.
  - Converted wall-to-wall flat side drawers into floating card inspectors (`fixed top-3 right-3 bottom-3 rounded-3xl border border-slate-200/90 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.22)]`).
  - Added micro-icons to form labels (`User`, `Mail`, `Shield`, `Activity`, `Building2`, `Globe`, `Phone`, `Sliders`), custom select dropdowns with `ChevronDown`, gradient callout cards with `ShieldCheck`, and polished action footers.
  - Applied across "Add New Role" & "Edit Role" ([assignments/page.tsx](file:///c:/Users/DELL/Desktop/breflow/BRE-Flow-Engine/frontend/app/%5BtenantUuid%5D/assignments/page.tsx)), "Sponsor New Channel" ([platformoverview/page.tsx](file:///c:/Users/DELL/Desktop/breflow/BRE-Flow-Engine/frontend/app/%5BtenantUuid%5D/platformoverview/page.tsx)), and "Add Employee Role" ([workspace/page.tsx](file:///c:/Users/DELL/Desktop/breflow/BRE-Flow-Engine/frontend/app/%5BtenantUuid%5D/platformoverview/%5BchannelUuid%5D/%5BchannelSlug%5D/workspace/page.tsx)).
  - Verified with `npm --prefix frontend run build` (compiled all 26 routes in 9.6s) and restarted `flowbre_frontend` Docker container (HTTP 200).
- [x] Converted Add Role and Add Channel into Right-Side Slide-Over Drawers:
  - Transformed "Add New Role" (`isInviteModalOpen`) and "Edit Role & Status" (`editingUser`) in [assignments/page.tsx](file:///c:/Users/DELL/Desktop/breflow/BRE-Flow-Engine/frontend/app/%5BtenantUuid%5D/assignments/page.tsx) from centered modals into smooth right-side slide-over drawers with backdrop blur and `.animate-drawer-in` entrance.
  - Transformed "Sponsor New Channel" in [platformoverview/page.tsx](file:///c:/Users/DELL/Desktop/breflow/BRE-Flow-Engine/frontend/app/%5BtenantUuid%5D/platformoverview/page.tsx) from a page redirect to a right-side slide-over drawer with instant channel registration, state machine progression, and audit trail logging.
  - Transformed "Add Employee (Role)" and "Edit Employee Role" in [workspace/page.tsx](file:///c:/Users/DELL/Desktop/breflow/BRE-Flow-Engine/frontend/app/%5BtenantUuid%5D/platformoverview/%5BchannelUuid%5D/%5BchannelSlug%5D/workspace/page.tsx) into right-side slide-over drawers.
  - Added `@keyframes drawer-slide-in` and `.animate-drawer-in` in [globals.css](file:///c:/Users/DELL/Desktop/breflow/BRE-Flow-Engine/frontend/app/globals.css).
  - Verified with `npm --prefix frontend run build` (compiled all 26 routes in 6.1s) and restarted `flowbre_frontend` Docker container (HTTP 200).
- [x] Displayed active channel name in sidebar footer:
  - Replaced "Health Monitor" in [Sidebar.tsx](file:///c:/Users/DELL/Desktop/breflow/BRE-Flow-Engine/frontend/components/Sidebar.tsx) footer card with dynamic `{channelName || "Bank of India Channel"}`.
  - Retained the green live ping indicator and 99.98% SLA telemetry badge.
  - Verified with `npm --prefix frontend run build` (compiled all 26 routes in 6.7s) and restarted `flowbre_frontend` container (HTTP 200).
- [x] Dedicated Edit Profile Page & Theme Toggle Removal:
  - Removed theme toggle (`Moon` button) completely from header.
  - Replaced static email text in profile dropdown with "Edit Profile" action item.
  - Clicking "Edit Profile" now navigates to a dedicated page (`/{tenantUuid}/profile` or `/profile`).
  - Created `ProfileSettingsView.tsx`, `frontend/app/[tenantUuid]/profile/page.tsx`, and `frontend/app/profile/page.tsx`.
  - Profile page allows viewing and editing Full Name, Email Address, Phone Number, and Designation, with organization & RBAC governance summary and workflow notification toggles.
  - Extended `useAuthStore` and `UserProfile` to persist all profile changes to memory and browser `localStorage`.
  - Added "User Profile & Account Settings" into Quick Search (`⌘K`).
  - Verified with `npm --prefix frontend run build` (compiled all 26 routes in 6.3s) and restarted `flowbre_frontend` container (HTTP 200).
- [x] Reverted sidebar redesign in `frontend/components/Sidebar.tsx` back to original FlowBRE design:
  - **Brand Header**: Reverted container back to original compact layout with emerald `Building2` icon for active channels (`Bank of India Channel`) and `Zap` for platform.
  - **Section Titles**: Reverted back to `text-[0.625rem] font-extrabold uppercase tracking-wider text-slate-400`.
  - **Active State**: Reverted back to original dark high-contrast style (`bg-slate-900 text-white font-bold shadow-xs`) with `text-teal-400` icons.
  - **Badges**: Restored original `BadgePill` rendering without pulsing `• Active` dot pill.
  - **Footer Widget**: Reverted back to original Health Monitor SLA link (`99.98% SLA` with animated green ping).
  - Preserved dynamic channel partner resolution (`Bank of India Channel` detection), null-safe `currentPath` navigation, and scroll jump fixes.
  - Verified with `npm --prefix frontend run build` (compiled 24 routes in 6.2s) and restarted `flowbre_frontend` Docker container (HTTP 200).
- [x] Completely removed `[Logo] FlowBRE / Console` brand lockup from the top bar (`frontend/components/AppHeader.tsx` and `HeaderErrorBoundary.tsx`):
  - Preserved mobile navigation drawer trigger button (`<button onClick={toggleDrawer} className="... xl:hidden">`).
  - Top bar now cleanly leads directly into the functional Quick Search bar (`⌘K`), messages, alerts, theme, and user profile avatar without any redundant logo or text.
  - Active channel branding is maintained exclusively in the top-left sidebar brand header (`frontend/components/Sidebar.tsx`).
  - Verified with `npm --prefix frontend run build` (compiled in 6.8s) and verified container running healthy.
- [x] Fixed top bar (`AppHeader`) disappearing on client-side navigation between modules:
  - Identified dual root cause: 1) Next.js router scroll restoration / focus scroll shifting the outer panel container (`div.overflow-hidden`) by 52px, clipping `<AppHeader />` off-screen, and 2) Next.js `usePathname()` returning `null` during route transitions causing `TypeError: Cannot read properties of null` across regex and `.startsWith()` calls.
  - Added safe `currentPath = pathname || ""` fallbacks across `frontend/components/AppHeader.tsx`, `frontend/components/PortalShell.tsx`, and `frontend/components/Sidebar.tsx`.
  - Added `overflow-hidden` to `<html>` in `frontend/app/layout.tsx` to stop window-level scroll drift.
  - Added explicit scroll reset effect (`panelRef.current.scrollTop = 0`, `mainRef.current.scrollTop = 0`) on `pathname` changes in `frontend/components/PortalShell.tsx`.
  - Added `scroll={false}` to all navigation `<Link>` components in `frontend/components/Sidebar.tsx` to prevent Next.js from triggering window/layout scroll jumps.
  - Created `frontend/components/HeaderErrorBoundary.tsx` and wrapped `<AppHeader />` inside it to ensure the top bar never crashes or unmounts during runtime edge cases.
  - Verified with `npm --prefix frontend run build` (compiled cleanly) and tested live endpoints.
- [x] Connected Platform Overview directly to PostgreSQL database via live endpoints (`GET /api/v1/tenants`, `GET /api/v1/tenants/approval-history`, `POST /api/v1/tenants/{uuid}/transition`, `suspend`, `reinstate`, `approve`, `reject`), ensuring channel statuses, state machine counts, and audit logs persist permanently across refreshes.
- [x] Replaced "Archive" action button with a prominent red "Reject" button (`bg-rose-600` with `X` icon) across Platform Overview (`frontend/app/[tenantUuid]/platformoverview/page.tsx`) and Dashboard (`frontend/app/platform/dashboard/page.tsx`) for suspended channels.
- [x] Removed "Reporting Tree" submodule and view switcher from Platform Overview channel workspace (`frontend/app/[tenantUuid]/platformoverview/[channelUuid]/[channelSlug]/workspace/page.tsx`), rendering the employee Table Roster directly.
- [x] Completely purged "Cyber Security Cell" (`CYBER_CELL`) module across database (`module_catalog`, `role_module_permission`, `navigation_node`), backend schemas (`navigation.py`, `constants.py`), frontend navigation (`useModuleStore.ts`, `Sidebar.tsx`, `navigation.ts`), and search index (`AppHeader.tsx`).
- [x] Completely removed redundant "Platform Console" module from `frontend/components/Sidebar.tsx` in favor of "Platform Overview".
- [x] Updated routes and database (`module_catalog`) for `PLATFORM_OVERVIEW` to point cleanly to `/{tenant}/platformoverview`, redirecting legacy `/platform/dashboard` requests.
- [x] Redesigned FlowBRE top navigation bar in `frontend/components/AppHeader.tsx` to match the exact 52px compact design specification.
- [x] Dynamically replaced `FlowBRE / Console` with the active logged-in channel name (e.g. `Bank of India Channel`) based on route `tenantUuid`, auth store, and tenant registry.
- [x] Implemented typing-only Quick Search engine in `frontend/components/AppHeader.tsx`: popover stays hidden on empty focus, opens only when user actively types, and filters matching modules, leads, policies, and actions accordingly.
- [x] Updated `--header-height: 52px` in `frontend/app/globals.css`.
- [x] Verified zero TypeScript compilation errors with `npx tsc --noEmit` and restarted `flowbre_frontend` Docker container.
- [x] Extracted EMI from active accounts and loan terms (EMI, repayment tenure, interest rate, payment frequency, account number, member name) in Rust domain engine (`crates/cibil-domain`).
- [x] Aggregated `Total_Active_EMI` and `Total_EMI` in delivery schema `TargetReport` and `AccountsSummary`.
- [x] Fixed status detection in `parser.rs` to correctly recognize `AccountStatus::Active` when `DATE CLOSED: NOT DISCLOSED` is present.
- [x] Fixed Onboarding Wizard step navigation breaking on `/[tenantUuid]?step=N` by dynamically preserving `pathname` in URL query synchronization.
- [x] Converted `useOnboardingStore` to session-only in-memory storage (clears on reload, saves in-memory during step transitions).
- [x] Deactivated cold-start draft recovery prompt banner and updated auto-save status pill to "Session Active (In-Memory)".
- [x] Enabled Onboarding Wizard navigation access across all roles in the organization hierarchy.
- [x] Rebuilt Next.js frontend with Turbopack and verified `flowbre_frontend` container recreation on `http://localhost:3000/e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f?step=1`.
- [x] Recompiled release binary `cibil-cli` and deployed to `flowbre_fastapi_app:/usr/local/bin/cibil-cli`.
- [x] Mapped `Total_Active_EMI` to `existingEmi` in `app/services/cibil_service.py` for CRE Phase 2 FOIR calculations.
- [x] Ran automated test suites (20/20 Rust tests, 43/43 Python tests) and refreshed all 38 output files in `cibil-pdf-scrapper/cibil-output/`.
- [x] Implemented bulk CIBIL PDF runner script in `cibil-pdf-scrapper/scripts/run_cibil_tests.py` and `cibil-pdf-scrapper/run_tests.py`.
- [x] Processed all 38 CIBIL PDFs from `cibil-pdf-scrapper/cibil-test/` through the `cibil-cli` Rust engine.
- [x] Extracted FlowBRE target delivery schema (`CIBIL_Score`, `CIBIL_PL_Score`, `Write_Off_Details`, `Write_Off_Amount`, `DPD`, `Loan_Enquiry`, `Currently_Outstanding`), `consumer_info`, and `raw_report`.
- [x] Evaluated credit rules with `service/bre.py` for each readable document.
- [x] Generated 38 individual standardized JSON files in `cibil-pdf-scrapper/cibil-output/` plus benchmark summary `cibil_bulk_benchmark_summary.json`.
- [x] Verified zero execution crashes/errors; 14 digital text PDFs successfully extracted, 24 image-only scanned PDFs correctly identified for OCR fallback.

- [x] Implemented database models for dynamic module catalog: `ModuleCatalogModel`, `TenantModuleEntitlementModel`, `RoleModulePermissionModel` in `app/db/models/module.py` and registered in `app/db/models/__init__.py`.
- [x] Authored and executed Alembic migration `0008_dynamic_module_catalog.py` seeding all 14 existing modules and complete default role permissions.
- [x] Configured `alembic/env.py` to bind dynamically to `settings.ASYNC_DATABASE_URI`.
- [x] Created dynamic navigation CRUD endpoints in `app/api/v1/endpoints/navigation.py`:
  - `GET /api/v1/navigation/modules` (dynamic tenant & role resolution with DB lookup and fallback)
  - `GET /api/v1/navigation/catalog` (list all catalog modules)
  - `POST /api/v1/navigation/catalog` (create new dynamic module)
  - `PUT /api/v1/navigation/catalog/{code}` (update module metadata)
  - `DELETE /api/v1/navigation/catalog/{code}` (deactivate module)
  - `GET /api/v1/navigation/matrix` (retrieve role permission entitlement grid)
  - `POST /api/v1/navigation/matrix` (batch update role permissions)
  - `GET /api/v1/navigation/tenants/{tenant_id}/modules` (get tenant module overrides)
  - `PUT /api/v1/navigation/tenants/{tenant_id}/modules/{code}` (toggle module for tenant)
- [x] Mounted navigation and roles routers in `app/api/router.py`.
- [x] Enhanced frontend `frontend/store/useModuleStore.ts` with catalog, matrix, and tenant actions.
- [x] Enhanced `frontend/components/Sidebar.tsx` with dynamic Lucide icon registry and module manager access.
- [x] Built interactive "Dynamic Module Manager & Role Entitlement Studio" at `frontend/app/platform/modules/page.tsx`.
- [x] Added quick launch button in `frontend/app/platform/dashboard/page.tsx`.
- [x] Verified via pytest (18/18 passed in `test_dynamic_navigation.py`, `test_database_models.py`, `test_uas_auth.py`, `test_tenant_provisioning.py`).
- [x] Verified frontend build (`next build`) compiled with zero errors across all 23 routes.
- [x] Identified and purged dynamic test module `TEST_DOCS_PORTAL` ("Updated Docs Portal" with badge "UPDATED") from database (`module_catalog` and `role_module_permission`), removing it from the sidebar navigation.
- [x] Enhanced `DELETE /api/v1/navigation/catalog/{code}` endpoint in `app/api/v1/endpoints/navigation.py` to support `?hard=true` for permanent cascade deletion of custom modules.
- [x] Added `deleteCatalogModule` to `frontend/store/useModuleStore.ts` and interactive delete action in `frontend/app/platform/modules/page.tsx`.
- [x] Updated `app/tests/test_dynamic_navigation.py` to automatically clean up test modules at test completion so the test suite never pollutes the database or sidebar.
- [x] Removed `SETTINGS` module from sidebar navigation across all layers:
  - Purged `SETTINGS` from `module_catalog`, `role_module_permission`, and `tenant_module_entitlement` PostgreSQL tables.
  - Purged all `Settings` / `configurator` rows from `navigation_node` table.
  - Removed `SETTINGS` from `getCanonicalSections` in `frontend/store/useModuleStore.ts`.
  - Removed `SETTINGS` from `MODULE_CATALOG` and default matrix generator in `app/api/v1/endpoints/navigation.py`.
  - Removed `Settings` from `RAW_NAVIGATION_SCHEMA` in `app/core/constants.py`.
  - Verified with 18/18 pytest tests passing and Next.js production build passing.
- [x] Resolved Docker compose crash (`Can't locate revision identified by '0008'`):
  - Rebuilt Docker images (`web`, `celery_worker`, `flower`) so that newly created migration file `alembic/versions/0008_dynamic_module_catalog.py` is present inside the container.
  - Verified `flowbre_fastapi_app` starts up healthy and `alembic upgrade head` runs without errors.
- [x] Resolved duplicate `modules?role=SUPER_ADMIN` network requests:
  - Lifted `fetchModules` out of `SidebarContent` into root `Sidebar` parent component in `frontend/components/Sidebar.tsx`.
  - Added singleflight promise deduplication and role/tenant key caching in `frontend/store/useModuleStore.ts`.
  - Verified with `npm run build` (0 errors across all routes) and pytest (5/5 passing).
- [x] Removed `+ New Dynamic Module` button from Dynamic Module Studio header in `frontend/app/platform/modules/page.tsx`.
- [x] Rebuilt Docker frontend container (`docker compose build frontend; docker compose up -d frontend`), verifying production container is healthy and serving updated bundle.
- [x] Connected ITR Document Extraction API (`@router.post("/itr/extract")`):
# Short-Term Context — Active Checklists

Working state for the current task. Kept here rather than in the context window so long sessions do not carry their own history as ballast.

## Current task

- [x] Implemented database models for dynamic module catalog: `ModuleCatalogModel`, `TenantModuleEntitlementModel`, `RoleModulePermissionModel` in `app/db/models/module.py` and registered in `app/db/models/__init__.py`.
- [x] Authored and executed Alembic migration `0008_dynamic_module_catalog.py` seeding all 14 existing modules and complete default role permissions.
- [x] Configured `alembic/env.py` to bind dynamically to `settings.ASYNC_DATABASE_URI`.
- [x] Created dynamic navigation CRUD endpoints in `app/api/v1/endpoints/navigation.py`:
  - `GET /api/v1/navigation/modules` (dynamic tenant & role resolution with DB lookup and fallback)
  - `GET /api/v1/navigation/catalog` (list all catalog modules)
  - `POST /api/v1/navigation/catalog` (create new dynamic module)
  - `PUT /api/v1/navigation/catalog/{code}` (update module metadata)
  - `DELETE /api/v1/navigation/catalog/{code}` (deactivate module)
  - `GET /api/v1/navigation/matrix` (retrieve role permission entitlement grid)
  - `POST /api/v1/navigation/matrix` (batch update role permissions)
  - `GET /api/v1/navigation/tenants/{tenant_id}/modules` (get tenant module overrides)
  - `PUT /api/v1/navigation/tenants/{tenant_id}/modules/{code}` (toggle module for tenant)
- [x] Mounted navigation and roles routers in `app/api/router.py`.
- [x] Enhanced frontend `frontend/store/useModuleStore.ts` with catalog, matrix, and tenant actions.
- [x] Enhanced `frontend/components/Sidebar.tsx` with dynamic Lucide icon registry and module manager access.
- [x] Built interactive "Dynamic Module Manager & Role Entitlement Studio" at `frontend/app/platform/modules/page.tsx`.
- [x] Added quick launch button in `frontend/app/platform/dashboard/page.tsx`.
- [x] Verified via pytest (18/18 passed in `test_dynamic_navigation.py`, `test_database_models.py`, `test_uas_auth.py`, `test_tenant_provisioning.py`).
- [x] Verified frontend build (`next build`) compiled with zero errors across all 23 routes.
- [x] Identified and purged dynamic test module `TEST_DOCS_PORTAL` ("Updated Docs Portal" with badge "UPDATED") from database (`module_catalog` and `role_module_permission`), removing it from the sidebar navigation.
- [x] Enhanced `DELETE /api/v1/navigation/catalog/{code}` endpoint in `app/api/v1/endpoints/navigation.py` to support `?hard=true` for permanent cascade deletion of custom modules.
- [x] Added `deleteCatalogModule` to `frontend/store/useModuleStore.ts` and interactive delete action in `frontend/app/platform/modules/page.tsx`.
- [x] Updated `app/tests/test_dynamic_navigation.py` to automatically clean up test modules at test completion so the test suite never pollutes the database or sidebar.
- [x] Removed `SETTINGS` module from sidebar navigation across all layers:
  - Purged `SETTINGS` from `module_catalog`, `role_module_permission`, and `tenant_module_entitlement` PostgreSQL tables.
  - Purged all `Settings` / `configurator` rows from `navigation_node` table.
  - Removed `SETTINGS` from `getCanonicalSections` in `frontend/store/useModuleStore.ts`.
  - Removed `SETTINGS` from `MODULE_CATALOG` and default matrix generator in `app/api/v1/endpoints/navigation.py`.
  - Removed `Settings` from `RAW_NAVIGATION_SCHEMA` in `app/core/constants.py`.
  - Verified with 18/18 pytest tests passing and Next.js production build passing.
- [x] Resolved Docker compose crash (`Can't locate revision identified by '0008'`):
  - Rebuilt Docker images (`web`, `celery_worker`, `flower`) so that newly created migration file `alembic/versions/0008_dynamic_module_catalog.py` is present inside the container.
  - Verified `flowbre_fastapi_app` starts up healthy and `alembic upgrade head` runs without errors.
- [x] Resolved duplicate `modules?role=SUPER_ADMIN` network requests:
  - Lifted `fetchModules` out of `SidebarContent` into root `Sidebar` parent component in `frontend/components/Sidebar.tsx`.
  - Added singleflight promise deduplication and role/tenant key caching in `frontend/store/useModuleStore.ts`.
  - Verified with `npm run build` (0 errors across all routes) and pytest (5/5 passing).
- [x] Removed `+ New Dynamic Module` button from Dynamic Module Studio header in `frontend/app/platform/modules/page.tsx`.
- [x] Rebuilt Docker frontend container (`docker compose build frontend; docker compose up -d frontend`), verifying production container is healthy and serving updated bundle.
- [x] Connected ITR Document Extraction API (`@router.post("/itr/extract")`):
  - Fixed route shadowing collision in `app/api/v1/endpoints/onboarding.py` where wildcard `/{document_type}/extract` was intercepting `/documents/itr/extract` with 422.
  - Added optional auth support with `get_current_user_optional` in `app/api/deps.py` and `app/api/v1/endpoints/documents.py`.
  - Added `ItrExtraction` interface and `extractItrDocument` client function in `frontend/lib/api.ts`.
  - Updated `frontend/components/DocumentUpload.tsx` to support `documentType="itr"`.
  - Added `itrVerified` state and `applyItrExtraction` action to `frontend/store/useOnboardingStore.ts`.
  - Connected `ItrField` in `frontend/components/steps/Steps.tsx` to ITR extraction, auto-filling income and displaying verification badge.
  - Verified with 10/10 passing pytest tests and 0 errors in TypeScript `npx tsc --noEmit`.
- [x] Added locked read-only row for "Total Tax, Interest & Fee Payable" in `frontend/components/steps/Steps.tsx` under Total Income when verified from uploaded ITR.
- [x] Implemented Phase 1: 2-Year Document-Based Income Assessment engine (`app/services/cre/phase1_income.py`, `app/schemas/cre.py`, and `POST /api/v1/onboarding/income/phase1-calculate`).
- [x] Added dedicated Step 6 ("Phase 1: Income Assessment") to frontend wizard with `Phase1IncomeCard.tsx`, interactive 4-step audit table, and server sync.
- [x] Generated 15 verified, completely unique test sets under `test files/test 1` to `test 15` with `current/` and `prev/` folders (60 unique files, 0 duplicates) and comprehensive documentation in `test files/README.md`.
- [x] Implemented CRE Phase 2 Bank FOIR calculation engine (`app/services/foir_service.py`) per `CRE_docs/FOIR Calculation (2).xlsx`.
- [x] Integrated interactive Existing EMI input field into Step 6 and computed `final_processed_income = foir_based_income - existing_emi`.
- [x] All 27 backend tests passing, frontend typechecked with 0 errors, Docker stack running healthy.
- [x] Upgraded `<Select>` in `frontend/components/Field.tsx` to a fully responsive custom dropdown with `left-0 right-0` constraint, animated `ChevronDown`, checkmarks, and click-outside dismissal, eliminating mobile/split-screen viewport overflow.
- [x] Verified full Next.js production build (`npm run build`) passing cleanly across all 24 routes.
- [x] Resolved ERR_3000_UNAUTHORIZED login bug for newly assigned roles/users:
  - Connected `Platform User Management` (`useRoleHierarchyStore.ts` and `[tenantUuid]/assignments/page.tsx`) to real backend endpoints (`GET/POST/PATCH/DELETE /api/v1/tenants/{tenant_uuid}/users`).
  - Added support in `app/api/v1/endpoints/tenants.py` for `tenant_uuid="platform"` to query all users and automatically resolve target tenant ID to avoid foreign key violations.
  - Enabled dynamic auto-registration of new roles in PostgreSQL `RoleModel` upon user creation.
  - Hardened `UserRepository.get_by_identifier` with case-insensitive lowercase matching (`func.lower`) and added fallback operational navigation nodes for custom roles.
  - Fixed in-memory nonce eviction on Redis consumption in `uas_service.py` to prevent replay bypass.
  - Seeded and verified real logins for `rani@gmail.com` (SUPER_ADMIN) and `sagar@gmail.com` (TRANSACTIONAL_USER) with token issuance.

## Open questions

- [ ] Reconcile runtime code-defined bank/FOIR thresholds with the repository policy requiring dynamically loaded `zen_rules/*.json` graphs.
- [ ] Decide whether duplicate router/schema surfaces (`app/api/router.py` vs `app/api/v1/router.py`, onboarding-local document/OTP routes vs dedicated routers) should be consolidated.
- [ ] Implement or remove the advertised Redis PubSub SSE path; `SSEManager.publish_event()` is currently a no-op.

## 2026-09-23 project exploration

- [x] Mapped the FastAPI, Next.js, PostgreSQL/Redis/Celery, Alembic, and Rust document-engine boundaries.
- [x] Traced the primary onboarding path: frontend API client -> tenant middleware/RLS -> `BREEngineService` -> application/rule audit persistence.
- [x] Confirmed document extraction invokes Rust CLI subprocesses using stdin-framed PDFs and bounded timeouts.
- [x] Counted 259 Python tests and 112 Rust test annotations; frontend `npm run typecheck` passed.
- [ ] Backend test execution unavailable locally: system Python is 3.9 and lacks FastAPI.
- [ ] Rust test execution unavailable locally: `cargo` is not installed.

## 2026-09-23 frontend architecture blueprint & upgrades

- [x] Audited frontend routes, stores, API calls, auth/tenant propagation, client boundaries, seed fallbacks, build configuration, and large modules.
- [x] Replaced `frontend/microfrontend.md` article notes with a repository-specific 6-phase upgrade plan and deliverable checklist.
- [x] Defined domain boundaries, API/session contract, security and tenancy controls, onboarding ownership, performance budgets, tests, CI/CD, rollout, and rollback for one Next.js deployment unit.
- [x] Removed all micro-frontend, Module Federation, multi-zone, cross-zone, and separate-deployment logic from `frontend/microfrontend.md` at user request.
- [x] **Phase 1: Pre-flight Step Validation & Atomic Subscriptions**
  - Implemented `frontend/lib/validation.ts` (PAN, Aadhaar, Phone, Email, Pincode, Employment schemas).
  - Added atomic selectors `useDraftField` and `useSetDraftField` to `frontend/store/useOnboardingStore.ts`.
- [x] **Phase 2: Route-Level Monolith Splitting & Dynamic Imports**
  - Split `Steps.tsx` (1,376 LOC) into `Step1Identity.tsx` to `Step6Phase1Income.tsx`, `step-shared.tsx`, and `index.ts`.
  - Added `StepLoadingSkeleton.tsx` and dynamic imports in `frontend/app/page.tsx`.
- [x] **Phase 3: Multi-Tier State Persistence & Auto-Save Recovery**
  - Built zero-dependency IndexedDB storage `hardenedIndexedDbStorage` with 7-day TTL in `frontend/lib/storage/hardenedStorage.ts`.
  - Hooked Zustand `persist` with `partialize` excluding file blobs, added `AutoSaveIndicator.tsx` and `ResumePromptBanner.tsx`.
- [x] **Phase 4: API Resilience, Request Deduping & Timeout Handling**
  - Implemented `fetchWithRetry` with 15s timeout, exponential backoff, and in-flight request deduplication in `frontend/lib/api.ts`.
  - Added `OfflineAlert.tsx` with live browser network listeners.
- [x] **Phase 5: Step Preheating & Matrix Policy Indexer**
  - Built $O(1)$ in-memory hash map index `frontend/lib/policyIndexer.ts`.
  - Built `usePreheatNextStep.ts` using `requestIdleCallback` for opportunistic bundle prefetching.
- [x] **Phase 6: Accessibility Trapping & Performance Telemetry**
  - Built `frontend/components/ErrorBoundary.tsx` and `frontend/lib/telemetry.ts` (marks, durations, long tasks).
  - Added modal focus trapping, keyboard navigation, and ARIA roles across `frontend/app/page.tsx`.
- [x] Verified complete frontend suite: `npx tsc --noEmit` (0 errors) and Next.js Turbopack `npm run build` (compiled in 6.1s across all 14 routes).

## 2026-09-24 Navigation Module Streamlining
- [x] Removed 5 unneeded navigation modules (`Regional Hierarchy`, `Analytics / Telemetry`, `Database Health`, `Platform Billing`, `Dynamic Module Manager`) across all architecture layers:
  - `frontend/store/useModuleStore.ts`: Cleared fallback entries and dynamic injection for Super Admin.
  - `frontend/components/Sidebar.tsx`: Cleared fallback items.
  - `frontend/lib/navigation.ts`: Cleared `PORTAL_NAVIGATION_SCHEMA` items.
  - `app/core/constants.py`: Cleared `RAW_NAVIGATION_SCHEMA` items.
  - `app/api/v1/endpoints/navigation.py`: Cleared `MODULE_CATALOG` items.
  - PostgreSQL Database: Purged records from `navigation_node`, `role_module_permission`, `tenant_module_entitlement`, and `module_catalog`.
  - Rebuilt Next.js frontend with Turbopack standalone (`npm run build`: 0 errors).
  - Recreated Docker frontend container (`flowbre_frontend` running healthy).
  - Verified backend pytest suite (`pytest app/tests/test_dynamic_navigation.py`: 5/5 passed).

## 2026-09-24 Onboarding Form Native Select Overlay Fix
- [x] Restored native `<select>` in `frontend/components/Field.tsx`:
  - Replaced DOM-constrained custom `<ul>` with native `<select className="... appearance-none pr-10 cursor-pointer">` and right-aligned `ChevronDown`.
  - Native select opens OS-level floating overlay matching Image 2 (`✓ Resident Indian`, `NRI/PIO`), eliminating container clipping at the bottom of the card.
  - TypeScript checked (`npx tsc --noEmit`: 0 errors).
  - Rebuilt and restarted `flowbre_frontend` Docker container with Turbopack standalone output.



