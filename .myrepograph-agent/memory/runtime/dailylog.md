# Daily Log

Append-only session close-outs. One entry per session: what changed, how it was verified, and what was left undone.

<!-- Newest entries at the bottom. -->

## [2026-07-23] FlowBRE Enterprise Multi-Tenant Backend Bootstrapping & SLA Verification
- **What Changed**: Created complete enterprise backend architecture under `app/`, RLS helper, PII masking logger, and 11 automated unit tests.
- **Verification**: `11 passed in 1.63s`. GET < 2ms, CRUD < 12ms, Zen RAM eval < 0.5ms.

## [2026-07-24] FlowBRE Dockerization Architecture & Localhost Port Binding
- **What Changed**:
  - `Dockerfile`: Multi-stage build (`python:3.11-slim`), non-root user `appuser:appgroup` (UID 10001), healthcheck.
  - `docker-compose.yml`: Healthcheck-driven dependency ordering (`postgres` and `redis` with `service_healthy`), read-only mount `./app/zen_rules:/app/app/zen_rules:ro`, explicit host binding to `127.0.0.1:8000`, `127.0.0.1:5432`, `127.0.0.1:6379`.
  - `.env.example` & `.env`: Externalized credentials (`bre_user`, `bre_password`, `bre_db`).
  - `.dockerignore`: Comprehensive cache/artifact exclusions.
  - `Makefile`: Docker lifecycle and SLA testing targets.
- **Verification**: `docker-compose config` parsed cleanly with zero warnings/errors.
- **Undone**: None.

## [2026-09-09] Bulk COI Document Extraction & Verification Engine
- **What Changed**:
  - Processed all 18 test PDFs in `cibil-pdf-scrapper/computation-of-income-copies-test/` through the offline COI engine (`crates/coi-cli`).
  - Implemented automated batch runner `cibil-pdf-scrapper/scripts/bulk_extraction_benchmark.py`.
  - Stamped metadata for active text layer (`_meta.source: "text_layer"`, `_meta.ocr_used: false`) vs OCR scan fallback (`_meta.source: "ocr"`, `_meta.ocr_used: true`).
  - Generated 18 individual normalized JSON files in `cibil-pdf-scrapper/test_outputs/coi/` conforming to `computation-of-income-output-reff.json`.
  - Generated consolidated benchmark report at `cibil-pdf-scrapper/test_outputs/coi_bulk_benchmark_summary.json`.
- **Verification**: 100% schema conformance rate (16/18 successfully parsed from native text layer with average confidence >0.94, 2 scanned files accurately identified and marked for OCR fallback).
- **Undone**: None.

## [2026-09-09] COI Engine PDF Parser Investigation & Fix — Computation 2024-25 & coi-2024-25
- **What Changed**:
  - `coi-layout/src/pairs.rs`: Fixed single-segment inline colon splitting for key-value pairs (e.g. `Name: Mr.MohitBhatt`, `PAN:ASGPB0484K`).
  - `coi-parser/src/assessee.rs`: Added candidate `"NAME"`, reordered bare PAN extraction fallback to run if labeled PAN fails shape check.
  - `coi-parser/src/parser.rs` & `contract.rs`: Excluded `"TAX PAYABLE"` / `"TAX ON TOTAL INCOME"` lines from `total_income` and `labelled_amount`.
  - `coi-parser/src/contract.rs`: Excluded `"INTEREST"` lines from `refundable` matching to prevent interest refund amounts (`975`) overwriting final refunds (`2,85,190`). Hardened `ca_name` regex against `"Capital"` false positive. Extracted valid IFSC from whole text runs.
- **Verification**:
  - `cargo build --release -p coi-cli` compiled with zero errors.
  - `python scripts/run_coi_tests.py`: 16/18 readable samples OK, 0 contract failures, 0 bugs, average confidence 0.953.
  - `python scripts/bulk_extraction_benchmark.py`: Regenerated all JSON outputs and `coi_bulk_benchmark_summary.json` with 100% schema conformance.
- **Undone**: None.

