"""Upload guards, OTP challenges and the derived Age at Last EMI (add-on.md)."""

import asyncio
from datetime import date
from typing import Any, Dict
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

import app.core.redis as redis_module
from app.api.deps import get_db, get_redis
from app.api.schemas.onboarding import OnboardingFormRequest
from app.constants import MAX_UPLOAD_BYTES, OTP_MAX_ATTEMPTS
from app.constants.form_mappings import LOAN_TENOR_YEARS
from app.core.exceptions import InvalidPayloadError
from app.main import app
from app.services import ocr_service
from app.services.ocr_service import validate_upload
from app.services.verification_service import send_otp, verify_otp

TENANT = {"X-Tenant-ID": "default"}


async def mock_get_db():
    session = MagicMock()
    session.add = lambda *a, **k: None
    future = asyncio.Future()
    future.set_result(MagicMock())
    session.execute.return_value = future
    session.flush.return_value = future
    session.commit.return_value = future
    session.rollback.return_value = future
    yield session


mock_redis = AsyncMock()
mock_redis.incr.return_value = 1
mock_redis.get.return_value = None
redis_module.redis_client = mock_redis


async def mock_get_redis():
    return mock_redis


@pytest.fixture(autouse=True)
def _overrides():
    """Scope the overrides to this module.

    Restoring the previous mapping rather than clearing it: other test modules
    install their own overrides at import time, and a blanket clear() here
    would strip them for every test that runs afterwards.
    """
    previous = dict(app.dependency_overrides)
    app.dependency_overrides[get_db] = mock_get_db
    app.dependency_overrides[get_redis] = mock_get_redis
    yield
    app.dependency_overrides.clear()
    app.dependency_overrides.update(previous)


@pytest.fixture
def client():
    return TestClient(app)


def _no_engines(monkeypatch) -> None:
    """Silence the OCR engine so the fallback path is what runs."""
    monkeypatch.setattr(ocr_service, "_load_openbharatocr", lambda: None)


# --------------------------------------------------------------------------- #
# Upload guards
# --------------------------------------------------------------------------- #

def test_upload_rejects_oversized_file() -> None:
    with pytest.raises(InvalidPayloadError, match="the limit is 5 MB"):
        validate_upload(b"x" * (MAX_UPLOAD_BYTES + 1), "image/png", "big.png")


def test_upload_accepts_exactly_the_limit() -> None:
    validate_upload(b"x" * MAX_UPLOAD_BYTES, "image/png", "at-limit.png")


@pytest.mark.parametrize("content_type", ["image/jpeg", "image/png", "application/pdf"])
def test_upload_accepts_every_documented_type(content_type: str) -> None:
    validate_upload(b"data", content_type, "doc")


@pytest.mark.parametrize("content_type", ["text/plain", "image/gif", None, ""])
def test_upload_rejects_other_types(content_type) -> None:
    with pytest.raises(InvalidPayloadError, match="JPEG, PNG or PDF"):
        validate_upload(b"data", content_type, "doc.txt")


def test_upload_rejects_empty_file() -> None:
    with pytest.raises(InvalidPayloadError, match="is empty"):
        validate_upload(b"", "image/png", "empty.png")


def test_unknown_document_type_is_404(client: TestClient) -> None:
    response = client.post(
        "/api/v1/onboarding/documents/passport/extract",
        files={"file": ("p.png", b"data", "image/png")},
        headers=TENANT,
    )
    assert response.status_code == 422


# --------------------------------------------------------------------------- #
# OTP challenges
# --------------------------------------------------------------------------- #

def test_otp_round_trip_verifies_once() -> None:
    challenge = send_otp("email", "applicant@example.com")
    code = challenge["demo_code"]

    assert verify_otp(challenge["challenge_id"], code)["verified"] is True
    # The challenge is consumed, so a replay of the same code cannot verify.
    with pytest.raises(InvalidPayloadError, match="expired"):
        verify_otp(challenge["challenge_id"], code)


def test_otp_rejects_a_wrong_code_without_consuming_the_challenge() -> None:
    challenge = send_otp("mobile", "9000000001")
    result = verify_otp(challenge["challenge_id"], "000000-wrong"[:6])

    assert result["verified"] is False
    assert result["attempts_remaining"] == OTP_MAX_ATTEMPTS - 1
    # The real code still works afterwards.
    assert verify_otp(challenge["challenge_id"], challenge["demo_code"])["verified"] is True


