"""Behaviour required by addon/onboarding-form-add-on.md.

One module per change-log document so a reviewer can read the spec and the
tests side by side; the rule mechanics themselves stay tested where they live.
"""

import asyncio
from datetime import date
from typing import Any, Dict, Optional

import pytest
from pydantic import ValidationError

from app.api.schemas.onboarding import OnboardingFormRequest
from app.constants.enums import EmployerType, FormBusinessEntityType, RentalIncomeType
from app.constants.limits import (
    MIN_CO_APPLICANT_ITR_TRIGGER,
    MIN_SALARIED_MONTHLY_SALARY,
)
from app.services.bre_engine import BANK_MATRIX_RULES, _evaluate_bank, bre_engine_service

TODAY = date.today()
_EST = TODAY.replace(year=TODAY.year - 10).isoformat()


def _salaried(**over: Any) -> Dict[str, Any]:
    return {
        "profileType": "Salaried", "employerType": "Private Sector", "tenureBand": "2y+",
        "grossSalary": 60000.0, "salaryMode": "Salary payment mode- Bank Credit",
        "form16Status": "Form 16", "form16Years": 2, **over,
    }


def _self_employed(**over: Any) -> Dict[str, Any]:
    return {
        "profileType": "Self-Employed", "businessEntityType": "Propreitorship",
        "businessEstablishmentDate": _EST, "currentITRAmount": 500000.0,
        "prevITRAmount": 400000.0, "businessItrAmount": 5,
        "businessProof": "GSTIN: 29AAAAA0000A1Z5", **over,
    }


def _agriculture(**over: Any) -> Dict[str, Any]:
    return {
        "profileType": "Self-Employed", "businessEntityType": "Agriculture",
        "ownsAgriculturalLand": True,
        "agriculturalLandLocation": "Survey 42, Mandya, Karnataka",
        "annualAgriculturalIncome": 500000.0, "agricultureItrFiled": True,
        "currentITRAmount": 500000.0, "prevITRAmount": 400000.0, "businessItrAmount": 5,
        **over,
    }


def _rental(**over: Any) -> Dict[str, Any]:
    return {
        "profileType": "Rental Income",
        "rentalPropertyAddress": "12 MG Road, Bengaluru",
        "rentalIncomeDocumentation": RentalIncomeType.AGREEMENT_NO_ITR_NOT_IN_BANK.value,
        **over,
    }


def _form(
    occupation: Optional[Dict[str, Any]] = None,
    citizenship: str = "Resident Indian",
    nri_months: Optional[int] = None,
    co_applicant: Optional[Dict[str, Any]] = None,
    cibil: int = 800,
    cibil_pl: Optional[int] = None,
    bank: str = "BOI",
) -> OnboardingFormRequest:
    identity: Dict[str, Any] = {
        "entityType": "Individual", "applicantName": "Rohan Sharma",
        "dob": TODAY.replace(year=TODAY.year - 34).isoformat(), "pan": "ABCDE1234F",
        "phone": "9876543210", "email": "rohan.sharma@example.com",
        "citizenshipStatus": citizenship,
    }
    if nri_months is not None:
        identity["nriStayPeriod"] = nri_months

    banking: Dict[str, Any] = {
        "existingAccountBank": {"BOI": "BOI", "BOB": "BOB", "IOB": "IOB",
                                "INDIAN_BANK": "Indian Bank"}[bank],
        "existingCarLoanBank": "None", "loanType": "Auto Loan",
        "bureauCibilScore": cibil, "bureauDpd": 0,
    }
    if cibil_pl is not None:
        banking["cibilPlScoreToggle"] = True
        banking["bureauCibilPlScore"] = cibil_pl

    return OnboardingFormRequest.model_validate({
        "identity": identity,
        "address": {"pincode": "560001", "residentDetails": "Owned House"},
        "occupation": occupation or _salaried(),
        "banking": banking,
        "coApplicant": co_applicant or {},
    })


def _occupation(payload: Dict[str, Any]):
    """Validate one step-3 branch through the full request, as the API does."""
    return _form(occupation=payload).occupation


def _evaluate(form: OnboardingFormRequest) -> Dict[str, Any]:
    return asyncio.run(
        bre_engine_service.evaluate_application(form.to_engine_payload(), tenant_id="default")
    )


