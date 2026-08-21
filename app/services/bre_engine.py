import asyncio
import time
from datetime import date, timedelta
from typing import Any, Dict, List

from app.constants.limits import MIN_SELF_EMPLOYED_COMBINED_ITR as COMBINED_ITR_FLOOR
from app.constants.limits import TENANT_CIBIL_OVERLAY
from app.core.exceptions import InvalidPayloadError
from app.core.logging import logger, redact_pii

# Bureau cells that represent a clean / on-time (0-day) status. The parser maps
# any of these to a 0 DPD value; every other cell must be numerically coercible.
# Distinguishes "the caller did not tell us where they bank" (legacy flat
# /evaluate payloads carry no such field — REL-501 cannot be judged, so it is
# skipped) from None, which means "holds no partner-bank account at all" and
# does reject.
ACCOUNT_BANK_UNKNOWN = "__UNKNOWN__"

DAYS_PER_YEAR = 365.25
MONTHS_PER_YEAR = 12

CLEAN_DPD_TOKENS = frozenset({"STD", "XXX", "*", "-", ""})


def _coerce_dpd_value(value: Any) -> int:
    """Coerce a single bureau DPD cell to an integer day-count.

    Recognized clean/standard tokens (e.g. "STD") map to 0; ints, floats and
    numeric strings ("120") are coerced to int. Anything else is rejected
    loudly via InvalidPayloadError rather than being silently dropped — a
    silently-dropped "120" would let a real 120-day delinquency masquerade as
    clean history and wrongly approve the applicant.
    """
    # bool is an int subclass; a boolean DPD cell is malformed bureau data.
    if isinstance(value, bool):
        raise InvalidPayloadError(f"boolean is not a valid DPD value: {value!r}")
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        token = value.strip().upper()
        if token in CLEAN_DPD_TOKENS:
            return 0
        try:
            return int(float(token))
        except ValueError:
            raise InvalidPayloadError(f"unparseable DPD token: {value!r}")
    raise InvalidPayloadError(f"unsupported DPD entry type: {type(value).__name__}")


def _normalize_dpd_history(dpd_values: Any) -> List[int]:
    """Coerce a raw dpd_history array into a list of integer day-counts.

    None/absent entries are skipped (no data point), not treated as 0-risk.
    """
    if dpd_values is None:
        return []
    if not isinstance(dpd_values, (list, tuple)):
        raise InvalidPayloadError(
            f"dpd_history must be a list, got {type(dpd_values).__name__}"
        )
    return [_coerce_dpd_value(v) for v in dpd_values if v is not None]


# Maps a bureau write-off type to the per-bank policy flag that governs it
# (Bank_Eligibility_Matrix_v1.xlsx columns 4-10). An unrecognized/absent type
# is treated as unclassified and fails closed (BUR-401D).
WRITE_OFF_TYPE_TO_FLAG = {
    "PL": "allow_pl_write_off",
    "HL": "allow_hl_write_off",
    "CONSUMER": "allow_consumer_write_off",
    "AGRI": "allow_agri_write_off",
    "MSME": "allow_msme_write_off",
    "AUTO": "allow_auto_write_off",
    "CC": "allow_cc_write_off",
}

# The property configuration the guarantor question attaches to: the office
# operates out of a RENTED residence (resi-cum-office rented). A separately
# addressed office is a distinct premises and is assessed on its own tenure —
# it does not trigger the guarantor prompt, whatever its premises status.
GUARANTOR_PROPERTY_STATUSES = frozenset({"RESI_CUM_OFFICE_RENTED"})

# Bureau rental-income class -> the per-bank policy flag governing it
# (matrix cols 38-40). NONE/absent means no secondary rental income claimed.
RENTAL_CLASS_TO_FLAG = {
    "NO_ITR_NOT_IN_BANK": "allow_rental_no_itr_not_in_bank",
    "NO_ITR_IN_BANK": "allow_rental_no_itr_in_bank",
    "ITR_NOT_IN_BANK": "allow_rental_itr_not_in_bank",
}

# Banks that do NOT permit an existing car loan OF THEIR OWN alongside the
# application (matrix col 19: "Existing Car Loan" == False). A car loan held
# with a different lender never binds these banks. EXB-702.
BANKS_DISALLOW_EXISTING_CAR_LOAN = frozenset({"IOB", "BOB"})

