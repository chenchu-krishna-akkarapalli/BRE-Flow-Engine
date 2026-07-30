"""Boundary-Value Analysis, fuzzing, rule-priority and PII tests for the
FlowBRE rule engine (`app/services/bre_engine.py`).

Grounded in the ACTUAL behaviour of `BREEngineService.evaluate_application`
(verified empirically), not the aspirational spec in Rules.md. Tests that
document a real defect are marked `xfail(strict=True)` so the suite stays
green today and each xfail flips to a hard failure the moment the bug is
fixed — turning this file into an executable bug ledger.
"""
import asyncio
import copy

import pytest

from app.core.exceptions import InvalidPayloadError
from app.core.logging import redact_pii
from app.services.bre_engine import BANK_MATRIX_RULES, bre_engine_service


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _evaluate(payload):
    """Synchronous driver around the async engine for concise assertions."""
    return asyncio.run(bre_engine_service.evaluate_application(copy.deepcopy(payload)))


def _base_payload(**overrides):
    """A minimal, clean, APPROVED-by-default salaried applicant."""
    payload = {
        "entity_type": "Individual",
        "occupation": "Salaried",
        "net_monthly_salary": 60000.0,
        "age": 32,
        "selected_bank": "BOI",
        "credit_bureau": {
            "cibil_score": 750,
            "dpd_history": [0, 0, 0],
            "write_off_amount": 0.0,
        },
    }
    payload.update(overrides)
    return payload


def _rule_ids(result):
    return {r["rule_id"] for r in result["rejection_reasons"]}


# --------------------------------------------------------------------------- #
# 1. Boundary Value Analysis — CIBIL floor (BOI floor = 701)
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize(
    "cibil, expect_reject",
    [
        (300, True),    # absolute floor
        (700, True),    # one below BOI floor
        (701, False),   # exactly at BOI floor -> accept
        (730, False),
        (900, False),   # absolute ceiling
    ],
)
def test_bva_cibil_floor_boi(cibil, expect_reject):
    p = _base_payload()
    p["credit_bureau"]["cibil_score"] = cibil
    result = _evaluate(p)
    assert ("BUR-405" in _rule_ids(result)) is expect_reject


# --------------------------------------------------------------------------- #
# 2. Boundary Value Analysis — Age floor (min age = 21)
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize(
    "age, expect_dem101",
    [
        (20, True),    # below minimum
        (21, False),   # exactly minimum -> accept
        (60, False),
    ],
)
def test_bva_age_floor(age, expect_dem101):
    result = _evaluate(_base_payload(age=age))
    assert ("DEM-101" in _rule_ids(result)) is expect_dem101


@pytest.mark.parametrize(
    "occupation, field, pass_age, fail_age, rule_id",
    [
        # BOI ceilings: salaried max 60, self-employed max 65.
        ("Salaried", "age_at_last_emi_salaried", 60, 61, "DEM-102"),
        ("Self-Employed", "age_at_last_emi_self_employed", 65, 66, "DEM-103"),
    ],
)
def test_bva_max_age_at_last_emi_boi(occupation, field, pass_age, fail_age, rule_id):
    """W6 regression guard: age at final EMI maturity must be enforced against
    the selected bank's ceiling (BOI: 60 salaried / 65 self-employed)."""
    ok = _base_payload(occupation=occupation, selected_bank="BOI")
    ok[field] = pass_age
    assert rule_id not in _rule_ids(_evaluate(ok))  # exactly at ceiling -> pass

    over = _base_payload(occupation=occupation, selected_bank="BOI")
    over[field] = fail_age
    result = _evaluate(over)
    assert rule_id in _rule_ids(result)  # one over -> reject
    assert result["overall_eligible"] is False


def test_max_age_ceiling_is_bank_specific():
    """IOB permits a higher maturity age (75) than BOI (60) for salaried, so an
    age that BOI rejects must pass at IOB — proving the ceiling is per-bank."""
    p = _base_payload(occupation="Salaried", selected_bank="IOB")
    p["age_at_last_emi_salaried"] = 70
    assert "DEM-102" not in _rule_ids(_evaluate(p))


