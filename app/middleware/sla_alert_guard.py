import time
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

# Monitors response times and triggers emergency alerts when latency exceeds 400ms
class SlaAlertGuardMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, sla_ceiling_ms: float = 400.0):
        super().__init__(app)
        self.sla_ceiling_ms = sla_ceiling_ms

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        start_time = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        if elapsed_ms > self.sla_ceiling_ms:
            response.headers["X-SLA-Breach"] = "true"
        return response
