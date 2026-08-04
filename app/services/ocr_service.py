"""Document OCR via openbharatocr, with a simulated fallback.

The wizard needs two values off a scanned card: the PAN number and the Aadhaar
number. openbharatocr answers both in ~1.5 s; the name and date of birth come
free in the same call and are passed through when it reads them. A host without
the stack must still serve uploads, so extraction degrades to a filename scan
and the response says so rather than failing the submission.
"""

import asyncio
import os
import re
import shutil
import sys
import tempfile
from types import ModuleType
from typing import Any, Dict, Optional, Tuple

from app.constants import MAX_UPLOAD_BYTES
from app.core.config import settings
from app.core.exceptions import InvalidPayloadError
from app.core.logging import logger, redact_pii

ACCEPTED_CONTENT_TYPES = frozenset({"image/jpeg", "image/jpg", "image/png", "application/pdf"})
ACCEPTED_SUFFIXES = {"image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png",
                     "application/pdf": ".pdf"}

FALLBACK_LOG_MESSAGE = "openbharatocr unavailable; falling back to simulated extraction."

# openbharatocr keys -> our field names. The identity number is what the wizard
# actually needs; name and DOB ride along when the engine manages to read them.
PAN_FIELD_MAP = {"PAN Number": "pan", "Full Name": "full_name", "Date of Birth": "dob"}
AADHAAR_FIELD_MAP = {"Aadhaar Number": "aadhaar_number", "Full Name": "full_name",
                     "Date of Birth": "dob"}
EXTRACTORS = {"pan": ("pan", PAN_FIELD_MAP), "aadhaar": ("front_aadhaar", AADHAAR_FIELD_MAP)}

# Identity numbers as they appear in a filename, e.g. "pan-ABCDE1234F.jpeg".
FILENAME_PAN = re.compile(r"[A-Z]{5}[0-9]{4}[A-Z]", re.IGNORECASE)
FILENAME_AADHAAR = re.compile(r"\d{4}[-\s_]?\d{4}[-\s_]?\d{4}")

# Cards print DD/MM/YYYY; the wizard's <input type="date"> only accepts ISO, so
# a passed-through "25/08/2002" silently leaves the field blank.
PRINTED_DOB = re.compile(r"^(\d{2})[/\-.](\d{2})[/\-.](\d{4})$")


def _iso_dob(value: Optional[str]) -> Optional[str]:
    match = PRINTED_DOB.match((value or "").strip())
    if not match:
        return value or None
    day, month, year = match.groups()
    return f"{year}-{month}-{day}"

# Set once per process by _load_openbharatocr(); None means "not resolved yet".
_obocr: Optional[ModuleType] = None
_obocr_error: Optional[str] = None
_obocr_resolved = False

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
    global _obocr, _obocr_error, _obocr_resolved
    if _obocr_resolved:
        return _obocr

    try:
        import openbharatocr

        _obocr = openbharatocr
    except ImportError as exc:
        # Name the module that is ACTUALLY missing. openbharatocr fails on
        # absent transitive deps (dateutil, cv2, PIL) too, and blaming the
        # top-level package sends whoever reads this log to the wrong fix.
        _obocr_error = f"{exc.__class__.__name__}: {exc}"
        _obocr = None
        logger.warning(f"{FALLBACK_LOG_MESSAGE} ({_obocr_error})")
    finally:
        _obocr_resolved = True

    return _obocr


def ocr_available() -> bool:
    """Whether real extraction is possible on this host."""
    return _load_openbharatocr() is not None


def _unavailable_reason() -> str:
    """Name what is missing and how to fix it, for the strict-mode error body."""
    if _obocr_error:
        return (
            f"the OCR stack is not installed on this interpreter ({sys.executable}): "
            f"{_obocr_error}. Install it with `uv pip install -r requirements.txt`, "
            "then start the API with that same interpreter."
        )
    if shutil.which("tesseract") is None:
        return (
            "the Tesseract OCR engine is not on PATH. It is an OS-level binary, not "
            "a pip package: install it with `winget install --id UB-Mannheim.TesseractOCR` "
            "(Windows) or `sudo apt-get install -y tesseract-ocr` (Debian/Ubuntu)."
        )
    return (
        "the OCR engine failed to read the document. Run "
        "`python scripts/check_ocr_stack.py` with the interpreter serving this API "
        "for a component-by-component diagnosis."
    )


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


def _read_document(document_type: str, content: bytes, suffix: str) -> Dict[str, Optional[str]]:
    """Blocking OCR call. openbharatocr reads from a path, so the bytes land in a temp file."""
    module = _load_openbharatocr()
    if module is None:
        raise OCRUnavailableError(FALLBACK_LOG_MESSAGE)

    extractor_name, field_map = EXTRACTORS[document_type]
    handle, path = tempfile.mkstemp(suffix=suffix)
    try:
        with os.fdopen(handle, "wb") as fh:
            fh.write(content)
        raw: Dict[str, Any] = getattr(module, extractor_name)(path) or {}
        fields = {ours: (str(raw[theirs]).strip() or None) if raw.get(theirs) else None
                  for theirs, ours in field_map.items()}
        fields["dob"] = _iso_dob(fields.get("dob"))
        return fields
    finally:
        # The scanned document is PII and is never retained past the request.
        try:
            os.unlink(path)
        except OSError:
            pass


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


async def _extract(document_type: str, content: bytes, content_type: Optional[str],
                   filename: str) -> Tuple[Dict[str, Optional[str]], bool]:
    """Return (fields, simulated). Never raises for a missing or broken OCR stack."""
    global simulated_extraction_count
    validate_upload(content, content_type, filename)

    if _load_openbharatocr() is not None:
        try:
            # OCR takes seconds, not milliseconds — it runs in a worker thread
            # so it never blocks the event loop serving evaluations.
            fields = await asyncio.to_thread(
                _read_document, document_type, content,
                ACCEPTED_SUFFIXES[(content_type or "").lower()]
            )
            logger.info(f"OCR {document_type} on '{redact_pii(filename)}' returned "
                        f"{redact_pii(dict(fields))}")
            return fields, False
        except Exception as exc:
            # A present-but-broken stack (no Tesseract binary, unreadable image)
            # degrades exactly like an absent one rather than failing the upload.
            logger.warning(f"{FALLBACK_LOG_MESSAGE} ({exc.__class__.__name__}: {exc})")

    if settings.OCR_REQUIRE_REAL:
        # OCR_REQUIRE_REAL is set, so a simulated payload is worse than an
        # error: it would enter the application as if read off the document.
        raise OCRUnavailableError(
            f"Real document extraction was required but is unavailable: {_unavailable_reason()}"
        )

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
    fields, simulated = await _extract("pan", content, content_type, filename)
    if fields.get("pan"):
        fields["pan"] = fields["pan"].upper().replace(" ", "")
    return fields, simulated


async def extract_aadhaar_card(content: bytes, content_type: Optional[str],
                               filename: str) -> Tuple[Dict[str, Optional[str]], bool]:
    fields, simulated = await _extract("aadhaar", content, content_type, filename)
    if fields.get("aadhaar_number"):
        fields["aadhaar_number"] = "".join(ch for ch in fields["aadhaar_number"] if ch.isdigit())
    return fields, simulated