# --------------------------------------------------------------------------- #
# 3. Boundary Value Analysis — Salary floor (>= 25000)
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize(
    "salary, expect_reject",
    [
        (0, True),
        (24999, True),
        (25000, False),   # exactly at floor -> accept
        (25001, False),
    ],
)
def test_bva_salary_floor(salary, expect_reject):
    result = _evaluate(_base_payload(net_monthly_salary=salary))
    assert ("EMP-SAL-202" in _rule_ids(result)) is expect_reject


# --------------------------------------------------------------------------- #
# 4. Boundary Value Analysis — CC write-off ceiling (BOI allows CC, cap 5000)
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize(
    "amount, expect_401b",
    [
        (0, False),       # no write-off block entered at all
        (4999, False),
        (5000, True),     # exactly at ceiling -> REJECT (sheet says "< 5000")
        (5001, True),     # over ceiling
        (10001, True),
    ],
)
def test_bva_cc_write_off_ceiling_boi(amount, expect_401b):
    p = _base_payload()
    p["credit_bureau"].update(
        {"write_off_amount": float(amount), "write_off_type": "CC", "cc_write_off": True}
    )
    result = _evaluate(p)
    assert ("BUR-401B" in _rule_ids(result)) is expect_401b


# --------------------------------------------------------------------------- #
# 5. Rule priority / conflict resolution
# --------------------------------------------------------------------------- #
def test_indian_bank_zero_dpd_priority():
    """Indian Bank fires BUR-403 for ANY dpd > 0, even a single 15-day slip
    that would pass the general BUR-402 (> 90) check."""
    p = _base_payload(selected_bank="INDIAN_BANK")
    p["credit_bureau"]["dpd_history"] = [15, 0, 0]
    ids = _rule_ids(_evaluate(p))
    assert "BUR-403" in ids
    assert "BUR-402" not in ids  # 15 <= 90, so the general rule must NOT fire


def test_std_string_is_normalized_to_zero_dpd():
    """The bureau parser converts the literal "STD" (standard/on-time) to 0."""
    p = _base_payload(selected_bank="INDIAN_BANK")
    p["credit_bureau"]["dpd_history"] = ["STD", "STD", 0]
    assert _evaluate(p)["overall_eligible"] is True


def test_write_off_branch_priority_cc_before_pl():
    """When both flags are set the CC branch (BUR-401) is chosen first for a
    bank that forbids CC write-offs (INDIAN_BANK: allow_cc_write_off=False)."""
    p = _base_payload(selected_bank="INDIAN_BANK")
    p["credit_bureau"].update(
        {
            "write_off_amount": 3000.0,
            "cc_write_off": True,
            "pl_write_off": True,
            "write_off_type": "CC",
        }
    )
    ids = _rule_ids(_evaluate(p))
    assert "BUR-401" in ids
    assert "BUR-401C" not in ids  # PL branch is an `elif`, must be skipped


def test_tenant_alpha_risk_override_stacks():
    """tenant_alpha adds ALPHA-RSK-001 for cibil < 720 on top of base rules,
    and must NOT leak into the default tenant."""
    p = _base_payload()
    p["credit_bureau"]["cibil_score"] = 710  # >= BOI 701, < alpha 720
    alpha = _evaluate_with_tenant(p, "tenant_alpha")
    default = _evaluate_with_tenant(p, "default")
    assert "ALPHA-RSK-001" in _rule_ids(alpha)
    assert "ALPHA-RSK-001" not in _rule_ids(default)


def _evaluate_with_tenant(payload, tenant_id):
    return asyncio.run(
        bre_engine_service.evaluate_application(copy.deepcopy(payload), tenant_id=tenant_id)
    )


