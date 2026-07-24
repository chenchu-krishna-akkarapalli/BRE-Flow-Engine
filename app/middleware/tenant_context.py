from contextvars import ContextVar
from typing import Optional
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

# Thread-safe ContextVar storing current request Tenant ID
_tenant_context_var: ContextVar[str] = ContextVar("tenant_id", default="default")


def get_current_tenant_id() -> str:
    """Retrieve the current request tenant_id from ContextVar."""
    return _tenant_context_var.get()


def set_current_tenant_id(tenant_id: str) -> None:
    """Set the current request tenant_id in ContextVar."""
    _tenant_context_var.set(tenant_id)


class TenantContextMiddleware(BaseHTTPMiddleware):
    """Extracts X-Tenant-ID header and binds it to ContextVar for the request lifecycle."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        tenant_id = request.headers.get("X-Tenant-ID") or "default"
        token = _tenant_context_var.set(tenant_id)
        try:
            response = await call_next(request)
            response.headers["X-Tenant-ID"] = tenant_id
            return response
        finally:
            _tenant_context_var.reset(token)