def _inputs(**overrides):
    """Engine inputs that pass every rule, so a test asserts only its own change."""
    base = {
        "age": 34, "occupation": "Salaried", "cibil": 800, "cibil_pl": None,
        "max_dpd": 0, "is_nri": False, "nri_stay_years": 0.0,
        "currently_overdue": False, "write_off_amount": 0.0,
        "write_off_type_raw": "", "write_off_flag_key": None,
        "salary": 60000.0, "salary_mode": "BANK_TRANSFER",
        "work_exp_years": 10.0, "current_company_years": 10.0,
        "no_income_proof": False, "form_16_years": 5, "income_proof": "Form 16",
        "car_loan_bank": None, "age_emi_sal": 41, "age_emi_se": 41,
        "se_current_itr": 1_000_000.0, "se_prev_itr": 1_000_000.0,
        "itr_filed": True, "business_proof": True, "business_itr_years": 10,
        "property_status": "OWNED", "guarantor_provided": True,
        "has_loan_enquiry": False, "existing_account_bank": "BOI",
        "is_huf": False, "is_agriculture": False, "rental_income_class": "NONE",
        "sibling_co_applicant": False, "government_employee": False,
    }
    return {**base, **overrides}


def _outcome(outcomes, rule_id):
    return next((o for o in outcomes if o["rule_id"] == rule_id), None)


# --------------------------------------------------------------------------- #
# Bug 1 — CIBIL score OR CIBIL PL score
# --------------------------------------------------------------------------- #

# A bank that publishes both floors. Synthetic on purpose: no bank in the
# shipped sheet defines a PL floor yet, and the rule must not depend on one.
_PL_BANK = {**BANK_MATRIX_RULES["BOI"], "min_cibil": 720, "min_cibil_pl": 701}


def test_pl_score_rescues_an_applicant_who_misses_the_headline_floor():
    # The spec's own worked example: 710 fails the CIBIL floor, 702 clears the
    # PL floor, and the applicant must not be rejected for the score they missed.
    outcomes = _evaluate_bank(_inputs(cibil=710, cibil_pl=702), "TESTBANK", _PL_BANK)
    assert _outcome(outcomes, "BUR-405")["passed"] is True


def test_headline_score_alone_still_clears_a_bank_with_a_pl_floor():
    outcomes = _evaluate_bank(_inputs(cibil=725, cibil_pl=400), "TESTBANK", _PL_BANK)
    assert _outcome(outcomes, "BUR-405")["passed"] is True


def test_both_scores_below_their_floors_rejects():
    outcomes = _evaluate_bank(_inputs(cibil=710, cibil_pl=700), "TESTBANK", _PL_BANK)
    result = _outcome(outcomes, "BUR-405")
    assert result["passed"] is False
    assert "701" in result["message"] and "720" in result["message"]


def test_a_missing_pl_score_falls_back_to_the_headline_floor():
    # Absent is not "passes": a bank with a PL floor still scores the applicant
    # on the one score they did supply.
    outcomes = _evaluate_bank(_inputs(cibil=710, cibil_pl=None), "TESTBANK", _PL_BANK)
    assert _outcome(outcomes, "BUR-405")["passed"] is False


@pytest.mark.parametrize(
    "bank", sorted(b for b, p in BANK_MATRIX_RULES.items() if "min_cibil_pl" not in p)
)
def test_banks_without_a_pl_floor_are_unchanged(bank):
    # The OR must be inert for every bank that does not publish a PL floor,
    # even when the applicant supplies a PL score that would have cleared one.
    policy = BANK_MATRIX_RULES[bank]
    below = policy["min_cibil"] - 1
    outcomes = _evaluate_bank(_inputs(cibil=below, cibil_pl=900), bank, policy)
    assert _outcome(outcomes, "BUR-405")["passed"] is False


def test_boi_is_the_bank_that_publishes_a_pl_floor():
    # Guards the sheet-to-code transcription in the one place it currently
    # matters; the conformance suite proves the two agree cell for cell.
    with_pl = {b: p["min_cibil_pl"] for b, p in BANK_MATRIX_RULES.items() if "min_cibil_pl" in p}
    assert with_pl == {"BOI": 701}
    assert BANK_MATRIX_RULES["BOI"]["min_cibil"] == 701


