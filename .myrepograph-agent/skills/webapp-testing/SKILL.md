---
name: webapp-testing
description: Playwright browser-driven end-to-end testing of single-file web app (flow.html) and FastAPI backend under load. Automated verification of < 30 ms GET and < 80 ms CRUD latency targets and post-GC baseline memory checks.
---

# Webapp Testing (FlowBRE E2E & Latency Benchmark Edition)

Browser-driven and API testing using Playwright to verify `flow.html` UI interaction, FastAPI endpoint correctness, latency SLAs, and memory garbage collection baseline.

## Testing & Audit Directives

1. **Automated Latency SLA Verification Under Load**:
   - Simple GET endpoints (`GET /health`): Assert response latency is **`< 30 ms`**.
   - Onboarding evaluation CRUD endpoints (`POST /evaluate`): Assert end-to-end latency is **`< 80 ms`**.
   - Zen-Engine rule evaluation: Assert Rust core execution is **`< 10 ms`**.
   - Total pipeline latency: Assert **`< 100 ms`**.

2. **Post-GC Baseline Memory Verification**:
   - Execute batch request runs and measure CPython process RSS memory.
   - Confirm that following Stage 4 (`Garbage Collection`), memory reference counts drop to zero and heap allocations return to baseline (`Stage 5: Memory Released`), preventing process memory leaks.

3. **Single-File UI & Bidirectional Sync Verification (`flow.html`)**:
   - Launch Playwright against local `flow.html`.
   - Interact with Step 4 onboarding inputs (`cibilScore`, `dpdCount`, `income`).
   - Assert that Tab 2 simulator decision cards and decision alert banners update in real-time without JavaScript console errors.

4. **Capture Evidence**:
   - Record exact latency distribution logs and take Playwright screenshots of decision output banners for empirical task verification.