def test_otp_locks_out_after_the_attempt_ceiling() -> None:
    challenge = send_otp("email", "applicant@example.com")
    for _ in range(OTP_MAX_ATTEMPTS):
        verify_otp(challenge["challenge_id"], "111111")

    with pytest.raises(InvalidPayloadError, match="Too many incorrect attempts"):
        verify_otp(challenge["challenge_id"], challenge["demo_code"])


def test_otp_destination_is_masked_never_echoed() -> None:
    assert send_otp("mobile", "9812345678")["sent_to"] == "******5678"
    assert send_otp("email", "rohan.sharma@example.com")["sent_to"] == "ro***@example.com"


def test_unknown_challenge_is_rejected() -> None:
    with pytest.raises(InvalidPayloadError, match="expired"):
        verify_otp("not-a-real-challenge", "123456")


def test_otp_endpoints_round_trip(client: TestClient) -> None:
    sent = client.post(
        "/api/v1/onboarding/verification/otp/send",
        json={"channel": "email", "target": "applicant@example.com"},
        headers=TENANT,
    )
    assert sent.status_code == 200
    body = sent.json()
    assert body["sent_to"] == "ap***@example.com"

    verified = client.post(
        "/api/v1/onboarding/verification/otp/verify",
        json={"challenge_id": body["challenge_id"], "code": body["demo_code"]},
        headers=TENANT,
    )
    assert verified.status_code == 200
    assert verified.json()["verified"] is True


# --------------------------------------------------------------------------- #
# Age at Last EMI (add-on.md §4) and the co-applicant threshold (§5)
# --------------------------------------------------------------------------- #

def _form(dob: str, **banking: Any) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "identity": {
            "entityType": "Individual", "applicantName": "Test Applicant", "dob": dob,
            "pan": "ABCDE1234F", "phone": "9000000001", "email": "a@example.com",
            "citizenshipStatus": "Resident Indian",
        },
        "address": {"pincode": "560001", "residentDetails": "Owned House"},
        "occupation": {
            "profileType": "Salaried", "tenureBand": "2y+", "grossSalary": 50000.0,
            "salaryMode": "Salary payment mode- Bank Credit",
            "form16Status": "Form 16", "form16Years": 2,
        },
        "banking": {
            "existingAccountBank": "BOI", "loanType": "Auto Loan",
            "bureauCibilScore": 780, "bureauDpd": 0,
        },
    }
    payload["banking"].update(banking)
    return payload


def _age_years(dob: str) -> int:
    born = date.fromisoformat(dob)
    today = date.today()
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


def test_age_at_last_emi_is_derived_from_dob_when_absent() -> None:
    dob = f"{date.today().year - 40:04d}-01-01"
    engine = OnboardingFormRequest.model_validate(_form(dob)).to_engine_payload()

    expected = _age_years(dob) + LOAN_TENOR_YEARS
    assert engine["age_at_last_emi_salaried"] == expected
    assert engine["age_at_last_emi_self_employed"] == expected


def test_an_explicit_age_at_last_emi_still_wins() -> None:
    """Integrators posting the value directly are not overridden by the derivation."""
    dob = f"{date.today().year - 40:04d}-01-01"
    engine = OnboardingFormRequest.model_validate(
        _form(dob, bureauAgeAtLastEMI=58)
    ).to_engine_payload()

    assert engine["age_at_last_emi_salaried"] == 58


def test_derived_age_drives_the_bank_age_ceiling(client: TestClient) -> None:
    """A 58-year-old lands at 65 with the 7-year tenor, past BOI's 60 limit."""
    dob = f"{date.today().year - 58:04d}-01-01"
    response = client.post("/api/v1/onboarding/evaluate/form", json=_form(dob), headers=TENANT)

    assert response.status_code == 200
    body = response.json()
    assert body["overall_eligible"] is False
    assert "DEM-102" in {r["rule_id"] for r in body["rejection_reasons"]}


# --------------------------------------------------------------------------- #
# Income proof (add-on.md §3.2b)
# --------------------------------------------------------------------------- #