# --------------------------------------------------------------------------- #
# 6. Fuzzing / malformed input — the engine performs NO shape validation.
#    These document crash-class defects (unhandled AttributeError/TypeError).
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize("bad_bureau", [None, [], "not-a-dict", 12345])
def test_fuzz_credit_bureau_wrong_type_raises_domain_error(bad_bureau):
    """A present-but-malformed `credit_bureau` must raise a *domain* exception
    (InvalidPayloadError, 422), never an unhandled AttributeError. CLAUDE.md
    forbids generic fallbacks AND silent swallowing. Regression guard for W2."""
    p = _base_payload()
    p["credit_bureau"] = bad_bureau
    with pytest.raises(InvalidPayloadError):
        _evaluate(p)


def test_fuzz_nri_days_as_string_raises_domain_error():
    """Non-numeric NRI stay must raise InvalidPayloadError, not a raw
    TypeError from the unconditional /365.0 division. Regression guard for W2."""
    p = _base_payload(is_nri=True)
    p["minimum_stay_period_nri_days"] = "abc"
    with pytest.raises(InvalidPayloadError):
        _evaluate(p)


def test_non_nri_ignores_bad_nri_days():
    """A non-NRI applicant must not be failed by a malformed NRI field it never
    uses — the stay period is only evaluated when is_nri is True."""
    p = _base_payload(is_nri=False)
    p["minimum_stay_period_nri_days"] = "abc"
    assert _evaluate(p)["overall_eligible"] is True


@pytest.mark.parametrize("bad_dpd", [["120"], [120.0], ["90", "120"]])
def test_fuzz_non_int_dpd_is_coerced_not_dropped(bad_dpd):
    """String/float DPD values must be coerced (not silently dropped by an
    `isinstance(v, int)` filter). A 120-day delinquency, however typed, must
    fail BUR-402. Regression guard for W1 (the false-approval defect)."""
    p = _base_payload()
    p["credit_bureau"]["dpd_history"] = bad_dpd
    assert "BUR-402" in _rule_ids(_evaluate(p))


@pytest.mark.parametrize("bad_dpd", [["hello"], ["12-days"], [{"dpd": 1}]])
def test_fuzz_unparseable_dpd_fails_closed(bad_dpd):
    """Genuinely unparseable DPD cells must fail closed with a domain error,
    never be dropped into a false 'clean history' verdict."""
    p = _base_payload()
    p["credit_bureau"]["dpd_history"] = bad_dpd
    with pytest.raises(InvalidPayloadError):
        _evaluate(p)


def test_fuzz_empty_and_missing_fields_are_defaulted():
    """Empty payload must not crash — engine applies documented defaults
    (cibil 750, age 30, salary 30000, bank BOI) and approves."""
    result = _evaluate({})
    assert result["status"] == "APPROVED"


@pytest.mark.parametrize("amount", [1.0, 8000.0])
def test_unclassified_write_off_fails_closed(amount):
    """W5 regression guard: a recorded write-off with no `write_off_type`/flag
    can no longer slip under the 10000 matrix ceiling. It fails closed via
    BUR-401D and disqualifies every bank."""
    p = _base_payload()
    p["credit_bureau"]["write_off_amount"] = amount
    result = _evaluate(p)
    assert "BUR-401D" in _rule_ids(result)
    assert result["overall_eligible"] is False
    assert all(v is False for v in result["bank_eligibility"].values())


def test_classified_write_off_within_policy_still_passes():
    """A CC write-off the bank explicitly allows and that is within its ceiling
    must NOT be caught by the new unclassified fail-closed branch (BOI allows
    CC write-offs up to 5000)."""
    p = _base_payload(selected_bank="BOI")
    p["credit_bureau"].update(
        {"write_off_amount": 3000.0, "write_off_type": "CC", "cc_write_off": True}
    )
    ids = _rule_ids(_evaluate(p))
    assert "BUR-401D" not in ids
    assert "BUR-401" not in ids and "BUR-401B" not in ids


