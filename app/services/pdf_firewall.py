"""Document firewall for untrusted PDF uploads, on bytes alone.

An uploaded CIBIL report is attacker-controlled input, so it is bounded and
inspected before the extraction engine sees it: container signature, size, page
count, declared stream expansion and encryption.

No PDF library is used. Every check reads the raw bytes, which keeps the
extraction path free of a Python PDF dependency and means a malformed document
is rejected by pattern rather than by handing it to a parser to find out.

Active content is DETECTED AND REPORTED but no longer stripped. Stripping
existed to protect PyMuPDF, which renders and can act on it; the Rust engine
parses the container with lopdf and has no JavaScript engine, no launch actions
and no embedded-file handling, so there is nothing downstream to execute it.
"""

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, Final, List

from app.constants import MAX_UPLOAD_BYTES
from app.core.exceptions import InvalidPayloadError

PDF_MAGIC: Final[bytes] = b"%PDF-"
MAX_PAGES: Final[int] = 120
MAX_DECLARED_STREAM_BYTES: Final[int] = 300 * 1024 * 1024

# Compressed-to-declared expansion beyond this is the classic bomb signature.
MAX_EXPANSION_RATIO: Final[int] = 500

# Active-content markers, recorded so a hostile upload is visible in the logs.
_ACTIVE_CONTENT: Final[Dict[str, "re.Pattern[bytes]"]] = {
    "javascript": re.compile(rb"/JavaScript|/JS\b", re.I),
    "auto_action": re.compile(rb"/OpenAction|/AA\b", re.I),
    "launch_action": re.compile(rb"/Launch\b", re.I),
    "embedded_file": re.compile(rb"/EmbeddedFile|/Filespec", re.I),
    "remote_uri": re.compile(rb"/URI\s*\(|/SubmitForm", re.I),
    "xfa_form": re.compile(rb"/XFA\b", re.I),
}

# \b not \s: a name may be followed directly by its dictionary, as in
# "/Encrypt<</Filter/Standard", which a whitespace-anchored pattern misses.
_ENCRYPT = re.compile(rb"/Encrypt\b", re.I)
_PAGE_OBJECT = re.compile(rb"/Type\s*/Page[^s]", re.I)
_PAGE_COUNT = re.compile(rb"/Type\s*/Pages\b.{0,200}?/Count\s+(\d+)", re.I | re.S)
_STREAM_LENGTH = re.compile(rb"/Length\s+(\d{1,12})\b")
_EOF = re.compile(rb"%%EOF")


class Threat(str, Enum):
    NOT_A_PDF = "NOT_A_PDF"
    TOO_LARGE = "TOO_LARGE"
    EMPTY_UPLOAD = "EMPTY_UPLOAD"
    ENCRYPTED = "ENCRYPTED"
    CORRUPT = "CORRUPT"
    TOO_MANY_PAGES = "TOO_MANY_PAGES"
    DECOMPRESSION_BOMB = "DECOMPRESSION_BOMB"


class FirewallRejection(InvalidPayloadError):
    """A document that must not reach the extraction engine.

    Subclasses InvalidPayloadError so a hostile upload answers 422 like any
    other rejected payload, while `threat` keeps the reason machine-readable.
    """

    def __init__(self, threat: Threat, message: str) -> None:
        super().__init__(message)
        self.threat = threat
        self.message = message


@dataclass(slots=True)
class FirewallVerdict:
    page_count: int
    active_content_found: List[str] = field(default_factory=list)

    def as_log_fields(self) -> Dict[str, Any]:
        """Structural facts only — never document text."""
        return {"pages": self.page_count, "active_content": self.active_content_found}


def _assert_container(data: bytes, filename: str) -> None:
    if not data:
        raise FirewallRejection(Threat.EMPTY_UPLOAD, f"'{filename}' is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise FirewallRejection(
            Threat.TOO_LARGE,
            f"'{filename}' is {len(data) / 1_048_576:.1f} MB; the limit is "
            f"{MAX_UPLOAD_BYTES // 1_048_576} MB.",
        )
    # Magic bytes, not the declared Content-Type or the extension: a client can
    # label anything application/pdf.
    if not data[:1024].lstrip()[: len(PDF_MAGIC)].startswith(PDF_MAGIC):
        raise FirewallRejection(
            Threat.NOT_A_PDF, f"'{filename}' is not a PDF (missing the %PDF- signature)."
        )
    if not _EOF.search(data[-4096:]):
        raise FirewallRejection(
            Threat.CORRUPT, f"'{filename}' is truncated (no %%EOF trailer)."
        )


def _page_count(data: bytes) -> int:
    """Pages from the /Pages /Count entry, else a count of page objects."""
    counts = [int(m.group(1)) for m in _PAGE_COUNT.finditer(data)]
    if counts:
        return max(counts)
    return len(_PAGE_OBJECT.findall(data))


def _assert_not_a_bomb(data: bytes, filename: str) -> None:
    """Bound the total DECLARED stream length against the encoded size.

    A few hundred bytes claiming hundreds of megabytes is the classic bomb; it
    is refused before the engine allocates anything.
    """
    total = 0
    for match in _STREAM_LENGTH.finditer(data):
        total += int(match.group(1))
        if total > MAX_DECLARED_STREAM_BYTES:
            raise FirewallRejection(
                Threat.DECOMPRESSION_BOMB,
                "Declared stream length exceeds the safety ceiling.",
            )

    ratio = total / max(len(data), 1)
    if ratio > MAX_EXPANSION_RATIO:
        raise FirewallRejection(
            Threat.DECOMPRESSION_BOMB,
            f"Stream expansion ratio {ratio:.0f}x exceeds the limit.",
        )


def inspect(data: bytes, filename: str = "upload.pdf") -> FirewallVerdict:
    """Validate and bound an upload; raise FirewallRejection to refuse it."""
    _assert_container(data, filename)

    # Encrypted documents are refused rather than partially parsed, which would
    # yield empty content that looks like a failed extraction.
    if _ENCRYPT.search(data):
        raise FirewallRejection(
            Threat.ENCRYPTED,
            "Password-protected PDFs are not accepted. Upload a decrypted copy.",
        )

    pages = _page_count(data)
    if pages == 0:
        raise FirewallRejection(Threat.CORRUPT, f"'{filename}' contains no pages.")
    if pages > MAX_PAGES:
        raise FirewallRejection(
            Threat.TOO_MANY_PAGES,
            f"'{filename}' has {pages} pages; the limit is {MAX_PAGES}.",
        )

    _assert_not_a_bomb(data, filename)

    findings = [name for name, pattern in _ACTIVE_CONTENT.items() if pattern.search(data)]
    return FirewallVerdict(page_count=pages, active_content_found=findings)
