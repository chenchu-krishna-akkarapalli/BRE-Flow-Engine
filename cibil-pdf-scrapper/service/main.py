"""FastAPI entrypoint for the CIBIL parse-and-evaluate pipeline.

Flow: upload -> firewall -> Rust engine -> PII redaction -> BRE -> response.
The uploaded PDF exists only as bytes in RAM for the life of the request.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import secrets
import time
import uuid
from contextlib import asynccontextmanager
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from bre import BreOutcome, evaluate
from cibil_engine_bridge import CibilEngine, EngineError
from pdf_firewall import MAX_UPLOAD_BYTES, FirewallRejection, inspect_and_sanitize
from pii_redactor import RedactingFilter, redact_structure

# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------
ENGINE_BINARY = os.getenv("CIBIL_ENGINE_BIN", "./target/release/cibil-cli")
DEDUPE_STATE = os.getenv("CIBIL_DEDUPE_STATE")  # omit to disable duplicate filtering
API_KEYS = {k for k in os.getenv("CIBIL_API_KEYS", "").split(",") if k}
ALLOWED_ORIGINS = [o for o in os.getenv("CIBIL_CORS_ORIGINS", "").split(",") if o]
RATE_LIMIT_PER_MIN = int(os.getenv("CIBIL_RATE_LIMIT_PER_MIN", "30"))

logging.basicConfig(level=logging.INFO)
logging.getLogger().addFilter(RedactingFilter())  # no PII reaches the log sink
logger = logging.getLogger("cibil.api")


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------
class BreBlock(BaseModel):
    decision: str
    ruleset_version: str
    triggered: list[dict[str, str]]
    signals: dict[str, int]


class ParseResponse(BaseModel):
    request_id: str
    status: str = Field(description="SUCCESS | DUPLICATE_DOCUMENT | UNKNOWN_CONSUMER")
    message: str
    duplicate_of: str | None = None
    firewall: dict[str, Any] | None = None
    bre: BreBlock | None = None
    data: dict[str, Any] | None = None


# --------------------------------------------------------------------------
# Security: API key + fixed-window rate limit
# --------------------------------------------------------------------------
_buckets: dict[str, tuple[int, float]] = {}


async def require_api_key(x_api_key: Annotated[str | None, Header()] = None) -> str:
    if not API_KEYS:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "No API keys configured.")
    if not x_api_key or not any(hmac.compare_digest(x_api_key, k) for k in API_KEYS):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or missing X-API-Key.")
    # Identify the caller by digest so the raw key never enters logs or memory keys.
    return hashlib.sha256(x_api_key.encode()).hexdigest()[:16]


async def rate_limit(principal: Annotated[str, Depends(require_api_key)]) -> str:
    """In-process fixed window. Replace with Redis INCR/EXPIRE for multi-instance."""
    window = int(time.time() // 60)
    count, w = _buckets.get(principal, (0, window))
    count = count + 1 if w == window else 1
    _buckets[principal] = (count, window)
    if count > RATE_LIMIT_PER_MIN:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Rate limit of {RATE_LIMIT_PER_MIN}/min exceeded.",
            headers={"Retry-After": "60"},
        )
    return principal


# --------------------------------------------------------------------------
# App
# --------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.engine = CibilEngine(ENGINE_BINARY, dedupe_state=DEDUPE_STATE)
    logger.info("engine ready: %s", ENGINE_BINARY)
    yield


app = FastAPI(
    title="CIBIL BRE Service",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=os.getenv("CIBIL_DOCS_URL") or None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,          # never "*" with credentialed calls
    allow_credentials=bool(ALLOWED_ORIGINS),
    allow_methods=["POST"],
    allow_headers=["X-API-Key", "Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    response.headers["Content-Security-Policy"] = "default-src 'none'"
    return response


@app.exception_handler(FirewallRejection)
async def firewall_handler(request: Request, exc: FirewallRejection) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"status": "REJECTED", "threat": exc.threat.value, "message": exc.message},
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post(
    "/api/v1/cibil/parse-and-evaluate",
    response_model=ParseResponse,
    response_model_exclude_none=True,
)
async def parse_and_evaluate(
    request: Request,
    file: UploadFile,
    principal: Annotated[str, Depends(rate_limit)],
) -> ParseResponse:
    request_id = str(uuid.uuid4())

    # 1. Bounded read — never trust Content-Length. One extra byte proves overflow.
    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"Upload exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )

    try:
        # 2. Firewall: magic bytes, encryption, page/bomb caps, active-content scrub.
        verdict = inspect_and_sanitize(raw)
        if verdict.active_content_found:
            logger.warning(
                "request=%s principal=%s active_content=%s",
                request_id, principal, ",".join(verdict.active_content_found),
            )

        # 3. Engine: sandboxed subprocess, stdin/stdout, no disk.
        doc_id = f"{principal}:{secrets.token_hex(8)}"
        try:
            result = await request.app.state.engine.parse(
                verdict.sanitized_pdf, doc_id=doc_id
            )
        except EngineError as exc:
            logger.error("request=%s engine_error=%s", request_id, exc)
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc

        firewall_block = {
            "page_count": verdict.page_count,
            "sanitized": verdict.sanitized,
            "active_content_found": verdict.active_content_found,
        }

        # 4. Filtered documents short-circuit before any BRE evaluation.
        if result.status != "SUCCESS" or not result.data:
            return ParseResponse(
                request_id=request_id,
                status=result.status,
                message=result.message,
                duplicate_of=result.duplicate_of,
                firewall=firewall_block,
            )

        # 5. Redact before the BRE sees the report, so no rule, log line or
        #    downstream store ever observes an unmasked identifier.
        clean = redact_structure(result.data)
        outcome: BreOutcome = evaluate(clean)

        logger.info(
            "request=%s principal=%s decision=%s rules=%s",
            request_id, principal, outcome.decision.value,
            [t["code"] for t in outcome.triggered],
        )

        return ParseResponse(
            request_id=request_id,
            status="SUCCESS",
            message="Report parsed and evaluated.",
            firewall=firewall_block,
            bre=BreBlock(
                decision=outcome.decision.value,
                ruleset_version=outcome.ruleset_version,
                triggered=outcome.triggered,
                signals=outcome.signals,
            ),
            data=clean,
        )
    finally:
        # 6. Drop references promptly; nothing was ever written to disk.
        del raw
        await file.close()
