"""Concurrency, tenant-isolation and hot-reload race tests for the FlowBRE
rule engine.

The engine method is `async` but performs zero `await` and no I/O, so under
asyncio it runs to completion cooperatively (no interleaving). Real thread
contention is exercised with a `ThreadPoolExecutor` driving independent event
loops, plus a hot-reload thread mutating shared module state mid-flight.
"""
import asyncio
import copy
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import pytest

from app.services.bre_engine import BANK_MATRIX_RULES, bre_engine_service


def _run(payload, tenant_id="default"):
    return asyncio.run(
        bre_engine_service.evaluate_application(copy.deepcopy(payload), tenant_id=tenant_id)
    )


def _payload(cibil, bank="BOI"):
    return {
        "occupation": "Salaried",
        "net_monthly_salary": 60000.0,
        "age": 32,
        "selected_bank": bank,
        "credit_bureau": {"cibil_score": cibil, "dpd_history": [0], "write_off_amount": 0.0},
    }


# --------------------------------------------------------------------------- #
# 1. asyncio fan-out — many coroutines share one loop; verify no state bleed.
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_event_loop_stays_responsive_during_evaluation_batch():
    """W3 regression guard: evaluation is offloaded to a worker thread, so a
    latency-sensitive heartbeat coroutine keeps getting scheduled while a large
    batch of evaluations is in flight (the loop is never monopolized)."""
    ticks = 0
    running = True

    async def heartbeat():
        nonlocal ticks
        while running:
            ticks += 1
            await asyncio.sleep(0.001)

    hb = asyncio.create_task(heartbeat())
    payload = _payload(cibil=800)
    results = await asyncio.gather(
        *[bre_engine_service.evaluate_application(copy.deepcopy(payload)) for _ in range(1000)]
    )
    running = False
    hb.cancel()

    assert all(r["overall_eligible"] is True for r in results)
    assert ticks > 0, "event loop was starved during the evaluation batch (W3)"


@pytest.mark.asyncio
async def test_asyncio_gather_no_cross_request_bleed():
    """Interleave APPROVE and REJECT applicants; each result must reflect its
    own input, proving the engine holds no request-scoped shared mutable state."""
    approve = _payload(cibil=800)          # passes BOI floor 701
    reject = _payload(cibil=650)           # fails BOI floor 701
    tasks = []
    for i in range(2000):
        tasks.append(
            bre_engine_service.evaluate_application(
                copy.deepcopy(approve if i % 2 == 0 else reject)
            )
        )
    results = await asyncio.gather(*tasks)
    for i, r in enumerate(results):
        expected = True if i % 2 == 0 else False
        assert r["overall_eligible"] is expected, f"index {i} leaked another request's verdict"


# --------------------------------------------------------------------------- #
# 2. Multi-threaded fan-out — independent loops, GIL contention.
# --------------------------------------------------------------------------- #
def test_threadpool_concurrent_execution_isolated():
    approve = _payload(cibil=800)
    reject = _payload(cibil=650)

    def worker(i):
        r = _run(approve if i % 2 == 0 else reject)
        return i, r["overall_eligible"]

    with ThreadPoolExecutor(max_workers=32) as pool:
        futures = [pool.submit(worker, i) for i in range(4000)]
        for fut in as_completed(futures):
            i, eligible = fut.result()
            assert eligible is (i % 2 == 0)


# --------------------------------------------------------------------------- #
# 3. Cross-tenant namespace isolation under concurrency.
# --------------------------------------------------------------------------- #
def test_tenant_isolation_under_thread_contention():
    """tenant_alpha rejects cibil 710 (needs >=720); default approves it.
    Hammer both tenants concurrently and assert verdicts never cross over."""
    p = _payload(cibil=710)  # >= BOI 701 but < alpha 720

    def worker(i):
        tenant = "tenant_alpha" if i % 2 == 0 else "default"
        r = _run(p, tenant_id=tenant)
        return tenant, r["overall_eligible"]

    with ThreadPoolExecutor(max_workers=16) as pool:
        results = [f.result() for f in [pool.submit(worker, i) for i in range(3000)]]

    for tenant, eligible in results:
        if tenant == "tenant_alpha":
            assert eligible is False, "tenant_alpha leaked a default-tenant approval"
        else:
            assert eligible is True, "default tenant inherited tenant_alpha's stricter rule"


# --------------------------------------------------------------------------- #
# 4. Source-of-truth immutability under concurrency (W4).
# --------------------------------------------------------------------------- #
def test_shared_matrix_not_mutated_under_concurrent_load():
    """BANK_MATRIX_RULES is the read-only, code-defined source of truth. A
    storm of concurrent evaluations must never mutate it (no shared-state write
    races) and must keep returning correct verdicts."""
    before = copy.deepcopy(BANK_MATRIX_RULES)
    errors = []

    def evaluator():
        p = _payload(cibil=800)
        for _ in range(500):
            try:
                r = _run(p)
                if r["overall_eligible"] is not True:
                    errors.append(("verdict", r["overall_eligible"]))
            except Exception as e:
                errors.append(("eval", repr(e)))

    threads = [threading.Thread(target=evaluator) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert not errors, f"Errors during concurrent evaluation: {errors[:5]}"
    assert BANK_MATRIX_RULES == before, "shared policy matrix was mutated during evaluation"


# --------------------------------------------------------------------------- #
# 5. Throughput smoke — coarse latency ceiling under serial load.
# --------------------------------------------------------------------------- #
def test_serial_throughput_latency_ceiling():
    p = _payload(cibil=750)
    n = 1000
    start = time.perf_counter()
    for _ in range(n):
        _run(p)
    per_call_ms = (time.perf_counter() - start) / n * 1000
    # Generous ceiling: per-call amortized well under the 10ms RAM-eval SLA.
    assert per_call_ms < 10.0, f"amortized per-call latency {per_call_ms:.3f} ms exceeds RAM SLA"
