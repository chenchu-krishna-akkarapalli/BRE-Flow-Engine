"""CIBIL report extraction via the Rust cibil-cli engine.

The engine already emits FlowBRE's bureau parameters directly: its `--schema
target` delivery payload carries CIBIL_Score, DPD, Loan_Enquiry,
Currently_Outstanding, Write_Off_Amount and Write_Off_Details. This module runs
it and translates those keys onto the Step-4 wizard fields; it does not re-derive
them from the raw account/enquiry tree, which would be a second implementation of
logic the engine owns.

Transport is a short-lived subprocess framed over stdin, adapted from the
engine's own service/cibil_engine_bridge.py: a panic or runaway allocation kills
one child rather than the ASGI worker, a wall-clock timeout is enforceable per
call, and the uploaded PDF never lands on disk.

stdin frame: [8-byte little-endian blocks-JSON length][blocks JSON][raw PDF]
"""

import asyncio
import json
import os
import shutil
import struct
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import settings
from app.core.exceptions import InvalidPayloadError
from app.core.logging import logger, redact_pii
from app.services.pdf_firewall import inspect

ACCEPTED_CONTENT_TYPES = frozenset({"application/pdf"})

# Engine status values. Only SUCCESS carries a data payload.
STATUS_SUCCESS = "SUCCESS"

# Cells that mean "reported, nothing overdue" rather than a day count. Mirrors
# the engine's own vocabulary; CLEAN_DPD_TOKENS in bre_engine.py is the same set.
CLEAN_DPD_CELLS = frozenset({"STD", "XXX", "SMA", "*", "-", ""})

# Non-numeric sentinels the delivery schema uses for "no such write-off".
NIL_TOKENS = frozenset({"NIL", "NONE", "NOT AVAILABLE", ""})

# Delivery-schema write-off key -> the wizard's bureau flag. The engine groups
# by the same seven product classes the bank matrix scores.
WRITE_OFF_FIELD_MAP = {
    "PL_Write_Off": "bureauFlagPL",
    "Home_Loan_Write_Off": "bureauFlagHome",
    "Consumer_Loan_Write_Off": "bureauFlagConsumer",
    "Agri_Loan_Write_Off": "bureauFlagAgri",
    "MSME_Loan_Write_Off": "bureauFlagMSME",
    "Auto_Loan_Write_Off": "bureauFlagAuto",
    "Credit_Card_Write_Off": "bureauFlagCC",
}

# A 90-day DPD is the bank matrix's severity boundary (BUR-402/403).
SEVERE_DPD_DAYS = 90

# Reported years that count as CURRENT delinquency for bureauDpd.
DPD_RECENT_YEARS = 2

_ENGINE_DEFAULT_RELATIVE = Path("cibil-pdf-scrapper/target/release/cibil-cli.exe")


class CibilEngineError(RuntimeError):
    """The engine is unavailable: binary missing, timed out, or unusable output.

    An operator problem, so the endpoint answers 503 — retrying the same
    document later may well succeed.
    """


class CibilDocumentError(InvalidPayloadError):
    """The engine ran but could not read THIS document.

    A property of the upload, not the service, so it answers 422 like any other
    rejected payload rather than implying the service is down.
    """


def _binary_path() -> Optional[str]:
    """Configured binary, else the workspace release build, else PATH."""
    configured = getattr(settings, "CIBIL_ENGINE_BINARY", "") or os.getenv("CIBIL_ENGINE_BINARY", "")
    if configured:
        return configured if Path(configured).exists() else None

    for candidate in (_ENGINE_DEFAULT_RELATIVE, _ENGINE_DEFAULT_RELATIVE.with_suffix("")):
        if candidate.exists():
            return str(candidate)
    return shutil.which("cibil-cli")


def missing_component() -> Optional[str]:
    """Name the missing engine, or None when it is present."""
    if _binary_path() is None:
        return ("the cibil-cli engine binary was not found. Build it with "
                "`cargo build --release --bin cibil-cli` inside cibil-pdf-scrapper/, "
                "or set CIBIL_ENGINE_BINARY to its path.")
    return None


