from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.constants import SWR_CACHE_MAX_AGE_SECONDS, SWR_CACHE_STALE_WHILE_REVALIDATE_SECONDS


class SWRCacheHeadersMiddleware(BaseHTTPMiddleware):
    """Injects Cache-Control SWR & Vary headers for GET requests to achieve < 30ms latency SLA."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        if request.method == "GET":
            response.headers["Cache-Control"] = (
                f"public, max-age={SWR_CACHE_MAX_AGE_SECONDS}, "
                f"stale-while-revalidate={SWR_CACHE_STALE_WHILE_REVALIDATE_SECONDS}"
            )
            response.headers["Vary"] = "X-Tenant-ID"
        return response