# --------------------------------------------------------------------------- #
# 7. PII safety — redaction must strip PAN / DOB / Aadhaar before logging
# --------------------------------------------------------------------------- #
def test_pii_redacted_payload_has_no_raw_identifiers():
    payload = {
        "applicant_name": "Jane Doe",
        "pan": "ABCDE1234F",
        "dob": "1990-05-15",
        "aadhaar": "123412341234",
        "credit_bureau": {"cibil_score": 750, "pan": "XYZAB9876Q"},
    }
    redacted = redact_pii(payload)
    flat = str(redacted)
    assert "ABCDE1234F" not in flat
    assert "1990-05-15" not in flat
    assert "123412341234" not in flat
    assert redacted["pan"] == "AB******4F"
    assert redacted["dob"] == "****-**-15"
    assert redacted["aadhaar"].endswith("1234") and redacted["aadhaar"].startswith("****")
    assert redacted["applicant_name"] == "Jane Doe"  # non-PII preserved


# --------------------------------------------------------------------------- #
# 8. Output-contract invariants
# --------------------------------------------------------------------------- #
def test_output_contract_shape():
    result = _evaluate(_base_payload())
    for key in (
        "status",
        "overall_eligible",
        "executed_rules_count",
        "execution_time_ms",
        "rejection_reasons",
        "bank_eligibility",
    ):
        assert key in result
    assert set(result["bank_eligibility"]) == set(BANK_MATRIX_RULES)
    assert result["execution_time_ms"] < 10.0  # RAM-eval SLA


def test_rejected_application_disqualifies_all_banks():
    """A globally-ineligible applicant (age < 21) must be False for every
    bank, because bank_eligibility is ANDed with overall_eligible."""
    result = _evaluate(_base_payload(age=19))
    assert result["overall_eligible"] is False
    assert all(v is False for v in result["bank_eligibility"].values())


# --------------------------------------------------------------------------- #
# 9. Full Excel-matrix fidelity (Bank_Eligibility_Matrix_v1.xlsx) regression set
# --------------------------------------------------------------------------- #
def _se_payload(**overrides):
    """A clean self-employed applicant that APPROVES by default."""
    p = _base_payload(**overrides)
    p["occupation"] = "Self-Employed"
    p.setdefault("current_itr", 500000)
    p.setdefault("previous_itr", 450000)
    p.setdefault("itr_filed", True)
    p.setdefault("business_proof", True)
    p.setdefault("business_experience_years", 5)
    p.setdefault("business_itr_years", 5)
    return p


def test_currently_overdue_rejects_bur404():
    p = _base_payload()
    p["credit_bureau"]["currently_overdue"] = True
    assert "BUR-404" in _rule_ids(_evaluate(p))


def test_min_work_experience_rejects_boi():
    assert "EMP-SAL-204" in _rule_ids(_evaluate(_base_payload(minimum_work_experience_years=1)))


def test_current_company_tenure_rejects_boi():
    # BOI requires >= 2 yrs; 12 months = 1 yr.
    assert "EMP-SAL-205" in _rule_ids(_evaluate(_base_payload(current_company_tenure_months=12)))


def test_no_income_proof_bank_specific():
    # BOI forbids no-income-proof; HDFC permits it.
    assert "EMP-SAL-207" in _rule_ids(_evaluate(_base_payload(no_income_proof_segment=True)))
    ok = _evaluate(_base_payload(selected_bank="HDFC", no_income_proof_segment=True))
    assert "EMP-SAL-207" not in _rule_ids(ok)
    assert ok["overall_eligible"] is True


def test_nri_not_allowed_and_stay_floor():
    # BOI does not onboard NRIs at all.
    assert "DEM-104" in _rule_ids(_evaluate(_base_payload(is_nri=True, minimum_stay_period_nri_years=5)))
    # HDFC allows NRI but requires >= 2 yrs stay.
    p = _base_payload(selected_bank="HDFC", is_nri=True, minimum_stay_period_nri_years=1)
    assert "DEM-105" in _rule_ids(_evaluate(p))


def test_guarantor_mandatory_bank_specific():
    # A rented resi-cum-office needs a guarantor at BOI; BOM waives it.
    assert "RES-205" in _rule_ids(_evaluate(_base_payload(property_status="RESI_CUM_OFFICE_RENTED")))
    ok = _evaluate(_base_payload(selected_bank="BOM", property_status="RESI_CUM_OFFICE_RENTED"))
    assert ok["overall_eligible"] is True


