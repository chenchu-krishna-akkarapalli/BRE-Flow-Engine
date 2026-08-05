"""Upload firewall: what reaches the CIBIL extraction engine, and what does not.

Documents are crafted byte by byte rather than committed as fixtures — a repo
carrying a live JavaScript PDF is a hazard to whatever opens it next — and
built without a PDF library, matching the firewall itself.
"""

import zlib

import pytest

from app.constants import MAX_UPLOAD_BYTES
from app.services.pdf_firewall import (
    MAX_PAGES,
    FirewallRejection,
    Threat,
    inspect,
)


def _pdf(objects: list[bytes], *, pages: int = 1, trailer_extra: bytes = b"") -> bytes:
    """A minimal PDF with a correct xref table.

    Built by hand so the tests exercise the same raw bytes the firewall reads,
    with no library normalising a malformed document into a valid one.
    """
    body = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count " + str(pages).encode() + b" >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>",
    ] + objects

    out = b"%PDF-1.4\n"
    offsets = []
    for index, obj in enumerate(body, 1):
        offsets.append(len(out))
        out += str(index).encode() + b" 0 obj\n" + obj + b"\nendobj\n"

    xref_at = len(out)
    out += b"xref\n0 " + str(len(body) + 1).encode() + b"\n0000000000 65535 f \n"
    for offset in offsets:
        out += ("%010d 00000 n \n" % offset).encode()
    out += (b"trailer\n<< /Size " + str(len(body) + 1).encode() + b" /Root 1 0 R "
            + trailer_extra + b">>\nstartxref\n" + str(xref_at).encode() + b"\n%%EOF\n")
    return out


def _stream(body: bytes, declared_length: int) -> bytes:
    return (b"<< /Length " + str(declared_length).encode() + b" /Filter /FlateDecode >>\n"
            b"stream\n" + body + b"\nendstream")


# --- Container guards ------------------------------------------------------ #


def test_empty_upload_is_rejected() -> None:
    with pytest.raises(FirewallRejection) as exc:
        inspect(b"", "report.pdf")
    assert exc.value.threat is Threat.EMPTY_UPLOAD


def test_oversized_upload_is_rejected_before_inspection() -> None:
    with pytest.raises(FirewallRejection) as exc:
        inspect(b"%PDF-1.4" + b"x" * MAX_UPLOAD_BYTES, "report.pdf")
    assert exc.value.threat is Threat.TOO_LARGE


def test_magic_bytes_beat_the_declared_content_type() -> None:
    """A client can label anything application/pdf; the signature cannot be faked."""
    with pytest.raises(FirewallRejection) as exc:
        inspect(b"MZ\x90\x00 this is a PE binary", "report.pdf")
    assert exc.value.threat is Threat.NOT_A_PDF


def test_truncated_pdf_is_rejected() -> None:
    with pytest.raises(FirewallRejection) as exc:
        inspect(_pdf([])[:120], "report.pdf")
    assert exc.value.threat is Threat.CORRUPT


def test_encrypted_pdf_is_refused_not_partially_parsed() -> None:
    """Extraction from an encrypted file yields empty content that reads like a
    failed parse; refusing says what actually happened."""
    with pytest.raises(FirewallRejection) as exc:
        inspect(_pdf([], trailer_extra=b"/Encrypt 9 0 R "), "report.pdf")
    assert exc.value.threat is Threat.ENCRYPTED


def test_page_count_is_bounded() -> None:
    with pytest.raises(FirewallRejection) as exc:
        inspect(_pdf([], pages=MAX_PAGES + 1), "report.pdf")
    assert exc.value.threat is Threat.TOO_MANY_PAGES


def test_a_report_at_the_page_limit_still_passes() -> None:
    verdict = inspect(_pdf([], pages=MAX_PAGES), "report.pdf")
    assert verdict.page_count == MAX_PAGES


def test_a_document_with_no_pages_is_corrupt() -> None:
    headerless = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF\n"
    with pytest.raises(FirewallRejection) as exc:
        inspect(headerless, "report.pdf")
    assert exc.value.threat is Threat.CORRUPT


# --- Active content -------------------------------------------------------- #


@pytest.mark.parametrize("marker,obj", [
    ("javascript", b"<< /S /JavaScript /JS (app.alert\\(1\\)) >>"),
    ("auto_action", b"<< /OpenAction << /S /JavaScript >> >>"),
    ("launch_action", b"<< /S /Launch /F (cmd.exe) >>"),
    ("embedded_file", b"<< /Type /Filespec /EmbeddedFile 100 0 R >>"),
    ("remote_uri", b"<< /S /URI /URI (http://evil.example/x) >>"),
    ("xfa_form", b"<< /XFA [ (form) 100 0 R ] >>"),
])
def test_active_content_is_detected_and_reported(marker: str, obj: bytes) -> None:
    """Detection is the contract now: the Rust engine has no JavaScript engine,
    launch handler or embedded-file support to execute any of it."""
    verdict = inspect(_pdf([obj]), "report.pdf")
    assert marker in verdict.active_content_found


def test_a_clean_report_reports_no_active_content() -> None:
    assert inspect(_pdf([])).active_content_found == []


# --- Decompression bombs --------------------------------------------------- #


def test_declared_stream_length_is_capped() -> None:
    """A few hundred bytes claiming 400 MB is refused before anything reads it."""
    bomb = _pdf([_stream(zlib.compress(b"\x00" * 50_000), declared_length=400_000_000)])
    assert len(bomb) < 4096, "the point is a tiny file declaring an enormous one"

    with pytest.raises(FirewallRejection) as exc:
        inspect(bomb, "report.pdf")
    assert exc.value.threat is Threat.DECOMPRESSION_BOMB


def test_an_honest_stream_of_the_same_shape_passes() -> None:
    """The guard keys on the lie, not on the presence of a compressed stream."""
    body = zlib.compress(b"\x00" * 50_000)
    verdict = inspect(_pdf([_stream(body, declared_length=len(body))]), "report.pdf")

    assert verdict.page_count == 1


# --- Logging contract ------------------------------------------------------ #


def test_log_fields_carry_no_document_text() -> None:
    """The verdict is logged on every hostile upload; it must stay structural."""
    fields = inspect(_pdf([b"<< /Note (SUNITHA S GUZPS9686F) >>"])).as_log_fields()

    assert set(fields) == {"pages", "active_content"}
    assert "GUZPS9686F" not in str(fields)


# --- Real documents -------------------------------------------------------- #


def test_a_genuine_cibil_report_passes_the_firewall() -> None:
    """Real bureau PDFs carry /OpenAction; the firewall must record that without
    turning a legitimate report away."""
    from pathlib import Path

    sample = Path("cibil-pdf-scrapper/test/ARJUNAN.pdf")
    if not sample.exists():
        pytest.skip("sample corpus not present")

    verdict = inspect(sample.read_bytes(), sample.name)
    assert verdict.page_count > 0