def test_itr_proof_requires_both_years() -> None:
    payload = _form("1990-01-01")
    payload["occupation"] = {
        "profileType": "Salaried", "tenureBand": "2y+", "grossSalary": 50000.0,
        "salaryMode": "Salary payment mode- Bank Credit", "form16Status": "ITR",
    }
    with pytest.raises(ValueError, match="currentYearItr and previousYearItr are required"):
        OnboardingFormRequest.model_validate(payload)


def test_itr_proof_skips_the_form16_history_rule(client: TestClient) -> None:
    """An ITR proves income without a Form-16 history, so EMP-SAL-206 does not apply."""
    payload = _form("1990-01-01")
    payload["occupation"] = {
        "profileType": "Salaried", "tenureBand": "2y+", "grossSalary": 50000.0,
        "salaryMode": "Salary payment mode- Bank Credit", "form16Status": "ITR",
        "currentYearItr": 600000.0, "previousYearItr": 550000.0,
    }
    response = client.post("/api/v1/onboarding/evaluate/form", json=payload, headers=TENANT)

    assert response.status_code == 200
    report = response.json()["evaluation_report"]["BOI"]
    evaluated = {r["rule_id"] for r in report["passed_rules"] + report["failed_rules"]}
    assert "EMP-SAL-206" not in evaluated


def test_form16_proof_still_scores_the_history_rule(client: TestClient) -> None:
    payload = _form("1990-01-01")
    payload["occupation"]["form16Years"] = 1
    response = client.post("/api/v1/onboarding/evaluate/form", json=payload, headers=TENANT)

    assert response.status_code == 200
    assert "EMP-SAL-206" in {r["rule_id"] for r in response.json()["rejection_reasons"]}


def test_aadhaar_from_ocr_is_accepted_and_never_persisted_raw() -> None:
    payload = _form("1990-01-01")
    payload["address"]["aadhaarNumber"] = "1234-5678-9012"
    engine = OnboardingFormRequest.model_validate(payload).to_engine_payload()

    assert engine["aadhaar_number"] == "1234-5678-9012"

    from app.core.logging import redact_pii

    assert "9012" in str(redact_pii(dict(engine)))
    assert "1234-5678-9012" not in str(redact_pii(dict(engine)))


# --------------------------------------------------------------------------- #
# Simulated-extraction fallback when openbharatocr is absent
# --------------------------------------------------------------------------- #

