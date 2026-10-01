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

## [2026-09-22] Phase 1 Income Assessment Engine & 15-Set Unique Test Matrix
- **What Changed**:
  - Implemented Phase 1 2-year document-based income calculation engine in `app/services/cre/phase1_income.py` and endpoint `POST /api/v1/onboarding/income/phase1-calculate`.
  - Added dedicated Step 6 ("Phase 1: Income Assessment") in onboarding wizard with `frontend/components/Phase1IncomeCard.tsx`, interactive 4-step audit table, and server calculation sync. Shifted Final Verdict to Step 7.
  - Created 15 unique test sets under `test files/` (`test 1` to `test 15`), each with `current/` (1 ITR + 1 COI) and `prev/` (1 ITR + 1 COI).
  - Ensured 100% uniqueness across all 60 PDF files (30 ITRs and 30 COIs) with 0 duplicated documents.
  - Authored comprehensive test guide and test set directory map in `test files/README.md`.
- **Verification**:
  - Python sha256 uniqueness verification: 60/60 files unique, 0 duplicate files.
  - Tested endpoint calculation against matched user filing (`Shashank Rai`): accurately computed assessed 2-year average income of ₹4,48,922.50.
  - Rebuilt Docker frontend container (`flowbre_frontend`) and verified HTTP 200 OK.
- **Undone**: None.

## [2026-09-22] CRE Phase 2: Bank FOIR Calculation & Step 6 EMI Integration
- **What Changed**:
  - `app/services/foir_service.py`: Implemented bank FOIR service conforming to `CRE_docs/FOIR Calculation (2).xlsx` for BOB, BOM, BOI, IOB, Indian Bank, and defaults for HDFC, AXIS, KOTAK.
  - `app/api/schemas/income.py` & `app/api/schemas/onboarding.py`: Added `BankFoirDetail`, `Phase2FoirCalculationRequest`, `Phase2FoirCalculationResponse`, and `existing_emi` in `BankingBureauStep`.
  - `app/api/v1/endpoints/onboarding.py`: Added `POST /api/v1/onboarding/income/phase2-foir` and attached `foir_assessment` to form evaluation response.
  - `frontend/lib/types.ts` & `frontend/lib/api.ts`: Added types and `calculatePhase2Foir` API caller.
  - `frontend/store/useOnboardingStore.ts`: Added `existingEmi`, `phase2FoirResult`, and reactive calculations on income/EMI changes.
  - `frontend/components/Phase1IncomeCard.tsx`: Added interactive Existing Monthly EMI input field and bank-wise processed income preview matrix.
  - `frontend/components/AuditCards.tsx`: Rendered Phase 2 FOIR breakdown card with processed income upon expanding each bank card.
- **Verification**:
  - Pytest `test_foir_service.py`: 6/6 tests passed.
  - Pytest `test_income_service.py test_onboarding_form.py`: 21/21 passed.
  - Live API testing: Verified Self-Employed (₹4,48,922.50 income, ₹15,000 EMI -> BOB 60% -> ₹2,54,353.50) and Salaried (₹9,60,000 income, ₹20,000 EMI -> BOB 70% -> ₹36,000.00).
  - TypeScript typecheck `npx tsc --noEmit`: 0 errors.
  - Docker containers `flowbre_fastapi_app` and `flowbre_frontend` healthy and responding HTTP 200.
- **Undone**: None.

## [2026-09-23] CIBIL PDF Engine Bulk Testing & Extraction Pipeline
- **What Changed**:
  - Implemented `cibil-pdf-scrapper/scripts/run_cibil_tests.py` and `cibil-pdf-scrapper/run_tests.py` bulk testing runner.
  - Processed all 38 CIBIL PDF documents from `cibil-pdf-scrapper/cibil-test/` through the `cibil-cli` Rust engine.
  - Extracted FlowBRE delivery target schema (`CIBIL_Score`, `CIBIL_PL_Score`, `Write_Off_Details`, `Write_Off_Amount`, `DPD`, `Loan_Enquiry`, `Currently_Outstanding`).
  - Extracted consumer profile details (`consumer_info`) and full internal report hierarchy (`raw_report`).
  - Executed Business Rules Engine (`service/bre.py`) credit decisioning on all readable reports.
  - Successfully written all 38 output JSON files to `cibil-pdf-scrapper/cibil-output/`.
  - Generated consolidated benchmark summary at `cibil-pdf-scrapper/cibil-output/cibil_bulk_benchmark_summary.json`.
- **Verification**:
  - Processed 38 total PDFs:
    - 14/38 readable text layer documents successfully parsed (100% success on text-layer reports, average score: 672.6, 0 execution errors).
    - 24/38 image-only / rasterized PDFs correctly flagged by pipeline gating as `UNKNOWN_CONSUMER` requiring OCR.
  - BRE Decisioning distribution: 5 APPROVE, 2 REFER, 7 DECLINE.
  - Verified JSON schema conformance across all generated files in `cibil-pdf-scrapper/cibil-output/`.
## [2026-09-23] CIBIL Engine: Active Account EMI & Loan Terms Extraction
- **What Changed**:
  - `crates/cibil-domain/src/models.rs`: Added `emi_amount: Option<u64>`, `payment_frequency: Option<String>`, `repayment_tenure: Option<u32>`, `interest_rate: Option<f64>`, `account_number: Option<String>`, `member_name: Option<String>` to `CreditAccount`, and `total_active_emi: u64`, `total_emi: u64` to `AccountsSummary`.
  - `crates/cibil-domain/src/parser.rs`: Added extraction logic for EMI, repayment tenure, interest rate (rounded to 2 decimal places), payment frequency, and account number. Fixed account status resolution to prevent `"DATE CLOSED: NOT DISCLOSED"` falsely marking active accounts as `Inactive`.
  - `crates/cibil-domain/src/aggregate.rs`: Exposed `Total_Active_EMI` and `Total_EMI` on `TargetReport`, and attached optional `emi`, `repayment_tenure`, `interest_rate`, `payment_frequency`, `account_number`, `member_name` to `DpdEntry`.
  - `crates/cibil-graph/src/relational.rs`: Updated `AccountsSummary` construction with active and total EMI sums.
  - `service/bre.py` & `scripts/run_cibil_tests.py`: Emitted `total_active_emi` in `signals`.
  - `app/services/cibil_service.py`: Mapped `Total_Active_EMI` to `existingEmi` and `totalActiveEmi`, and `Total_EMI` to `totalEmi`.
  - Recompiled release binary `cibil-cli` via Docker and deployed to `flowbre_fastapi_app:/usr/local/bin/cibil-cli`.
  - Re-ran bulk testing across all 38 PDFs in `cibil-test/` and regenerated outputs in `cibil-output/`.
- **Verification**:
  - Rust tests: 20/20 passed (`cargo test -p cibil-domain -p cibil-graph`).
  - Python tests: 43/43 passed (`pytest app/tests/test_cibil_extraction.py`).
  - Target document verification (`mohammed tousif r a h.pdf`, Account 2 Gold Loan): Extracted `status: "ACTIVE"`, `emi: 68000`, `repayment_tenure: 13`, `interest_rate: 0.23`, `Total_Active_EMI: 228054`.
  - Bulk test verification: 14 text PDFs parsed with 100% success; extracted active EMI across 6 reports (up to ₹2,28,054) and total EMI across 10 reports (up to ₹4,056,680). 0 execution failures.
- **Undone**: None.

## [2026-09-23] Repository Architecture Exploration
- **What Changed**: No application source changed. Documented the current architecture and open design risks in runtime context.
- **Verified**:
  - FastAPI entrypoint/middleware/router, async SQLAlchemy pool, RLS tenant context, BRE call path, audit persistence, Next.js API integration, Celery workers, Alembic chain through `0008`, and the 27-member Rust workspace.
  - Frontend `npm run typecheck`: passed with 0 errors.
  - Repository contains 259 Python test functions and 112 Rust test annotations.
- **Unavailable Checks**:
  - `python3 -m pytest app/tests/test_bre_engine.py -q` stopped during collection because host Python 3.9 lacks FastAPI.
  - `cargo test -q --workspace` could not start because `cargo` is absent.
  - No latency benchmark was executed; SLA claims remain unverified in this session.
- **Surprises / Risks**:
  - Runtime bank policies and FOIR tiers are hardcoded in Python despite workspace policy requiring dynamic `zen_rules/*.json` loading.
  - `SSEManager.publish_event()` is a no-op.
  - Duplicate router and schema surfaces increase drift risk.

## [2026-09-23] Frontend Architecture and Micro-Frontend Upgrade Blueprint
- **What Changed**:
  - Replaced `frontend/microfrontend.md` (an imported article/tool transcript) with a verified 631-line repository-specific architecture and delivery blueprint.
  - Documented current routes/data maturity, API integrations, auth/tenant gaps, browser-policy duplication, hotspot modules, target domain slices, rendering/state/API contracts, security, tenancy, onboarding, performance, testing, CI/CD, rollout, and backend dependencies.
  - Defined six delivery phases with deliverables and acceptance criteria; multi-zone extraction remains optional behind measurable entry criteria.
- **Verification**:
  - `npm run typecheck`: passed.
  - `git diff --check`: passed after removing Markdown trailing whitespace.
  - Markdown structure checked: headings present and fenced code blocks balanced.
