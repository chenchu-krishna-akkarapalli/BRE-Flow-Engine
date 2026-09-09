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


def test_sanitize_coi_payload_fixes_total_income_and_bank_details():
    from app.services.coi_service import _sanitize_coi_payload

    raw_payload = {
        "summary": {
            "gross_total_income": 464063,
            "total_deductions_chapter_6a": 0,
            "total_income": 115,
            "bank_name": "HDFC BANK, ,",
            "ifsc_code": "Type",
        },
        "bank_details": {
            "bank_name": "HDFC BANK, ,",
            "ifsc_code": "Type",
        },
    }

    sanitized = _sanitize_coi_payload(raw_payload)

    assert sanitized["summary"]["total_income"] == 464063
    assert sanitized["summary"]["bank_name"] == "HDFC BANK"
    assert sanitized["summary"]["ifsc_code"] is None
    assert sanitized["bank_details"]["bank_name"] == "HDFC BANK"
    assert sanitized["bank_details"]["ifsc_code"] is None


def test_sanitize_coi_payload_chapter_via_deductions_reconciliation():
    from app.services.coi_service import _sanitize_coi_payload

    raw_payload = {
        "summary": {
            "gross_total_income": 522469,
            "total_deductions_chapter_6a": 27899,
            "total_income": 522469,
            "bank_name": "INDIAN BANK, , A/C NO:51259412349",
            "ifsc_code": "IDIB000J517",
        },
        "bank_details": {
            "bank_name": "INDIAN BANK, ,",
            "ifsc_code": "IDIB000J517",
        },
    }

    sanitized = _sanitize_coi_payload(raw_payload)

    assert sanitized["summary"]["total_income"] == 494570
    assert sanitized["summary"]["total_deductions_chapter_6a"] == 27899
    assert sanitized["summary"]["bank_name"] == "INDIAN BANK"
    assert sanitized["summary"]["ifsc_code"] == "IDIB000J517"


def test_sanitize_coi_payload_44ad_and_rounded_total_income():
    from app.services.coi_service import _sanitize_coi_payload

    raw_payload = {
        "summary": {
            "gross_total_income": 490178,
            "total_deductions_chapter_6a": 0,
            "total_income": 490178,
            "total_income_rounded": 490180,
            "business_turnover": 2487630,
            "deemed_profit_44ad_6pct": 0,
            "deemed_profit_44ad_8pct": 199010,
        }
    }

    sanitized = _sanitize_coi_payload(raw_payload)

    assert sanitized["summary"]["total_income_rounded"] == 490180
    assert sanitized["summary"]["business_turnover"] == 2487630
    assert sanitized["summary"]["deemed_profit_44ad"] == 199010
    assert sanitized["summary"]["deemed_profit_44ad_6pct"] == 0
    assert sanitized["summary"]["deemed_profit_44ad_8pct"] == 199010