def validate_upload(content: bytes, content_type: Optional[str], filename: str) -> None:
    """Check the DECLARED type — the one thing the firewall cannot see.

    Emptiness, size and the actual %PDF- signature are the firewall's, which
    judges the bytes rather than what the client claims about them.
    """
    if (content_type or "").lower() not in ACCEPTED_CONTENT_TYPES:
        raise InvalidPayloadError(
            f"'{filename}' is {content_type or 'of unknown type'}; upload the CIBIL report as a PDF."
        )


async def _run_engine(pdf_bytes: bytes, doc_id: str) -> Dict[str, Any]:
    """Spawn the engine, frame the request over stdin, return its envelope."""
    binary = _binary_path()
    if binary is None:
        raise CibilEngineError(missing_component() or "The CIBIL engine is unavailable.")

    # --from-pdf: the engine decodes the document itself, so no Python PDF
    # library sits in the extraction path. The blocks slot stays in the frame
    # because the wire format is [len][blocks][pdf]; it is sent empty.
    frame = struct.pack("<Q", 2) + b"[]" + pdf_bytes

    argv = [binary, "-", "--schema", "target", "--pipeline", "--from-pdf", "--doc-id", doc_id]
    proc = await asyncio.create_subprocess_exec(
        *argv,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(frame), timeout=settings.CIBIL_ENGINE_TIMEOUT_S
        )
    except asyncio.TimeoutError as exc:
        proc.kill()
        await proc.wait()
        raise CibilEngineError(
            f"The CIBIL engine exceeded its {settings.CIBIL_ENGINE_TIMEOUT_S:.0f}s budget."
        ) from exc

    if proc.returncode != 0:
        # The binary was found and ran, so a non-zero exit is this document
        # failing to parse — a 422, not a 503 claiming the service is down.
        # stderr quotes document text; it is logged truncated and never returned.
        logger.error(f"cibil-cli exit={proc.returncode} stderr={redact_pii(stderr[:512].decode('utf-8', 'replace'))}")
        raise CibilDocumentError(
            f"'{doc_id}' could not be read as a CIBIL report; the file appears to be "
            "damaged or is not a bureau report."
        )

    try:
        return json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise CibilEngineError("The CIBIL engine returned malformed JSON.") from exc


# --------------------------------------------------------------------------- #
# Delivery schema -> wizard bureau fields
# --------------------------------------------------------------------------- #


def _amount(value: Any) -> float:
    """A rupee figure, or 0.0 for the schema's NIL/None sentinels."""
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value or "").strip().replace(",", "")
    if text.upper() in NIL_TOKENS:
        return 0.0
    try:
        return float(text)
    except ValueError:
        return 0.0


def _dpd_days(cell: Any) -> int:
    """A DPD cell as a day count; reported-clean tokens score 0."""
    text = str(cell if cell is not None else "").strip().upper()
    if text in CLEAN_DPD_CELLS:
        return 0
    try:
        return max(0, int(float(text)))
    except ValueError:
        return 0


def _worst_dpd(dpd: Dict[str, Any]) -> Tuple[int, int, bool, bool]:
    """(recent worst, lifetime worst, missed recently, 90+ days recently).

    Both flags read the RECENT figure, not the lifetime one: the wizard turns
    them back into a day count (dpdDaysFor maps a 90+ answer to 90), so flags
    drawn from lifetime history would reimpose the cured default that windowing
    exists to exclude. The lifetime worst is returned for disclosure only.
    """
    reported = [
        (int(year), months)
        for entry in dpd.values() if isinstance(entry, dict)
        for year, months in entry.items() if year.isdigit() and isinstance(months, dict)
    ]
    if not reported:
        return 0, 0, False, False

    # Windowed against the report's OWN latest year, not each account's: an
    # account that stopped reporting in 2018 has its per-account "recent" years
    # in 2018, which would readmit the very history the window excludes.
    cutoff = max(year for year, _ in reported) - DPD_RECENT_YEARS + 1

    recent = lifetime = 0
    for year, months in reported:
        worst_in_year = max((_dpd_days(cell) for cell in months.values()), default=0)
        lifetime = max(lifetime, worst_in_year)
        if year >= cutoff:
            recent = max(recent, worst_in_year)
    return recent, lifetime, recent > 0, recent > SEVERE_DPD_DAYS


