"""Tests for ITR Document Extraction Engine Python Service Bridge."""

import pytest
from app.core.exceptions import InvalidPayloadError
from app.services.itr_service import validate_upload, missing_component


def test_validate_upload_accepts_pdf():
    # Should not raise
    validate_upload(b"%PDF-1.4 test bytes", "application/pdf", "itr_sample.pdf")


def test_validate_upload_rejects_non_pdf():
    with pytest.raises(InvalidPayloadError) as exc_info:
        validate_upload(b"some text", "text/plain", "notes.txt")
    assert "upload the ITR document as a PDF" in str(exc_info.value)


def test_itr_service_component_check():
    # Check that missing_component returns message or None
    msg = missing_component()
    assert msg is None or "itr-cli engine binary was not found" in msg
