import time
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette import status

from app.constants import DEFAULT_TENANT_RATE_LIMIT_PER_MINUTE, ErrorCode, MSG_ERR_RATE_LIMIT_EXCEEDED
from app.core.redis import get_redis
from app.middleware.tenant_context import get_current_tenant_id


class TenantRateLimiterMiddleware(BaseHTTPMiddleware):
    """Enforces dynamic per-tenant request rate limits using Redis sliding window counter."""

    def __init__(self, app, requests_per_minute: int = DEFAULT_TENANT_RATE_LIMIT_PER_MINUTE):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Skip rate limiting for static/health endpoints
        path = request.url.path
        if path.startswith("/docs") or path.startswith("/openapi.json") or "/health" in path:
            return await call_next(request)

        tenant_id = get_current_tenant_id()
        current_minute = int(time.time() // 60)
        cache_key = f"rate_limit:{tenant_id}:{current_minute}"

        try:
            redis = await get_redis()
            current_count = await redis.incr(cache_key)
            if current_count == 1:
                await redis.expire(cache_key, 60)

            if current_count > self.requests_per_minute:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "success": False,
                        "error": {
                            "code": ErrorCode.RATE_LIMIT_EXCEEDED.value,
                            "message": MSG_ERR_RATE_LIMIT_EXCEEDED,
                            "details": {"limit": self.requests_per_minute, "current": current_count},
                        },
                    },
                )
        except Exception:
            # Fall through gracefully if Redis is temporarily unreachable
            pass

        return await call_next(request)
