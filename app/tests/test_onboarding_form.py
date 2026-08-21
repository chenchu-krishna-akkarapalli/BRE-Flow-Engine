"""Validation, translation and audit-trail coverage for the 5-step onboarding
wizard contract (onboading-form.json)."""

import asyncio
import time
from typing import Any, Dict, List
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

import app.core.redis as redis_module
from app.api.deps import get_db, get_redis
from app.api.schemas.onboarding import OnboardingEvaluationRequest, OnboardingFormRequest
from app.constants import BankCode, EntityType, PropertyStatus
from app.db.models.application import ApplicationModel
from app.db.models.audit_log import AuditLogModel
from app.db.models.rule_execution import RuleExecutionModel
from app.main import app

# Records everything the route stages into the session, so the persisted audit
# trail can be asserted without a live database.
captured_records: List[Any] = []


async def mock_get_db():
    session = MagicMock()
    session.add = captured_records.append
    future = asyncio.Future()
    future.set_result(MagicMock())
    session.execute.return_value = future
    session.flush.return_value = future
    session.commit.return_value = future
    session.rollback.return_value = future
    yield session


mock_redis = AsyncMock()
mock_redis.incr.return_value = 1
mock_redis.expire.return_value = True
mock_redis.get.return_value = None
mock_redis.setex.return_value = True
redis_module.redis_client = mock_redis


async def mock_get_redis():
    return mock_redis


app.dependency_overrides[get_db] = mock_get_db
app.dependency_overrides[get_redis] = mock_get_redis
client = TestClient(app)


INDIVIDUAL_SALARIED: Dict[str, Any] = {
    "identity": {
        "entityType": "Individual",
        "applicantName": "Rohan Sharma",
        "dob": "1992-05-15",
        "gender": "Male",
        "pan": "ABCDE1234F",
        "maritalStatus": "Married",
        "citizenshipStatus": "Resident Indian",
        "phone": "9876543210",
        "email": "rohan.sharma@example.com",
    },
    "address": {
        "pincode": "560001",
        "cityName": "Bengaluru",
        "stateName": "Karnataka",
        "residentDetails": "Owned House",
    },
    "occupation": {
        "profileType": "Salaried",
        "employerType": "Private Sector",
        "tenureBand": "2y+",
        "grossSalary": 50000.0,
        "salaryMode": "Salary payment mode- Bank Credit",
        "form16Status": "Form 16",
        "form16Years": 2,
    },
    "banking": {
        "existingAccountBank": "BOI",
        "existingCarLoanBank": "None",
        "loanType": "Auto Loan",
        "bureauCibilScore": 780,
        "bureauDpd": 0,
        "bureauAgeAtLastEMI": 55,
    },
    "coApplicant": {"coAppAgeRelation": "None", "coAppIncomeRelation": "None"},
}

COMPANY_SUBMISSION: Dict[str, Any] = {
    "identity": {
        "entityType": "Company",
        "applicantName": "Acme Traders Pvt Ltd",
        "companyName": "Acme Traders Pvt Ltd",
        "companyType": "private_limited",
        "companyPan": "AABCT1234C",
        "companyLocation": "MG Road, Bengaluru",
        "contactPersonName": "Priya Nair",
        "companyMobile": "9876543211",
        "companyEmail": "accounts@company.example.com",
    },
    "occupation": {
        "profileType": "Company",
        "companyEstablishmentDate": "2016-04-01",
        "companyGstin": "29AAAAA0000A1Z5",
        "companyCurrentITRAmount": 1200000,
        "companyPrevITRAmount": 950000,
        "businessItrAmountCompany": 5,
    },
    "banking": {
        "existingAccountBank": "BOB",
        "existingCarLoanBank": "None",
        "loanType": "Auto Loan",
        "bureauCibilScore": 780,
        "bureauDpd": 0,
        "bureauAgeAtLastEMI": 45,
    },
}

HUF_SUBMISSION: Dict[str, Any] = {
    "identity": {
        "entityType": "HUF",
        "applicantName": "Sharma HUF",
        "hufName": "Sharma HUF",
        "hufPan": "AAAHS1234F",
        "kartaName": "Rakesh Sharma",
        "kartaPan": "ABCDE1234F",
        "kartaMobile": "9876543212",
    },
    "address": {"pincode": "560001", "residentDetails": "Owned House"},
    "occupation": {
        "profileType": "HUF",
        "officeAddressType": "Same",
        "businessEstablishmentDate": "2019-01-10",
        "itrFilingStatus": "Self employed ITR Filled",
        "currentITRAmount": 450000,
        "prevITRAmount": 380000,
        "businessProof": "GSTIN: 29AAAAA0000A1Z5",
    },
    "banking": {
        "existingAccountBank": "BOM",
        "existingCarLoanBank": "None",
        "loanType": "Auto Loan",
        "bureauCibilScore": 760,
        "bureauDpd": 0,
        "bureauAgeAtLastEMI": 50,
    },
}


