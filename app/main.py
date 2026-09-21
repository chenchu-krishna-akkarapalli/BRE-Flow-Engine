from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import settings
from app.core.exceptions import FlowBREException, flowbre_exception_handler
from app.core.logging import logger
from app.core.redis import close_redis, init_redis
from app.middleware.rate_limiter import TenantRateLimiterMiddleware
from app.middleware.swr_cache_headers import SWRCacheHeadersMiddleware
from app.middleware.tenant_context import TenantContextMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle events."""
    logger.info("Initializing FlowBRE Enterprise Engine...")

    # Bank policy rules are the code-defined BANK_MATRIX_RULES matrix, resident
    # in RAM at import time — no rule pre-compilation step is required at boot.

    # WARM Redis Connection Pool
    try:
        await init_redis()
        logger.info("Redis connection pool warmed successfully.")
    except Exception as e:
        logger.warning(f"Redis initialization deferred: {e}")

    # Bootstrap default UAS roles and seed accounts
    try:
        from app.core.database import AsyncSessionLocal
        from app.services.uas_service import uas_service
        async with AsyncSessionLocal() as db:
            await uas_service.seed_default_users(db)
            await db.commit()
            logger.info("Default UAS governance roles and seed accounts initialized.")
    except Exception as e:
        logger.warning(f"UAS seed data check deferred: {e}")

    yield

    logger.info("Shutting down FlowBRE Enterprise Engine...")
    await close_redis()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Custom Pipeline Interceptor Middlewares (LIFO: registered first, executed innermost)
app.add_middleware(SWRCacheHeadersMiddleware)
app.add_middleware(TenantRateLimiterMiddleware)
app.add_middleware(TenantContextMiddleware)

# CORS Middleware Setup (MUST be added LAST so it executes FIRST as the outermost wrapper)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*", "X-Tenant-ID", "Content-Disposition"],
)

# Custom Exception Handlers
app.add_exception_handler(FlowBREException, flowbre_exception_handler)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception(f"Unhandled exception on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": str(exc) or "An unexpected server error occurred.",
                "details": f"{type(exc).__name__}: {str(exc)}",
            },
        },
    )

# Include API Router
app.include_router(api_router, prefix=settings.API_V1_STR)
