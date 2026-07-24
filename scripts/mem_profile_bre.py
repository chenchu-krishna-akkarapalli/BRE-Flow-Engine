"""5-Stage Request Memory Lifecycle profiler for the FlowBRE rule engine.

Proves that process RSS returns to baseline after a high-volume evaluation
loop (CPython refcount GC reclaims request-scoped objects, no circular-ref
leak) and that tracemalloc shows no monotonic Python-heap growth.

Run:
    python scripts/mem_profile_bre.py --iterations 10000
Exit code 1 if either the RSS drift or the tracemalloc growth guard trips,
so it can gate CI.
"""
from __future__ import annotations

import argparse
import asyncio
import copy
import gc
import statistics
import sys
import tracemalloc
from pathlib import Path

# Ensure the project root (parent of this scripts/ dir) is importable when the
# profiler is launched directly as `python scripts/mem_profile_bre.py`.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# psutil is optional; RSS check is skipped (not failed) if unavailable.
try:
    import psutil

    _PROC = psutil.Process()
except Exception:  # pragma: no cover
    psutil = None
    _PROC = None

from app.services.bre_engine import bre_engine_service

PAYLOAD = {
    "occupation": "Salaried",
    "net_monthly_salary": 60000.0,
    "age": 32,
    "selected_bank": "BOI",
    "credit_bureau": {"cibil_score": 750, "dpd_history": [0, 5, "STD"], "write_off_amount": 0.0},
}


def _rss_mb() -> float:
    return _PROC.memory_info().rss / (1024 * 1024) if _PROC else 0.0


async def _evaluate_once() -> None:
    # Fresh deep copy each call == a distinct "request" through the 5-stage
    # lifecycle: allocate -> use -> teardown -> release.
    await bre_engine_service.evaluate_application(copy.deepcopy(PAYLOAD))


async def _run_loop(iterations: int) -> list[float]:
    """Return a sampled RSS trace (MB) taken every ~iterations/20 requests."""
    sample_every = max(1, iterations // 20)
    trace: list[float] = []
    for i in range(iterations):
        await _evaluate_once()
        if i % sample_every == 0:
            trace.append(_rss_mb())
    return trace


def main() -> int:
    ap = argparse.ArgumentParser(description="FlowBRE memory-lifecycle profiler")
    ap.add_argument("--iterations", type=int, default=10000)
    ap.add_argument("--rss-drift-mb", type=float, default=15.0,
                    help="max tolerated RSS growth vs baseline after GC (MB)")
    ap.add_argument("--tracemalloc-drift-kb", type=float, default=512.0,
                    help="max tolerated tracemalloc top-stats growth (KB)")
    args = ap.parse_args()

    # --- Baseline (post warm-up + forced collection) ------------------------
    asyncio.run(_run_loop(200))  # warm caches / interpreter
    gc.collect()
    tracemalloc.start(25)
    snap_before = tracemalloc.take_snapshot()
    baseline_rss = _rss_mb()

    # --- High-volume loop ---------------------------------------------------
    rss_trace = asyncio.run(_run_loop(args.iterations))
    peak_rss = max(rss_trace) if rss_trace else baseline_rss

    # --- Garbage Collection + Memory Released stages ------------------------
    gc.collect()
    snap_after = tracemalloc.take_snapshot()
    final_rss = _rss_mb()
    tracemalloc.stop()

    # --- tracemalloc delta (Python heap) ------------------------------------
    top_stats = snap_after.compare_to(snap_before, "lineno")
    heap_growth_kb = sum(s.size_diff for s in top_stats) / 1024.0

    # --- Cycle detection (circular-ref leak indicator) ----------------------
    uncollectable = len(gc.garbage)

    # --- Report -------------------------------------------------------------
    print("=" * 68)
    print("FlowBRE 5-Stage Memory Lifecycle Report")
    print("=" * 68)
    print(f"iterations           : {args.iterations}")
    if _PROC:
        print(f"baseline RSS         : {baseline_rss:8.2f} MB")
        print(f"peak RSS (in-loop)   : {peak_rss:8.2f} MB")
        print(f"final RSS (post-GC)  : {final_rss:8.2f} MB")
        print(f"RSS drift            : {final_rss - baseline_rss:+8.2f} MB "
              f"(budget {args.rss_drift_mb} MB)")
        if len(rss_trace) > 2:
            print(f"RSS trace stdev      : {statistics.pstdev(rss_trace):8.2f} MB")
    else:
        print("psutil not installed -> RSS check skipped")
    print(f"tracemalloc heap drift: {heap_growth_kb:+8.2f} KB "
          f"(budget {args.tracemalloc_drift_kb} KB)")
    print(f"gc.garbage (uncollect): {uncollectable}")
    print("top 5 allocation deltas:")
    for stat in top_stats[:5]:
        print(f"   {stat}")
    print("=" * 68)

    # --- Guards -------------------------------------------------------------
    failed = False
    if _PROC and (final_rss - baseline_rss) > args.rss_drift_mb:
        print("FAIL: RSS did not return to baseline -> possible leak")
        failed = True
    if heap_growth_kb > args.tracemalloc_drift_kb:
        print("FAIL: tracemalloc heap grew beyond budget -> possible leak")
        failed = True
    if uncollectable:
        print("FAIL: uncollectable objects present -> circular-reference leak")
        failed = True

    if failed:
        return 1
    print("PASS: memory returned cleanly to baseline.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