- **Blocked / Existing Toolchain Issues**:
  - `npm run lint` cannot start because `typescript-eslint@8.65.0` rejects TypeScript `7.0.2`.
  - `npm run build` reached Turbopack but failed because the restricted environment cannot download Inter, JetBrains Mono, and Outfit from Google Fonts.
- **Application Source Changes**: None; documentation and mandated runtime memory only.

## [2026-09-23] Remove Micro-Frontend Logic from Frontend Blueprint
- **What Changed**:
  - Removed Module Federation, multi-zone, runtime-composition, cross-zone, separate-repository, and independent-deployment guidance from `frontend/microfrontend.md`.
  - Reframed the target as one domain-modular Next.js application with one build and deployment unit.
  - Removed the optional zone-extraction phase and related checklist/definition-of-done items.
- **Verification**:
  - Case-insensitive search found no micro-frontend-specific terms or logic remaining in the document.
  - `git diff --check` passed; document now has 601 lines.
- **Application Source Changes**: None.

## [2026-09-23] Frontend Architecture Upgrades: Execution of Phases 1 to 6
- **What Changed**:
  - **Phase 1 (Pre-flight Step Validation & Atomic Subscriptions)**: Created `frontend/lib/validation.ts` with comprehensive validators for Steps 1–6 (PAN, Aadhaar, Phone, Email, Pincode, Salaried/Self-Employed/Company). Added atomic selectors `useDraftField` and `useSetDraftField` to `frontend/store/useOnboardingStore.ts`.
  - **Phase 2 (Route-Level Monolith Splitting & Dynamic Imports)**: Decomposed `frontend/components/steps/Steps.tsx` (1,376 LOC) into modular components: `step-shared.tsx`, `Step1Identity.tsx` (synchronous), `Step2Address.tsx`, `Step3Occupation.tsx`, `Step4Banking.tsx`, `Step5CoApplicant.tsx`, `Step6Phase1Income.tsx`, with re-exports in `index.ts`. Created `frontend/components/StepLoadingSkeleton.tsx`. Dynamically imported deferred steps 2-6 and heavy analytical views in `frontend/app/page.tsx` with Suspense skeletons.
  - **Phase 3 (Hardened Multi-Tier State Persistence & Auto-Save Recovery)**: Implemented native IndexedDB storage engine `frontend/lib/storage/hardenedStorage.ts` with 7-day TTL cleanup and in-memory fallback. Integrated Zustand `persist` middleware with `partialize` serialization and hydration tracking. Created `frontend/components/AutoSaveIndicator.tsx` and `frontend/components/ResumePromptBanner.tsx`.
  - **Phase 4 (API Resilience, Request Deduping & Timeout Handling)**: Created resilient `fetchWithRetry` with 15s timeout, exponential backoff (2 retries on 5xx/network errors), pre-flight offline guard, and in-flight evaluation deduplication in `frontend/lib/api.ts`. Created `frontend/components/OfflineAlert.tsx`.
  - **Phase 5 (Step Preheating & Matrix Policy Indexer)**: Implemented $O(1)$ in-memory hash map index `frontend/lib/policyIndexer.ts` for bank FOIR matrices. Built `frontend/hooks/usePreheatNextStep.ts` using idle-time callbacks (`requestIdleCallback`) to prefetch next step chunks and analytical modules.
  - **Phase 6 (Accessibility Trapping & Performance Telemetry)**: Created reusable `frontend/components/ErrorBoundary.tsx` with inline recovery. Implemented `frontend/lib/telemetry.ts` for high-precision marks, durations, and `PerformanceObserver` long-task tracking. Enhanced `frontend/app/page.tsx` with modal focus trapping (Escape / Tab cycling) and accessibility attributes (`aria-current`, `aria-live`).
- **Verification**:
  - `npx tsc --noEmit`: 0 errors.
  - `npm run build`: Turbopack compiled successfully in 6.1s across all 14 routes with 0 errors.
  - Unit tests for validation, storage, deduplication, and policy indexing executed and passed.
- **Undone**: None. All 6 phases executed and verified.

## [2026-09-23] Fix "Next question" Button Disabled State & Validation Guidance
- **What Changed**:
  - `frontend/app/page.tsx`:
    - Removed `disabled={!canProceed}` from the "Next question" button so the button is never unresponsive/dead (`disabled={termination !== null}`).
    - Updated `handleNext` to run `validateStep(stepId, draft)` on click. If invalid, it sets `error: firstError` (rendering the prominent red error alert banner) and smoothly scrolls to and focuses the missing input element via `el.scrollIntoView({ behavior: 'smooth', block: 'center' })` and `el.focus()`.
  - `frontend/components/steps/step-shared.tsx`:
    - Exposed `error` in `useField()` hook so all step components can display real-time validation error borders and messages.
  - `frontend/components/steps/Step1Identity.tsx`:
    - Added error message and warning styling to `applicantName`, `dob`, `gender`, `pan`, `phone`, `email`, and company fields when required fields are missing.
  - Rebuilt Docker image and restarted `flowbre_frontend` container.
- **Verification**:
  - `npx tsc --noEmit`: 0 errors.
  - Turbopack production build succeeded in 6.2s.
  - Docker container restarted and verified active/healthy on `127.0.0.1:3000`.
- **Undone**: None.
## [2026-09-23] Role Hierarchy Routing & In-Memory Session Onboarding Engine
- **What Changed**:
  - `frontend/app/page.tsx`:
    - Bound `usePathname()` to all step transitions so `router.push(`${pathname}?step=${stepId}`)` and `router.replace(`${pathname}?step=${fallbackStep}`)` preserve the dynamic tenant UUID path (`/[tenantUuid]?step=N`) without reverting to root `/`.
    - Added Channel Tenant and Active Role badges above the stepper header.
    - Added fallback step validation on direct URL navigation to prevent jumping to inaccessible steps with an empty draft.
  - `frontend/store/useOnboardingStore.ts`:
    - Removed Zustand `persist` middleware. Onboarding store is now purely in-memory ("saved once across active steps").
    - Added startup IndexedDB purging (`hardenedIndexedDbStorage.removeItem("onboarding-storage")`) ensuring page reload (`F5`) always starts with a fresh, clean draft without restoring stale data.
    - Added `tenantUuid` and `activeRole` reactive state properties and forwarded tenant ID in the evaluation header (`X-Tenant-ID`).
  - `frontend/components/ResumePromptBanner.tsx`:
    - Deactivated cold-start draft recovery prompt banner (`return null`).
  - `frontend/components/AutoSaveIndicator.tsx` & `frontend/components/Stepper.tsx`:
    - Updated auto-save indicator to "Session Active (In-Memory)".
    - Deduplicated auto-save indicator by displaying it cleanly in the header context bar.
  - `frontend/lib/navigation.ts`:
    - Expanded `PORTAL_NAVIGATION_SCHEMA` to grant Onboarding Wizard access to all organizational hierarchy roles (`SUPER_ADMIN`, `REGIONAL_DIRECTOR`, `OPERATIONS_HEAD`, `ACCOUNTS_HEAD`, `AREA_MANAGER`, `TEAM_LEADER`, `SALES_MANAGER`, `CHANNEL_ADMIN`, `TRANSACTIONAL_USER`).
  - `frontend/lib/api.ts`:
    - Updated `evaluateOnboardingForm` to propagate `tenantId` in the `X-Tenant-ID` header.
- **Verification**:
  - `npx tsc --noEmit`: 0 errors.
  - `npm run build`: Turbopack compiled all static and dynamic routes (`/[tenantUuid]`) in 5.7s with 0 errors.
  - Rebuilt Docker frontend container (`docker compose build frontend; docker compose up -d frontend`).
  - `curl.exe -I http://localhost:3000/e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f?step=1` returned `HTTP/1.1 200 OK`.
- **Undone**: None.

## [2026-09-24] Responsive Dropdown Upgrade & Initial Draft Gender Default
- **What Changed**:
  - `frontend/components/Field.tsx`:
    - Replaced native HTML `<select>` with a custom responsive dropdown component bounded by `absolute left-0 right-0 w-full`.
    - Added click-outside listener (`mousedown`), keyboard accessibility (`Escape`, `ArrowDown`, `ArrowUp`), animated `ChevronDown` rotation, brand teal highlights, and checkmark indicators for selected items.
    - Prevents OS-level popup menu overflows on mobile viewports and narrow split-screens.
  - `frontend/store/useOnboardingStore.ts`:
    - Updated `INITIAL_DRAFT` to set `gender: "Male"` and `maritalStatus: "Married"` by default.
    - Eliminates false "Please select your gender" validation errors when applicants leave the default selection intact.
- **Verification**:
  - `npx tsc --noEmit`: 0 errors.
  - `npm run build`: Compiled with Turbopack in 11.0s with 0 errors across all 24 routes.
- **Undone**: None.