def test_boi_accepts_an_applicant_who_clears_only_the_pl_floor():
    # BOI's two floors are both 701, so the OR bites exactly where the headline
    # score falls short and the personal-loan score does not.
    verdict = _evaluate(_form(cibil=690, cibil_pl=701, bank="BOI"))
    assert verdict["bank_eligibility"]["BOI"] is True
    # ...and a bank with no PL floor is unmoved by the same PL score.
    assert verdict["bank_eligibility"]["IOB"] is False


def test_boi_rejects_when_neither_score_clears_its_own_floor():
    verdict = _evaluate(_form(cibil=690, cibil_pl=700, bank="BOI"))
    assert verdict["bank_eligibility"]["BOI"] is False
    failed = {r["rule_id"] for r in verdict["evaluation_report"]["BOI"]["failed_rules"]}
    assert "BUR-405" in failed


def test_boi_still_accepts_the_headline_score_alone():
    verdict = _evaluate(_form(cibil=701, bank="BOI"))
    assert verdict["bank_eligibility"]["BOI"] is True


# --------------------------------------------------------------------------- #
# Bug 2 — NRI questions belong to step 3, and only to salaried applicants
# --------------------------------------------------------------------------- #


def test_residency_stays_available_to_integrators_posting_it_directly():
    """The restriction is a wizard one, and deliberately not enforced here.

    The wizard asks about residency only in step 3 and only of salaried
    applicants, so its payloads carry NRI status only for them. The API keeps
    honouring an explicitly declared status, because an integrator posting its
    own data model has no such wizard — refusing it would silently score a real
    NRI as resident, which is the more dangerous failure.
    """
    form = _form(occupation=_self_employed(), citizenship="NRI/PIO", nri_months=1)
    assert form.to_engine_payload()["is_nri"] is True


# --------------------------------------------------------------------------- #
# Bug 3 — Agriculture / Farming has its own field set
# --------------------------------------------------------------------------- #


def test_farming_rejects_the_trade_only_fields():
    for field, value in (
        ("businessProof", "29AAAAA0000A1Z5"),
        ("officeAddress", "Shop 4, Market Road"),
        ("guarantorStatus", "With a Gaurantor"),
    ):
        with pytest.raises(ValidationError, match="not collected for Agriculture"):
            _occupation(_agriculture(**{field: value}))


def test_a_trade_rejects_the_farming_only_fields():
    with pytest.raises(ValidationError, match="only collected for Agriculture"):
        _occupation({**_self_employed(), "ownsAgriculturalLand": True})


def test_a_farmer_without_a_return_must_supply_an_income_proof():
    with pytest.raises(ValidationError, match="agriculturalIncomeProof is required"):
        _occupation(_agriculture(agricultureItrFiled=False))

    ok = _occupation(_agriculture(agricultureItrFiled=False,
                                  agriculturalIncomeProof="Village revenue record"))
    assert ok.engine_inputs()["itr_filed"] is False


def test_farming_satisfies_business_proof_without_a_registration_number():
    # BUS-302 is mandatory at every bank, and the farming branch is forbidden to
    # ask for a GST number — the land plus its evidence is what satisfies it.
    inputs = _occupation(_agriculture()).engine_inputs()
    assert inputs["business_proof"] is True
    assert inputs["business_entity_type"] == FormBusinessEntityType.AGRICULTURE.value


def test_farming_without_land_or_evidence_fails_business_proof():
    inputs = _occupation(
        _agriculture(ownsAgriculturalLand=False)
    ).engine_inputs()
    assert inputs["business_proof"] is False


# --------------------------------------------------------------------------- #
# Bug 4 — two organisation types; government service skips the tenure floors
# --------------------------------------------------------------------------- #


def test_organisation_type_offers_exactly_two_sectors():
    assert {e.value for e in EmployerType} == {"Private Sector", "Government Sector"}


def test_government_service_is_not_asked_for_a_previous_employer():
    with pytest.raises(ValidationError, match="not collected for Government Sector"):
        _occupation(_salaried(employerType="Government Sector", tenureBand="6m-1y",
                              prevCompanyName="Prior Ltd", prevCompanyJoining="2020-01-01"))

    # ...and the short tenure alone is accepted, where private sector is not.
    assert _occupation(
        _salaried(employerType="Government Sector", tenureBand="6m-1y")
    ).engine_inputs()["government_employee"] is True