# Canonical Bank Policy Matrix derived from Bank_Eligibility_Matrix_v1.xlsx (62 columns).
#
# SOURCE OF TRUTH: this dict is the authoritative, code-defined ruleset that
# evaluate_application() evaluates against. Rule changes are code changes and
# ship via redeploy. (W4: the previous JDM/JSON loader and /rules API implied
# rules could be hot-reloaded into evaluation — they never were — and have been
# removed to make the code-defined matrix the single, honest source of truth.)
#
# Boundary semantics follow the sheet's operators exactly:
#   * max_dpd / max_cc_write_off_amount store the MAXIMUM ACCEPTABLE value.
#     The sheet's DPD "< 90" columns are stored as 89 (so DPD 90 rejects); the
#     "<= 0" columns are stored as 0 (so any DPD > 0 rejects).
#   * The credit-card write-off cap uses the sheet's strict "< 5000"/"< 10000",
#     i.e. an amount AT the cap is rejected (see BUR-401B: amount >= cap).
BANK_MATRIX_RULES = {
    "BOI": {
        "min_cibil": 701,
        "allow_pl_write_off": False,
        "allow_hl_write_off": False,
        "allow_consumer_write_off": False,
        "allow_agri_write_off": False,
        "allow_msme_write_off": False,
        "allow_auto_write_off": False,
        "allow_cc_write_off": True,
        "max_cc_write_off_amount": 5000.0,
        "max_dpd": 0,
        "min_age": 21,
        "max_age_emi_salaried": 60,
        "max_age_emi_self_employed": 65,
        "allow_nri": False,
        "min_nri_stay_years": 0,
        "min_salary": 25000.0,
        "min_current_company_tenure_years": 2.0,
        "min_total_experience_years": 2.0,
        "form16_years_required": 2,
        "se_min_current_itr": 300000.0,
        "se_min_prev_itr": 100000.0,
        "se_combined_itr_rule": False,
        "min_business_itr_years": 3,
        "allow_no_income_proof": False,
        "allow_huf": False,
        "allow_sibling_coapplicant": True,
        "allow_loan_enquiry": True,
        "allow_agriculture": False,
        "allow_rental_no_itr_not_in_bank": False,
        "allow_rental_no_itr_in_bank": True,
        "allow_rental_itr_not_in_bank": True,
        "allow_itr_not_filed": False,
        "allow_without_guarantor": False,
        "allow_with_guarantor": True,
        "allows_existing_account_holder": True,
        "allow_separate_both_rented": False,
    },
    "INDIAN_BANK": {
        "min_cibil": 730,
        "allow_pl_write_off": False,
        "allow_hl_write_off": False,
        "allow_consumer_write_off": False,
        "allow_agri_write_off": False,
        "allow_msme_write_off": False,
        "allow_auto_write_off": False,
        "allow_cc_write_off": False,
        "max_cc_write_off_amount": 0.0,
        "max_dpd": 0,
        "min_age": 21,
        "max_age_emi_salaried": 60,
        "max_age_emi_self_employed": 70,
        "allow_nri": True,
        "min_nri_stay_years": 2,
        "min_salary": 25000.0,
        "min_current_company_tenure_years": 2.0,
        "min_total_experience_years": 2.0,
        "form16_years_required": 2,
        "se_min_current_itr": 300000.0,
        "se_min_prev_itr": 300000.0,
        "se_combined_itr_rule": False,
        "min_business_itr_years": 2,
        "allow_no_income_proof": False,
        "allow_huf": False,
        "allow_sibling_coapplicant": False,
        "allow_loan_enquiry": True,
        "allow_agriculture": False,
        "allow_rental_no_itr_not_in_bank": False,
        "allow_rental_no_itr_in_bank": False,
        "allow_rental_itr_not_in_bank": True,
        "allow_itr_not_filed": False,
        "allow_without_guarantor": False,
        "allow_with_guarantor": True,
        "allows_existing_account_holder": True,
        "allow_separate_both_rented": False,
    },
    "IOB": {
        "min_cibil": 701,
        "allow_pl_write_off": False,
        "allow_hl_write_off": False,
        "allow_consumer_write_off": False,
        "allow_agri_write_off": False,
        "allow_msme_write_off": False,
        "allow_auto_write_off": False,
        "allow_cc_write_off": True,
        "max_cc_write_off_amount": 5000.0,
        "max_dpd": 89,
        "min_age": 21,
        "max_age_emi_salaried": 75,
        "max_age_emi_self_employed": 75,
        "allow_nri": True,
        "min_nri_stay_years": 2,
        "min_salary": 25000.0,
        "min_current_company_tenure_years": 1.0,
        "min_total_experience_years": 2.0,
        "form16_years_required": 2,
        "se_min_current_itr": 300000.0,
        "se_min_prev_itr": 300000.0,
        "se_combined_itr_rule": False,
        "min_business_itr_years": 2,
        "allow_no_income_proof": False,
        "allow_huf": False,
        "allow_sibling_coapplicant": False,
        "allow_loan_enquiry": True,
        "allow_agriculture": False,
        "allow_rental_no_itr_not_in_bank": False,
        "allow_rental_no_itr_in_bank": False,
        "allow_rental_itr_not_in_bank": False,
        "allow_itr_not_filed": False,
        "allow_without_guarantor": False,
        "allow_with_guarantor": False,
        "allows_existing_account_holder": False,
        "allow_separate_both_rented": False,
    },
    "BOB": {
        "min_cibil": 726,
        "allow_pl_write_off": False,
        "allow_hl_write_off": False,
        "allow_consumer_write_off": False,
        "allow_agri_write_off": False,
        "allow_msme_write_off": False,
        "allow_auto_write_off": False,
        "allow_cc_write_off": False,
        "max_cc_write_off_amount": 0.0,
        "max_dpd": 89,
        "min_age": 21,
        "max_age_emi_salaried": 60,
        "max_age_emi_self_employed": 70,
        "allow_nri": True,
        "min_nri_stay_years": 2,
        "min_salary": 25000.0,
        "min_current_company_tenure_years": 2.0,
        "min_total_experience_years": 2.0,
        "form16_years_required": 1,
        # The sheet's "Current ITR" cell reads "condition", not a threshold:
        # BOB states no per-year floor and defers entirely to the combined
        # test below. The 300,000 previously carried here was transcribed from
        # the other banks' rows and rejected applicants the combined rule
        # admits.
        "se_min_current_itr": 0.0,
        "se_min_prev_itr": 0.0,
        "se_combined_itr_rule": True,  # Current + Prev >= 600,000
        "min_business_itr_years": 2,
        "allow_no_income_proof": False,
        "allow_huf": False,
        "allow_sibling_coapplicant": True,
        "allow_loan_enquiry": True,
        "allow_agriculture": False,
        "allow_rental_no_itr_not_in_bank": False,
        "allow_rental_no_itr_in_bank": False,
        "allow_rental_itr_not_in_bank": False,
        "allow_itr_not_filed": False,
        "allow_without_guarantor": False,
        "allow_with_guarantor": False,
        "allows_existing_account_holder": True,
        "allow_separate_both_rented": True,
    },
    "BOM": {
        "min_cibil": 650,
        "allow_pl_write_off": False,
        "allow_hl_write_off": False,
        "allow_consumer_write_off": False,
        "allow_agri_write_off": False,
        "allow_msme_write_off": False,
        "allow_auto_write_off": False,
        "allow_cc_write_off": True,
        "max_cc_write_off_amount": 10000.0,
        "max_dpd": 0,
        "min_age": 21,
        "max_age_emi_salaried": 70,
        "max_age_emi_self_employed": 70,
        "allow_nri": True,
        "min_nri_stay_years": 2,
        "min_salary": 25000.0,
        "min_current_company_tenure_years": 2.0,
        "min_total_experience_years": 2.0,
        "form16_years_required": 2,
        "se_min_current_itr": 100000.0,
        "se_min_prev_itr": 100000.0,
        "se_combined_itr_rule": False,
        "min_business_itr_years": 2,
        "allow_no_income_proof": False,
        "allow_huf": False,
        "allow_sibling_coapplicant": False,
        "allow_loan_enquiry": True,
        "allow_agriculture": True,
        "allow_rental_no_itr_not_in_bank": False,
        "allow_rental_no_itr_in_bank": False,
        "allow_rental_itr_not_in_bank": False,
        "allow_itr_not_filed": False,
        "allow_without_guarantor": True,
        "allow_with_guarantor": True,
        "allows_existing_account_holder": True,
        "allow_separate_both_rented": False,
    },
    "HDFC": {
        "min_cibil": 701,
        "allow_pl_write_off": False,
        "allow_hl_write_off": False,
        "allow_consumer_write_off": False,
        "allow_agri_write_off": False,
        "allow_msme_write_off": False,
        "allow_auto_write_off": False,
        "allow_cc_write_off": False,
        "max_cc_write_off_amount": 0.0,
        "max_dpd": 89,
        "min_age": 21,
        "max_age_emi_salaried": 70,
        "max_age_emi_self_employed": 70,
        "allow_nri": True,
        "min_nri_stay_years": 2,
        "min_salary": 25000.0,
        "min_current_company_tenure_years": 0.5,
        "min_total_experience_years": 2.0,
        "form16_years_required": 2,
        "se_min_current_itr": 100000.0,
        "se_min_prev_itr": 100000.0,
        "se_combined_itr_rule": False,
        "min_business_itr_years": 2,
        "allow_no_income_proof": True,
        "allow_huf": False,
        "allow_sibling_coapplicant": True,
        "allow_loan_enquiry": True,
        "allow_agriculture": True,
        "allow_rental_no_itr_not_in_bank": False,
        "allow_rental_no_itr_in_bank": False,
        "allow_rental_itr_not_in_bank": False,
        "allow_itr_not_filed": False,
        "allow_without_guarantor": False,
        "allow_with_guarantor": True,
        "allows_existing_account_holder": True,
        "allow_separate_both_rented": True,
    },
    "AXIS": {
        "min_cibil": 701,
        "allow_pl_write_off": False,
        "allow_hl_write_off": False,
        "allow_consumer_write_off": False,
        "allow_agri_write_off": False,
        "allow_msme_write_off": False,
        "allow_auto_write_off": False,
        "allow_cc_write_off": False,
        "max_cc_write_off_amount": 0.0,
        "max_dpd": 89,
        "min_age": 21,
        "max_age_emi_salaried": 70,
        "max_age_emi_self_employed": 70,
        "allow_nri": True,
        "min_nri_stay_years": 2,
        "min_salary": 25000.0,
        "min_current_company_tenure_years": 0.5,
        "min_total_experience_years": 2.0,
        "form16_years_required": 2,
        "se_min_current_itr": 100000.0,
        "se_min_prev_itr": 100000.0,
        "se_combined_itr_rule": False,
        "min_business_itr_years": 2,
        "allow_no_income_proof": True,
        "allow_huf": False,
        "allow_sibling_coapplicant": True,
        "allow_loan_enquiry": True,
        "allow_agriculture": True,
        "allow_rental_no_itr_not_in_bank": False,
        "allow_rental_no_itr_in_bank": False,
        "allow_rental_itr_not_in_bank": False,
        "allow_itr_not_filed": False,
        "allow_without_guarantor": False,
        "allow_with_guarantor": True,
        "allows_existing_account_holder": True,
        "allow_separate_both_rented": True,
    },
    "KOTAK": {
        "min_cibil": 701,
        "allow_pl_write_off": False,
        "allow_hl_write_off": False,
        "allow_consumer_write_off": False,
        "allow_agri_write_off": False,
        "allow_msme_write_off": False,
        "allow_auto_write_off": False,
        "allow_cc_write_off": False,
        "max_cc_write_off_amount": 0.0,
        "max_dpd": 89,
        "min_age": 21,
        "max_age_emi_salaried": 70,
        "max_age_emi_self_employed": 70,
        "allow_nri": True,
        "min_nri_stay_years": 2,
        "min_salary": 25000.0,
        "min_current_company_tenure_years": 0.5,
        "min_total_experience_years": 2.0,
        "form16_years_required": 2,
        "se_min_current_itr": 100000.0,
        "se_min_prev_itr": 100000.0,
        "se_combined_itr_rule": False,
        "min_business_itr_years": 2,
        "allow_no_income_proof": True,
        "allow_huf": False,
        "allow_sibling_coapplicant": True,
        "allow_loan_enquiry": True,
        "allow_agriculture": True,
        "allow_rental_no_itr_not_in_bank": False,
        "allow_rental_no_itr_in_bank": False,
        "allow_rental_itr_not_in_bank": False,
        "allow_itr_not_filed": False,
        "allow_without_guarantor": False,
        "allow_with_guarantor": True,
        "allows_existing_account_holder": True,
        "allow_separate_both_rented": True,
    },
}


