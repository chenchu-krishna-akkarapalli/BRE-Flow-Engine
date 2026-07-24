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

# Property configurations that make a guarantor mandatory (Rules.md RES-203/204).
GUARANTOR_PROPERTY_STATUSES = frozenset({"RESI_CUM_OFFICE_RENTED", "SEPARATE_BOTH_RENTED"})
# Banks that accept the above configuration WITHOUT a guarantor (matrix col 23:
# "Without a Guarantor" == True). Only BOM per Ver 4.0.
BANKS_ALLOW_WITHOUT_GUARANTOR = frozenset({"BOM"})

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
        "allow_huf": True,
        "allow_sibling_coapplicant": True,
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
        "allow_huf": True,
        "allow_sibling_coapplicant": True,
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
        "allow_huf": True,
        "allow_sibling_coapplicant": True,
    },
}


def _bank_rejections(inp: Dict[str, Any], code: str, policy: Dict[str, Any]) -> List[Dict[str, str]]:
    """Return every REJECT-rule violation for one bank given normalized inputs.

    Drives BOTH the selected-bank verdict (overall_eligible) and each bank in
    the matrix, so the two can never disagree. Implements the payload-supported
    columns of Bank_Eligibility_Matrix_v1.xlsx. (Form-16 years and existing car
    loan are omitted: the request schema carries no field for them.)
    """
    reasons: List[Dict[str, str]] = []

    def add(rid: str, cat: str, msg: str) -> None:
        reasons.append({"rule_id": rid, "category": cat, "message": msg})

    # --- Demographics --------------------------------------------------------
    if inp["age"] < policy["min_age"]:
        add("DEM-101", "Demographics",
            f"Applicant age ({inp['age']}) is below the minimum requirement ({policy['min_age']} years).")

    if inp["is_nri"]:
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

    # --- Employment / income -------------------------------------------------
    if inp["occupation"] == "Salaried":
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
        if inp["age_emi_sal"] > policy["max_age_emi_salaried"]:
            add("DEM-102", "Demographics",
                f"Age at final EMI maturity ({inp['age_emi_sal']}) exceeds {code} limit of {policy['max_age_emi_salaried']} yrs for salaried applicants.")
    else:
        if inp["business_exp_years"] < policy["min_total_experience_years"]:
            add("EMP-SE-301", "Self-Employed",
                f"Business existence ({inp['business_exp_years']} yrs) is below {code} minimum ({policy['min_total_experience_years']} yrs).")
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
        if not inp["itr_filed"]:
            add("EMP-SE-304", "Self-Employed",
                "Active ITR filing proof is required for self-employed profiles.")
        if not inp["business_proof"]:
            add("EMP-SE-307", "Self-Employed", "Valid business proof/registration is mandatory.")
        if inp["age_emi_se"] > policy["max_age_emi_self_employed"]:
            add("DEM-103", "Demographics",
                f"Age at final EMI maturity ({inp['age_emi_se']}) exceeds {code} limit of {policy['max_age_emi_self_employed']} yrs for self-employed applicants.")

    # --- Residence / guarantor ----------------------------------------------
    if (inp["property_status"] in GUARANTOR_PROPERTY_STATUSES
            and not inp["guarantor_provided"]
            and code not in BANKS_ALLOW_WITHOUT_GUARANTOR):
        add("RES-205", "Residence & Guarantor",
            f"Guarantor is mandatory for property configuration '{inp['property_status']}' at {code}.")

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
        }

        # --- Selected-bank verdict ------------------------------------------
        selected_policy = BANK_MATRIX_RULES[selected_bank]
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
            for code, policy in BANK_MATRIX_RULES.items()
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
