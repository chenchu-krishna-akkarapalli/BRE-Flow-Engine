from typing import Any, Dict, Optional
from fastapi import Request, status
from fastapi.responses import JSONResponse
from app.constants import ErrorCode, MSG_ERR_RATE_LIMIT_EXCEEDED, MSG_ERR_TENANT_NOT_FOUND, MSG_ERR_UNAUTHORIZED


class FlowBREException(Exception):
    """Base exception class for FlowBRE custom exceptions."""

    def __init__(
        self,
        message: str,
        error_code: ErrorCode = ErrorCode.INTERNAL_SERVER_ERROR,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[Dict[str, Any]] = None,
    ):
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


class TenantNotFoundError(FlowBREException):
    def __init__(self, tenant_id: str):
        super().__init__(
            message=MSG_ERR_TENANT_NOT_FOUND.format(tenant_id=tenant_id),
            error_code=ErrorCode.TENANT_NOT_FOUND,
            status_code=status.HTTP_404_NOT_FOUND,
        )


class TenantHeaderMissingError(FlowBREException):
    def __init__(self):
        super().__init__(
            message="Missing required X-Tenant-ID header.",
            error_code=ErrorCode.TENANT_MISSING_HEADER,
            status_code=status.HTTP_400_BAD_REQUEST,
        )


class RateLimitExceededError(FlowBREException):
    def __init__(self):
        super().__init__(
            message=MSG_ERR_RATE_LIMIT_EXCEEDED,
            error_code=ErrorCode.RATE_LIMIT_EXCEEDED,
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        )


class UnauthorizedError(FlowBREException):
    def __init__(self, message: str = MSG_ERR_UNAUTHORIZED):
        super().__init__(
            message=message,
            error_code=ErrorCode.UNAUTHORIZED,
            status_code=status.HTTP_401_UNAUTHORIZED,
        )


class RuleEvaluationError(FlowBREException):
    def __init__(self, detail: str):
        super().__init__(
            message=f"Rule evaluation failed: {detail}",
            error_code=ErrorCode.RULE_EVALUATION_FAILED,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


class InvalidPayloadError(FlowBREException):
    """Raised when an onboarding payload is structurally malformed (wrong
    field types / shapes) such that the rule engine cannot safely evaluate it.

    Fails closed with a 422 rather than letting a raw AttributeError/TypeError
    escape or — worse — silently treating malformed bureau data as clean.
    """

    def __init__(self, detail: str):
        super().__init__(
            message=f"Invalid onboarding payload: {detail}",
            error_code=ErrorCode.VALIDATION_ERROR,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )


async def flowbre_exception_handler(request: Request, exc: FlowBREException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.error_code.value,
                "message": exc.message,
                "details": exc.details,
            },
        },
    )