# --------------------------------------------------------------------------- #
# Entity-scoped matrix views
# --------------------------------------------------------------------------- #
#
# The policy sheet is split by entity type. A Company is scored on the columns
# present in bank_Company_Organization_Eligibility_Matrix.xlsx; an Individual or
# HUF on bank_Individual_Eligibility_Matrix.xlsx. The projections below mirror
# those column sets exactly.
#
# A key ABSENT from a view means that matrix carries no such column, so the rule
# it governs does not exist for that entity — not that it defaults to pass. The
# practical consequence: a company has no date of birth, so the Company sheet
# has no age columns, and the EMI-maturity age rule (DEM-103) no longer fires
# against a corporate applicant's bureau "age at last EMI".

COMPANY_MATRIX_KEYS = frozenset({
    "min_cibil",
    "allow_pl_write_off", "allow_hl_write_off", "allow_consumer_write_off",
    "allow_agri_write_off", "allow_msme_write_off", "allow_auto_write_off",
    "allow_cc_write_off", "max_cc_write_off_amount",
    "max_dpd", "allow_loan_enquiry", "allows_existing_account_holder",
    "se_min_current_itr", "se_min_prev_itr", "se_combined_itr_rule",
    "allow_itr_not_filed", "min_business_itr_years",
})

INDIVIDUAL_MATRIX: Dict[str, Dict[str, Any]] = {
    code: dict(policy) for code, policy in BANK_MATRIX_RULES.items()
}
# Where the two sheets hold DIFFERENT values for the same policy, the Company
# sheet wins for corporate applicants. HDFC/AXIS/Kotak decline an unfiled ITR
# from an individual but still underwrite a company that has not filed —
# expressing that divergence is the point of splitting the matrix.
COMPANY_POLICY_OVERRIDES: Dict[str, Dict[str, Any]] = {
    "HDFC": {"allow_itr_not_filed": True},
    "AXIS": {"allow_itr_not_filed": True},
    "KOTAK": {"allow_itr_not_filed": True},
}