@pytest.mark.parametrize(
    "field, value, rule_id",
    [
        ("current_itr", 200000, "EMP-SE-302"),   # BOI SE current ITR >= 300000
        ("previous_itr", 50000, "EMP-SE-303"),   # BOI SE previous ITR >= 100000
        ("itr_filed", False, "EMP-SE-304"),
        ("business_proof", False, "BUS-302"),
        ("business_itr_years", 1, "EMP-SE-301"),
    ],
)
def test_self_employed_suite_rejects_boi(field, value, rule_id):
    assert rule_id in _rule_ids(_evaluate(_se_payload(**{field: value})))


def test_self_employed_clean_approves():
    assert _evaluate(_se_payload())["overall_eligible"] is True


def test_bob_combined_itr_rule():
    # BOB uses current+previous >= 600000 instead of a flat previous floor.
    fail = _se_payload(selected_bank="BOB", current_itr=300000, previous_itr=100000)
    assert "EMP-SE-303" in _rule_ids(_evaluate(fail))
    ok = _se_payload(selected_bank="BOB", current_itr=400000, previous_itr=250000)
    assert "EMP-SE-303" not in _rule_ids(_evaluate(ok))


@pytest.mark.parametrize(
    "bank, dpd, reject",
    [
        ("IOB", 89, False),   # "< 90" -> 89 passes
        ("IOB", 90, True),    # 90 rejects
        ("BOI", 0, False),    # "<= 0" -> 0 passes
        ("BOI", 1, True),     # any DPD rejects for a zero-tolerance bank
    ],
)
def test_dpd_boundary_matches_sheet(bank, dpd, reject):
    p = _base_payload(selected_bank=bank)
    p["credit_bureau"]["dpd_history"] = [dpd]
    assert ("BUR-402" in _rule_ids(_evaluate(p))) is reject


def test_write_off_type_specific_rejection():
    # A home-loan write-off (never permitted) rejects via generic BUR-401.
    p = _base_payload()
    p["credit_bureau"].update({"write_off_amount": 3000.0, "write_off_type": "HL"})
    assert "BUR-401" in _rule_ids(_evaluate(p))


def test_selected_bank_and_matrix_are_consistent():
    """The selected-bank verdict must equal that bank's entry in the 8-bank map
    (both now come from the same rule function)."""
    p = _base_payload(selected_bank="IOB")
    p["credit_bureau"]["cibil_score"] = 700  # below IOB floor 701
    result = _evaluate(p)
    assert result["overall_eligible"] is False
    assert result["bank_eligibility"]["IOB"] is False


def test_form_16_years_bank_specific():
    # BOI requires >= 2 Form-16 years; 1 rejects, 2 passes.
    assert "EMP-SAL-206" in _rule_ids(_evaluate(_base_payload(form_16_years=1)))
    assert "EMP-SAL-206" not in _rule_ids(_evaluate(_base_payload(form_16_years=2)))
    # BOB only needs 1 year.
    assert "EMP-SAL-206" not in _rule_ids(_evaluate(_base_payload(selected_bank="BOB", form_16_years=1)))


def test_form_16_skipped_on_accepted_no_income_proof():
    # HDFC accepts a no-income-proof profile, so Form-16 history is not required.
    ok = _evaluate(_base_payload(selected_bank="HDFC", no_income_proof_segment=True, form_16_years=0))
    assert "EMP-SAL-206" not in _rule_ids(ok)
    assert ok["overall_eligible"] is True


def test_existing_car_loan_bank_specific():
    # IOB and BOB forbid an existing active car loan; others allow it.
    assert "EXB-702" in _rule_ids(_evaluate(_base_payload(selected_bank="IOB", active_car_loan=True)))
    assert "EXB-702" in _rule_ids(_evaluate(_base_payload(selected_bank="BOB", active_car_loan=True)))
    assert _evaluate(_base_payload(selected_bank="BOI", active_car_loan=True))["overall_eligible"] is True
    assert _evaluate(_base_payload(selected_bank="HDFC", active_car_loan=True))["overall_eligible"] is True