def _deep_merge(base: Dict[str, Any], overrides: Dict[str, Any]) -> Dict[str, Any]:
    merged = {k: (dict(v) if isinstance(v, dict) else v) for k, v in base.items()}
    for key, value in overrides.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key].update(value)
        else:
            merged[key] = value
    return merged


# --- Polymorphic validation ------------------------------------------------ #


def test_individual_branch_validates_and_translates():
    form = OnboardingFormRequest.model_validate(INDIVIDUAL_SALARIED)
    payload = form.to_engine_payload()

    assert payload["entity_type"] == EntityType.INDIVIDUAL.value
    assert payload["occupation"] == "Salaried"
    assert payload["net_monthly_salary"] == 50000.0
    assert payload["current_company_tenure_months"] == 24
    assert payload["salary_payment_mode"] == "BANK_TRANSFER"
    assert payload["selected_bank"] == BankCode.BOI.value
    assert payload["property_status"] == PropertyStatus.OWNED.value
    assert payload["credit_bureau"]["cibil_score"] == 780


def test_company_branch_skips_address_and_co_applicant():
    form = OnboardingFormRequest.model_validate(COMPANY_SUBMISSION)
    payload = form.to_engine_payload()

    assert form.address is None and form.co_applicant is None
    assert payload["entity_type"] == EntityType.COMPANY.value
    # Companies are scored on the self-employed income rules.
    assert payload["occupation"] == "Self-Employed"
    assert payload["current_itr"] == 1200000
    assert payload["is_nri"] is False


def test_huf_branch_translates_itr_and_business_proof():
    form = OnboardingFormRequest.model_validate(HUF_SUBMISSION)
    payload = form.to_engine_payload()

    assert payload["entity_type"] == EntityType.HUF.value
    assert payload["itr_filed"] is True
    assert payload["business_proof"] is True
    assert payload["property_status"] == PropertyStatus.RESI_CUM_OFFICE_OWNED.value


def test_company_payload_rejects_address_step():
    with pytest.raises(ValidationError, match="not collected for Company"):
        OnboardingFormRequest.model_validate(
            _deep_merge(COMPANY_SUBMISSION, {"address": INDIVIDUAL_SALARIED["address"]})
        )


def test_individual_payload_requires_address_step():
    payload = {k: v for k, v in INDIVIDUAL_SALARIED.items() if k != "address"}
    with pytest.raises(ValidationError, match="address step is required"):
        OnboardingFormRequest.model_validate(payload)


def test_profile_type_must_match_entity_type():
    mismatched = dict(INDIVIDUAL_SALARIED)
    mismatched["occupation"] = COMPANY_SUBMISSION["occupation"]
    with pytest.raises(ValidationError, match="is not valid for entityType"):
        OnboardingFormRequest.model_validate(mismatched)


def test_nri_requires_stay_period():
    with pytest.raises(ValidationError, match="nriStayPeriod is required"):
        OnboardingFormRequest.model_validate(
            _deep_merge(INDIVIDUAL_SALARIED, {"identity": {"citizenshipStatus": "NRI/PIO"}})
        )


def test_short_tenure_requires_previous_employer():
    with pytest.raises(ValidationError, match="prevCompanyName"):
        OnboardingFormRequest.model_validate(
            _deep_merge(INDIVIDUAL_SALARIED, {"occupation": {"tenureBand": "6m-1y"}})
        )


def test_write_off_precedence_reports_least_permissive_class():
    form = OnboardingFormRequest.model_validate(
        _deep_merge(
            INDIVIDUAL_SALARIED,
            {"banking": {"bureauFlagCC": True, "bureauFlagPL": True, "bureauWriteOffAmount": 4000}},
        )
    )
    # CC is the only class any bank tolerates; PL must win so the applicant is
    # not approved on the strength of the permitted class alone.
    assert form.banking.write_off_type == "PL"