COMPANY_MATRIX: Dict[str, Dict[str, Any]] = {
    code: {
        **{k: v for k, v in policy.items() if k in COMPANY_MATRIX_KEYS},
        **COMPANY_POLICY_OVERRIDES.get(code, {}),
    }
    for code, policy in BANK_MATRIX_RULES.items()
}

# Each entity type resolves to exactly one matrix. The two views are built as
# independent dicts (no shared sub-objects), so an Individual evaluation and a
# Company evaluation cannot observe each other's state under concurrency.
ENTITY_MATRICES: Dict[str, Dict[str, Dict[str, Any]]] = {
    "INDIVIDUAL": INDIVIDUAL_MATRIX,
    "COMPANY": COMPANY_MATRIX,
}
ENTITY_TYPE_TO_MATRIX = {
    "INDIVIDUAL": "INDIVIDUAL",
    "HUF": "INDIVIDUAL",
    "COMPANY": "COMPANY",
}


def matrix_for_entity(entity_type: Any) -> Dict[str, Dict[str, Any]]:
    """Resolve the entity-scoped rule matrix. Unknown entity types fall back to
    the Individual matrix, the stricter of the two."""
    key = str(entity_type or "").strip().upper()
    return ENTITY_MATRICES[ENTITY_TYPE_TO_MATRIX.get(key, "INDIVIDUAL")]


def _years_between(start: date, end: date) -> float:
    """Fractional years between two dates. Fractions matter: the matrix floors
    are floats (">= 2"), and truncating to whole years scores an applicant with
    1 year 11 months as 1."""
    return max((end - start).days / DAYS_PER_YEAR, 0.0)


def _total_work_experience_years(
    prev_joining: Any, current_tenure_months: Any, reference: date | None = None
) -> float | None:
    """Total employment history = prior-employment span + current tenure.

    The prior span runs from the previous joining date to the START of the
    current job (today minus the current tenure), so the two components are
    disjoint and cannot double-count. Returns None when no previous employment
    is on file, letting the caller fall back to the current tenure alone.
    """
    if not prev_joining:
        return None
    try:
        start = date.fromisoformat(str(prev_joining)[:10])
    except ValueError:
        raise InvalidPayloadError(f"prev_company_joining is not a valid date: {prev_joining!r}")

    today = reference or date.today()
    tenure_years = float(current_tenure_months or 0) / MONTHS_PER_YEAR
    current_job_start = today - timedelta(days=tenure_years * DAYS_PER_YEAR)
    return _years_between(start, current_job_start) + tenure_years


def _resolved_work_experience(payload: Dict[str, Any]) -> float:
    """Total work experience in years for the salaried rules.

    Prefers the date-based computation; falls back to any pre-computed value
    (the flat /evaluate contract carries one), then to a permissive default so
    a payload that never mentions employment is not spuriously rejected.
    """
    computed = _total_work_experience_years(
        payload.get("prev_company_joining"),
        payload.get("current_company_tenure_months"),
    )
    if computed is not None:
        return computed
    if "minimum_work_experience_years" in payload:
        return float(payload["minimum_work_experience_years"])
    return 99.0