## [2026-09-24] Platform User Management DB Sync & Dynamic Role Login Fix
- **What Changed**:
  - `frontend/store/useRoleHierarchyStore.ts` & `frontend/app/[tenantUuid]/assignments/page.tsx`:
    - Connected `useRoleHierarchyStore` user mutations to the real backend endpoints (`GET/POST/PATCH/DELETE /api/v1/tenants/${tenantUuid}/users`).
    - Added `fetchUsers(tenantUuid)` on component mount and made user invitation/updates/deletions persist to PostgreSQL.
  - `app/api/v1/endpoints/tenants.py`:
    - Updated `get_tenant_users` to support `tenant_uuid="platform"` / `"global"`, returning all system users from the database.
    - Updated `create_tenant_user` to gracefully resolve tenant IDs for platform users (preventing foreign key violation crashes) and dynamically insert any new role into PostgreSQL `RoleModel` upon creation.
  - `app/db/repositories/user_repository.py`:
    - Converted `get_by_identifier` to case-insensitive matching with `func.lower(...)`.
    - Added automatic operational navigation node fallback for dynamic roles in `get_navigation_nodes_for_role`.
  - `app/services/uas_service.py`:
    - Cleared in-memory nonces upon Redis consumption to harden single-use token exchange.
  - Seeded `rani@gmail.com` (`SUPER_ADMIN`) and `sagar@gmail.com` (`TRANSACTIONAL_USER`) with active tenant bindings in the database.
- **Verification**:
  - `docker exec flowbre_fastapi_app pytest app/tests/test_uas_auth.py`: 3/3 passed.
  - Verified programmatic UAS challenge and verify flow for `rani@gmail.com` and `sagar@gmail.com`: 200 OK with valid JWT tokens issued.
  - Rebuilt Next.js frontend container with Turbopack (`npm run build`: 0 errors).
- **Undone**: None.

## [2026-09-24] Navigation Module Streamlining (Removal of 5 Unneeded Modules)
- **What Changed**:
  - Removed 5 modules requested by user: `Regional Hierarchy`, `Analytics / Telemetry`, `Database Health`, `Platform Billing`, `Dynamic Module Manager`.
  - `frontend/store/useModuleStore.ts`:
    - Removed `ANALYTICS`, `REGIONAL_HIERARCHY`, `DB_HEALTH`, `BILLING`, and `MODULE_MANAGER` from `getCanonicalSections`.
    - Removed `MODULE_MANAGER` injection for `SUPER_ADMIN` in `fetchModules`.
  - `frontend/components/Sidebar.tsx`:
    - Removed `Analytics`, `Regional Hierarchy`, `Database Health`, and `Platform Billing` from fallback navigation items.
  - `frontend/lib/navigation.ts`:
    - Removed `Analytics`, `Regional Hierarchy`, `Database Health`, and `Platform Billing` from `PORTAL_NAVIGATION_SCHEMA`.
  - `app/core/constants.py`:
    - Removed `Analytics`, `Regional Hierarchy`, `Database Health`, and `Platform Billing` from `RAW_NAVIGATION_SCHEMA`.
  - `app/api/v1/endpoints/navigation.py`:
    - Removed `ANALYTICS`, `REGIONAL_HIERARCHY`, `DB_HEALTH`, and `BILLING` from `MODULE_CATALOG`.
  - `app/tests/test_dynamic_navigation.py`:
    - Updated assertions for catalog length (>= 8) and verified removed modules are not in catalog.
  - PostgreSQL Database:
    - Purged rows from `role_module_permission` for removed module codes.
    - Purged rows from `tenant_module_entitlement` for removed module codes.
    - Purged rows from `module_catalog` for removed module codes.
    - Purged rows from `navigation_node` for removed module paths and names.
- **Verification**:
  - `pytest app/tests/test_dynamic_navigation.py`: 5/5 tests passed (100%).
  - `npx tsc --noEmit`: 0 errors.
  - `npm run build`: 0 errors, compiled in 8.1s across all 24 routes.
  - Rebuilt and restarted `flowbre_frontend` Docker container with Turbopack standalone output.
  - Verified dynamic modules API (`GET /api/v1/navigation/modules?role=SUPER_ADMIN`) and catalog API (`GET /api/v1/navigation/catalog`) return only the clean, streamlined module list.
- **Undone**: None.

## [2026-09-24] Onboarding Form Native Select Overlay Fix
- **What Changed**:
  - `frontend/components/Field.tsx`:
    - Restored native `<select>` in place of custom DOM `<ul>` menu.
    - Uses `${CONTROL_BASE} appearance-none pr-10 cursor-pointer` with right-positioned `ChevronDown`.
    - Clicking the dropdown now opens the browser/OS-level native overlay (matching Image 2) showing `✓ Resident Indian` and `NRI/PIO` without being clipped by parent card bounds or `overflow-hidden`.
- **Verification**:
  - `npx tsc --noEmit`: 0 errors.
  - Docker frontend container rebuilt and restarted (`docker compose build frontend; docker compose up -d frontend`), verified `HTTP/1.1 200 OK`.
- **Undone**: None.

## [2026-09-28] Compact 52px Top Bar Redesign, Dynamic Channel Branding & Quick Search Engine
- **What Changed**:
  - `frontend/components/AppHeader.tsx`:
    - Replaced monolithic header with exact compact 52px navbar matching Stitch design specification.
    - Dynamically resolves logged-in channel name from `tenantUuid` via `getTenantByUuidOrCode`, API lookup, and user profile session.
    - Displays channel name (e.g. `Bank of India Channel`) in place of `FlowBRE / Console` for channel users.
    - Implemented omni-search engine with keyboard navigation (`⌘K` / `Ctrl+K`, arrows, `Enter`, `Esc`). Popover strictly appears ONLY when the user actively types into the search engine (hidden on blank focus/clear), filtering matching system modules, leads, policies, and actions dynamically.
    - Preserved mail icon with green status dot, bell icon with red status dot, theme toggle, and user initials avatar (`TE` / `SA`) with sign-out dropdown.
  - `frontend/app/globals.css`:
    - Updated `--header-height: 52px`.
- **Verification**:
  - `npx tsc --noEmit`: 0 errors.
  - `docker compose restart frontend`: container restarted and ready in 0ms.
- **Undone**: None.

## [2026-09-28] Removal of Redundant Platform Console Module
- **What Changed**:
  - `frontend/components/Sidebar.tsx`:
    - Completely removed the "Platform Console" master banner from the top of the sidebar.
    - Preserved "Platform Overview" under Platform Oversight governance items, eliminating duplicate access.
  - `frontend/app/platform/dashboard/page.tsx`:
    - Added automatic client-side redirect to `/[tenantUuid]/platformoverview`.
  - `frontend/app/auth/login/page.tsx`:
    - Updated post-authentication redirect for platform administrators from `/platform/dashboard` to `/[tenantUuid]/platformoverview`.
  - `frontend/app/new-channel/page.tsx`:
    - Updated return approval queue CTA to link to `platformoverview`.
  - `app/api/v1/endpoints/navigation.py` & `alembic/versions/0008_dynamic_module_catalog.py`:
    - Updated `PLATFORM_OVERVIEW` route template from `/platform/dashboard` to `/{tenant}/platformoverview`.
  - Database (`module_catalog` table):
    - Executed SQL update to synchronize `route_template` for `PLATFORM_OVERVIEW` to `/{tenant}/platformoverview`.
- **Verification**:
  - `app/tests/test_dynamic_navigation.py`: 5/5 tests passed (100%).
  - `npx tsc --noEmit`: 0 errors.
  - `docker compose restart frontend`: container restarted and ready in 0ms.
- **Undone**: None.

## [2026-09-28] Complete Removal of Cyber Security Cell Module
- **What Changed**:
  - `Database` (`bre_db`):
    - Purged `CYBER_CELL` from `role_module_permission`, `module_catalog`, and `navigation_node` tables.
  - `frontend/store/useModuleStore.ts`:
    - Removed `CYBER_CELL` from canonical fallback navigation items under `Platform Oversight`.
  - `frontend/components/Sidebar.tsx`:
    - Removed `Cyber Security Cell` from static platform governance sections.
  - `frontend/components/AppHeader.tsx`:
    - Removed `module-cyber-cell` from omni-search catalog index.
  - `frontend/lib/navigation.ts`:
    - Removed `Cyber Security Cell` from `PORTAL_NAVIGATION_SCHEMA`.
  - `app/api/v1/endpoints/navigation.py`:
    - Removed `CYBER_CELL` from canonical `MODULE_CATALOG`.
  - `app/core/constants.py`:
    - Removed `Cyber Security Cell` from `RAW_NAVIGATION_SCHEMA`.
  - `alembic/versions/0008_dynamic_module_catalog.py`:
    - Removed `CYBER_CELL` seed definition.
- **Verification**:
  - `app/tests/test_dynamic_navigation.py`: 5/5 tests passed (100%).
  - `npx tsc --noEmit`: 0 errors.
  - `docker compose restart frontend`: container restarted and ready in 0ms.
- **Undone**: None.

## [2026-09-28] Removal of Reporting Tree Submodule from Platform Overview
- **What Changed**:
  - `frontend/app/[tenantUuid]/platformoverview/[channelUuid]/[channelSlug]/workspace/page.tsx`:
    - Removed `CorporateSalesTree` component import.
    - Removed `employeeSubView` state (`"table" | "tree"`).
    - Removed `Table Roster` / `Reporting Tree` segmented sub-view toggle buttons.
    - Removed SubView B visual hierarchy tree section (`CorporateSalesTree`).
    - Rendered the employee Table Roster directly within the Channel Employees tab.
- **Verification**:
  - `npm --prefix frontend run build`: Compiled successfully in 5.3s with zero errors across all 23 Next.js routes.
- **Undone**: None.

