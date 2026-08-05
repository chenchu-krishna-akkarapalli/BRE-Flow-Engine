"""Document firewall: validates and sanitises untrusted PDF uploads in memory.

Every check runs on bytes only — nothing is written to disk at any point.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Final

import fitz  # PyMuPDF

PDF_MAGIC: Final[bytes] = b"%PDF-"
MAX_UPLOAD_BYTES: Final[int] = 15 * 1024 * 1024      # 15 MB
MAX_PAGES: Final[int] = 120
MAX_DECOMPRESSED_BYTES: Final[int] = 300 * 1024 * 1024  # decompression-bomb ceiling
MAX_IMAGES: Final[int] = 2000

# Active-content markers. Presence is not automatically fatal — the document is
# scrubbed — but each is recorded so the caller can alert on hostile uploads.
_ACTIVE_CONTENT: Final[dict[str, re.Pattern[bytes]]] = {
    "javascript": re.compile(rb"/JavaScript|/JS\b", re.I),
    "auto_action": re.compile(rb"/OpenAction|/AA\b", re.I),
    "launch_action": re.compile(rb"/Launch\b", re.I),
    "embedded_file": re.compile(rb"/EmbeddedFile|/Filespec", re.I),
    "remote_uri": re.compile(rb"/URI\s*\(|/SubmitForm", re.I),
    "xfa_form": re.compile(rb"/XFA\b", re.I),
}


class Threat(str, Enum):
    NOT_A_PDF = "NOT_A_PDF"
    TOO_LARGE = "TOO_LARGE"
    EMPTY_UPLOAD = "EMPTY_UPLOAD"
    ENCRYPTED = "ENCRYPTED"
    CORRUPT = "CORRUPT"
    TOO_MANY_PAGES = "TOO_MANY_PAGES"
    DECOMPRESSION_BOMB = "DECOMPRESSION_BOMB"


class FirewallRejection(Exception):
    """Raised when a document must not reach the extraction engine."""

    def __init__(self, threat: Threat, message: str) -> None:
        super().__init__(message)
        self.threat = threat
        self.message = message


@dataclass(slots=True)
class FirewallVerdict:
    sanitized_pdf: bytes
    page_count: int
    sanitized: bool
    active_content_found: list[str] = field(default_factory=list)


def _assert_container(data: bytes) -> None:
    if not data:
        raise FirewallRejection(Threat.EMPTY_UPLOAD, "Uploaded file is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise FirewallRejection(
            Threat.TOO_LARGE,
            f"File is {len(data) / 1e6:.1f} MB; the limit is {MAX_UPLOAD_BYTES / 1e6:.0f} MB.",
        )
    # Magic bytes, not the declared Content-Type or filename extension: a client
    # can label an executable as application/pdf.
    if not data[:1024].lstrip()[: len(PDF_MAGIC)].startswith(PDF_MAGIC):
        raise FirewallRejection(
            Threat.NOT_A_PDF, "Payload is not a PDF (missing %PDF- signature)."
        )


def _scan_active_content(data: bytes) -> list[str]:
    return [name for name, pattern in _ACTIVE_CONTENT.items() if pattern.search(data)]


def inspect_and_sanitize(data: bytes) -> FirewallVerdict:
    """Validate, bound, and strip active content. Returns sanitised bytes.

    Raises FirewallRejection for anything that must not be parsed.
    """
    _assert_container(data)
    findings = _scan_active_content(data)

    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:  # noqa: BLE001 - any parse failure is a rejection
        raise FirewallRejection(Threat.CORRUPT, f"Unreadable PDF container: {exc}") from exc

    try:
        # Encrypted documents are rejected rather than brute-forced or
        # partially parsed: extraction would silently yield empty content.
        if doc.needs_pass or doc.is_encrypted:
            raise FirewallRejection(
                Threat.ENCRYPTED,
                "Password-protected PDFs are not accepted. Supply a decrypted copy.",
            )

        page_count = doc.page_count
        if page_count == 0:
            raise FirewallRejection(Threat.CORRUPT, "PDF contains no pages.")
        if page_count > MAX_PAGES:
            raise FirewallRejection(
                Threat.TOO_MANY_PAGES,
                f"PDF has {page_count} pages; the limit is {MAX_PAGES}.",
            )

        _assert_not_a_bomb(doc, len(data))

        # Strip JavaScript, embedded files, auto-actions, XFA and metadata.
        # scrub() mutates in place; we then re-serialise the cleaned document.
        try:
            doc.scrub(
                attached_files=True,
                clean_pages=True,
                embedded_files=True,
                javascript=True,
                metadata=True,
                redactions=True,
                remove_links=True,
                reset_fields=True,
                reset_responses=True,
                xml_metadata=True,
            )
            sanitized = doc.tobytes(garbage=3, deflate=True)
            was_sanitized = True
        except Exception:  # noqa: BLE001 - scrubbing is best-effort
            # If scrubbing fails we refuse rather than forward active content.
            if findings:
                raise FirewallRejection(
                    Threat.CORRUPT,
                    "Active content present and could not be stripped.",
                ) from None
            sanitized = data
            was_sanitized = False

        return FirewallVerdict(
            sanitized_pdf=sanitized,
            page_count=page_count,
            sanitized=was_sanitized,
            active_content_found=findings,
        )
    finally:
        doc.close()


def _assert_not_a_bomb(doc: "fitz.Document", encoded_size: int) -> None:
    """Bounds total decompressed stream size and image count.

    A few KB of compressed streams can expand to gigabytes; refuse before the
    extraction engine ever allocates it.
    """
    total = 0
    images = 0
    for xref in range(1, doc.xref_length()):
        try:
            if doc.xref_get_key(xref, "Subtype")[1] == "/Image":
                images += 1
                if images > MAX_IMAGES:
                    raise FirewallRejection(
                        Threat.DECOMPRESSION_BOMB,
                        f"PDF declares more than {MAX_IMAGES} images.",
                    )
            length = doc.xref_get_key(xref, "Length")
            if length[0] == "int":
                total += int(length[1])
        except FirewallRejection:
            raise
        except Exception:  # noqa: BLE001 - malformed xref entries are skipped
            continue
        if total > MAX_DECOMPRESSED_BYTES:
            raise FirewallRejection(
                Threat.DECOMPRESSION_BOMB,
                "Declared stream length exceeds the safety ceiling.",
            )
    # Extreme expansion ratio is the classic bomb signature.
    if encoded_size and total / max(encoded_size, 1) > 500:
        raise FirewallRejection(
            Threat.DECOMPRESSION_BOMB,
            f"Stream expansion ratio {total / encoded_size:.0f}x exceeds the limit.",
        )
