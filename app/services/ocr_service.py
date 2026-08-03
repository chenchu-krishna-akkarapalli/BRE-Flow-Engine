"""Document OCR via openbharatocr, with a simulated fallback.

openbharatocr pulls in OpenCV, Pillow, pytesseract and a Tesseract binary. A
host without them must still serve uploads: extraction degrades to a filename
scan and the response says so, rather than 400-ing the whole submission.
"""

import asyncio
import os
import re
import tempfile
from types import ModuleType
from typing import Any, Dict, Optional, Tuple

from app.constants import MAX_UPLOAD_BYTES
from app.core.exceptions import InvalidPayloadError
from app.core.logging import logger, redact_pii

ACCEPTED_CONTENT_TYPES = frozenset({"image/jpeg", "image/jpg", "image/png", "application/pdf"})
ACCEPTED_SUFFIXES = {"image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png", "application/pdf": ".pdf"}

# openbharatocr keys -> our field names, per document type.
PAN_FIELD_MAP = {"PAN Number": "pan", "Full Name": "full_name", "Date of Birth": "dob"}
AADHAAR_FIELD_MAP = {"Aadhaar Number": "aadhaar_number", "Full Name": "full_name", "Date of Birth": "dob"}

FALLBACK_LOG_MESSAGE = "openbharatocr unavailable; falling back to simulated extraction."

# Identity numbers as they appear in a filename, e.g. "pan-ABCDE1234F.jpeg".
FILENAME_PAN = re.compile(r"[A-Z]{5}[0-9]{4}[A-Z]", re.IGNORECASE)
FILENAME_AADHAAR = re.compile(r"\d{4}[-\s_]?\d{4}[-\s_]?\d{4}")

# Set once per process by _load_openbharatocr(); None means "not resolved yet".
_ocr_module: Optional[ModuleType] = None
_ocr_import_error: Optional[str] = None
_ocr_resolved = False

# Count of requests served by the fallback, surfaced for ops to alarm on.
simulated_extraction_count = 0


class OCRUnavailableError(InvalidPayloadError):
    """Raised only when a caller explicitly demands real OCR and cannot have it."""


def _load_openbharatocr() -> Optional[ModuleType]:
    """Import openbharatocr once, returning None when it or a dependency is absent.

    Resolved once per process: a missing package will not become present
    mid-run, and retrying the import on every upload costs a failed sys.path
    walk each time.
    """
    global _ocr_module, _ocr_import_error, _ocr_resolved
    if _ocr_resolved:
        return _ocr_module

    try:
        import openbharatocr

        _ocr_module = openbharatocr
    except ImportError as exc:
        # Name the module that is ACTUALLY missing. openbharatocr fails on
        # absent transitive deps (dateutil, cv2, PIL) too, and blaming the
        # top-level package sends whoever reads this log to the wrong fix.
        _ocr_import_error = f"{exc.__class__.__name__}: {exc}"
        _ocr_module = None
        logger.warning(f"{FALLBACK_LOG_MESSAGE} ({_ocr_import_error})")
    finally:
        _ocr_resolved = True

    return _ocr_module


def ocr_available() -> bool:
    """Whether real extraction is possible on this host."""
    return _load_openbharatocr() is not None


def validate_upload(content: bytes, content_type: Optional[str], filename: str) -> None:
    """Reject anything the OCR pipeline cannot read before it reaches a worker thread."""
    if not content:
        raise InvalidPayloadError(f"'{filename}' is empty.")
    if len(content) > MAX_UPLOAD_BYTES:
        raise InvalidPayloadError(
            f"'{filename}' is {len(content) / 1_048_576:.1f} MB; the limit is "
            f"{MAX_UPLOAD_BYTES // 1_048_576} MB."
        )
    if (content_type or "").lower() not in ACCEPTED_CONTENT_TYPES:
        raise InvalidPayloadError(
            f"'{filename}' is {content_type or 'of unknown type'}; upload a JPEG, PNG or PDF."
        )