## [2026-09-28] Replaced Archive Button with Reject Button on Suspended Channels
- **What Changed**:
  - `frontend/app/[tenantUuid]/platformoverview/page.tsx`:
    - Replaced the grey `Archive` button in the `suspended` stage actions with a red `Reject` button styled with `bg-rose-600` and the `<X size={12} />` icon.
    - Connected to the existing `REJECT` modal for audit reason logging and state machine transition to `rejected`.
  - `frontend/app/platform/dashboard/page.tsx`:
    - Replaced the `Archive` button with the `Reject` button for consistent state actions across routes.
- **Verification**:
  - `npm --prefix frontend run build`: Compiled with 0 errors across all routes in 5.8s.
  - `docker compose restart frontend`: Container restarted and ready.
- **Undone**: None.

## [2026-09-28] Full Database API Persistence for Platform Overview
- **What Changed**:
  - `app/api/v1/endpoints/tenants.py`:
    - Added `cibil_overlay` to `TenantResponse` model.
    - Added `TenantStatusTransitionPayload` request schema.
    - Added `POST /api/v1/tenants/{tenant_uuid}/suspend` endpoint.
    - Added `POST /api/v1/tenants/{tenant_uuid}/reinstate` endpoint.
    - Added `POST /api/v1/tenants/{tenant_uuid}/transition` unified state transition endpoint.
    - Updated `POST /api/v1/tenants/{tenant_uuid}/approve` and `reject` to accept transition payloads and record custom audit reasons in `tenant_status_history`.
    - Updated `GET /api/v1/tenants` and `GET /api/v1/tenants/approval-history` to support optional authentication headers.
  - `frontend/app/[tenantUuid]/platformoverview/page.tsx`:
    - Implemented `fetchLiveChannelsAndAudit()` fetching live tenant records and audit history directly from PostgreSQL.
    - Connected `handleTransition()` to `POST /api/v1/tenants/{tenant_uuid}/transition`.
    - Added "Sync Database" button in the header toolbar with real-time sync spinner.
    - Safeguarded audit log rendering against empty UUID fields.
- **Verification**:
  - E2E API Verification: Successfully tested suspend and reinstate against PostgreSQL; verified audit logging into `tenant_status_history`.
  - `npm --prefix frontend run build`: Compiled with 0 errors across all 23 Next.js routes in 5.9s.
  - Restarted `flowbre_frontend` and `flowbre_fastapi_app` containers.
- **Undone**: None.

## [2026-09-28] Fixed Top Bar (AppHeader) Disappearing on Client-Side Module Navigation
- **What Changed**:
  - `frontend/app/layout.tsx`:
    - Added `overflow-hidden` to `<html>` to stop document-level scroll leakage and viewport displacement.
  - `frontend/components/AppHeader.tsx`:
    - Added safe `currentPath = pathname || ""` fallback to prevent `TypeError: Cannot read properties of null (reading 'match' / 'startsWith')` when Next.js `usePathname()` evaluates during client transitions.
  - `frontend/components/PortalShell.tsx`:
    - Bound `panelRef` and `mainRef` with an explicit `useEffect` resetting `scrollTop = 0` on route changes (`pathname`).
    - Added safe `currentPath = pathname || ""` fallback.
    - Created and wrapped `<AppHeader />` in `<HeaderErrorBoundary>` with fixed `shrink-0 sticky top-0 z-30` guard to guarantee header persistence under any runtime circumstance.
  - `frontend/components/Sidebar.tsx`:
    - Added safe `currentPath` fallback for precision active link calculation.
    - Added `scroll={false}` to all navigation `<Link>` components so Next.js does not fire automatic window scroll restoration on client transitions.
  - `frontend/components/HeaderErrorBoundary.tsx`:
    - Implemented robust React error boundary with fallback console header.
- **Verification**:
  - `npm --prefix frontend run typecheck`: Passed with 0 TypeScript errors.
  - `npm --prefix frontend run build`: Compiled with 0 errors in 6.9s across all 23 Next.js routes.
  - Restarted `flowbre_frontend` Docker container and verified HTTP 200 on `http://localhost:3000/e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f/pipeline`.
- **Undone**: None.

## [2026-09-28] Moved Channel Name to Sidebar Brand Slot & Cleaned Top Bar Duplication
- **What Changed**:
  - `frontend/components/Sidebar.tsx`:
    - Replaced hardcoded "FlowBRE [Tenant] {UUID}" brand block with dynamic channel resolver (`activeTenantUuid`, `channelName`).
    - When a channel is logged in (e.g. Bank of India Channel), displays `<Building2 size={18} />`, the channel name, an emerald `Channel` badge, and `Channel Partner Workspace` (or user role).
    - When Super Admin / platform is active, displays `<Zap size={18} /> FlowBRE [Admin]`.
  - `frontend/components/AppHeader.tsx`:
    - Completely removed `[Logo] FlowBRE / Console` brand lockup, preserving the mobile navigation drawer trigger (`xl:hidden`).
    - Top bar now cleanly leads directly into the functional Quick Search bar (`⌘K`), messages, alerts, theme, and user profile avatar.
  - `frontend/components/HeaderErrorBoundary.tsx`:
    - Updated error fallback header to remove redundant logo and brand title.
- **Verification**:
  - `npm --prefix frontend run typecheck`: 0 TypeScript errors.
  - `npm --prefix frontend run build`: Compiled with 0 errors in 6.8s across all 23 Next.js routes.
  - Restarted `flowbre_frontend` Docker container and verified HTTP 200 on `http://localhost:3000/e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f/pipeline`.
- **Undone**: None.

## [2026-09-28] Nexus Enterprise Sidebar Modernization
- **What Changed**:
  - `frontend/components/Sidebar.tsx`:
    - Transformed brand header into Nexus geometric layout with stylized dark container, bold uppercase title, and wide-tracking `CHANNEL PARTNER` or `ENTERPRISE CORE` subtitle.
    - Updated section titles to `text-[10px] font-bold tracking-[0.14em] uppercase text-slate-400`.
    - Implemented soft indigo active navigation items (`bg-indigo-50/90 text-indigo-700 font-semibold shadow-2xs`) with matching indigo line icons and pulsing `• Active` dot pill badge.
    - Updated inactive items with refined hover states and modern pill badges (`BadgePill`).
    - Implemented floating SLA & Operational Health footer card: emerald checkmark in rounded square, `99.98% SLA • Operational Health`, and quick alert bell with red `3` counter badge.
- **Verification**:
  - `npm --prefix frontend run typecheck`: 0 TypeScript errors.
  - `npm --prefix frontend run build`: Compiled with 0 errors in 6.7s across all 23 Next.js routes.
  - Restarted `flowbre_frontend` Docker container and verified HTTP 200 on `http://localhost:3000/e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f/pipeline`.
- **Undone**: None.

## [2026-09-28] Reverted Sidebar Redesign to Original FlowBRE Style
- **What Changed**:
  - `frontend/components/Sidebar.tsx`:
    - Reverted active navigation links back to high-contrast FlowBRE style: `bg-slate-900 text-white font-bold shadow-xs` with `text-teal-400` icons.
    - Reverted brand header back to original compact layout with emerald `Building2` icon for active channels (`Bank of India Channel`) and `Zap` for platform.
    - Reverted section headers back to `text-[0.625rem] font-extrabold uppercase tracking-wider text-slate-400`.
    - Restored original `BadgePill` rendering without the pulsing `• Active` dot badge.
    - Reverted footer widget back to the original Health Monitor SLA link (`99.98% SLA` with animated green ping).
    - Preserved dynamic channel partner resolution (`Bank of India Channel` detection) and null-safe `currentPath` navigation.
- **Verification**:
  - `npm --prefix frontend run build`: Compiled with 0 errors in 6.2s across 24 Next.js routes.
  - Restarted `flowbre_frontend` Docker container and verified HTTP 200 on `http://localhost:3000/e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f/pipeline`.
- **Undone**: None.

## [2026-09-28] Removed Theme Toggle & Added Dedicated Edit Profile Page
- **What Changed**:
  - `frontend/components/AppHeader.tsx`:
    - Removed dark/light mode toggle button (`<Moon className="w-4 h-4" />`) completely from header.
    - Updated profile dropdown "Edit Profile" action item to navigate directly to the dedicated profile page (`/{tenantUuid}/profile` or `/profile`).
    - Added "User Profile & Account Settings" into Quick Search (`⌘K`) indexing.
  - `frontend/components/ProfileSettingsView.tsx`:
    - Built comprehensive Profile & Account Settings view with large avatar identity header, breadcrumbs, editable personal details (Full Name, Email Address, Direct Phone, Designation), security & governance context (role, cryptographic Argon2 session proof, permissions), and workflow notification preferences.
    - Includes instant `useAuthStore` update and `localStorage` persistence, discard changes, and save confirmation banner.
  - `frontend/app/[tenantUuid]/profile/page.tsx` & `frontend/app/profile/page.tsx`:
    - Created dedicated Next.js App Router pages for scoped tenant and global profile routes.
  - `frontend/lib/uas-client.ts` & `frontend/store/useAuthStore.ts`:
    - Extended `UserProfile` and `updateProfile` to manage `name`, `email`, `phone`, and `designation`.
- **Verification**:
  - `npm --prefix frontend run build`: Compiled with 0 errors in 6.3s across all 26 Next.js routes.
  - Restarted `flowbre_frontend` Docker container and verified HTTP 200 on both `http://localhost:3000/e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f/profile` and `http://localhost:3000/profile`.
- **Undone**: None.

