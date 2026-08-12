"""Unit tests for Payslip PDF extraction service, field mapping, and API endpoint."""

import io
import pytest
from fastapi.testclient import TestClient

from app.api.v1.endpoints.onboarding import router
from app.core.exceptions import InvalidPayloadError
from app.main import app
from app.services.payslip_service import (
    _to_rupees,
    map_to_payslip_fields,
    validate_upload,
)

client = TestClient(app)

SAMPLE_PAYSLIP_DATA = {
    "gross_earnings": {
        "paise": 9102700,
        "raw": "91,027.00"
    },
    "net_pay": {
        "paise": 8045800,
        "raw": "80,458.00"
    },
    "employee": {
        "name": "Adithya M",
        "pan": "ABCDE1234F",
        "employee_id": "EMP9921"
    },
    "employer": {
        "name": "Acme Corp Ltd"
    },
    "earnings": [
        {"label": "Basic Salary", "amount": {"paise": 4500000, "raw": "45,000.00"}},
        {"label": "HRA", "amount": {"paise": 2000000, "raw": "20,000.00"}}
    ],
    "deductions": [
        {"label": "Provident Fund", "amount": {"paise": 232800, "raw": "2,328.00"}},
        {"label": "Professional Tax", "amount": {"paise": 20000, "raw": "200.00"}},
        {"label": "Income Tax", "amount": {"paise": 630000, "raw": "6,300.00"}}
    ]
}


def test_to_rupees_conversion():
    assert _to_rupees({"paise": 9102700, "raw": "91,027.00"}) == 91027.0
    assert _to_rupees({"raw": "80,458.00"}) == 80458.0
    assert _to_rupees(50000) == 50000.0
    assert _to_rupees("12,500.50") == 12500.50
    assert _to_rupees(None) is None


def test_validate_upload_accepts_pdf():
    validate_upload(b"%PDF-1.4...", "application/pdf", "payslip.pdf")


def test_validate_upload_rejects_non_pdf():
    with pytest.raises(InvalidPayloadError):
        validate_upload(b"some image data", "image/png", "payslip.png")


def test_map_to_payslip_fields():
    fields = map_to_payslip_fields(SAMPLE_PAYSLIP_DATA)
    assert fields["grossSalary"] == 91027.0
    assert fields["netSalary"] == 80458.0
    assert fields["employerName"] == "Acme Corp Ltd"
    assert fields["applicantName"] == "Adithya M"
    assert fields["panNumber"] == "ABCDE1234F"
    assert fields["providentFund"] == 2328.0
    assert fields["professionalTax"] == 200.0
    assert fields["incomeTax"] == 6300.0


def test_payslip_extract_endpoint_validation():
    # Test non-PDF file upload validation
    response = client.post(
        "/api/v1/onboarding/documents/payslip/extract",
        files={"file": ("payslip.txt", b"hello world", "text/plain")},
        headers={"X-Tenant-ID": "tenant_alpha"},
    )
    assert response.status_code == 422
