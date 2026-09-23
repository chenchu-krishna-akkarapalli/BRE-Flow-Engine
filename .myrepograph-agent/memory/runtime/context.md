# Short-Term Context — Active Checklists

Working state for the current task. Kept here rather than in the context window so long sessions do not carry their own history as ballast.

## Current task
- [x] Extracted EMI from active accounts and loan terms (EMI, repayment tenure, interest rate, payment frequency, account number, member name) in Rust domain engine (`crates/cibil-domain`).
- [x] Aggregated `Total_Active_EMI` and `Total_EMI` in delivery schema `TargetReport` and `AccountsSummary`.
- [x] Fixed status detection in `parser.rs` to correctly recognize `AccountStatus::Active` when `DATE CLOSED: NOT DISCLOSED` is present.
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
- [x] Rendered Bank-Wise Processed Income preview in Step 6 and expandable Phase 2 FOIR cards in Step 7 Audit Cards.
- [x] All 27 backend tests passing, frontend typechecked with 0 errors, Docker stack running healthy.

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

## 2026-09-23 frontend architecture blueprint

- [x] Audited frontend routes, stores, API calls, auth/tenant propagation, client boundaries, seed fallbacks, build configuration, and large modules.
- [x] Replaced `frontend/microfrontend.md` article notes with a repository-specific 6-phase upgrade plan and deliverable checklist.
- [x] Defined domain boundaries, API/session contract, security and tenancy controls, onboarding ownership, performance budgets, tests, CI/CD, rollout, and rollback for one Next.js deployment unit.
- [x] Removed all micro-frontend, Module Federation, multi-zone, cross-zone, and separate-deployment logic from `frontend/microfrontend.md` at user request.
- [x] Frontend typecheck passed.
- [ ] Frontend lint is blocked by `typescript-eslint@8.65.0` rejecting TypeScript `7.0.2`.
- [ ] Offline production build is blocked by build-time Google Fonts downloads for Inter, JetBrains Mono, and Outfit.