def test_missing_ocr_package_does_not_block_the_upload(client: TestClient, monkeypatch) -> None:
    """The reported defect: a missing package 400'd the whole submission."""
    _no_engines(monkeypatch)

    response = client.post(
        "/api/v1/onboarding/documents/pan/extract",
        files={"file": ("test-pan.jpeg", b"\xff\xd8\xff-not-a-real-jpeg", "image/jpeg")},
        headers=TENANT,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["simulated"] is True
    assert body["populated"] is False


def test_fallback_reads_an_identity_number_out_of_the_filename(client: TestClient, monkeypatch) -> None:
    _no_engines(monkeypatch)

    response = client.post(
        "/api/v1/onboarding/documents/pan/extract",
        files={"file": ("pan-ABCDE1234F.jpeg", b"data", "image/jpeg")},
        headers=TENANT,
    )

    body = response.json()
    assert body["extracted"]["pan"] == "ABCDE1234F"
    assert body["simulated"] is True


def test_fallback_invents_nothing(monkeypatch) -> None:
    """A filename with no identity number yields empty fields, not a made-up PAN."""
    fields = ocr_service._simulated_extract("pan", "scan_0001.jpeg")
    assert fields == {"pan": None, "full_name": None, "dob": None}


def test_fallback_normalises_a_formatted_aadhaar() -> None:
    fields = ocr_service._simulated_extract("aadhaar", "aadhaar-1234 5678 9012.png")
    assert fields["aadhaar_number"] == "123456789012"


def test_a_broken_ocr_stack_degrades_instead_of_failing(client: TestClient, monkeypatch) -> None:
    """Package present, Tesseract binary missing — same graceful path."""
    class Exploding:
        def pan(self, path):
            raise RuntimeError("tesseract is not installed or it's not in your PATH")

    _no_engines(monkeypatch)
    monkeypatch.setattr(ocr_service, "_load_openbharatocr", lambda: Exploding())

    response = client.post(
        "/api/v1/onboarding/documents/pan/extract",
        files={"file": ("pan-ABCDE1234F.jpeg", b"data", "image/jpeg")},
        headers=TENANT,
    )

    assert response.status_code == 200
    assert response.json()["simulated"] is True
    assert response.json()["extracted"]["pan"] == "ABCDE1234F"


def test_upload_guards_still_reject_under_the_fallback(client: TestClient, monkeypatch) -> None:
    _no_engines(monkeypatch)

    response = client.post(
        "/api/v1/onboarding/documents/pan/extract",
        files={"file": ("notes.txt", b"hello", "text/plain")},
        headers=TENANT,
    )
    assert response.status_code == 422


def test_fallback_is_far_inside_the_latency_budget() -> None:
    import time

    start = time.perf_counter()
    for _ in range(200):
        ocr_service._simulated_extract("pan", "pan-ABCDE1234F.jpeg")
    per_call_ms = (time.perf_counter() - start) * 1000 / 200

    assert per_call_ms < 10.0, f"{per_call_ms:.3f} ms per call breaches the 10 ms budget"


def test_fallback_logs_the_tracked_warning(client: TestClient, monkeypatch, caplog) -> None:
    _no_engines(monkeypatch)

    with caplog.at_level("WARNING", logger="flowbre"):
        client.post(
            "/api/v1/onboarding/documents/pan/extract",
            files={"file": ("pan-ABCDE1234F.jpeg", b"data", "image/jpeg")},
            headers=TENANT,
        )

    assert any(ocr_service.FALLBACK_LOG_MESSAGE in r.message for r in caplog.records)
    # The PAN travelled in the filename; it must not reach the log unmasked.
    assert not any("ABCDE1234F" in r.message for r in caplog.records)


# --------------------------------------------------------------------------- #
# OCR_REQUIRE_REAL: refuse to simulate rather than simulate silently
# --------------------------------------------------------------------------- #

def test_strict_mode_errors_instead_of_simulating(client: TestClient, monkeypatch) -> None:
    _no_engines(monkeypatch)
    monkeypatch.setattr(ocr_service.settings, "OCR_REQUIRE_REAL", True)

    response = client.post(
        "/api/v1/onboarding/documents/pan/extract",
        files={"file": ("pan-ABCDE1234F.jpeg", b"data", "image/jpeg")},
        headers=TENANT,
    )

    assert response.status_code == 422
    detail = str(response.json())
    assert "Real document extraction was required" in detail
    # Whichever component is at fault, the error must name a next step rather
    # than just reporting the failure.
    assert any(hint in detail.lower()
               for hint in ("requirements.txt", "tesseract", "check_ocr_stack.py"))


def test_strict_mode_names_the_missing_python_stack(monkeypatch) -> None:
    monkeypatch.setattr(ocr_service, "_obocr_error", "ModuleNotFoundError: No module named 'cv2'")
    reason = ocr_service._unavailable_reason()

    assert "cv2" in reason
    assert "interpreter" in reason


def test_strict_mode_names_a_missing_tesseract_binary(monkeypatch) -> None:
    monkeypatch.setattr(ocr_service, "_obocr_error", None)
    monkeypatch.setattr(ocr_service.shutil, "which", lambda _: None)
    reason = ocr_service._unavailable_reason()

    assert "Tesseract" in reason
    assert "not a pip package" in reason


def test_default_stays_permissive(client: TestClient, monkeypatch) -> None:
    """OCR_REQUIRE_REAL is off by default, so a dev host still serves uploads."""
    _no_engines(monkeypatch)

    response = client.post(
        "/api/v1/onboarding/documents/pan/extract",
        files={"file": ("pan-ABCDE1234F.jpeg", b"data", "image/jpeg")},
        headers=TENANT,
    )
    assert response.status_code == 200
    assert response.json()["simulated"] is True


def test_printed_dob_is_normalised_to_iso() -> None:
    """Cards print DD/MM/YYYY; <input type="date"> silently rejects anything else."""
    assert ocr_service._iso_dob("25/08/2002") == "2002-08-25"
    assert ocr_service._iso_dob("25-08-2002") == "2002-08-25"
    assert ocr_service._iso_dob("2002-08-25") == "2002-08-25"
    assert ocr_service._iso_dob(None) is None
    assert ocr_service._iso_dob("") is None
