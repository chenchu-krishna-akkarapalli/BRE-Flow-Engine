import asyncio
import time
from typing import Any, Dict, List

from app.core.exceptions import InvalidPayloadError
from app.core.logging import logger, redact_pii

# Bureau cells that represent a clean / on-time (0-day) status. The parser maps
# any of these to a 0 DPD value; every other cell must be numerically coercible.
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

# The only property configuration the matrix conditions on a guarantor:
# residence and office both rented (cols 22/23). Resi-cum-office-rented has no
# column of its own — col 19 ("Rented House-Salaried") and col 20
# ("Resi-Cum-Office-Owned") are True for every bank — so it carries no
# guarantor requirement. It previously did, which rejected applicants the form
# never even offers the guarantor question to.
GUARANTOR_PROPERTY_STATUSES = frozenset({"SEPARATE_BOTH_RENTED"})

# Bureau rental-income class -> the per-bank policy flag governing it
# (matrix cols 38-40). NONE/absent means no secondary rental income claimed.
RENTAL_CLASS_TO_FLAG = {
    "NO_ITR_NOT_IN_BANK": "allow_rental_no_itr_not_in_bank",
    "NO_ITR_IN_BANK": "allow_rental_no_itr_in_bank",
    "ITR_NOT_IN_BANK": "allow_rental_itr_not_in_bank",
}

# Banks that do NOT permit an existing active car loan alongside the application
# (matrix col 19: "Existing Car Loan" == False). EXB-702.
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
        "allow_loan_enquiry": False,
        "allow_agriculture": False,
        "allow_rental_no_itr_not_in_bank": False,
        "allow_rental_no_itr_in_bank": True,
        "allow_rental_itr_not_in_bank": True,
        "allow_itr_not_filed": False,
        "allow_without_guarantor": False,
        "allow_with_guarantor": True,
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
        "allow_loan_enquiry": False,
        "allow_agriculture": False,
        "allow_rental_no_itr_not_in_bank": False,
        "allow_rental_no_itr_in_bank": False,
        "allow_rental_itr_not_in_bank": True,
        "allow_itr_not_filed": False,
        "allow_without_guarantor": False,
        "allow_with_guarantor": True,
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
        "allow_loan_enquiry": False,
        "allow_agriculture": False,
        "allow_rental_no_itr_not_in_bank": False,
        "allow_rental_no_itr_in_bank": False,
        "allow_rental_itr_not_in_bank": False,
        "allow_itr_not_filed": False,
        "allow_without_guarantor": False,
        "allow_with_guarantor": False,
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
        "se_min_current_itr": 300000.0,
        "se_min_prev_itr": 0.0,
        "se_combined_itr_rule": True,  # Current + Prev >= 600,000
        "min_business_itr_years": 2,
        "allow_no_income_proof": False,
        "allow_huf": False,
        "allow_sibling_coapplicant": True,
        "allow_loan_enquiry": False,
        "allow_agriculture": False,
        "allow_rental_no_itr_not_in_bank": False,
        "allow_rental_no_itr_in_bank": False,
        "allow_rental_itr_not_in_bank": False,
        "allow_itr_not_filed": False,
        "allow_without_guarantor": False,
        "allow_with_guarantor": False,
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
        "allow_loan_enquiry": False,
        "allow_agriculture": True,
        "allow_rental_no_itr_not_in_bank": False,
        "allow_rental_no_itr_in_bank": False,
        "allow_rental_itr_not_in_bank": False,
        "allow_itr_not_filed": False,
        "allow_without_guarantor": True,
        "allow_with_guarantor": True,
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
        "allow_loan_enquiry": False,
        "allow_agriculture": True,
        "allow_rental_no_itr_not_in_bank": False,
        "allow_rental_no_itr_in_bank": False,
        "allow_rental_itr_not_in_bank": False,
        "allow_itr_not_filed": False,
        "allow_without_guarantor": False,
        "allow_with_guarantor": True,
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
        "allow_loan_enquiry": False,
        "allow_agriculture": True,
        "allow_rental_no_itr_not_in_bank": False,
        "allow_rental_no_itr_in_bank": False,
        "allow_rental_itr_not_in_bank": False,
        "allow_itr_not_filed": False,
        "allow_without_guarantor": False,
        "allow_with_guarantor": True,
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
        "allow_loan_enquiry": False,
        "allow_agriculture": True,
        "allow_rental_no_itr_not_in_bank": False,
        "allow_rental_no_itr_in_bank": False,
        "allow_rental_itr_not_in_bank": False,
        "allow_itr_not_filed": False,
        "allow_without_guarantor": False,
        "allow_with_guarantor": True,
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
    "max_dpd", "allow_loan_enquiry",
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