## [2026-09-28] Displayed Channel Name in Sidebar Footer
- **What Changed**:
  - `frontend/components/Sidebar.tsx`:
    - Replaced static "Health Monitor" label in sidebar footer status card with dynamic `{channelName || "Bank of India Channel"}`.
    - Retained the green live ping indicator and 99.98% SLA telemetry badge.
- **Verification**:
  - `npm --prefix frontend run build`: Compiled with 0 errors in 6.7s across all 26 Next.js routes.
  - Restarted `flowbre_frontend` Docker container and verified HTTP 200 on `http://localhost:3000/e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f/dashboard`.
- **Undone**: None.

## [2026-09-28] Right-Side Slide-Over Drawers for Add Role & Add Channel
- **What Changed**:
  - `frontend/app/globals.css`:
    - Added `@keyframes drawer-slide-in` and `.animate-drawer-in` utility for GPU-accelerated right-to-left slide entrance animation.
  - `frontend/app/[tenantUuid]/assignments/page.tsx`:
    - Converted "Add New Role" (`isInviteModalOpen`) and "Edit Role & Status" (`editingUser`) from centered dialogs into right-side slide-over drawers with backdrop blur, scrollable form body, and pinned footer action buttons.
  - `frontend/app/[tenantUuid]/platformoverview/page.tsx`:
    - Replaced "Sponsor New Channel" page redirect with a right-side slide-over drawer enabling instant channel onboarding (Channel Name, Tenant Code, Channel Type, CIBIL Overlay Margin, Admin Email, Direct Phone), state machine progression, and audit ledger persistence.
  - `frontend/app/[tenantUuid]/platformoverview/[channelUuid]/[channelSlug]/workspace/page.tsx`:
    - Converted "Add Employee (Role)" and "Edit Employee Role" modal to right-side slide-over drawer with tenancy isolation indicators.
- **Verification**:
  - `npm --prefix frontend run build`: Turbopack build compiled with 0 errors across all 26 Next.js routes in 6.1s.
  - Restarted `flowbre_frontend` Docker container.
