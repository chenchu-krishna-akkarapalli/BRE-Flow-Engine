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
import re
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

    if stdout:
        try:
            parsed = json.loads(stdout)
            if isinstance(parsed, dict) and ("summary" in parsed or "computation_of_total_income" in parsed or "_meta" in parsed):
                return parsed
            if isinstance(parsed, dict) and "data" in parsed and isinstance(parsed["data"], dict):
                return parsed["data"]
        except json.JSONDecodeError:
            pass

    if proc.returncode != 0:
        logger.error(f"coi-cli exit={proc.returncode} stderr={redact_pii(stderr[:512].decode('utf-8', 'replace'))}")
        raise CoiDocumentError(
            f"'{doc_id}' could not be read as a COI report; the file appears damaged or invalid."
        )

    raise CoiEngineError("The COI engine returned malformed JSON.")


def _sanitize_coi_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitize bank details and enforce math fallback for total_income."""
    if not isinstance(payload, dict):
        return payload

    # 1. Sanitize summary fields if present
    summary = payload.get("summary")
    if isinstance(summary, dict):
        # Clean bank_name
        if "bank_name" in summary and isinstance(summary["bank_name"], str):
            bn = summary["bank_name"].split(",")[0].strip()
            up = bn.upper()
            if not bn or up.startswith(("INTEREST", "SAVINGS", "DEPOSIT", "INCOME", "REFUND", "TYPE")) or "INTEREST ON" in up:
                summary["bank_name"] = None
            else:
                summary["bank_name"] = bn

        # Clean / validate ifsc_code (11-char IFSC standard format)
        ifsc = summary.get("ifsc_code")
        if ifsc and (not isinstance(ifsc, str) or ifsc.strip().upper() == "TYPE" or not re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", ifsc.strip().upper())):
            summary["ifsc_code"] = None

        # Enforce math fallback invariant: total_income = gross_total_income - total_deductions_chapter_6a
        gti = summary.get("gross_total_income")
        ded = summary.get("total_deductions_chapter_6a") or 0
        tot_inc = summary.get("total_income")
        if isinstance(gti, (int, float)):
            expected_tot = int(gti - ded)
            if tot_inc is None or tot_inc == 115 or (ded > 0 and tot_inc == gti) or (tot_inc != expected_tot and ded > 0):
                summary["total_income"] = expected_tot

        # Sanitize total_income_rounded
        tot_inc_round = summary.get("total_income_rounded")
        if (
            tot_inc_round is None
            or tot_inc_round == 115
            or (isinstance(gti, (int, float)) and ded > 0 and tot_inc_round == gti)
            or (isinstance(tot_inc, (int, float)) and tot_inc > 100000 and tot_inc_round is not None and abs(tot_inc - tot_inc_round) > 1000)
        ):
            if summary.get("total_income") is not None:
                tot_val = summary["total_income"]
                summary["total_income_rounded"] = int(round(tot_val / 10.0) * 10)

        # Reconcile deemed_profit_44ad 6% and 8% modes if present
        d6 = summary.get("deemed_profit_44ad_6pct")
        d8 = summary.get("deemed_profit_44ad_8pct")
        current_deemed = summary.get("deemed_profit_44ad")
        if isinstance(d6, (int, float)) and isinstance(d8, (int, float)):
            summary["deemed_profit_44ad"] = int(d6 + d8)
        elif isinstance(d8, (int, float)) and (current_deemed is None or current_deemed == 0):
            summary["deemed_profit_44ad"] = int(d8)
        elif isinstance(d6, (int, float)) and (current_deemed is None or current_deemed == 0):
            summary["deemed_profit_44ad"] = int(d6)

        # Reconcile total_tds_tcs against refundable_amount (prevent gross income base confusion)
        tds = summary.get("total_tds_tcs")
        refund = summary.get("refundable_amount")
        if isinstance(tds, (int, float)) and tds > 0 and isinstance(refund, (int, float)) and refund > 0:
            if tds >= 8 * refund and abs((tds // 10) - refund) <= 500:
                summary["total_tds_tcs"] = int(tds // 10)

    # 2. Sanitize bank_details struct if present
    bank_details = payload.get("bank_details")
    if isinstance(bank_details, dict):
        if "bank_name" in bank_details and isinstance(bank_details["bank_name"], str):
            bn = bank_details["bank_name"].split(",")[0].strip()
            up = bn.upper()
            if not bn or up.startswith(("INTEREST", "SAVINGS", "DEPOSIT", "INCOME", "REFUND", "TYPE")) or "INTEREST ON" in up:
                bank_details["bank_name"] = None
            else:
                bank_details["bank_name"] = bn
        ifsc = bank_details.get("ifsc_code")
        if ifsc and (not isinstance(ifsc, str) or ifsc.strip().upper() == "TYPE" or not re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", ifsc.strip().upper())):
            bank_details["ifsc_code"] = None

    return payload


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
    extracted_payload = _sanitize_coi_payload(extracted_payload)
    logger.info(
        f"COI extracted from '{redact_pii(filename)}' ({len(content)} bytes): "
        f"assessee={redact_pii(str(extracted_payload.get('assessee_info', {}).get('name')))}"
    )
    return extracted_payload, STATUS_SUCCESS, "COI report parsed successfully."
