from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.exceptions import FlowBREException, flowbre_exception_handler
from app.core.logging import logger
from app.core.redis import close_redis, init_redis
from app.middleware.rate_limiter import TenantRateLimiterMiddleware
from app.middleware.swr_cache_headers import SWRCacheHeadersMiddleware
from app.middleware.tenant_context import TenantContextMiddleware
from app.services.bre_engine import bre_engine_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle events."""
    logger.info("Initializing FlowBRE Enterprise Engine...")
    
    # Pre-compile JSON decision ASTs into RAM at startup
    bre_engine_service.load_all_rules()

    # WARM Redis Connection Pool
    try:
        await init_redis()
        logger.info("Redis connection pool warmed successfully.")
    except Exception as e:
        logger.warning(f"Redis initialization deferred: {e}")

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

# CORS Middleware Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom Pipeline Interceptor Middlewares
app.add_middleware(SWRCacheHeadersMiddleware)
app.add_middleware(TenantRateLimiterMiddleware)
app.add_middleware(TenantContextMiddleware)

# Custom Exception Handlers
app.add_exception_handler(FlowBREException, flowbre_exception_handler)

# Include API Router
app.include_router(api_router, prefix=settings.API_V1_STR)