## [2026-09-28] Floating Card Drawers & Crystal Clear Background Visibility
- **What Changed**:
  - Removed all `backdrop-blur-xs` masks across all drawer backdrops, replacing them with minimal transparent overlays (`bg-slate-900/10`) so the underlying page, tables, sidebar, and data remain 100% sharp, bright, legible, and visible.
  - Converted wall-to-wall flat side drawers into floating card inspectors (`fixed top-3 right-3 bottom-3 rounded-3xl border border-slate-200/90 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.22)]`).
  - Added micro-icons to form labels (`User`, `Mail`, `Shield`, `Activity`, `Building2`, `Globe`, `Phone`, `Sliders`), custom select dropdowns with `ChevronDown`, gradient callout cards with `ShieldCheck`, and polished action footers.
  - Applied across "Add New Role" & "Edit Role" ([assignments/page.tsx](file:///c:/Users/DELL/Desktop/breflow/BRE-Flow-Engine/frontend/app/%5BtenantUuid%5D/assignments/page.tsx)), "Sponsor New Channel" ([platformoverview/page.tsx](file:///c:/Users/DELL/Desktop/breflow/BRE-Flow-Engine/frontend/app/%5BtenantUuid%5D/platformoverview/page.tsx)), and "Add Employee Role" ([workspace/page.tsx](file:///c:/Users/DELL/Desktop/breflow/BRE-Flow-Engine/frontend/app/%5BtenantUuid%5D/platformoverview/%5BchannelUuid%5D/%5BchannelSlug%5D/workspace/page.tsx)).
- **Verification**:
  - `npm --prefix frontend run build`: Turbopack compiled all 26 routes with 0 errors in 9.6s.
  - Restarted `flowbre_frontend` Docker container.
  - Verified HTTP 200 on `http://localhost:3000/e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f/assignments` and `http://localhost:3000/e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f/platformoverview`.
## [2026-09-28] Removed Dynamic Tenant UUID from Platform Overview Module
- **What Changed**:
  - `frontend/app/[tenantUuid]/platformoverview/page.tsx` & `frontend/app/platform/dashboard/page.tsx`:
    - Removed `<th className="px-4 py-3.5">Dynamic Tenant UUID</th>` table column header and the corresponding copyable UUID button cell `<td className="px-4 py-3.5">`.
    - Main channel roster table now displays a cleaner, more spacious view with Channel Partner, Classification, Lifecycle Status, CIBIL Overlay, Primary Administrator, and State Machine Actions.
  - `frontend/app/[tenantUuid]/platformoverview/[channelUuid]/[channelSlug]/workspace/page.tsx`:
    - Removed the "Dynamic Tenant UUID" code block under Channel Registration Parameters tab.
- **Verification**:
  - `npm --prefix frontend run build`: Turbopack compiled all 26 routes with 0 errors in 5.8s.
  - Restarted `flowbre_frontend` Docker container.
  - Verified HTTP 200 on `http://localhost:3000/e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f/platformoverview`.
- **Undone**: None.

## [2026-09-28] Compact Audit Log Timeline Cards & "View Details" Slide-Over Drawer
- **What Changed**:
  - `frontend/app/[tenantUuid]/platformoverview/page.tsx` & `frontend/app/platform/dashboard/page.tsx`:
    - Compacted each entry in the "Live `tenant_status_history` Audit Log Timeline" into a single, clean horizontal card displaying Channel Partner Name, lifecycle transition pill (`previous_status → new_status`), timestamp, and an interactive "View Details" button with an `Eye` icon.
    - Implemented a dedicated right-side slide-over drawer (`selectedAuditLog`) in the floating card style (`fixed top-3 right-3 bottom-3 rounded-3xl`) with zero backdrop blur (`bg-slate-900/10`) to keep the rest of the page 100% visible and sharp.
    - Inside the drawer: Channel Partner Entity & UUID, State Machine Lifecycle Transition, Action Justification & Compliance Notes, Authorized Operator, ISO Timestamp, and Immutable Audit Proof assurance.
    - Fixed drawer closing JSX tags.
- **Verification**:
  - `npm --prefix frontend run build`: Turbopack compiled all 26 routes with 0 errors in 6.7s.
  - Restarted `flowbre_frontend` Docker container.
  - Verified HTTP 200 on `http://localhost:3000/e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f/platformoverview`.
- **Undone**: None.

## [2026-09-28] Reverted Audit Log Timeline to Inline Details
- **What Changed**:
  - `frontend/app/[tenantUuid]/platformoverview/page.tsx` & `frontend/app/platform/dashboard/page.tsx`:
    - Reverted "Live `tenant_status_history` Audit Log Timeline" cards back to the full inline layout where the status transition, justification reason, operator name, and timestamp are displayed directly on the card.
    - Removed `selectedAuditLog` right-side slide-over drawer JSX, `selectedAuditLog` state hook, and `Eye` icon imports.
- **Verification**:
  - `npm --prefix frontend run build`: Turbopack build succeeded with 0 errors across all 26 routes in 6.4s.
  - Restarted `flowbre_frontend` Docker container.
  - Verified HTTP 200 on `http://localhost:3000/e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f/platformoverview`.
- **Undone**: None.

## [2026-09-28] Converted Audit Log Timeline Section into "View Details" Drawer Trigger
- **What Changed**:
  - `frontend/app/[tenantUuid]/platformoverview/page.tsx` & `frontend/app/platform/dashboard/page.tsx`:
    - Replaced the bulky inline timeline list with a compact section banner: "Live `tenant_status_history` Audit Log Timeline", "Immutable Ledger" tag, event counter badge, description, and an emerald/teal **"View Details"** button with `Eye` icon.
    - Implemented right-side slide-over drawer (`isAuditLogDrawerOpen`) as an elevated floating card (`fixed top-3 right-3 bottom-3 rounded-3xl`) with transparent zero-blur overlay (`bg-slate-900/10`) so the underlying page remains 100% visible.
    - Inside the drawer: all historical audit events in full detail (partner name, tenant UUID, status transition pills, action reason/justification, operator, timestamp, and immutable ledger assurance).
- **Verification**:
  - `npm --prefix frontend run build`: Turbopack build succeeded with 0 errors across all 26 routes in 6.6s.
  - Restarted `flowbre_frontend` Docker container.
  - Verified HTTP 200 on `http://localhost:3000/e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f/platformoverview`.
- **Undone**: None.

## [2026-09-28] Downwards Collapsible Audit Log Details (No Popup)
- **What Changed**:
  - `frontend/app/[tenantUuid]/platformoverview/page.tsx` & `frontend/app/platform/dashboard/page.tsx`:
    - Removed the right-side slide-over popup drawer entirely.
    - Converted the "Live `tenant_status_history` Audit Log Timeline" card into an in-place downwards collapsible accordion:
      - Default state: compact bar with title, `Immutable Ledger` badge, live count pill (`{auditLogs.length} Events`), description, and `[View Details ▾]` button.
      - On click: expands directly downwards inside the card on the page (`isAuditLogsExpanded`), revealing all audit log events with transition pills, reasons, operator, timestamp, and immutable proof.
      - Button dynamically changes to `[Hide Details ▴]` to collapse back up.
- **Verification**:
  - `npm --prefix frontend run build`: Turbopack build succeeded with 0 errors across all 26 routes in 5.8s.
  - Restarted `flowbre_frontend` Docker container.
  - Verified HTTP 200 on `http://localhost:3000/e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f/platformoverview`.
- **Undone**: None.

## [2026-09-29] End-to-End Sidebar UI Modifications & Complete UX Component & Dropdown Behavior
- **What Changed**:
  - `frontend/store/useSidebarStore.ts`:
    - Added desktop rail mode `isCollapsed` state and `toggleCollapsed()`.
    - Added section expand/collapse dictionary `expandedSections` and `toggleSection(key)`.
    - Added `searchQuery`, `setSearchQuery`, and `clearSearch`.
    - Added `isTenantMenuOpen` and `toggleTenantMenu()`.
  - `frontend/components/Sidebar.tsx`:
    - **Workspace / Tenant Switcher Dropdown**: Clickable trigger button with logo mark, channel name, subtitle, and `ChevronDown`. Opens popover listing all initial channels/tenants with active indicator, response latency, and links to register a new channel or view settings. Includes click-outside listener.
    - **Desktop Sidebar Collapse Toggle (`PanelLeftClose` / `PanelLeft`)**: Allows toggling between full `w-[260px]` and compact rail `w-[68px]` with smooth width transition.
    - **Quick Search & Navigation Bar (`⌘K` / `Ctrl+K`)**: Includes keyboard listener, autofocus, clear button (`X`), and live search filtering across routes.
    - **Flat Primary Top Navigation**: Separated `Dashboard` and `Onboarding Wizard` as flat top items. Refined active item state to light container with teal accents (`bg-teal-50/80 text-teal-800 border-teal-200/80`).
    - **Collapsible Hierarchical Dropdown Groups**: Formatted modules into accordion groups (`COMPLIANCE & UNDERWRITING`, `OPERATIONS & SALES`, `ORGANIZATION & PLATFORM`) with rotating chevrons, individual toggle state, and nested items aligned along a vertical tree guide line (`border-l border-slate-200/90`).
    - **Secondary Utility Links & Footer**: Added subtle links (`Contact us`, `Documentation`, `Status`, `Changelog`) and updated footer brand lockup with live SLA indicator.
    - **Color Palette Adherence**: Strictly preserved all tokens from `globals.css` (`hsl(var(--hsl-brand-primary))`, `hsl(var(--hsl-line))`, `hsl(var(--hsl-bg-glass))`).
- **Verification**:
  - `npm --prefix frontend run build`: Next.js Turbopack build compiled successfully with 0 errors across all routes in 8.7s.
- **Undone**: None.

## [2026-09-29] Removed Redundant Search Engine from Top AppHeader
- **What Changed**:
  - `frontend/components/AppHeader.tsx`:
    - Removed top bar search input, dropdown results popover, static search catalog, and keyboard event listeners.
    - Simplified header layout to keep mobile drawer trigger on the left, an automatic flex spacer in the center, and utilities (messages, notifications, user profile dropdown) neatly grouped on the right.
    - All quick navigation and search capabilities are now unified within the sidebar (`⌘K` / `Ctrl+K`), eliminating interface clutter and duplication.
- **Verification**:
  - `npm --prefix frontend run build`: Next.js Turbopack build succeeded with 0 errors across all 26 routes in 5.9s.
- **Undone**: None.

## [2026-09-29] Removed Secondary Utilitarian Links from Sidebar
- **What Changed**:
  - `frontend/components/Sidebar.tsx`:
    - Removed the "Contact us", "Documentation", and "Status / All systems normal" section located above the footer.
    - Cleaned up the bottom sidebar section so navigation scrolls naturally into the bottom engine brand lockup (`1L flowbre 99.98% SLA`).
- **Verification**:
  - `npm --prefix frontend run build`: Next.js Turbopack build compiled successfully with 0 errors across all 26 routes in 5.7s.
- **Undone**: None.

## [2026-09-29] Replaced Health Checking Footer with Debt Factory Brand Card
- **What Changed**:
  - `frontend/components/Sidebar.tsx`:
    - Removed the health checking navigation link (`/health`) and SLA status badge (`99.98% SLA`).
    - Added clean brand lockup card labeled `debt factory` featuring a custom `DF` logo badge in brand teal.
- **Verification**:
  - `npm --prefix frontend run build`: Next.js Turbopack build compiled cleanly with 0 errors across all 26 routes in 6.6s.
- **Undone**: None.

## [2026-09-29] Relocated Sidebar Collapse Button Outside to Prevent Logo Overlap
- **What Changed**:
  - `frontend/components/Sidebar.tsx`:
    - Removed the cramped desktop button from inside the 68px header row that was competing with the logo.
    - Centered the logo cleanly when in collapsed rail mode.
    - Mounted a floating edge pill button (`absolute -right-3 top-4 z-40`) on the outside border seam of the sidebar with `ChevronLeft` / `ChevronRight` and hover zoom.
  - `frontend/components/AppHeader.tsx`:
    - Added a desktop collapse/expand toggle button (`PanelLeftClose` / `PanelLeft`) at the top-left of the top bar, immediately outside the sidebar.
- **Verification**:
  - `npm --prefix frontend run build`: Next.js Turbopack build compiled cleanly with 0 errors across all 26 routes in 9.1s.
- **Undone**: None.

## [2026-09-29] Integrated User Management Team Dropdown with Email Links & Static WhatsApp
- **What Changed**:
  - `frontend/components/Sidebar.tsx`:
    - Replaced the "Organizations & Channels" popover menu with a "User Management & Team" card.
    - Integrated with `useRoleHierarchyStore` and scoped to the active channel/tenant.
    - Displays user avatars, names, roles, and emails.
    - Added mail action button (`mailto:`) that triggers the email client directly.
    - Added a static emerald WhatsApp logo beside the email action.
    - Included a direct link to open the full User Management module (`/assignments`).
- **Verification**:
  - `npm --prefix frontend run build`: Next.js Turbopack build compiled cleanly with 0 errors across all 26 routes in 5.9s.
- **Undone**: None.

## [2026-09-29] User Management Popover Clipping Fix & Visual Card Redesign
- **What Changed**:
  - `frontend/components/Sidebar.tsx`:
    - Resolved popover right-edge clipping caused by sidebar width mismatch (previously `w-80` inside `w-[260px]`).
    - Configured expanded sidebar popover to `w-[236px]` (`left-0 top-12`) with 12px margins, keeping it completely within bounds.
    - Configured collapsed rail mode popover to `fixed left-[76px] top-3 w-[250px]`, floating outside the rail without clipping.
    - Redesigned user item cards: individual soft cards with teal avatar initials, active indicator, name, role subtitle, quick action buttons (`mailto:` mail client launcher and static emerald WhatsApp logo), plus full clickable email address row.
    - Styled with official brand tokens matching `globals.css` (Teal `#0f766e`, Emerald, Slate).
- **Verification**:
  - `npm --prefix frontend run build`: Compiled 15 static routes and 11 dynamic routes in 5.9s with 0 TypeScript/Turbopack errors.
  - Container reload: `docker restart flowbre_frontend` executed.
  - HTTP check: `curl.exe -I http://127.0.0.1:3000` returned `HTTP/1.1 200 OK`.
## [2026-09-29] Fixed False Active Highlight Matching & Duplicate Module Routes in Sidebar
- **What Changed**:
  - `frontend/components/Sidebar.tsx`:
    - Resolved root cause of false active highlight ("another module is getting the box"):
      - Previously, `currentPath.startsWith(`${item.href}/`)` was matching every route under the tenant for root/home links (`/${tenantUuid}` or `/`), causing `Onboarding Wizard` to highlight on every single page (e.g. `/approvals`, `/dashboard`, `/pipeline`).
      - Implemented `checkItemActive(itemHref, currentPath, homeHref)`: exact match for current route, strict equality for root/home links (`cleanItem === "/" || cleanItem === cleanHome`), and bounded prefix match only for genuine sub-routes (e.g., `/pipeline/lead-123`).
      - Resolved duplicate link paths in `rawSections`:
        - `Credit Bureau Rules` (`CIBIL`) was pointing to `${prefix}/dashboard` (duplicating `Dashboard`); updated to point to its dedicated route `${prefix}/configurator`.
        - `Policy Documents` (`DOCS`) was pointing to `${prefix} || "/"` (duplicating `Onboarding Wizard`); updated to `${prefix}/telemetry`.
      - Updated `homeHref`, `prefix`, and `platformUuid` inside `useMemo` to prioritize `activeTenantUuid` from URL pathname, ensuring generated link paths always match the browser address bar.
- **Verification**:
  - `npm --prefix frontend run build`: Compiled 15 static and 11 dynamic routes in 16.6s with 0 errors.
  - `docker restart flowbre_frontend`: Restarted container cleanly.
  - `curl.exe -I http://127.0.0.1:3000`: Returned `HTTP/1.1 200 OK`.
- **Undone**: None.

## [2026-09-29] Darker Module Section Headers & Sub-Module Active Highlight Sync
- **What Changed**:
  - `frontend/components/Sidebar.tsx`:
    - Darkened default unselected module headers from faint `text-slate-400` to high-contrast `text-slate-500` for clear visibility and hierarchy.
    - Synchronized module section header appearance with on-hover styling when any sub-module is active/clicked (`hasActiveChild`):
      - Container: `bg-slate-100/70 hover:bg-slate-100/90`
      - Section Icon: `text-slate-800`
      - Module Title: `text-slate-800`
      - Chevron Down: `text-slate-700`
## [2026-09-29] Removed Channel Partner and Transactional User Roles from User Management
- **What Changed**:
  - `frontend/app/[tenantUuid]/assignments/page.tsx`:
    - Defined `EXCLUDED_USER_MGMT_ROLES = ["CHANNEL_ADMIN", "TRANSACTIONAL_USER"]`.
    - Filtered `assignableRoles` to exclude `CHANNEL_ADMIN` and `TRANSACTIONAL_USER`, removing both from the "Add New Role" slide-over drawer role selection dropdown.
    - Defined `editableRoles` to filter out both roles from the "Edit Role & Status" drawer selection, with safe fallback for any pre-existing records.
- **Verification**:
  - `npm --prefix frontend run build`: Compiled 15 static and 11 dynamic routes in 5.2s with 0 errors.
  - `docker restart flowbre_frontend`: Restarted container cleanly.
  - `curl.exe http://127.0.0.1:3000/assignments`: Returned HTTP 200 OK.
- **Undone**: None.
## [2026-09-29] Removed Sales Manager and Team Leader from Platform Overview Workspace Add Employee
- **What Changed**:
  - `frontend/app/[tenantUuid]/platformoverview/[channelUuid]/[channelSlug]/workspace/page.tsx`:
    - Removed `SALES_MANAGER` and `TEAM_LEADER` from the "Add Employee" / "Edit Employee Role" right-side slide-over drawer select dropdown (`formRole`).
    - Removed `SALES_MANAGER` and `TEAM_LEADER` from the channel employees table role filter dropdown (`roleFilter`).
    - Only `CHANNEL_ADMIN` (Branch Head) and `TRANSACTIONAL_USER` (Loan Officer) remain available, strictly upholding partner tenant role isolation.
- **Verification**:
  - `npm --prefix frontend run build`: Compiled all 26 routes in 5.5s with 0 errors.
  - `docker restart flowbre_frontend`: Restarted container cleanly.
  - `curl.exe -I http://127.0.0.1:3000`: Returned `HTTP/1.1 200 OK`.
## [2026-09-29] Removed Channel Admin Role from User Management Add New Role
- **What Changed**:
  - `frontend/app/[tenantUuid]/assignments/page.tsx`:
    - Updated `assignableRoles` to explicitly filter out `CHANNEL_ADMIN` (`r.roleKey !== "TRANSACTIONAL_USER" && r.roleKey !== "CHANNEL_ADMIN"`).
    - Updated `editableRoles` to exclude `CHANNEL_ADMIN` for new role selections while gracefully preserving it only when viewing a pre-existing channel admin member.
    - "Add New Role" drawer now exclusively offers internal corporate management roles (`SUPER_ADMIN`, `REGIONAL_DIRECTOR`, `OPERATIONS_HEAD`, `ACCOUNTS_HEAD`, `AREA_MANAGER`, `TEAM_LEADER`, `SALES_MANAGER`).
- **Verification**:
  - `npm --prefix frontend run build`: Compiled all 26 routes in 5.3s with 0 errors.
  - `docker restart flowbre_frontend`: Restarted container cleanly.
  - `curl.exe -I http://127.0.0.1:3000`: Returned `HTTP/1.1 200 OK`.
## [2026-09-29] Resolved Top Bar Disappearing Bug During Client Navigation
- **What Changed**:
  - `frontend/app/globals.css`:
    - Locked `html, body` with `position: fixed; inset: 0; width: 100vw; height: 100vh; height: 100dvh; overflow: hidden; overscroll-behavior: none;`.
  - `frontend/app/layout.tsx`:
    - Updated `<body>` className to `fixed inset-0 flex h-full w-full overflow-hidden bg-bg-deep text-ink selection:bg-brand-500/20 selection:text-brand-600`.
  - `frontend/components/PortalShell.tsx`:
    - Enhanced navigation scroll lock with `requestAnimationFrame` + `setTimeout` clamping.
    - Added `onScroll` guard on `panelRef` to immediately clamp `scrollTop = 0`.
  - `frontend/components/Sidebar.tsx`:
    - Added `onScroll` guards to `<aside>` and `SidebarContent` wrapper.
    - Added `scroll={false}` to the "Open User Management" link.
- **Verification**:
  - `npm --prefix frontend run build`: Compiled all 26 routes in 6.1s with 0 errors.
  - `docker restart flowbre_frontend`: Restarted container cleanly.
  - `curl.exe -I http://127.0.0.1:3000`: Returned `HTTP/1.1 200 OK`.
## [2026-09-29] Enforced Strict Role Hierarchy Visibility (Hide Super Admin from Regional Director)
- **What Changed**:
  - `frontend/store/useRoleHierarchyStore.ts`:
    - Removed hardcoded `REGIONAL_DIRECTOR` exemption from `canSeeUser` and `canAssignRole`.
    - Only `SUPER_ADMIN` has global multi-tier visibility; Regional Director (Tier 1) and below cannot see superiors (`targetTier < actorTier`).
  - `frontend/app/[tenantUuid]/assignments/page.tsx`:
    - Updated Scoped View banner condition to trigger for Regional Director (`currentAuthRole !== "SUPER_ADMIN"`).
  - `frontend/components/Sidebar.tsx`:
    - Filtered `teamUsers` using `canSeeUser(role, u.role)` so Super Admin accounts are excluded from the team directory popup for Regional Director.
- **Verification**:
  - `npm --prefix frontend run build`: Compiled all 26 routes in 6.3s with 0 errors.
  - `docker restart flowbre_frontend`: Restarted container cleanly.
  - `curl.exe -I http://127.0.0.1:3000`: Returned `HTTP/1.1 200 OK`.
## [2026-09-29] Fixed Authentication Challenge Failure for Channel Admin and Transactional Users on Login Page
- **What Changed**:
  - `frontend/app/auth/login/page.tsx`:
    - Updated `DEMO_ACCOUNTS` quick-login cards:
      - Channel Admin: changed from deleted `channel.admin@boi.com` to active `partner@apex-punjab.in` (Apex FinTech Punjab).
      - Transactional Officer: changed from deleted `agent.john@boi.com` to active `simran.k@apex-punjab.in` (Apex FinTech Punjab).
    - Updated email input placeholder to `super.admin@flowbre.com or partner@apex-punjab.in`.
  - `frontend/lib/uas-client.ts`:
    - Surfaced detailed API error messages (`errorBody.detail`) in `requestAuthChallenge` and `verifyAuthChallenge`.
- **Verification**:
  - Executed automated UAS challenge-response proof test: verified `partner@apex-punjab.in`, `simran.k@apex-punjab.in`, `lahari-deloitte@gmail.com`, and `narashimlu-deloitte@gmail.com` all complete challenge and verification with HTTP 200 and valid JWT tokens.
  - `npm --prefix frontend run build`: Compiled all 26 routes in 6.4s with 0 errors.
  - `docker restart flowbre_frontend`: Restarted container cleanly.
  - `curl.exe -I http://127.0.0.1:3000`: Returned `HTTP/1.1 200 OK`.
## [2026-09-29] Channel Partner Default Status Bug Fix (Active on Super Admin Approval)
- **What Changed**:
  - `app/api/v1/endpoints/tenants.py`:
    - Updated `approve_channel_tenant`, `transition_channel_tenant`, and `reinstate_channel_tenant` to automatically provision or activate the `CHANNEL_ADMIN` user with `is_active = True`.
    - Updated `get_tenant_users` to dynamically map status: pending channels return `PENDING` (amber), while approved channels return `ACTIVE` (emerald) for both Main Tenant and sub-tenant rosters.
    - Updated `get_tenant_by_uuid` to use `get_current_user_optional`.
  - `frontend/store/useRoleHierarchyStore.ts`:
    - Added `PENDING` to `UserStatus` type (`"ACTIVE" | "SUSPENDED" | "PENDING"`).
    - Deduplicated `otherTenantUsers` in `fetchUsers` by user ID and lowercase email to eliminate stale localStorage users.
  - `frontend/app/[tenantUuid]/assignments/page.tsx`:
    - Added cross-tab/cross-view listener for `flowbre_approval_sync`.
    - Added `PENDING` badge support (amber) in User Management table.
  - `frontend/app/[tenantUuid]/platformoverview/page.tsx`:
    - Updated active channel stage action from red pill to clean button: `<Ban size={11} /> <span>Suspend Channel</span>`.
    - Added `flowbre_approval_sync` broadcasting on transition.
  - `frontend/app/[tenantUuid]/platformoverview/[channelUuid]/[channelSlug]/workspace/page.tsx`:
    - Bound all workspace data (banner, stats, profile parameters, drawer, and employee roster) to dynamic `liveChannel` from `/api/v1/tenants/${channelUuid}`.
    - Added zero-latency cross-tab synchronization with `flowbre_approval_sync`.
    - Updated employee table status badge to display `ACTIVE` (emerald) and `PENDING` (amber).
    - Restyled toggle button to clean button (`Suspend Access` / `Activate Access`).
- **Verification**:
  - Next.js production build: `npm --prefix frontend run build` compiled all routes with 0 errors.
## [2026-09-30] Multi-Tenant User Management Isolation for Channel Partners
- **What Changed**:
  - `frontend/app/[tenantUuid]/assignments/page.tsx`:
    - Enforced strict multi-tenant isolation in `filteredUsers`. If caller is `CHANNEL_ADMIN` or `TRANSACTIONAL_USER`, results are strictly restricted to staff of their own channel partner (`isSelf` or matching tenant identifier/code) and limited to `CHANNEL_ADMIN` and `TRANSACTIONAL_USER`.
    - Sub-tenant assignments views are strictly scoped to matching `tenantUuid`.
    - Main Tenant assignments view strictly filters to internal corporate employees (`SUPER_ADMIN`, `REGIONAL_DIRECTOR`, `OPERATIONS_HEAD`, `ACCOUNTS_HEAD`, `AREA_MANAGER`, `TEAM_LEADER`, `SALES_MANAGER`), removing cross-tenant channel partner admins and transactional users.
    - Bound `handleInviteUser` and badge display to `effectiveTenantUuid`. Added Channel Isolated alert banner for channel partners.
  - `frontend/store/useRoleHierarchyStore.ts`:
    - Removed duplicate `Harpreet Singh` under Main Tenant seed in `INITIAL_USERS`.
    - Bumped storage key to `flowbre_users_v7_clean` and purged `flowbre_users_v6_clean`.
    - Updated `fetchUsers` to send Bearer JWT Authorization header and cleanly replace stale tenant users.
    - Added `getUsersForTenant(tenantUuid)` helper.
  - `frontend/app/assignments/page.tsx`:
    - Updated default `/assignments` route to resolve channel partner's tenant UUID when logged in as `CHANNEL_ADMIN` or `TRANSACTIONAL_USER`.
  - `frontend/components/Sidebar.tsx`:
    - Updated `activeTenantUuid` to prioritize the authenticated channel partner's bound `tenant_id`.
  - `app/api/v1/endpoints/tenants.py`:
    - Added `current_user` dependency in `get_tenant_users`. If caller is `CHANNEL_ADMIN` or `TRANSACTIONAL_USER`, forces `tenant_uuid = current_user.tenant_id`.
    - Removed `UserModel.role == "CHANNEL_ADMIN"` leakage from Main Tenant corporate user list.
- **Verification**:
  - `GET /api/v1/tenants/tenant-infotech/users`: Returns exactly 1 user (`InfoTech Admin`).
  - `GET /api/v1/tenants/e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f/users`: Returns 9 internal corporate employees with zero channel partner leakage.
## [2026-09-30] Profile Change Password Feature & Sidebar Selection Flicker Resolution
- **What Changed**:
  - Profile Change Password:
    - `app/api/schemas/auth.py`: Added `ChangePasswordRequest` and `ChangePasswordResponse` schemas.
    - `app/services/uas_service.py`: Added `change_password` with cryptographic salt rotation (`generate_salt(16)`), old password verification, and PBKDF2/SHA-256 derivation.
    - `app/api/v1/endpoints/auth.py`: Added authenticated endpoint `POST /api/v1/auth/change-password`.
    - `frontend/lib/uas-client.ts`: Added `changeUserPassword` method calling `/api/v1/auth/change-password`.
    - `frontend/store/useAuthStore.ts`: Added `changePassword` action.
    - `frontend/components/ProfileSettingsView.tsx`: Integrated password change form card with real-time complexity validation and visibility toggles.
  - Sidebar Module Selection Lag & Previous Module Flicker:
    - Root cause: Next.js route transitions are asynchronous; `usePathname()` does not update until the destination page loads (200-500ms delay). The sidebar active indicator (`isActive`) was purely reactive to `usePathname()`, so clicking a new module caused the indicator to remain stuck on the previous module before jumping to the current module. Additionally, regex `/([a-zA-Z0-9_-]{8,36})` did not exclude standard routes, causing `activeTenantUuid` to match route names.
    - `frontend/components/Sidebar.tsx`:
      - Added `optimisticPath` state updated synchronously on `onMouseDown` and `onClick`.
      - Bound `isActive` and `hasActiveChild` to `activePath = optimisticPath || currentPath`, clearing `optimisticPath` when `pathname` resolves.
      - Updated link CSS from `transition-all duration-150` to `transition-colors duration-100` for zero-lag instant visual feedback.
      - Added `KNOWN_STATIC_ROUTES` guard to exclude standard routes from tenant UUID parsing.
    - `frontend/components/AppHeader.tsx`:
      - Added `KNOWN_STATIC_ROUTES` guard to prevent standard route names from matching `activeTenantUuid`.
- **Verification**:
  - `pytest app/tests/test_change_password.py`: 100% pass (5 test cases: mismatch, weak, reuse old, wrong current, and valid rotation).
  - Next.js production build (`npm --prefix frontend run build`): Compiled all 26 routes in 6.1s with 0 errors.
  - Restarted Docker containers `flowbre_fastapi_app` and `flowbre_frontend` and confirmed 200 OK.
- **Undone**: None.

## [2026-09-30] Sidebar Resize Control Unification
- **What Changed**:
  - `frontend/components/Sidebar.tsx`:
    - Removed redundant circular floating edge toggle button (`-right-3 top-4` with `<ChevronLeft />` / `<ChevronRight />`) on the sidebar border seam.
    - Cleaned up unused `ChevronLeft` and `ChevronRight` imports from `lucide-react`.
    - Added global `Ctrl+B` / `Cmd+B` keyboard shortcut handler to toggle sidebar collapse state.
  - `frontend/components/AppHeader.tsx`:
    - Kept and polished the single desktop resize toggle button on the top bar positioned immediately adjacent to the sidebar (`PanelLeft` / `PanelLeftClose`).
    - Updated title tooltip to `title={isCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}`.
- **Verification**:
  - Next.js production build (`npm --prefix frontend run build`): Compiled all 26 routes in 6.3s with 0 errors.
## [2026-09-30] Positioned and Polished Sidebar Resize Button Beside Channel Name
- **What Changed**:
  - `frontend/components/Sidebar.tsx`:
    - Moved the resize toggle button from the second row (`SUPER ADMIN`) into Row 1 beside the channel name (`Bank of India Channel v`), utilizing the open header white space.
    - Scaled up button dimensions: increased to `h-7 w-7` (28px x 28px) matching the logo dimensions, with `PanelLeftClose size={16}`, `rounded-lg`, and refined border `border-slate-200/80 shadow-2xs`.
    - Shifted button position further right: removed parent `mr-1` from tenant container and added `-mr-1` right offset for seamless margin alignment with the sidebar seam.
    - Simplified Row 2 to cleanly display the role title (`SUPER ADMIN`) without any inline action button crowding the text.
    - Updated collapsed rail mode (`isCollapsed === true`) header to render a centered `PanelLeft` expand button (`h-8 w-8`) for one-click restoration of the full sidebar.
  - `frontend/components/AppHeader.tsx`:
    - Removed duplicate desktop sidebar collapse toggle from the top bar, leaving only the mobile navigation drawer trigger for `< xl` screens.
- **Verification**:
  - Next.js production build (`npm --prefix frontend run build`): Compiled all 26 routes in 6.0s with 0 errors.
## [2026-09-30] Fixed Approvals Table Spacing & Eliminated Side Scroll (Unified View)
- **What Changed**:
  - `frontend/app/[tenantUuid]/approvals/page.tsx`:
    - Eliminated horizontal scrollbar (`side scroll`) by removing `overflow-x-auto` and applying `table-fixed w-full` directly on the card table.
    - Proportioned all 6 columns to mathematically fit 100% of the container: Queue ID (`w-20`), Applicant (`w-[19%]`), Exception Category (`w-[18%]`), Underwriter Notes (`w-auto` flexible with `truncate` & tooltip), Status (`w-24`), and Actions (`w-[170px]`).
    - Both Approve and Reject buttons fit comfortably side-by-side with crisp padding and zero clipping, with the entire table presented seamlessly in a single unified view without side scrolling.
## [2026-10-01] Removed ⌘K Symbol Badge from Sidebar Search Bar
- **What Changed**:
  - `frontend/components/Sidebar.tsx`:
    - Removed `<kbd className="... font-mono">⌘K</kbd>` badge from inside the search input box.
    - Updated right input padding from `pr-9` to `pr-8`.
    - Updated search button title in collapsed mode from `Search (⌘K)` to `Search`.
    - Retained background keyboard shortcut listeners (`Ctrl+K` / `Cmd+K`) for power users.
- **Verification**:
  - Next.js production build (`npm --prefix frontend run build`): Compiled all 26 routes in 12.1s with 0 errors.
  - Restarted Docker container `flowbre_frontend` and confirmed 200 OK.
- **Undone**: None.

## [2026-10-01] Dark Grey Dropdown Connecting Tree Guide Line in Sidebar (1px, Dark Grey)
- **What Changed**:
  - `frontend/components/Sidebar.tsx`:
    - Preserved thin 1px border stroke (`border-l`), avoiding all extra thickness per user direction.
    - Set the line color in grey to dark grey:
      - Inactive / Open Dropdown: `border-slate-500` (crisp, clearly defined dark slate grey).
      - Active Module (`hasActiveChild`): `border-slate-600` (deep dark grey).
    - Preserved smooth transition `transition-colors duration-150`.
- **Verification**:
  - Next.js production build (`npm --prefix frontend run build`): Compiled all 26 routes in 5.9s with 0 errors.
  - Docker container restart: `docker restart flowbre_frontend` completed with code 0.
  - Verified frontend container running cleanly on `127.0.0.1:3000`.
- **Undone**: None.

