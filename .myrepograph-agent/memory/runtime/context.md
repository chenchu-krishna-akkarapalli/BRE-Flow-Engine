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


## Open questions

_none_
