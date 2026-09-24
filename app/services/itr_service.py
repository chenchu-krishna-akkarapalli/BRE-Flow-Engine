"""ITR PDF document extraction via the Rust itr-cli engine.

Transport is a short-lived subprocess framed over stdin, replicating the
cibil-cli, payslip-cli, and coi-cli engine bridges: a wall-clock timeout is enforceable per call,
PDF firewall inspection is performed before subprocess execution, and the
uploaded PDF is framed over stdin without persisting to disk.
"""

import asyncio
import json
import os
import shutil
import struct
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from app.core.config import settings
from app.core.exceptions import InvalidPayloadError
from app.core.logging import logger, redact_pii
from app.services.pdf_firewall import inspect

ACCEPTED_CONTENT_TYPES = frozenset({"application/pdf"})
STATUS_SUCCESS = "SUCCESS"

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_ENGINE_DEFAULT_RELATIVE = Path("cibil-pdf-scrapper/target/release/itr-cli.exe")
_ENGINE_DEFAULT_ABSOLUTE = _PROJECT_ROOT / "cibil-pdf-scrapper" / "target" / "release" / "itr-cli.exe"


class ItrEngineError(RuntimeError):
    """The ITR engine is unavailable: binary missing, timed out, or unusable output."""


class ItrDocumentError(InvalidPayloadError):
    """The engine ran but could not read this document."""


def _binary_path() -> Optional[str]:
    """Configured binary, else workspace release build, else PATH."""
    configured = getattr(settings, "ITR_ENGINE_BINARY", "") or os.getenv("ITR_ENGINE_BINARY", "")
    if configured:
        return configured if Path(configured).exists() else None

    for candidate in (
        _ENGINE_DEFAULT_ABSOLUTE,
        _ENGINE_DEFAULT_ABSOLUTE.with_suffix(""),
        _ENGINE_DEFAULT_RELATIVE,
        _ENGINE_DEFAULT_RELATIVE.with_suffix(""),
    ):
        if candidate.exists():
            return str(candidate)
    return shutil.which("itr-cli")


def missing_component() -> Optional[str]:
    """Name the missing engine, or None when present."""
    if _binary_path() is None:
        return (
            "the itr-cli engine binary was not found. Build it with "
            "`cargo build --release --bin itr-cli` inside cibil-pdf-scrapper/, "
            "or set ITR_ENGINE_BINARY to its path."
        )
    return None


def validate_upload(content: bytes, content_type: Optional[str], filename: str) -> None:
    """Validate content type of uploaded document."""
    if (content_type or "").lower() not in ACCEPTED_CONTENT_TYPES:
        raise InvalidPayloadError(
            f"'{filename}' is {content_type or 'of unknown type'}; upload the ITR document as a PDF."
        )


_semaphore: Optional[asyncio.Semaphore] = None


def _get_semaphore() -> asyncio.Semaphore:
    global _semaphore
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(getattr(settings, "DOC_EXTRACTION_MAX_CONCURRENCY", 10))
    return _semaphore


async def _run_engine(pdf_bytes: bytes, doc_id: str) -> Dict[str, Any]:
    """Spawn itr-cli, frame request over stdin, return envelope dict."""
    binary = _binary_path()
    if binary is None:
        raise ItrEngineError(missing_component() or "The ITR engine is unavailable.")

    frame = struct.pack("<Q", 2) + b"[]" + pdf_bytes
    argv = [binary, "-"]

    timeout = float(getattr(settings, "ITR_ENGINE_TIMEOUT_S", 25.0))
    async with _get_semaphore():
        proc = await asyncio.create_subprocess_exec(
            *argv,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            out, err = await asyncio.wait_for(proc.communicate(input=frame), timeout=timeout)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            raise ItrEngineError(f"ITR extraction timed out after {timeout:.1f}s") from None

    if proc.returncode != 0:
        err_msg = err.decode("utf-8", errors="replace").strip() or f"exit code {proc.returncode}"
        raise ItrDocumentError(f"ITR engine failed: {err_msg}")

    out_str = out.decode("utf-8", errors="replace").strip()
    if not out_str:
        raise ItrEngineError("ITR engine returned empty output.")

    try:
        parsed = json.loads(out_str)
        return {"status": STATUS_SUCCESS, "data": parsed}
    except json.JSONDecodeError as e:
        raise ItrEngineError(f"Failed to parse ITR engine JSON output: {e}") from e


async def process_itr_pdf(
    pdf_bytes: bytes,
    filename: str,
    content_type: Optional[str] = None,
    doc_id: str = "itr",
) -> Dict[str, Any]:
    """Validate, inspect via PDF firewall, run engine, return extracted dict."""
    validate_upload(pdf_bytes, content_type, filename)
    inspect(pdf_bytes, filename=filename)
    return await _run_engine(pdf_bytes, doc_id)