def test_government_service_clears_both_experience_floors():
    policy = BANK_MATRIX_RULES["BOI"]
    short = _inputs(work_exp_years=0.5, current_company_years=0.5)

    private = _evaluate_bank(short, "BOI", policy)
    assert _outcome(private, "EMP-SAL-204")["passed"] is False
    assert _outcome(private, "EMP-SAL-205")["passed"] is False

    government = _evaluate_bank({**short, "government_employee": True}, "BOI", policy)
    # Not applicable rather than passed: the bank verified nothing here.
    assert _outcome(government, "EMP-SAL-204") is None
    assert _outcome(government, "EMP-SAL-205") is None
    # Every other salaried rule still binds.
    assert _outcome(government, "EMP-SAL-202") is not None


# --------------------------------------------------------------------------- #
# Bugs 5 & 6 — terminating conditions
# --------------------------------------------------------------------------- #


def test_salary_below_the_floor_terminates_at_every_bank():
    below = _inputs(salary=MIN_SALARIED_MONTHLY_SALARY - 1)
    verdict = _evaluate(_form(occupation=_salaried(grossSalary=below["salary"])))

    assert verdict["overall_eligible"] is False
    assert all(eligible is False for eligible in verdict["bank_eligibility"].values())
    for report in verdict["evaluation_report"].values():
        assert any(r["rule_id"] == "TERM-901" for r in report["failed_rules"])


def test_salary_at_the_floor_does_not_terminate():
    verdict = _evaluate(_form(occupation=_salaried(grossSalary=MIN_SALARIED_MONTHLY_SALARY)))
    for report in verdict["evaluation_report"].values():
        assert not any(r["rule_id"] == "TERM-901" for r in report["failed_rules"])


def test_missing_business_proof_terminates_a_self_employed_application():
    verdict = _evaluate(_form(occupation=_self_employed(businessProof=None)))

    assert all(eligible is False for eligible in verdict["bank_eligibility"].values())
    for report in verdict["evaluation_report"].values():
        assert any(r["rule_id"] == "TERM-902" for r in report["failed_rules"])


def test_farming_is_not_terminated_for_lacking_a_registration_number():
    # The farming branch is forbidden to ask for one, so it cannot be stopped
    # for not having supplied it.
    verdict = _evaluate(_form(occupation=_agriculture()))
    for report in verdict["evaluation_report"].values():
        assert not any(r["rule_id"] == "TERM-902" for r in report["failed_rules"])


# --------------------------------------------------------------------------- #
# Bug 7 — Rental Income as a top-level occupation
# --------------------------------------------------------------------------- #


def test_the_rental_rider_questions_are_gone():
    for profile, alias in (
        (_salaried(), "rentalIncomeTypeSalaried"),
        (_self_employed(), "rentalIncomeTypeSelfEmployed"),
    ):
        with pytest.raises(ValidationError):
            _occupation({**profile, alias: "None"})


def test_a_rentier_is_scored_on_neither_employment_nor_business_rules():
    verdict = _evaluate(_form(occupation=_rental()))
    rules = {
        r["rule_id"]
        for report in verdict["evaluation_report"].values()
        for r in report["passed_rules"] + report["failed_rules"]
    }
    assert not any(r.startswith("EMP-") for r in rules), rules
    assert "BUS-302" not in rules
    # The rental configuration is what actually scores this applicant.
    assert "INC-601" in rules


def test_each_rental_documentation_option_demands_its_own_evidence():
    with pytest.raises(ValidationError, match="currentYearItr and previousYearItr are required"):
        _occupation(_rental(rentalIncomeDocumentation=RentalIncomeType.AGREEMENT_ITR_NOT_IN_BANK.value))

    with pytest.raises(ValidationError, match="rentalBankStatementProvided and rentalIncomeAmount"):
        _occupation(_rental(rentalIncomeDocumentation=RentalIncomeType.AGREEMENT_NO_ITR_IN_BANK.value))

    # ...and neither option accepts the other's evidence.
    with pytest.raises(ValidationError, match="only collected for the paid-into-bank"):
        _occupation(_rental(rentalIncomeAmount=40000.0, rentalBankStatementProvided=True))


def test_rental_income_cannot_claim_no_rental_configuration():
    with pytest.raises(ValidationError, match="must name a documentation option"):
        _occupation(_rental(rentalIncomeDocumentation="None"))


# --------------------------------------------------------------------------- #
# Bug 8 — split co-applicant conditions and income clubbing
# --------------------------------------------------------------------------- #