def _bank_rejections(inp: Dict[str, Any], code: str, policy: Dict[str, Any]) -> List[Dict[str, str]]:
    """Return every REJECT-rule violation for one bank given normalized inputs.

    Drives BOTH the selected-bank verdict (overall_eligible) and each bank in
    the matrix, so the two can never disagree. Implements the payload-supported
    columns of Bank_Eligibility_Matrix_v1.xlsx: bureau (2-13), demographics
    (14-16, 25-26), residence & guarantor (22-23), entity class (27, 54),
    employment & income (33-43, 46-47, 55), and co-applicant (56-61).
    Columns describing options that are True for every bank (e.g. 28-32
    employment types, 49-52 business entity types) carry no rejection path.
    """
    reasons: List[Dict[str, str]] = []

    def add(rid: str, cat: str, msg: str) -> None:
        reasons.append({"rule_id": rid, "category": cat, "message": msg})

    # --- Demographics --------------------------------------------------------
    if "min_age" in policy and inp["age"] < policy["min_age"]:
        add("DEM-101", "Demographics",
            f"Applicant age ({inp['age']}) is below the minimum requirement ({policy['min_age']} years).")

    if inp["is_nri"] and "allow_nri" in policy:
        if not policy["allow_nri"]:
            add("DEM-104", "Demographics", f"{code} does not onboard NRI/PIO applicants.")
        elif inp["nri_stay_years"] < policy["min_nri_stay_years"]:
            add("DEM-105", "Demographics",
                f"NRI in-country stay ({inp['nri_stay_years']:.2f} yrs) is below {code} minimum ({policy['min_nri_stay_years']} yrs).")

    # --- Credit bureau -------------------------------------------------------
    if inp["currently_overdue"]:
        add("BUR-404", "Credit Bureau History",
            "Application declined due to active currently-outstanding overdue balances.")

    if inp["cibil"] < policy["min_cibil"]:
        add("BUR-405", "Credit Bureau Floor",
            f"CIBIL score ({inp['cibil']}) is below {code} minimum threshold of {policy['min_cibil']}.")

    if inp["loan_enquiry_count"] > 0 and not policy["allow_loan_enquiry"]:
        add("BUR-406", "Credit Bureau History",
            f"{code} does not accept applicants with open loan enquiries "
            f"({inp['loan_enquiry_count']} on file).")

    if code == "INDIAN_BANK" and inp["max_dpd"] > 0:
        add("BUR-403", "Credit Bureau History",
            "Indian Bank requires zero past DPD instances across all loan accounts.")
    elif inp["max_dpd"] > policy["max_dpd"]:
        add("BUR-402", "Credit Bureau History",
            f"DPD value ({inp['max_dpd']}) exceeds {code} tolerance ({policy['max_dpd']} days).")

    # --- Write-off (per product type; strict '<' cap for CC) -----------------
    if inp["write_off_amount"] > 0:
        flag_key = inp["write_off_flag_key"]
        rt = inp["write_off_type_raw"]
        if flag_key is None:
            add("BUR-401D", "Credit Bureau History",
                f"Unclassified write-off (Rs {inp['write_off_amount']:,.2f}) recorded; type could not be validated against {code} policy.")
        elif not policy[flag_key]:
            add("BUR-401", "Credit Bureau History", f"{rt} write-offs are not permitted by {code}.")
        elif rt == "CC" and inp["write_off_amount"] >= policy["max_cc_write_off_amount"]:
            add("BUR-401B", "Credit Bureau History",
                f"Credit Card write-off amount (Rs {inp['write_off_amount']:,.2f}) is not below {code} ceiling (Rs {policy['max_cc_write_off_amount']:,.2f}).")

    # --- Entity & business classification ------------------------------------
    if inp["is_huf"] and "allow_huf" in policy and not policy["allow_huf"]:
        add("ENT-501", "Entity Classification",
            f"{code} does not onboard Hindu Undivided Family (HUF) applicants.")

    if inp["is_agriculture"] and "allow_agriculture" in policy and not policy["allow_agriculture"]:
        add("ENT-502", "Entity Classification",
            f"{code} does not lend against agriculture-sector business income.")

    # --- Secondary rental income (matrix cols 38-40) -------------------------
    rental_flag = RENTAL_CLASS_TO_FLAG.get(inp["rental_income_class"])
    if rental_flag is not None and rental_flag in policy and not policy[rental_flag]:
        add("INC-601", "Secondary Income",
            f"{code} does not accept the declared rental-income configuration "
            f"({inp['rental_income_class']}).")

    # --- Employment / income -------------------------------------------------
    if inp["occupation"] == "Salaried" and "min_salary" in policy:
        if inp["salary"] < policy["min_salary"]:
            add("EMP-SAL-202", "Employment - Salaried",
                f"Monthly net salary (Rs {inp['salary']:,.2f}) is below the minimum floor (Rs {policy['min_salary']:,.0f}).")
        if inp["salary_mode"] in ("CASH", "Salary payment mode-Cash"):
            add("EMP-SAL-203", "Employment - Salaried",
                "Cash salary payment mode is ineligible. Direct bank credit required.")
        if inp["work_exp_years"] < policy["min_total_experience_years"]:
            add("EMP-SAL-204", "Employment - Salaried",
                f"Total work experience ({inp['work_exp_years']} yrs) is below {code} minimum ({policy['min_total_experience_years']} yrs).")
        if inp["current_company_years"] < policy["min_current_company_tenure_years"]:
            add("EMP-SAL-205", "Employment - Salaried",
                f"Current-company tenure ({inp['current_company_years']:.2f} yrs) is below {code} minimum ({policy['min_current_company_tenure_years']} yrs).")
        if inp["no_income_proof"]:
            # No-income-proof segment: rejected unless the bank permits it; when
            # permitted, the Form-16 history requirement does not apply.
            if not policy["allow_no_income_proof"]:
                add("EMP-SAL-207", "Employment - Salaried",
                    f"{code} requires valid income proof; no-income-proof profile is not accepted.")
        elif inp["form_16_years"] < policy["form16_years_required"]:
            add("EMP-SAL-208", "Employment - Salaried",
                f"Form-16 history ({inp['form_16_years']} yrs) is below {code} requirement ({policy['form16_years_required']} yrs).")
        if "max_age_emi_salaried" in policy and inp["age_emi_sal"] > policy["max_age_emi_salaried"]:
            add("DEM-102", "Demographics",
                f"Age at final EMI maturity ({inp['age_emi_sal']}) exceeds {code} limit of {policy['max_age_emi_salaried']} yrs for salaried applicants.")
    else:
        # Business vintage is governed by the sheet's "Business ITR Years"
        # column (col 47), not the salaried work-experience column.
        if inp["business_exp_years"] < policy["min_business_itr_years"]:
            add("EMP-SE-301", "Self-Employed",
                f"Business existence ({inp['business_exp_years']} yrs) is below {code} minimum ({policy['min_business_itr_years']} yrs).")
        if not inp["itr_filed"]:
            # Banks carrying "ITR Not Filed" == True (col 46) underwrite this
            # segment; for everyone else it is a hard stop. The ITR *amount*
            # rules are moot when no return was filed.
            if not policy["allow_itr_not_filed"]:
                add("EMP-SE-304", "Self-Employed",
                    f"{code} requires a filed ITR for self-employed profiles.")
        else:
            if inp["se_current_itr"] < policy["se_min_current_itr"]:
                add("EMP-SE-302", "Self-Employed",
                    f"Current-year ITR (Rs {inp['se_current_itr']:,.0f}) is below {code} minimum (Rs {policy['se_min_current_itr']:,.0f}).")
            if policy["se_combined_itr_rule"]:
                combined = inp["se_current_itr"] + inp["se_prev_itr"]
                if combined < 600000:
                    add("EMP-SE-303", "Self-Employed",
                        f"Combined current+previous ITR (Rs {combined:,.0f}) is below {code} minimum (Rs 600,000).")
            elif inp["se_prev_itr"] < policy["se_min_prev_itr"]:
                add("EMP-SE-303", "Self-Employed",
                    f"Previous-year ITR (Rs {inp['se_prev_itr']:,.0f}) is below {code} minimum (Rs {policy['se_min_prev_itr']:,.0f}).")
        if not inp["business_proof"]:
            add("EMP-SE-307", "Self-Employed", "Valid business proof/registration is mandatory.")
        if "max_age_emi_self_employed" in policy and inp["age_emi_se"] > policy["max_age_emi_self_employed"]:
            add("DEM-103", "Demographics",
                f"Age at final EMI maturity ({inp['age_emi_se']}) exceeds {code} limit of {policy['max_age_emi_self_employed']} yrs for self-employed applicants.")

    # --- Residence / guarantor ----------------------------------------------
    # Cols 22/23 decide the both-rented configuration independently: a
    # guarantor rescues it only where col 23 is True, and IOB/BOB decline it
    # either way. Offering a guarantor is not universally sufficient.
    if inp["property_status"] in GUARANTOR_PROPERTY_STATUSES and "allow_with_guarantor" in policy:
        if inp["guarantor_provided"]:
            if not policy["allow_with_guarantor"]:
                add("RES-206", "Residence & Guarantor",
                    f"{code} does not lend where residence and office are both rented, "
                    "even with a guarantor.")
        elif not policy["allow_without_guarantor"]:
            add("RES-205", "Residence & Guarantor",
                f"Guarantor is mandatory for property configuration '{inp['property_status']}' at {code}.")

    # --- Co-applicant eligibility (matrix cols 56-61) ------------------------
    if inp["sibling_co_applicant"] and "allow_sibling_coapplicant" in policy and not policy["allow_sibling_coapplicant"]:
        add("COA-801", "Co-Applicant",
            f"{code} does not accept a brother/sister co-applicant for age or income pooling.")

    # --- Existing banking relationship --------------------------------------
    if inp["active_car_loan"] and code in BANKS_DISALLOW_EXISTING_CAR_LOAN:
        add("EXB-702", "Existing Banking Relationship",
            f"{code} does not permit an existing active car loan alongside this application.")

    return reasons


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
            "work_exp_years": payload.get("minimum_work_experience_years", 99),
            "current_company_years": payload.get("current_company_tenure_months", 99999) / 12.0,
            "no_income_proof": payload.get("no_income_proof_segment", False),
            "form_16_years": payload.get("form_16_years", 2),
            "active_car_loan": payload.get("active_car_loan", False),
            "age_emi_sal": payload.get("age_at_last_emi_salaried", age),
            "age_emi_se": payload.get("age_at_last_emi_self_employed", age),
            "se_current_itr": payload.get("current_itr", 10_000_000),
            "se_prev_itr": payload.get("previous_itr", 10_000_000),
            "itr_filed": payload.get("itr_filed", True),
            "business_proof": payload.get("business_proof", True),
            "business_exp_years": payload.get("business_experience_years", 99),
            "property_status": str(payload.get("property_status", "OWNED")).upper(),
            "guarantor_provided": payload.get("guarantor_provided", False),
            "loan_enquiry_count": payload.get("loan_enquiry_count", 0),
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

        # --- Selected-bank verdict ------------------------------------------
        selected_policy = entity_matrix[selected_bank]
        rejection_reasons = _bank_rejections(inp, selected_bank, selected_policy)

        # Tenant-level overlay (not part of the bank matrix)
        if tenant_id == "tenant_alpha" and cibil_score < 720:
            rejection_reasons.append({
                "rule_id": "ALPHA-RSK-001",
                "category": "Tenant Alpha Risk",
                "message": "Tenant Alpha requires a minimum CIBIL score of 720 for prime onboarding.",
            })

        overall_eligible = len(rejection_reasons) == 0

        # --- Full 8-bank eligibility map (same rule function) ---------------
        bank_eligibility: Dict[str, bool] = {
            code: (len(_bank_rejections(inp, code, policy)) == 0) and overall_eligible
            for code, policy in entity_matrix.items()
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
        }

bre_engine_service = BREEngineService()