def _simulated_extract(document_type: str, filename: str) -> Dict[str, Optional[str]]:
    """Read an identity number out of the FILENAME. Pure regex, microseconds.

    It reads only what the caller already supplied. Nothing is invented: a
    filename carrying no identity number yields empty fields, so the wizard
    asks the applicant to type it in rather than pre-filling a number that
    was never on the document.
    """
    if document_type == "pan":
        match = FILENAME_PAN.search(filename)
        return {"pan": match.group(0).upper() if match else None, "full_name": None, "dob": None}

    match = FILENAME_AADHAAR.search(filename)
    digits = re.sub(r"\D", "", match.group(0)) if match else None
    return {"aadhaar_number": digits, "full_name": None, "dob": None}


def _run_extractor(extractor_name: str, content: bytes, suffix: str) -> Dict[str, Any]:
    """Blocking OCR call. openbharatocr reads from a path, so the bytes land in a temp file."""
    module = _load_openbharatocr()
    if module is None:
        raise OCRUnavailableError(FALLBACK_LOG_MESSAGE)

    handle, path = tempfile.mkstemp(suffix=suffix)
    try:
        with os.fdopen(handle, "wb") as fh:
            fh.write(content)
        return getattr(module, extractor_name)(path) or {}
    finally:
        # The scanned document is PII and is never retained past the request.
        try:
            os.unlink(path)
        except OSError:
            pass


async def _extract(extractor: str, field_map: Dict[str, str], content: bytes,
                   content_type: Optional[str], filename: str,
                   document_type: str) -> Tuple[Dict[str, Optional[str]], bool]:
    """Return (fields, simulated). Never raises for a missing or broken OCR stack."""
    global simulated_extraction_count
    validate_upload(content, content_type, filename)

    if _load_openbharatocr() is not None:
        try:
            # OCR takes seconds, not milliseconds — it runs in a worker thread
            # so it never blocks the event loop serving evaluations.
            raw = await asyncio.to_thread(
                _run_extractor, extractor, content, ACCEPTED_SUFFIXES[(content_type or "").lower()]
            )
            fields = {ours: (str(raw[theirs]).strip() or None) if raw.get(theirs) else None
                      for theirs, ours in field_map.items()}
            logger.info(f"OCR {extractor} on '{filename}' returned {redact_pii(dict(fields))}")
            return fields, False
        except Exception as exc:
            # A present-but-broken stack (no Tesseract binary, unreadable image)
            # degrades exactly like an absent one rather than failing the upload.
            logger.warning(f"{FALLBACK_LOG_MESSAGE} ({exc.__class__.__name__}: {exc})")

    simulated_extraction_count += 1
    fields = _simulated_extract(document_type, filename)
    logger.warning(
        f"{FALLBACK_LOG_MESSAGE} document_type={document_type} "
        f"file={redact_pii(filename)} fields={redact_pii(dict(fields))} "
        f"simulated_total={simulated_extraction_count}"
    )
    return fields, True


async def extract_pan_card(content: bytes, content_type: Optional[str],
                           filename: str) -> Tuple[Dict[str, Optional[str]], bool]:
    fields, simulated = await _extract("pan", PAN_FIELD_MAP, content, content_type, filename, "pan")
    if fields.get("pan"):
        fields["pan"] = fields["pan"].upper().replace(" ", "")
    return fields, simulated


async def extract_aadhaar_card(content: bytes, content_type: Optional[str],
                               filename: str) -> Tuple[Dict[str, Optional[str]], bool]:
    fields, simulated = await _extract(
        "front_aadhaar", AADHAAR_FIELD_MAP, content, content_type, filename, "aadhaar"
    )
    if fields.get("aadhaar_number"):
        fields["aadhaar_number"] = "".join(ch for ch in fields["aadhaar_number"] if ch.isdigit())
    return fields, simulated
