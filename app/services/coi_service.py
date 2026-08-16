# single concise context line
"""COI PDF report extraction via the Rust coi-cli engine.

Transport is a short-lived subprocess framed over stdin, replicating the
cibil-cli and payslip-cli engine bridges: a wall-clock timeout is enforceable per call,
PDF firewall inspection is performed before subprocess execution, and the
uploaded PDF is framed over stdin without persisting to disk.
"""

import asyncio
import json
import os
import shutil
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from app.core.config import settings
from app.core.exceptions import InvalidPayloadError
from app.core.logging import logger, redact_pii
from app.services.pdf_firewall import inspect

ACCEPTED_CONTENT_TYPES = frozenset({"application/pdf"})
STATUS_SUCCESS = "SUCCESS"

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_ENGINE_DEFAULT_RELATIVE = Path("cibil-pdf-scrapper/target/release/coi-cli.exe")
_ENGINE_DEFAULT_ABSOLUTE = _PROJECT_ROOT / "cibil-pdf-scrapper" / "target" / "release" / "coi-cli.exe"


# single concise context line
class CoiEngineError(RuntimeError):
    """The COI engine is unavailable: binary missing, timed out, or unusable output."""


# single concise context line
class CoiDocumentError(InvalidPayloadError):
    """The engine ran but could not read this document."""


# single concise context line
def _binary_path() -> Optional[str]:
    """Configured binary, else workspace release build, else PATH."""
    configured = getattr(settings, "COI_ENGINE_BINARY", "") or os.getenv("COI_ENGINE_BINARY", "")
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
    return shutil.which("coi-cli")


# single concise context line
def missing_component() -> Optional[str]:
    """Name the missing engine, or None when present."""
    if _binary_path() is None:
        return (
            "the coi-cli engine binary was not found. Build it with "
            "`cargo build --release --bin coi-cli` inside cibil-pdf-scrapper/, "
            "or set COI_ENGINE_BINARY to its path."
        )
    return None


# single concise context line
def validate_upload(content: bytes, content_type: Optional[str], filename: str) -> None:
    """Validate content type of uploaded document."""
    if (content_type or "").lower() not in ACCEPTED_CONTENT_TYPES:
        raise InvalidPayloadError(
            f"'{filename}' is {content_type or 'of unknown type'}; upload the COI report as a PDF."
        )


# single concise context line
async def _run_engine(pdf_bytes: bytes, doc_id: str) -> Dict[str, Any]:
    """Spawn coi-cli, frame request over stdin, return envelope dict."""
    binary = _binary_path()
    if binary is None:
        raise CoiEngineError(missing_component() or "The COI engine is unavailable.")

    argv = [binary, "-"]
    proc = await asyncio.create_subprocess_exec(
        *argv,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(pdf_bytes), timeout=settings.COI_ENGINE_TIMEOUT_S
        )
    except asyncio.TimeoutError as exc:
        proc.kill()
        await proc.wait()
        raise CoiEngineError(
            f"The COI engine exceeded its {settings.COI_ENGINE_TIMEOUT_S:.0f}s budget."
        ) from exc

    if proc.returncode != 0:
        logger.error(f"coi-cli exit={proc.returncode} stderr={redact_pii(stderr[:512].decode('utf-8', 'replace'))}")
        raise CoiDocumentError(
            f"'{doc_id}' could not be read as a COI report; the file appears damaged or invalid."
        )

    try:
        return json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise CoiEngineError("The COI engine returned malformed JSON.") from exc


# single concise context line
async def extract_coi_report(
    content: bytes, content_type: Optional[str], filename: str
) -> Tuple[Dict[str, Any], str, str]:
    """Parse an uploaded COI PDF into structured fields payload."""
    validate_upload(content, content_type, filename)

    verdict = inspect(content, filename)
    if verdict.active_content_found:
        logger.warning(
            f"Active content detected in COI upload '{redact_pii(filename)}': "
            f"{verdict.as_log_fields()}"
        )

    data = await _run_engine(content, doc_id=filename)
    if "error" in data:
        status = "FAILED"
        message = str(data["error"])
        logger.warning(f"COI extraction error for '{redact_pii(filename)}': {message}")
        return {}, status, message

    extracted_payload = data.get("data", data) if isinstance(data, dict) else data
    logger.info(
        f"COI extracted from '{redact_pii(filename)}' ({len(content)} bytes): "
        f"assessee={redact_pii(str(extracted_payload.get('assessee_info', {}).get('name')))}"
    )
    return extracted_payload, STATUS_SUCCESS, "COI report parsed successfully."