def _pl_score(value: Any) -> Optional[int]:
    """The personal-loan score, or None when the report carries no usable one."""
    if isinstance(value, int) and 300 <= value <= 900:
        return value
    try:
        parsed = int(str(value).strip())
    except (TypeError, ValueError):
        return None
    return parsed if 300 <= parsed <= 900 else None


def map_to_bureau_fields(data: Dict[str, Any]) -> Dict[str, Any]:
    """Translate one delivery payload onto the Step-4 wizard draft fields.

    Keys are the wizard's own, not the engine's: the response is merged straight
    into the form draft, so a rename here is a field that silently stops
    populating. The wizard asks two yes/no questions rather than a DPD figure,
    so the day counts ride along as evidence for the badge.
    """
    outstanding = data.get("Currently_Outstanding") or {}
    enquiry = data.get("Loan_Enquiry") or {}
    write_off_details = data.get("Write_Off_Details") or {}
    recent_dpd, lifetime_dpd, missed, severe = _worst_dpd(data.get("DPD") or {})

    write_offs = {
        field: _amount(write_off_details.get(key)) > 0
        for key, field in WRITE_OFF_FIELD_MAP.items()
    }
    # The wizard collects ONE amount; the credit-card figure is what the matrix
    # scores against a cap, so it wins when several classes are written off.
    cc_amount = _amount(write_off_details.get("Credit_Card_Write_Off"))
    total_write_off = _amount((data.get("Write_Off_Amount") or {}).get("Total"))

    pl_score = _pl_score(data.get("CIBIL_PL_Score"))

    return {
        "bureauCibilScore": int(data.get("CIBIL_Score") or 0),
        "cibilPlScoreToggle": pl_score is not None,
        "bureauCibilPlScore": pl_score,
        "hasMissedPayment": missed,
        "missedOver90": severe,
        "bureauDpd": recent_dpd,
        "worstEverDpd": lifetime_dpd,
        "bureauLoanEnquiry": int(enquiry.get("Past_30_Days") or 0) > 0,
        "enquiriesLast30Days": int(enquiry.get("Past_30_Days") or 0),
        "enquiriesLast12Months": int(enquiry.get("Past_12_Months") or 0),
        "bureauCurrentlyOutstanding": _amount(outstanding.get("Total_Overdue")),
        "totalCurrentBalance": _amount(outstanding.get("Total_Current_Balance")),
        "hasWriteOff": any(write_offs.values()),
        "bureauWriteOffAmount": cc_amount or total_write_off,
        **write_offs,
    }


async def extract_cibil_report(
    content: bytes, content_type: Optional[str], filename: str
) -> Tuple[Dict[str, Any], str, str]:
    """Parse an uploaded CIBIL PDF into wizard bureau fields.

    Returns (fields, status, message). A non-SUCCESS status yields empty fields:
    a report the engine could not attribute to a consumer must not be presented
    as that applicant's bureau history.
    """
    validate_upload(content, content_type, filename)

    # The uploaded bytes are attacker-controlled, so they are bounded and
    # inspected before the engine is handed them.
    verdict = inspect(content, filename)
    if verdict.active_content_found:
        logger.warning(
            f"Active content detected in CIBIL upload '{redact_pii(filename)}': "
            f"{verdict.as_log_fields()}"
        )

    envelope = await _run_engine(content, doc_id=filename)
    status = envelope.get("status", STATUS_SUCCESS)
    message = envelope.get("message", "")

    if status != STATUS_SUCCESS or not envelope.get("data"):
        logger.warning(
            f"CIBIL extraction returned {status} for '{redact_pii(filename)}' "
            f"({len(content)} bytes): {redact_pii(message)}"
        )
        return {}, status, message

    fields = map_to_bureau_fields(envelope["data"])
    logger.info(
        f"CIBIL extracted from '{redact_pii(filename)}' ({len(content)} bytes): "
        f"{redact_pii(dict(fields))}"
    )
    return fields, status, message
