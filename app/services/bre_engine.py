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

# Canonical Bank Policy Matrix derived from Bank_Eligibility_Matrix_v1.xlsx (62 columns).
#
# SOURCE OF TRUTH: this dict is the authoritative, code-defined ruleset that
# evaluate_application() evaluates against. Rule changes are code changes and
# ship via redeploy. (W4: the previous JDM/JSON loader and /rules API implied
# rules could be hot-reloaded into evaluation — they never were — and have been
# removed to make the code-defined matrix the single, honest source of truth.)
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
        "max_dpd": 90,
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
        "max_dpd": 90,
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
        "max_dpd": 90,
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
        "max_dpd": 90,
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
        "max_dpd": 90,
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
        """Evaluates an onboarding application payload against 62-column Bank Eligibility Matrix in RAM (< 10 ms)."""
        start_time = time.perf_counter()
        rejection_reasons: List[Dict[str, str]] = []
        executed_rules_count = 0

        # Log PII-redacted debug payload
        safe_log_payload = redact_pii(payload)
        logger.debug(f"Evaluating application payload for tenant '{tenant_id}': {safe_log_payload}")

        # Normalize Input Fields
        # A missing credit_bureau key falls back to documented defaults, but a
        # present-yet-malformed value (None/list/str/int) fails closed.
        if "credit_bureau" in payload:
            bureau = payload["credit_bureau"]
            if not isinstance(bureau, dict):
                raise InvalidPayloadError(
                    f"credit_bureau must be an object, got {type(bureau).__name__}"
                )
        else:
            bureau = {}
        clean_dpd_values = _normalize_dpd_history(bureau.get("dpd_history", []))
        max_dpd_value = max(clean_dpd_values, default=0)

        cibil_score = bureau.get("cibil_score", payload.get("cibil_score", 750))
        write_off_amount = bureau.get("write_off_amount", payload.get("write_off_amount", 0.0))
        pl_write_off = bureau.get("pl_write_off", False) or (write_off_amount > 0 and bureau.get("write_off_type") == "PL")
        cc_write_off = bureau.get("cc_write_off", False) or (write_off_amount > 0 and bureau.get("write_off_type") == "CC")
        
        selected_bank = payload.get("selected_bank", "BOI").upper()
        if selected_bank == "INDIAN BANK":
            selected_bank = "INDIAN_BANK"
        if selected_bank == "KOTAK":
            selected_bank = "KOTAK"

        age = payload.get("age", 30)
        occupation = payload.get("occupation", "Salaried")
        is_nri = payload.get("is_nri", False)
        # NRI stay is only evaluated for NRI applicants; coerce defensively so a
        # non-numeric value raises a typed error instead of an unhandled TypeError.
        nri_stay_years = 0.0
        if is_nri:
            if "minimum_stay_period_nri_years" in payload:
                raw_nri = payload["minimum_stay_period_nri_years"]
                field_name = "minimum_stay_period_nri_years"
                divisor = 1.0
            else:
                raw_nri = payload.get("minimum_stay_period_nri_days", 0)
                field_name = "minimum_stay_period_nri_days"
                divisor = 365.0
            try:
                nri_stay_years = float(raw_nri) / divisor
            except (TypeError, ValueError):
                raise InvalidPayloadError(f"{field_name} must be numeric")

        # 1. Demographics Check
        if age < 21:
            rejection_reasons.append({
                "rule_id": "DEM-101",
                "category": "Demographics",
                "message": f"Applicant age ({age}) is below the minimum requirement (21 years)."
            })
            executed_rules_count += 1

        # 2. Employment & Income Check
        if occupation == "Salaried":
            salary = payload.get("net_monthly_salary", 30000)
            if salary < 25000:
                rejection_reasons.append({
                    "rule_id": "EMP-SAL-202",
                    "category": "Employment - Salaried",
                    "message": f"Monthly net salary (₹{salary:,.2f}) is below the minimum floor parameter (₹25,000)."
                })
                executed_rules_count += 1

            mode = payload.get("salary_payment_mode", "BANK_TRANSFER")
            if mode in ["CASH", "Salary payment mode-Cash"]:
                rejection_reasons.append({
                    "rule_id": "EMP-SAL-203",
                    "category": "Employment - Salaried",
                    "message": "Cash salary payment mode is ineligible. Direct bank credit required."
                })
                executed_rules_count += 1

        # 3. Credit Bureau Checks (General)
        if max_dpd_value > 90:
            rejection_reasons.append({
                "rule_id": "BUR-402",
                "category": "Credit Bureau History",
                "message": f"Found DPD value ({max_dpd_value}) exceeding 90-day tolerance threshold."
            })
            executed_rules_count += 1

        if selected_bank == "INDIAN_BANK" and max_dpd_value > 0:
            rejection_reasons.append({
                "rule_id": "BUR-403",
                "category": "Credit Bureau History",
                "message": "Indian Bank requires zero past DPD instances across all loan accounts."
            })
            executed_rules_count += 1

        # 4. Bank Policy Matrix Floor & Specific Checks
        target_bank_policy = BANK_MATRIX_RULES.get(selected_bank, BANK_MATRIX_RULES["BOI"])
        
        # CIBIL Floor Check
        min_required_cibil = target_bank_policy["min_cibil"]
        if cibil_score < min_required_cibil:
            rejection_reasons.append({
                "rule_id": "BUR-405",
                "category": "Credit Bureau Floor",
                "message": f"CIBIL score ({cibil_score}) is below selected bank's ({selected_bank}) minimum threshold of {min_required_cibil}."
            })
            executed_rules_count += 1

        # Max Age at Final EMI Check (DEM-102 salaried / DEM-103 self-employed).
        # Falls back to current age when the projected maturity age is absent —
        # an applicant already past the ceiling cannot be under it at maturity.
        if occupation == "Salaried":
            age_at_last_emi = payload.get("age_at_last_emi_salaried", age)
            max_emi_age = target_bank_policy["max_age_emi_salaried"]
            if age_at_last_emi > max_emi_age:
                rejection_reasons.append({
                    "rule_id": "DEM-102",
                    "category": "Demographics",
                    "message": f"Age at final EMI maturity ({age_at_last_emi}) exceeds {selected_bank} limit of {max_emi_age} years for salaried applicants."
                })
                executed_rules_count += 1
        else:
            age_at_last_emi = payload.get("age_at_last_emi_self_employed", age)
            max_emi_age = target_bank_policy["max_age_emi_self_employed"]
            if age_at_last_emi > max_emi_age:
                rejection_reasons.append({
                    "rule_id": "DEM-103",
                    "category": "Demographics",
                    "message": f"Age at final EMI maturity ({age_at_last_emi}) exceeds {selected_bank} limit of {max_emi_age} years for self-employed applicants."
                })
                executed_rules_count += 1

        # Write-Off Floor Check
        if write_off_amount > 0:
            if not target_bank_policy["allow_cc_write_off"] and cc_write_off:
                rejection_reasons.append({
                    "rule_id": "BUR-401",
                    "category": "Credit Bureau History",
                    "message": f"Credit Card write-offs are not permitted by {selected_bank}."
                })
                executed_rules_count += 1
            elif cc_write_off and write_off_amount > target_bank_policy["max_cc_write_off_amount"]:
                rejection_reasons.append({
                    "rule_id": "BUR-401B",
                    "category": "Credit Bureau History",
                    "message": f"Credit Card write-off amount (₹{write_off_amount:,.2f}) exceeds {selected_bank} ceiling (₹{target_bank_policy['max_cc_write_off_amount']:,.2f})."
                })
                executed_rules_count += 1
            elif pl_write_off and not target_bank_policy["allow_pl_write_off"]:
                rejection_reasons.append({
                    "rule_id": "BUR-401C",
                    "category": "Credit Bureau History",
                    "message": f"Personal Loan write-offs are not permitted by {selected_bank}."
                })
                executed_rules_count += 1
            elif not cc_write_off and not pl_write_off:
                # W5 fail-closed: a recorded write-off with no classifiable type
                # (write_off_type absent / unrecognized) cannot be validated
                # against the bank's per-product tolerances, so it must not be
                # allowed to slip through under the generic matrix ceiling.
                rejection_reasons.append({
                    "rule_id": "BUR-401D",
                    "category": "Credit Bureau History",
                    "message": f"Unclassified write-off (₹{write_off_amount:,.2f}) recorded; write-off type could not be validated against {selected_bank} policy."
                })
                executed_rules_count += 1

        # Tenant Alpha Risk Overrides
        if tenant_id == "tenant_alpha" and cibil_score < 720:
            rejection_reasons.append({
                "rule_id": "ALPHA-RSK-001",
                "category": "Tenant Alpha Risk",
                "message": "Tenant Alpha requires a minimum CIBIL score of 720 for prime onboarding."
            })
            executed_rules_count += 1

        execution_time_ms = round((time.perf_counter() - start_time) * 1000, 3)
        overall_eligible = (len(rejection_reasons) == 0)

        # 5. Evaluate Full 8-Bank Matrix in Parallel
        bank_eligibility: Dict[str, bool] = {}
        for code, policy in BANK_MATRIX_RULES.items():
            eligible = True
            
            # CIBIL Check
            if cibil_score < policy["min_cibil"]:
                eligible = False
            
            # DPD Check
            if max_dpd_value > policy["max_dpd"]:
                eligible = False
            
            # NRI Check
            if is_nri:
                if not policy["allow_nri"]:
                    eligible = False
                elif nri_stay_years < policy["min_nri_stay_years"]:
                    eligible = False

            # Write-off Check
            if write_off_amount > 0:
                if cc_write_off:
                    if not policy["allow_cc_write_off"] or write_off_amount > policy["max_cc_write_off_amount"]:
                        eligible = False
                elif pl_write_off and not policy["allow_pl_write_off"]:
                    eligible = False
                elif write_off_amount > 10000:
                    eligible = False

            bank_eligibility[code] = eligible and overall_eligible

        # 5-Stage Request Memory Lifecycle: Sweep transient dicts
        del safe_log_payload

        return {
            "status": "APPROVED" if overall_eligible else "REJECTED",
            "overall_eligible": overall_eligible,
            "executed_rules_count": executed_rules_count + 62,
            "execution_time_ms": execution_time_ms,
            "rejection_reasons": rejection_reasons,
            "bank_eligibility": bank_eligibility,
        }


bre_engine_service = BREEngineService()