def test_pooling_income_requires_the_co_applicants_own_returns():
    with pytest.raises(ValidationError, match="coApplicantCurrentItr"):
        _form(co_applicant={
            "coAppIncomeRelation": "Father",
            "coApplicantName": "Anil Sharma",
            "coApplicantDob": "1965-03-10",
        })


def test_co_applicant_returns_are_rejected_when_nobody_pools_income():
    with pytest.raises(ValidationError, match="only collected when"):
        _form(co_applicant={
            "coAppIncomeRelation": "None",
            "coApplicantCurrentItr": 400000.0,
            "coApplicantPreviousItr": 400000.0,
        })


def test_income_is_clubbed_before_the_bank_itr_floors_are_scored():
    own = 90_000.0
    payload = _form(
        occupation=_self_employed(currentITRAmount=own, prevITRAmount=own),
        co_applicant={
            "coAppIncomeRelation": "Father",
            "coApplicantName": "Anil Sharma", "coApplicantDob": "1965-03-10",
            "coApplicantCurrentItr": 400_000.0, "coApplicantPreviousItr": 400_000.0,
        },
    ).to_engine_payload()

    assert payload["current_itr"] == 490_000.0
    assert payload["previous_itr"] == 490_000.0
    assert payload["income_clubbed"] is True


def test_income_is_not_clubbed_when_no_co_applicant_pools():
    payload = _form(occupation=_self_employed(currentITRAmount=90_000.0)).to_engine_payload()
    assert payload["current_itr"] == 90_000.0
    assert "income_clubbed" not in payload


def test_the_income_trigger_threshold_is_a_named_constant():
    # The wizard shows the income co-applicant question below this figure; the
    # backend does not gate on it, so this guards the two from drifting apart.
    assert MIN_CO_APPLICANT_ITR_TRIGGER == 100_000.0


# --------------------------------------------------------------------------- #
# Bug 9 — the self-employed flow asks for the income co-applicant in step 3
# --------------------------------------------------------------------------- #


def _pooled(**over: Any) -> Dict[str, Any]:
    return {
        "coAppIncomeRelation": "Father",
        "coApplicantName": "Anil Sharma", "coApplicantDob": "1965-03-10",
        "coApplicantCurrentItr": 400_000.0, "coApplicantPreviousItr": 400_000.0,
        **over,
    }


@pytest.mark.parametrize(
    "current, previous",
    [
        (90_000.0, 90_000.0),   # both short
        (90_000.0, 400_000.0),  # only the current year is short
        (400_000.0, 90_000.0),  # only the previous year is short
    ],
)
def test_a_self_employed_applicant_may_pool_income_on_either_short_year(current, previous):
    """Bug 9 triggers on EITHER year, so all three shapes must be poolable.

    The trigger itself lives in the wizard; what the API must guarantee is that
    every one of these submissions is accepted and clubbed, because a payload
    the wizard can now produce must not 422.
    """
    payload = _form(
        occupation=_self_employed(currentITRAmount=current, prevITRAmount=previous),
        co_applicant=_pooled(),
    ).to_engine_payload()

    assert payload["current_itr"] == current + 400_000.0
    assert payload["previous_itr"] == previous + 400_000.0
    assert payload["income_clubbed"] is True


def test_clubbing_lifts_a_self_employed_applicant_over_the_bank_itr_floors():
    own = 90_000.0
    alone = _evaluate(_form(occupation=_self_employed(currentITRAmount=own, prevITRAmount=own)))
    assert alone["bank_eligibility"]["BOI"] is False

    pooled = _evaluate(_form(
        occupation=_self_employed(currentITRAmount=own, prevITRAmount=own),
        co_applicant=_pooled(),
    ))
    assert pooled["bank_eligibility"]["BOI"] is True
    # The floors were scored against the combined amount, not the applicant's.
    failed = {r["rule_id"] for r in pooled["evaluation_report"]["BOI"]["failed_rules"]}
    assert "EMP-SE-302" not in failed and "EMP-SE-303" not in failed


def test_a_farmer_who_filed_may_also_pool_income():
    # Farming fills the same two ITR fields, so bug 9's trigger reaches it.
    payload = _form(
        occupation=_agriculture(currentITRAmount=90_000.0, prevITRAmount=90_000.0),
        co_applicant=_pooled(),
    ).to_engine_payload()
    assert payload["current_itr"] == 490_000.0