def test_resi_cum_office_rented_requires_guarantor_decision():
    self_employed = _deep_merge(
        INDIVIDUAL_SALARIED,
        {
            "address": {"residentDetails": "Rented House"},
            "occupation": {
                "profileType": "Self-Employed",
                "officeAddressType": "Same",
                "businessEstablishmentDate": "2019-01-10",
                "currentITRAmount": 450000,
                "prevITRAmount": 380000,
                "businessItrAmount": 5,
                "businessProof": "GSTIN: 29AAAAA0000A1Z5",
            },
        },
    )
    self_employed["occupation"] = {
        k: v for k, v in self_employed["occupation"].items()
        if k not in ("employerType", "tenureBand", "grossSalary", "salaryMode",
                     "form16Status", "form16Years")
    }

    with pytest.raises(ValidationError, match="guarantorStatus is required"):
        OnboardingFormRequest.model_validate(self_employed)

    with_guarantor = _deep_merge(
        self_employed, {"occupation": {"guarantorStatus": "With a Gaurantor"}}
    )
    form = OnboardingFormRequest.model_validate(with_guarantor)
    assert form.to_engine_payload()["property_status"] == PropertyStatus.RESI_CUM_OFFICE_RENTED.value
    assert form.to_engine_payload()["guarantor_provided"] is True


# --- Endpoint, audit trail & SLA ------------------------------------------- #


def test_form_endpoint_records_audit_trail_within_sla():
    captured_records.clear()
    client.get("/api/v1/health")  # warm up

    start = time.perf_counter()
    response = client.post(
        "/api/v1/onboarding/evaluate/form",
        json=INDIVIDUAL_SALARIED,
        headers={"X-Tenant-ID": "tenant_beta"},
    )
    elapsed_ms = (time.perf_counter() - start) * 1000

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["entity_type"] == "Individual"
    assert body["selected_bank"] == "BOI"
    assert body["persisted"] is True
    assert elapsed_ms < 80.0, f"Form evaluation exceeded 80 ms budget: {elapsed_ms:.2f} ms"

    applications = [r for r in captured_records if isinstance(r, ApplicationModel)]
    executions = [r for r in captured_records if isinstance(r, RuleExecutionModel)]
    audit_logs = [r for r in captured_records if isinstance(r, AuditLogModel)]
    assert len(applications) == 1 and len(executions) == 1 and len(audit_logs) == 1

    application = applications[0]
    assert application.entity_type == "Individual"
    assert application.profile_type == "Salaried"
    assert application.selected_bank == "BOI"
    assert application.status == body["status"]
    assert application.entity_detail_json["identity"]["applicantName"] == "Rohan Sharma"

    audit = audit_logs[0]
    assert audit.action == "ONBOARDING_FORM_EVALUATION"
    assert audit.resource_id == application.id
    assert audit.details_document["bank_eligibility"] == body["bank_eligibility"]

    execution = executions[0]
    assert execution.application_id == application.id
    assert execution.eligible == body["overall_eligible"]


def test_persisted_audit_trail_masks_pii():
    captured_records.clear()
    client.post(
        "/api/v1/onboarding/evaluate/form",
        json=INDIVIDUAL_SALARIED,
        headers={"X-Tenant-ID": "tenant_beta"},
    )
    application = next(r for r in captured_records if isinstance(r, ApplicationModel))

    assert application.pan_masked == "AB******4F"
    identity = application.entity_detail_json["identity"]
    assert identity["pan"] == "AB******4F"
    assert identity["dob"] == "****-**-15"


def test_company_form_endpoint_evaluates():
    captured_records.clear()
    response = client.post(
        "/api/v1/onboarding/evaluate/form",
        json=COMPANY_SUBMISSION,
        headers={"X-Tenant-ID": "tenant_beta"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["entity_type"] == "Company"
    assert body["selected_bank"] == "BOB"

    application = next(r for r in captured_records if isinstance(r, ApplicationModel))
    assert application.pincode is None and application.resident_details is None
    assert application.co_applicant_income_relation is None


def test_form_endpoint_rejects_mismatched_branch():
    response = client.post(
        "/api/v1/onboarding/evaluate/form",
        json=_deep_merge(INDIVIDUAL_SALARIED, {"identity": {"pan": "INVALID123"}}),
        headers={"X-Tenant-ID": "tenant_beta"},
    )
    assert response.status_code == 422


@pytest.mark.parametrize("model", [OnboardingFormRequest, OnboardingEvaluationRequest])
def test_documented_swagger_example_validates(model) -> None:
    """The example is what "Try it out" posts, so a stale one is a 422 demo.

    It drifts silently: renaming a field updates the model and leaves the
    example behind, and nothing else in the suite ever submits it.
    """
    model.model_validate(model.model_config["json_schema_extra"]["example"])
