import pathlib

NEW = '''def _evaluate_bank(inp: Dict[str, Any], code: str, policy: Dict[str, Any]) -> List[Dict[str, Any]]:
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
        outcomes.append({
            "rule_id": rid, "name": name, "category": cat, "passed": bool(passed),
            "value": str(value), "limit": str(limit), "message": "" if passed else msg,
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

    check("BUR-406", "Loan Enquiries", "Credit Bureau History",
          inp["loan_enquiry_count"] == 0 or policy["allow_loan_enquiry"],
          inp["loan_enquiry_count"], "0" if not policy["allow_loan_enquiry"] else "any",
          f"{code} does not accept applicants with open loan enquiries "
          f"({inp['loan_enquiry_count']} on file).")

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
        else:
            check("EMP-SAL-208", "Form-16 History", "Employment - Salaried",
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
        else:
            check("EMP-SE-302", "Current-Year ITR", "Self-Employed",
                  inp["se_current_itr"] >= policy["se_min_current_itr"],
                  f"Rs {inp['se_current_itr']:,.0f}", f">= Rs {policy['se_min_current_itr']:,.0f}",
                  f"Current-year ITR (Rs {inp['se_current_itr']:,.0f}) is below {code} minimum (Rs {policy['se_min_current_itr']:,.0f}).")
            if policy["se_combined_itr_rule"]:
                combined = inp["se_current_itr"] + inp["se_prev_itr"]
                check("EMP-SE-303", "Combined ITR", "Self-Employed",
                      combined >= 600000, f"Rs {combined:,.0f}", ">= Rs 600,000",
                      f"Combined current+previous ITR (Rs {combined:,.0f}) is below {code} minimum (Rs 600,000).")
            else:
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

    # --- Co-applicant eligibility (matrix cols 56-61) ------------------------
    if inp["sibling_co_applicant"] and "allow_sibling_coapplicant" in policy:
        check("COA-801", "Sibling Co-Applicant", "Co-Applicant",
              policy["allow_sibling_coapplicant"], "Brother/Sister", policy["allow_sibling_coapplicant"],
              f"{code} does not accept a brother/sister co-applicant for age or income pooling.")

    # --- Existing banking relationship --------------------------------------
    if (policy.get("requires_existing_account")
            and inp["existing_account_bank"] is not ACCOUNT_BANK_UNKNOWN):
        check("REL-501", "Existing Account Holder", "Existing Banking Relationship",
              inp["existing_account_bank"] == code,
              inp["existing_account_bank"] or "None", code,
              f"{code} lends only to existing current/savings account holders; "
              f"the applicant does not hold an account with {code}.")

    if code in BANKS_DISALLOW_EXISTING_CAR_LOAN:
        check("EXB-702", "Existing Car Loan", "Existing Banking Relationship",
              not inp["active_car_loan"], inp["active_car_loan"], False,
              f"{code} does not permit an existing active car loan alongside this application.")

    return outcomes


def _bank_rejections(inp: Dict[str, Any], code: str, policy: Dict[str, Any]) -> List[Dict[str, str]]:
    """Every REJECT-rule violation for one bank — the failures from _evaluate_bank."""
    return [
        {"rule_id": o["rule_id"], "category": o["category"], "message": o["message"]}
        for o in _evaluate_bank(inp, code, policy) if not o["passed"]
    ]
'''

p = pathlib.Path("app/services/bre_engine.py")
t = p.read_text(encoding="utf-8")
start = t.index("def _bank_rejections(")
end = t.index("    return reasons", start) + len("    return reasons\n")
p.write_text(t[:start] + NEW + t[end:], encoding="utf-8")
print("rule engine restructured")
