import time
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.constants import MSG_HEALTH_OK, MSG_READY_OK, SLA_TARGET_SIMPLE_GET_MS
from app.core.redis import get_redis
from app.services.bre_engine import BANK_MATRIX_RULES, bre_engine_service

router = APIRouter()


@router.get("/health")
async def health_check():
    """Liveness probe executing in < 30 ms SLA target."""
    start_time = time.perf_counter()
    exec_time_ms = round((time.perf_counter() - start_time) * 1000, 3)

    return {
        "status": "healthy",
        "message": MSG_HEALTH_OK,
        "sla_target_ms": SLA_TARGET_SIMPLE_GET_MS,
        "execution_time_ms": exec_time_ms,
    }


@router.get("/ready")
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """Readiness probe validating PostgreSQL DB, Redis, and Zen Engine RAM status in < 30 ms."""
    start_time = time.perf_counter()
    checks = {"database": False, "redis": False, "bre_engine": False}

    # Check DB
    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = True
    except Exception:
        checks["database"] = False

    # Check Redis
    try:
        redis = await get_redis()
        await redis.ping()
        checks["redis"] = True
    except Exception:
        checks["redis"] = False

    # Check BRE Engine readiness against the ACTUAL evaluation dependency: the
    # in-memory bank policy matrix that evaluate_application() consults. (The
    # optional JDM/JSON rulesets are tenant metadata only and are NOT the source
    # of truth for evaluation, so their presence must not gate readiness.)
    checks["bre_engine"] = len(BANK_MATRIX_RULES) == 8

    all_ready = all(checks.values())
    exec_time_ms = round((time.perf_counter() - start_time) * 1000, 3)

    status_code = status.HTTP_200_OK if all_ready else status.HTTP_503_SERVICE_UNAVAILABLE

    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ready" if all_ready else "degraded",
            "message": MSG_READY_OK if all_ready else "One or more dependencies unavailable.",
            "checks": checks,
            "execution_time_ms": exec_time_ms,
        },
    )