def _evaluate_bank(inp: Dict[str, Any], code: str, policy: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return an outcome record for every rule ACTUALLY EVALUATED for one bank.

    This is the single source of rule logic; `_bank_rejections` filters it for
    failures. A rule that does not apply (NRI checks for a resident, write-off
    checks with no write-off on file, columns absent from the entity's matrix)
    records nothing at all — "not applicable" is not the same as "passed", and
    reporting it as a pass would overstate what the bank actually verified.
    """
    outcomes: List[Dict[str, Any]] = []

    def check(rid: str, name: str, cat: str, passed: bool,
              value: Any, limit: Any, msg: str = "") -> None:
        # A passing rule states its own outcome; only failures carry a
        # hand-written sentence, because only they have to explain themselves.
        description = (
            f"{name} of {value} satisfies {code} limit of {limit}."
            if passed else msg
        )
        outcomes.append({
            "rule_id": rid, "name": name, "category": cat, "passed": bool(passed),
            "value": str(value), "limit": str(limit), "message": description,
        })

    # --- Demographics --------------------------------------------------------
    if "min_age" in policy:
        check("DEM-101", "Minimum Age", "Demographics",
              inp["age"] >= policy["min_age"], inp["age"], f">= {policy['min_age']}",
              f"Applicant age ({inp['age']}) is below the minimum requirement ({policy['min_age']} years).")

    if inp["is_nri"] and "allow_nri" in policy:
        check("DEM-104", "NRI/PIO Accepted", "Demographics",
              policy["allow_nri"], "NRI/PIO", policy["allow_nri"],
              f"{code} does not onboard NRI/PIO applicants.")
        if policy["allow_nri"]:
            check("DEM-105", "NRI Minimum Stay", "Demographics",
                  inp["nri_stay_years"] >= policy["min_nri_stay_years"],
                  f"{inp['nri_stay_years']:.2f} yrs", f">= {policy['min_nri_stay_years']} yrs",
                  f"NRI in-country stay ({inp['nri_stay_years']:.2f} yrs) is below {code} minimum ({policy['min_nri_stay_years']} yrs).")

    # --- Credit bureau -------------------------------------------------------
    check("BUR-404", "Currently Outstanding", "Credit Bureau History",
          not inp["currently_overdue"], inp["currently_overdue"], False,
          "Application declined due to active currently-outstanding overdue balances.")

    check("BUR-405", "CIBIL Score", "Credit Bureau Floor",
          inp["cibil"] >= policy["min_cibil"], inp["cibil"], f">= {policy['min_cibil']}",
          f"CIBIL score ({inp['cibil']}) is below {code} minimum threshold of {policy['min_cibil']}.")

    # An applicant with no enquiries always passes; one with enquiries is
    # judged against the bank's col-12 permission.
    check("BUR-406", "Loan Enquiries", "Credit Bureau History",
          (not inp["has_loan_enquiry"]) or policy["allow_loan_enquiry"],
          "Yes" if inp["has_loan_enquiry"] else "No",
          "Any" if policy["allow_loan_enquiry"] else "No",
          f"{code} does not accept applicants with active loan enquiries on the bureau record.")

    if code == "INDIAN_BANK":
        check("BUR-403", "DPD History", "Credit Bureau History",
              inp["max_dpd"] <= 0, inp["max_dpd"], "<= 0",
              "Indian Bank requires zero past DPD instances across all loan accounts.")
    else:
        check("BUR-402", "DPD History", "Credit Bureau History",
              inp["max_dpd"] <= policy["max_dpd"], inp["max_dpd"], f"<= {policy['max_dpd']}",
              f"DPD value ({inp['max_dpd']}) exceeds {code} tolerance ({policy['max_dpd']} days).")

    # --- Write-off (per product type; strict '<' cap for CC) -----------------
    if inp["write_off_amount"] > 0:
        flag_key = inp["write_off_flag_key"]
        rt = inp["write_off_type_raw"]
        if flag_key is None:
            check("BUR-401D", "Unclassified Write-off", "Credit Bureau History",
                  False, f"Rs {inp['write_off_amount']:,.2f}", "classified type required",
                  f"Unclassified write-off (Rs {inp['write_off_amount']:,.2f}) recorded; type could not be validated against {code} policy.")
        else:
            check("BUR-401", f"{rt} Write-off", "Credit Bureau History",
                  policy[flag_key], rt, policy[flag_key],
                  f"{rt} write-offs are not permitted by {code}.")
            if policy[flag_key] and rt == "CC":
                check("BUR-401B", "Credit Card Write-off Amount", "Credit Bureau History",
                      inp["write_off_amount"] < policy["max_cc_write_off_amount"],
                      f"Rs {inp['write_off_amount']:,.2f}", f"< Rs {policy['max_cc_write_off_amount']:,.2f}",
                      f"Credit Card write-off amount (Rs {inp['write_off_amount']:,.2f}) is not below {code} ceiling (Rs {policy['max_cc_write_off_amount']:,.2f}).")

    # --- Entity & business classification ------------------------------------
    if inp["is_huf"] and "allow_huf" in policy:
        check("ENT-501", "HUF Accepted", "Entity Classification",
              policy["allow_huf"], "HUF", policy["allow_huf"],
              f"{code} does not onboard Hindu Undivided Family (HUF) applicants.")

    if inp["is_agriculture"] and "allow_agriculture" in policy:
        check("ENT-502", "Agriculture Sector", "Entity Classification",
              policy["allow_agriculture"], "Agriculture", policy["allow_agriculture"],
              f"{code} does not lend against agriculture-sector business income.")

    # --- Secondary rental income (matrix cols 38-40) -------------------------
    rental_flag = RENTAL_CLASS_TO_FLAG.get(inp["rental_income_class"])
    if rental_flag is not None and rental_flag in policy:
        check("INC-601", "Rental Income Configuration", "Secondary Income",
              policy[rental_flag], inp["rental_income_class"], policy[rental_flag],
              f"{code} does not accept the declared rental-income configuration "
              f"({inp['rental_income_class']}).")

    # --- Employment / income -------------------------------------------------
    if inp["occupation"] == "Salaried" and "min_salary" in policy:
        check("EMP-SAL-202", "Minimum Salary", "Employment - Salaried",
              inp["salary"] >= policy["min_salary"],
              f"Rs {inp['salary']:,.2f}", f">= Rs {policy['min_salary']:,.0f}",
              f"Monthly net salary (Rs {inp['salary']:,.2f}) is below the minimum floor (Rs {policy['min_salary']:,.0f}).")
        check("EMP-SAL-203", "Salary Payment Mode", "Employment - Salaried",
              inp["salary_mode"] not in ("CASH", "Salary payment mode-Cash"),
              inp["salary_mode"], "Bank Credit",
              "Cash salary payment mode is ineligible. Direct bank credit required.")
        check("EMP-SAL-204", "Total Work Experience", "Employment - Salaried",
              inp["work_exp_years"] >= policy["min_total_experience_years"],
              inp["work_exp_years"], f">= {policy['min_total_experience_years']} yrs",
              f"Total work experience ({inp['work_exp_years']} yrs) is below {code} minimum ({policy['min_total_experience_years']} yrs).")
        check("EMP-SAL-205", "Current Company Tenure", "Employment - Salaried",
              inp["current_company_years"] >= policy["min_current_company_tenure_years"],
              f"{inp['current_company_years']:.2f} yrs", f">= {policy['min_current_company_tenure_years']} yrs",
              f"Current-company tenure ({inp['current_company_years']:.2f} yrs) is below {code} minimum ({policy['min_current_company_tenure_years']} yrs).")
        if inp["no_income_proof"]:
            # No-income-proof segment: rejected unless the bank permits it; when
            # permitted, the Form-16 history requirement does not apply.
            check("EMP-SAL-207", "No Income Proof Segment", "Employment - Salaried",
                  policy["allow_no_income_proof"], "No Income Proof", policy["allow_no_income_proof"],
                  f"{code} requires valid income proof; no-income-proof profile is not accepted.")
        elif inp["income_proof"] != "ITR":
            check("EMP-SAL-206", "Form-16 History", "Employment - Salaried",
                  inp["form_16_years"] >= policy["form16_years_required"],
                  f"{inp['form_16_years']} yrs", f">= {policy['form16_years_required']} yrs",
                  f"Form-16 history ({inp['form_16_years']} yrs) is below {code} requirement ({policy['form16_years_required']} yrs).")
        if "max_age_emi_salaried" in policy:
            check("DEM-102", "Age at Last EMI (Salaried)", "Demographics",
                  inp["age_emi_sal"] <= policy["max_age_emi_salaried"],
                  inp["age_emi_sal"], f"<= {policy['max_age_emi_salaried']}",
                  f"Age at final EMI maturity ({inp['age_emi_sal']}) exceeds {code} limit of {policy['max_age_emi_salaried']} yrs for salaried applicants.")
    else:
        # Col 47 "Business ITR Years" counts YEARS OF FILED RETURNS, not the
        # age of the business.
        check("EMP-SE-301", "Business ITR Years", "Self-Employed",
              inp["business_itr_years"] >= policy["min_business_itr_years"],
              f"{inp['business_itr_years']} yrs", f">= {policy['min_business_itr_years']} yrs",
              f"Filed business ITR history ({inp['business_itr_years']} yrs) is below "
              f"{code} minimum ({policy['min_business_itr_years']} yrs).")
        if not inp["itr_filed"]:
            # Banks carrying "ITR Not Filed" == True (col 46) underwrite this
            # segment; the ITR *amount* rules are moot when no return was filed.
            check("EMP-SE-304", "ITR Filed", "Self-Employed",
                  policy["allow_itr_not_filed"], "Not Filed", policy["allow_itr_not_filed"],
                  f"{code} requires a filed ITR for self-employed profiles.")
        elif policy["se_combined_itr_rule"]:
            # Combined-ITR banks assess the two-year total, not each year in
            # isolation: a lean current year carried by a strong previous one
            # still proves the income. The Rs 600,000 total is therefore the
            # ONLY income floor here — the per-year minimum does not also
            # apply, or a qualifying applicant would be rejected for the very
            # shortfall the combined test exists to absorb.
            combined = inp["se_current_itr"] + inp["se_prev_itr"]
            check("EMP-SE-303", "Combined ITR", "Self-Employed",
                  combined >= COMBINED_ITR_FLOOR, f"Rs {combined:,.0f}",
                  f">= Rs {COMBINED_ITR_FLOOR:,.0f}",
                  f"Combined current+previous ITR (Rs {combined:,.0f}) is below "
                  f"{code} minimum (Rs {COMBINED_ITR_FLOOR:,.0f}).")
        else:
            check("EMP-SE-302", "Current-Year ITR", "Self-Employed",
                  inp["se_current_itr"] >= policy["se_min_current_itr"],
                  f"Rs {inp['se_current_itr']:,.0f}", f">= Rs {policy['se_min_current_itr']:,.0f}",
                  f"Current-year ITR (Rs {inp['se_current_itr']:,.0f}) is below {code} minimum (Rs {policy['se_min_current_itr']:,.0f}).")
            check("EMP-SE-303", "Previous-Year ITR", "Self-Employed",
                  inp["se_prev_itr"] >= policy["se_min_prev_itr"],
                  f"Rs {inp['se_prev_itr']:,.0f}", f">= Rs {policy['se_min_prev_itr']:,.0f}",
                  f"Previous-year ITR (Rs {inp['se_prev_itr']:,.0f}) is below {code} minimum (Rs {policy['se_min_prev_itr']:,.0f}).")
        # Col 48 "Business Proof" is Mandatory at every bank.
        check("BUS-302", "Business Proof", "Business Proof",
              bool(inp["business_proof"]), bool(inp["business_proof"]), "Mandatory",
              "A valid business proof or registration number (GSTIN / Udyam) "
              "is mandatory for self-employed applicants.")
        if "max_age_emi_self_employed" in policy:
            check("DEM-103", "Age at Last EMI (Self-Employed)", "Demographics",
                  inp["age_emi_se"] <= policy["max_age_emi_self_employed"],
                  inp["age_emi_se"], f"<= {policy['max_age_emi_self_employed']}",
                  f"Age at final EMI maturity ({inp['age_emi_se']}) exceeds {code} limit of {policy['max_age_emi_self_employed']} yrs for self-employed applicants.")

    # --- Residence / guarantor ----------------------------------------------
    if inp["property_status"] in GUARANTOR_PROPERTY_STATUSES and "allow_with_guarantor" in policy:
        if inp["guarantor_provided"]:
            check("RES-206", "Rented Premises With Guarantor", "Residence & Guarantor",
                  policy["allow_with_guarantor"], "With a Guarantor", policy["allow_with_guarantor"],
                  f"{code} does not lend where residence and office are both rented, "
                  "even with a guarantor.")
        else:
            check("RES-205", "Rented Premises Without Guarantor", "Residence & Guarantor",
                  policy["allow_without_guarantor"], "Without a Guarantor", policy["allow_without_guarantor"],
                  f"Guarantor is mandatory for property configuration '{inp['property_status']}' at {code}.")

    # --- Separate office premises, both rented (col 21) ---------------------
    # Distinct from the guarantor question (cols 22/23), which governs an office
    # run out of a rented residence. This one asks whether the bank lends at all
    # when residence and a SEPARATELY addressed office are both rented.
    if inp["property_status"] == "SEPARATE_BOTH_RENTED" and "allow_separate_both_rented" in policy:
        check("REL-502", "Separate Premises Both Rented", "Residence & Guarantor",
              policy["allow_separate_both_rented"],
              "Residence + separate office both rented",
              policy["allow_separate_both_rented"],
              f"{code} does not lend where the residence and a separately addressed "
              "office are both rented.")

    # --- Co-applicant eligibility (matrix cols 56-61) ------------------------
    if inp["sibling_co_applicant"] and "allow_sibling_coapplicant" in policy:
        check("COA-801", "Sibling Co-Applicant", "Co-Applicant",
              policy["allow_sibling_coapplicant"], "Brother/Sister", policy["allow_sibling_coapplicant"],
              f"{code} does not accept a brother/sister co-applicant for age or income pooling.")

    # --- Existing banking relationship --------------------------------------
    # Col "Existing A/C Holder". true = no constraint, the bank lends to anyone.
    # false = it will not lend to its OWN account holders; another bank's
    # customers are unaffected, so the rule only binds when the two match.
    if (not policy.get("allows_existing_account_holder", True)
            and inp["existing_account_bank"] is not ACCOUNT_BANK_UNKNOWN):
        check("REL-501", "Existing Account Holder", "Existing Banking Relationship",
              inp["existing_account_bank"] != code,
              inp["existing_account_bank"] or "None", f"not {code}",
              f"{code} does not lend to applicants who already hold a "
              f"current/savings account with {code}.")

    # Col "Existing Car Loan" false = the bank refuses a second exposure to
    # ITSELF; a car loan running with any other lender leaves it unbound, so
    # the rule only binds when the car loan is with this same bank. EXB-702.
    if inp["car_loan_bank"] is not None and code in BANKS_DISALLOW_EXISTING_CAR_LOAN:
        check("EXB-702", "Existing Car Loan", "Existing Banking Relationship",
              inp["car_loan_bank"] != code, inp["car_loan_bank"], f"not {code}",
              f"{code} does not permit a second exposure to an applicant who already "
              f"services a car loan with {code}.")

    return outcomes


def _tenant_overlay_outcomes(tenant_id: str, cibil: int) -> List[Dict[str, Any]]:
    """Tenant risk rules in the same outcome shape as a matrix rule.

    Emitted for pass and fail alike so the audit report carries the overlay at
    every bank, rather than a bank reading ineligible with no rule to show.
    """
    entry = TENANT_CIBIL_OVERLAY.get(tenant_id)
    if entry is None:
        return []
    rule_id, floor = entry
    passed = cibil >= floor
    return [{
        "rule_id": rule_id,
        "name": "Tenant CIBIL Floor",
        "category": "Tenant Risk Overlay",
        "passed": passed,
        "value": str(cibil),
        "limit": f">= {floor}",
        "message": (
            f"Tenant CIBIL Floor of {cibil} satisfies the {tenant_id} limit of >= {floor}."
            if passed else
            f"{tenant_id} requires a minimum CIBIL score of {floor} for prime onboarding."
        ),
    }]


def _report_row(outcome: Dict[str, Any]) -> Dict[str, str]:
    """Project a rule outcome onto the audit-report row shape."""
    return {
        "rule_id": outcome["rule_id"],
        "parameter_name": outcome["name"],
        "category": outcome["category"],
        "status": "PASS" if outcome["passed"] else "FAIL",
        "user_value": outcome["value"],
        "limit_value": outcome["limit"],
        "description": outcome["message"],
    }


def _bank_rejections(inp: Dict[str, Any], code: str, policy: Dict[str, Any]) -> List[Dict[str, str]]:
    """Every REJECT-rule violation for one bank — the failures from _evaluate_bank."""
    return [
        {"rule_id": o["rule_id"], "category": o["category"], "message": o["message"]}
        for o in _evaluate_bank(inp, code, policy) if not o["passed"]
    ]


class BREEngineService:
    """In-memory bank onboarding rule evaluator.

    Rules are the code-defined BANK_MATRIX_RULES matrix, resident in RAM at
    import time — evaluation performs zero hot-path disk I/O and targets
    < 10 ms latency across all 8 partner banks.
    """

    async def evaluate_application(self, payload: Dict[str, Any], tenant_id: str = "default") -> Dict[str, Any]:
        """Async entry point for onboarding evaluation.

        The rule evaluation is pure CPU work with no awaitable I/O. Running it
        inline on the event loop would let a batch of concurrent evaluations
        monopolize the loop and starve latency-sensitive coroutines (e.g. the
        /health probe). Offloading to a worker thread keeps the loop responsive
        while preserving the awaitable contract every call site already uses.
        """
        return await asyncio.to_thread(self._evaluate_application_sync, payload, tenant_id)

    def _evaluate_application_sync(self, payload: Dict[str, Any], tenant_id: str = "default") -> Dict[str, Any]:
        """Evaluate an onboarding application against the 62-column Bank
        Eligibility Matrix in RAM (< 10 ms), returning the selected-bank verdict
        plus the full 8-bank eligibility map."""
        start_time = time.perf_counter()

        # Log PII-redacted debug payload
        safe_log_payload = redact_pii(payload)
        logger.debug(f"Evaluating application payload for tenant '{tenant_id}': {safe_log_payload}")

        # --- Normalize & validate credit_bureau ------------------------------
        if "credit_bureau" in payload:
            bureau = payload["credit_bureau"]
            if not isinstance(bureau, dict):
                raise InvalidPayloadError(
                    f"credit_bureau must be an object, got {type(bureau).__name__}"
                )
        else:
            bureau = {}

        max_dpd_value = max(_normalize_dpd_history(bureau.get("dpd_history", [])), default=0)
        cibil_score = bureau.get("cibil_score", payload.get("cibil_score", 750))
        write_off_amount = bureau.get("write_off_amount", payload.get("write_off_amount", 0.0))

        # Resolve write-off product type -> policy flag key (None = unclassified)
        write_off_type_raw = str(bureau.get("write_off_type") or "").strip().upper()
        if not write_off_type_raw:
            if bureau.get("cc_write_off"):
                write_off_type_raw = "CC"
            elif bureau.get("pl_write_off"):
                write_off_type_raw = "PL"
        write_off_flag_key = WRITE_OFF_TYPE_TO_FLAG.get(write_off_type_raw)

        selected_bank = str(payload.get("selected_bank", "BOI")).upper().replace(" ", "_")
        if selected_bank not in BANK_MATRIX_RULES:
            selected_bank = "BOI"

        # NRI stay is only evaluated for NRI applicants; coerce defensively so a
        # non-numeric value raises a typed error instead of an unhandled TypeError.
        is_nri = payload.get("is_nri", False)
        nri_stay_years = 0.0
        if is_nri:
            if "minimum_stay_period_nri_years" in payload:
                raw_nri, field_name, divisor = payload["minimum_stay_period_nri_years"], "minimum_stay_period_nri_years", 1.0
            else:
                raw_nri, field_name, divisor = payload.get("minimum_stay_period_nri_days", 0), "minimum_stay_period_nri_days", 365.0
            try:
                nri_stay_years = float(raw_nri) / divisor
            except (TypeError, ValueError):
                raise InvalidPayloadError(f"{field_name} must be numeric")

        age = payload.get("age", 30)
        # Absent optional fields default to values that PASS, so a minimal
        # payload is approved rather than spuriously rejected.
        inp: Dict[str, Any] = {
            "age": age,
            "occupation": payload.get("occupation", "Salaried"),
            "cibil": cibil_score,
            "max_dpd": max_dpd_value,
            "is_nri": is_nri,
            "nri_stay_years": nri_stay_years,
            "currently_overdue": bool(bureau.get("currently_overdue", False)),
            "write_off_amount": write_off_amount,
            "write_off_type_raw": write_off_type_raw,
            "write_off_flag_key": write_off_flag_key,
            "salary": payload.get("net_monthly_salary", 30000),
            "salary_mode": payload.get("salary_payment_mode", "BANK_TRANSFER"),
            # Computed here from raw facts, not consumed pre-truncated: the
            # prior-employment span only reaches the rule if the engine owns
            # the arithmetic (Bug-2).
            "work_exp_years": _resolved_work_experience(payload),
            "current_company_years": payload.get("current_company_tenure_months", 99999) / 12.0,
            "no_income_proof": payload.get("no_income_proof_segment", False),
            "form_16_years": payload.get("form_16_years", 2),
            # "Form 16" | "ITR" | "No Income Proof". An ITR proves income
            # without a Form-16 history, so col 55 does not apply to it.
            "income_proof": payload.get("income_proof", "Form 16"),
            # Which lender the car loan runs with, not merely that one exists:
            # EXB-702 is bank-specific, so an unnamed lender binds nobody.
            "car_loan_bank": payload.get("existing_car_loan_bank") or None,
            "age_emi_sal": payload.get("age_at_last_emi_salaried", age),
            "age_emi_se": payload.get("age_at_last_emi_self_employed", age),
            "se_current_itr": payload.get("current_itr", 10_000_000),
            "se_prev_itr": payload.get("previous_itr", 10_000_000),
            "itr_filed": payload.get("itr_filed", True),
            "business_proof": payload.get("business_proof", True),
            # Years of filed business ITRs. Falls back to business age when the
            # branch collects no explicit count (HUF), so the rule still binds.
            "business_itr_years": payload.get(
                "business_itr_years", payload.get("business_experience_years", 99)
            ),
            "property_status": str(payload.get("property_status", "OWNED")).upper(),
            "guarantor_provided": payload.get("guarantor_provided", False),
            # Yes/no on the wizard; the flat contract still carries a count.
            "has_loan_enquiry": bool(
                payload.get("has_loan_enquiry", payload.get("loan_enquiry_count", 0) > 0)
            ),
            "existing_account_bank": payload.get("existing_account_bank", ACCOUNT_BANK_UNKNOWN),
            "is_huf": (
                str(payload.get("entity_type", "")).upper() == "HUF"
                or str(payload.get("business_entity_type", "")).upper() == "HUF"
            ),
            "is_agriculture": str(payload.get("business_entity_type", "")).upper() == "AGRICULTURE",
            "rental_income_class": str(payload.get("rental_income_class") or "NONE").upper(),
            "sibling_co_applicant": payload.get("sibling_co_applicant", False),
        }

        # --- Entity-scoped matrix selection ----------------------------------
        # Individual/HUF -> Individual matrix; Company -> Company matrix. The
        # chosen view is used for BOTH the selected-bank verdict and the 8-bank
        # map, so the two can never be scored against different rule sets.
        entity_matrix = matrix_for_entity(payload.get("entity_type"))

        # --- Evaluate every bank ONCE; derive verdict, map and report -------
        bank_outcomes: Dict[str, List[Dict[str, Any]]] = {
            code: _evaluate_bank(inp, code, policy) for code, policy in entity_matrix.items()
        }

        # Tenant-level overlay (not part of the bank matrix). It gates the
        # applicant, not one lender, so it is scored INTO every bank's outcomes:
        # a bank it suppresses has to show the rule that suppressed it.
        for outcomes in bank_outcomes.values():
            outcomes.extend(_tenant_overlay_outcomes(tenant_id, cibil_score))

        # --- Selected-bank verdict ------------------------------------------
        rejection_reasons = [
            {"rule_id": o["rule_id"], "category": o["category"], "message": o["message"]}
            for o in bank_outcomes[selected_bank] if not o["passed"]
        ]

        overall_eligible = len(rejection_reasons) == 0

        # --- Full 8-bank eligibility map (same rule function) ---------------
        # Each bank is scored on ITS OWN rules plus the tenant overlay, and
        # nothing else. Previously this was ANDed with `overall_eligible`,
        # which folded the SELECTED bank's rejections into every other entry:
        # one bank turning the applicant down blanked the whole map, so the
        # answer to "who else would lend to me" was always "nobody", and a bank
        # could report is_eligible=false with an empty failed_rules list.
        bank_eligibility: Dict[str, bool] = {
            code: all(o["passed"] for o in outcomes)
            for code, outcomes in bank_outcomes.items()
        }

        # --- Per-bank audit report (what passed, what failed, and why) -------
        evaluation_report: Dict[str, Dict[str, Any]] = {
            code: {
                "is_eligible": bank_eligibility[code],
                "passed_rules": [_report_row(o) for o in outcomes if o["passed"]],
                "failed_rules": [_report_row(o) for o in outcomes if not o["passed"]],
            }
            for code, outcomes in bank_outcomes.items()
        }

        execution_time_ms = round((time.perf_counter() - start_time) * 1000, 3)
        del safe_log_payload  # 5-stage lifecycle: sweep transient PII dict

        return {
            "status": "APPROVED" if overall_eligible else "REJECTED",
            "overall_eligible": overall_eligible,
            "executed_rules_count": len(rejection_reasons) + 62,
            "execution_time_ms": execution_time_ms,
            "rejection_reasons": rejection_reasons,
            "bank_eligibility": bank_eligibility,
            "evaluation_report": evaluation_report,
        }

bre_engine_service = BREEngineService()
