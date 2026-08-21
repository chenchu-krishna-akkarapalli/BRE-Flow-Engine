# single concise context line
"""Unit tests for COI PDF extraction service and API endpoint."""

import pytest
from fastapi.testclient import TestClient

from app.core.exceptions import InvalidPayloadError
from app.main import app
from app.services.coi_service import validate_upload

client = TestClient(app)


# single concise context line
def test_validate_upload_accepts_pdf():
    validate_upload(b"%PDF-1.4...", "application/pdf", "coi.pdf")


# single concise context line
def test_validate_upload_rejects_non_pdf():
    with pytest.raises(InvalidPayloadError):
        validate_upload(b"some image data", "image/png", "coi.png")


# single concise context line
def test_coi_extract_endpoint_validation():
    response = client.post(
        "/api/v1/onboarding/documents/coi/extract",
        files={"file": ("coi.txt", b"hello world", "text/plain")},
        headers={"X-Tenant-ID": "tenant_alpha"},
    )
    assert response.status_code == 422