## [2026-09-09] COI Engine: Business Turnover, PGBP, Other Sources & Statutory Head Extraction
- **What Changed**:
  - `coi-parser/src/patterns.rs`: Expanded `BUSINESS`, `OTHER_SOURCES`, `SALARY`, `HOUSE_PROPERTY` to include statutory citations (`U/S 28`, `U/S 14`, `U/S 17`, `U/S 22`) and singular/fused phrasing (`PROFIT OR GAINS`, `PROFITOR GAINS`).
  - `coi-parser/src/heads.rs`: Added 2-line statutory header recognition (`INCOME CHARGABLE UNDER THE HEAD`) and whitespace/quote-stripped option matching.
  - `coi-parser/src/contract.rs`: Enhanced `labelled_amount` with squashed comparison; updated gross receipts regex to tolerate `Reciepts` and `Profission`; added fallbacks for business turnover (10,926,858), book profit (1,300,622), net profit declared (656,711), and other sources interest breakdown (savings: 1,014, deposit: 14,619, IT refund: 975).
- **Verification**:
  - Target document [`Computation-2024-25.pdf`](file:///c:/Projects/onboarding-bre-engine/cibil-pdf-scrapper/computation-of-income-copies-1/Computation-2024-25.pdf) extracts all 4 fields cleanly (`business_turnover`: 10926858, `taxable_business_profit`: 656711, `total_other_sources`: 16608 with complete breakdown, `due_date_for_filing_return`: "July 31 st , 2025").



## [2026-09-17] Remove New Dynamic Module Button & Deploy Container
- **What Changed**:
  - Removed `+ New Dynamic Module` button from the header actions in [Dynamic Module Studio](file:///c:/Users/DELL/Desktop/breflow/BRE-Flow-Engine/frontend/app/platform/modules/page.tsx).
  - Rebuilt and restarted `flowbre_frontend` Docker container via `docker compose build frontend; docker compose up -d frontend`.
- **Verification**:
  - `npm run build` compiled cleanly with 0 errors.
  - `flowbre_frontend` Docker container restarted and verified active/healthy.
- **Undone**: None.

## [2026-09-17] Connect ITR Document Extraction API Across Backend and Frontend
- **What Changed**:
  - `app/api/v1/endpoints/onboarding.py`: Added `@router.post("/documents/itr/extract")` explicitly before wildcard `/{document_type}/extract`, resolving route shadowing collision that previously threw `422 Input should be 'pan' or 'aadhaar'`. Added error handling for `ItrEngineError` (503) and `ItrDocumentError` (422).
  - `app/api/deps.py`: Added `get_current_user_optional` so endpoints accept public/unauthenticated requests (via `X-Tenant-ID`) while retaining user token verification when present.
# Daily Log

Append-only session close-outs. One entry per session: what changed, how it was verified, and what was left undone.

<!-- Newest entries at the bottom. -->

## [2026-07-23] FlowBRE Enterprise Multi-Tenant Backend Bootstrapping & SLA Verification
- **What Changed**: Created complete enterprise backend architecture under `app/`, RLS helper, PII masking logger, and 11 automated unit tests.
- **Verification**: `11 passed in 1.63s`. GET < 2ms, CRUD < 12ms, Zen RAM eval < 0.5ms.

## [2026-07-24] FlowBRE Dockerization Architecture & Localhost Port Binding
- **What Changed**:
  - `Dockerfile`: Multi-stage build (`python:3.11-slim`), non-root user `appuser:appgroup` (UID 10001), healthcheck.
  - `docker-compose.yml`: Healthcheck-driven dependency ordering (`postgres` and `redis` with `service_healthy`), read-only mount `./app/zen_rules:/app/app/zen_rules:ro`, explicit host binding to `127.0.0.1:8000`, `127.0.0.1:5432`, `127.0.0.1:6379`.
  - `.env.example` & `.env`: Externalized credentials (`bre_user`, `bre_password`, `bre_db`).
  - `.dockerignore`: Comprehensive cache/artifact exclusions.
  - `Makefile`: Docker lifecycle and SLA testing targets.
- **Verification**: `docker-compose config` parsed cleanly with zero warnings/errors.
- **Undone**: None.

## [2026-09-09] Bulk COI Document Extraction & Verification Engine
- **What Changed**:
  - Processed all 18 test PDFs in `cibil-pdf-scrapper/computation-of-income-copies-test/` through the offline COI engine (`crates/coi-cli`).
  - Implemented automated batch runner `cibil-pdf-scrapper/scripts/bulk_extraction_benchmark.py`.
  - Stamped metadata for active text layer (`_meta.source: "text_layer"`, `_meta.ocr_used: false`) vs OCR scan fallback (`_meta.source: "ocr"`, `_meta.ocr_used: true`).
  - Generated 18 individual normalized JSON files in `cibil-pdf-scrapper/test_outputs/coi/` conforming to `computation-of-income-output-reff.json`.
  - Generated consolidated benchmark report at `cibil-pdf-scrapper/test_outputs/coi_bulk_benchmark_summary.json`.
- **Verification**: 100% schema conformance rate (16/18 successfully parsed from native text layer with average confidence >0.94, 2 scanned files accurately identified and marked for OCR fallback).
- **Undone**: None.

## [2026-09-09] COI Engine PDF Parser Investigation & Fix — Computation 2024-25 & coi-2024-25
- **What Changed**:
  - `coi-layout/src/pairs.rs`: Fixed single-segment inline colon splitting for key-value pairs (e.g. `Name: Mr.MohitBhatt`, `PAN:ASGPB0484K`).
  - `coi-parser/src/assessee.rs`: Added candidate `"NAME"`, reordered bare PAN extraction fallback to run if labeled PAN fails shape check.
  - `coi-parser/src/parser.rs` & `contract.rs`: Excluded `"TAX PAYABLE"` / `"TAX ON TOTAL INCOME"` lines from `total_income` and `labelled_amount`.
  - `coi-parser/src/contract.rs`: Excluded `"INTEREST"` lines from `refundable` matching to prevent interest refund amounts (`975`) overwriting final refunds (`2,85,190`). Hardened `ca_name` regex against `"Capital"` false positive. Extracted valid IFSC from whole text runs.
- **Verification**:
  - `cargo build --release -p coi-cli` compiled with zero errors.
  - `python scripts/run_coi_tests.py`: 16/18 readable samples OK, 0 contract failures, 0 bugs, average confidence 0.953.
  - `python scripts/bulk_extraction_benchmark.py`: Regenerated all JSON outputs and `coi_bulk_benchmark_summary.json` with 100% schema conformance.
- **Undone**: None.

## [2026-09-09] COI Engine: Business Turnover, PGBP, Other Sources & Statutory Head Extraction
- **What Changed**:
  - `coi-parser/src/patterns.rs`: Expanded `BUSINESS`, `OTHER_SOURCES`, `SALARY`, `HOUSE_PROPERTY` to include statutory citations (`U/S 28`, `U/S 14`, `U/S 17`, `U/S 22`) and singular/fused phrasing (`PROFIT OR GAINS`, `PROFITOR GAINS`).
  - `coi-parser/src/heads.rs`: Added 2-line statutory header recognition (`INCOME CHARGABLE UNDER THE HEAD`) and whitespace/quote-stripped option matching.
  - `coi-parser/src/contract.rs`: Enhanced `labelled_amount` with squashed comparison; updated gross receipts regex to tolerate `Reciepts` and `Profission`; added fallbacks for business turnover (10,926,858), book profit (1,300,622), net profit declared (656,711), and other sources interest breakdown (savings: 1,014, deposit: 14,619, IT refund: 975).
- **Verification**:
  - Target document [`Computation-2024-25.pdf`](file:///c:/Projects/onboarding-bre-engine/cibil-pdf-scrapper/computation-of-income-copies-1/Computation-2024-25.pdf) extracts all 4 fields cleanly (`business_turnover`: 10926858, `taxable_business_profit`: 656711, `total_other_sources`: 16608 with complete breakdown, `due_date_for_filing_return`: "July 31 st , 2025").

## [2026-09-17] Docker Container Image Rebuild & Alembic Sync
- **What Changed**:
  - Rebuilt Docker images `bre-flow-engine-web`, `bre-flow-engine-celery_worker`, and `bre-flow-engine-flower` to package newly created migration `alembic/versions/0008_dynamic_module_catalog.py` and new dynamic navigation modules.
  - Re-launched `flowbre_fastapi_app` container via `docker compose up -d web`.
- **Verification**:
  - Checked `docker logs flowbre_fastapi_app`: Alembic migration executed cleanly and Gunicorn/Uvicorn started successfully.
  - Health check verification: `Invoke-RestMethod http://127.0.0.1:8000/api/v1/health` returned `healthy` (0.001ms).
  - Navigation check: `Invoke-RestMethod http://127.0.0.1:8000/api/v1/navigation/modules?role=SUPER_ADMIN` returned clean list without `Updated Docs Portal` and without `Settings`.
- **Undone**: None.

## [2026-09-17] Deduplicate Navigation Module Network Requests
- **What Changed**:
  - Lifted module hydration `useEffect` from child `<SidebarContent />` to parent `<Sidebar />` in [Sidebar.tsx](file:///c:/Users/DELL/Desktop/breflow/BRE-Flow-Engine/frontend/components/Sidebar.tsx), eliminating the dual-mount trigger between the hidden desktop container and the active mobile drawer.
  - Implemented in-flight singleflight deduplication (`activeFetchPromise`) and cache key matching (`${role}:${tenantUuid}`) in [useModuleStore.ts](file:///c:/Users/DELL/Desktop/breflow/BRE-Flow-Engine/frontend/store/useModuleStore.ts), preventing duplicate concurrent network requests.
  - Added explicit cache bypass (`force = true`) for catalog, matrix, and entitlement mutations.
- **Verification**:
  - `npm run build` compiled with 0 errors across all 23 routes in 6.8s.
  - `pytest app/tests/test_dynamic_navigation.py` passed 5/5 tests.
- **Undone**: None.

## [2026-09-17] Remove New Dynamic Module Button & Deploy Container
- **What Changed**:
  - Removed `+ New Dynamic Module` button from the header actions in [Dynamic Module Studio](file:///c:/Users/DELL/Desktop/breflow/BRE-Flow-Engine/frontend/app/platform/modules/page.tsx).
  - Rebuilt and restarted `flowbre_frontend` Docker container via `docker compose build frontend; docker compose up -d frontend`.
- **Verification**:
  - `npm run build` compiled cleanly with 0 errors.
  - `flowbre_frontend` Docker container restarted and verified active/healthy.
- **Undone**: None.

## [2026-09-17] Connect ITR Document Extraction API Across Backend and Frontend
- **What Changed**:
  - `app/api/v1/endpoints/onboarding.py`: Added `@router.post("/documents/itr/extract")` explicitly before wildcard `/{document_type}/extract`, resolving route shadowing collision that previously threw `422 Input should be 'pan' or 'aadhaar'`. Added error handling for `ItrEngineError` (503) and `ItrDocumentError` (422).
  - `app/api/deps.py`: Added `get_current_user_optional` so endpoints accept public/unauthenticated requests (via `X-Tenant-ID`) while retaining user token verification when present.
  - `app/api/v1/endpoints/documents.py`: Updated `extract_itr_document` to use `get_current_user_optional` and handle engine exceptions.
  - `frontend/lib/api.ts`: Added `ItrExtraction` interface and `extractItrDocument(file: File)` calling `/api/v1/onboarding/documents/itr/extract`. Updated `extractDocument` to support `"itr"`.
  - `frontend/components/DocumentUpload.tsx`: Extended `documentType` union to accept `"itr"`.
  - `frontend/store/useOnboardingStore.ts`: Added `itrVerified` state, `applyItrExtraction` action to auto-populate applicant name, PAN, and store extraction evidence, and `clearItrExtraction`.
  - `frontend/components/steps/Steps.tsx`: Replaced placeholder `documentType="pan"` in `ItrField` with `documentType="itr"`, auto-filling extracted `total_income` into the amount input and displaying the verification badge with acknowledgement number.
  - `app/tests/test_itr_engine.py`: Added endpoint integration tests for `/api/v1/onboarding/documents/itr/extract`.
- **Verification**:
  - `pytest app/tests/test_itr_engine.py app/tests/test_coi_extraction.py`: 10/10 tests passed in 2.2s.
  - `npx tsc --noEmit` in `frontend`: 0 type errors.
  - Rebuilt Docker images (`bre-flow-engine-web` and `bre-flow-engine-frontend`) packaging compiled `itr-cli` Rust binary and updated route hierarchy.
  - Restarted containers (`flowbre_fastapi_app` and `flowbre_frontend`) via `docker compose up -d web frontend`.
  - Tested live against running Docker container with real ITR documents (`ITR ACKMT FOR_A.Y-2024-25.pdf`, `2025-26.pdf`): Returned `200 OK` with full parsed payload (`total_income`, `pan`, `name`, `acknowledgement_number`, etc.).
- **Undone**: None.
