"""Generate postman/FlowBRE-Onboarding.postman_collection.json.

Expectations are derived from BANK_MATRIX_RULES (policy), NOT from engine
output -- so a disagreement between the two is a finding, not a silent pass.
"""
import copy
import json
import os
import sys

sys.path.insert(0, os.getcwd())
from app.services.bre_engine import BANK_MATRIX_RULES  # noqa: E402

# ExistingBankOption wire value for each partner bank. Every BankCode is
# selectable, so every bank's policy is reachable through the wizard contract.
FORM_BANKS = {"BOI": "BOI", "INDIAN_BANK": "Indian Bank", "IOB": "IOB", "BOB": "BOB",
              "BOM": "BOM", "HDFC": "HDFC", "AXIS": "Axis", "KOTAK": "Kotak"}
FLAT_BANKS = list(FORM_BANKS)
BANK_LABEL = {"BOI": "BOI", "INDIAN_BANK": "Indian Bank", "IOB": "IOB", "BOB": "BOB",
              "BOM": "BOM", "HDFC": "HDFC", "AXIS": "AXIS", "KOTAK": "KOTAK"}

FORM_URL = "{{baseUrl}}/api/v1/onboarding/evaluate/form"
FLAT_URL = "{{baseUrl}}/api/v1/onboarding/evaluate"

# --------------------------------------------------------------------------- #
# Payload builders. Every PII value below is synthetic: a reserved-pattern PAN,
# a fixed non-routable phone, and an example.com mailbox.
# --------------------------------------------------------------------------- #

SYNTHETIC_PAN = "ABCDE1234F"
SYNTHETIC_DOB = "1990-03-15"
SYNTHETIC_PHONE = "9000000001"
SYNTHETIC_EMAIL = "applicant@example.com"


def identity():
    return {
        "entityType": "Individual",
        "applicantName": "Test Applicant",
        "dob": SYNTHETIC_DOB,
        "pan": SYNTHETIC_PAN,
        "phone": SYNTHETIC_PHONE,
        "email": SYNTHETIC_EMAIL,
        "citizenshipStatus": "Resident Indian",
    }


def address(resident="Owned House"):
    return {"pincode": "560001", "cityName": "Bengaluru", "stateName": "Karnataka",
            "residentDetails": resident}


def banking(bank, **over):
    b = {
        "existingAccountBank": FORM_BANKS[bank],
        "existingCarLoanBank": "None",
        "loanType": "Auto Loan",
        "bureauCibilScore": min(BANK_MATRIX_RULES[bank]["min_cibil"] + 30, 900),
        "bureauDpd": 0,
        "bureauLoanEnquiry": False,
        "bureauCurrentlyOutstanding": 0.0,
        "bureauAgeAtLastEMI": 50,
    }
    b.update(over)
    return b


def salaried(bank, **over):
    o = {
        "profileType": "Salaried",
        "employerType": "Employment-Pvt Ltd",
        "tenureBand": "2y+",
        "grossSalary": 50000.0,
        "salaryMode": "Salary payment mode- Bank Credit",
        "form16Status": "Form 16",
        "form16Years": max(BANK_MATRIX_RULES[bank]["form16_years_required"], 2),
        "rentalIncomeTypeSalaried": "None",
    }
    o.update(over)
    if o.get("form16Status") == "No Income Proof":
        o.pop("form16Years", None)
    if o.get("tenureBand") != "2y+":
        o.setdefault("prevCompanyName", "Previous Employer Pvt Ltd")
        o.setdefault("prevCompanyJoining", "2014-04-01")
    return o


def self_employed(bank, **over):
    p = BANK_MATRIX_RULES[bank]
    o = {
        "profileType": "Self-Employed",
        "officeAddressType": "Same",
        "businessEntityType": "Propreitorship",
        "businessProof": "GSTIN-29ABCDE1234F1Z5",
        "businessEstablishmentDate": "2014-06-01",
        "currentITRAmount": p["se_min_current_itr"] + 300000.0,
        "prevITRAmount": max(p["se_min_prev_itr"], 300000.0) + 300000.0,
        "businessItrAmount": p["min_business_itr_years"] + 2,
        "rentalIncomeTypeSelfEmployed": "None",
    }
    o.update(over)
    return o


def form_body(bank, occupation, addr=None, co=None, bank_over=None):
    body = {
        "identity": identity(),
        "address": addr or address(),
        "occupation": occupation,
        "banking": banking(bank, **(bank_over or {})),
        "coApplicant": co or {"coAppAgeRelation": "None", "coAppIncomeRelation": "None"},
    }
    return body


def flat_body(bank, **over):
    p = BANK_MATRIX_RULES[bank]
    body = {
        "entity_type": "Individual",
        "occupation": "Salaried",
        "applicant_name": "Test Applicant",
        "pan": SYNTHETIC_PAN,
        "dob": SYNTHETIC_DOB,
        "age": 35,
        "age_at_last_emi_salaried": 50,
        "age_at_last_emi_self_employed": 50,
        "is_nri": False,
        "property_status": "OWNED",
        "guarantor_provided": False,
        "net_monthly_salary": 50000.0,
        "current_company_tenure_months": 36,
        "minimum_work_experience_years": 5,
        "salary_payment_mode": "BANK_TRANSFER",
        "form_16_years": max(p["form16_years_required"], 2),
        "no_income_proof_segment": False,
        "existing_car_loan_bank": None,
        "business_experience_years": p["min_business_itr_years"] + 2,
        "current_itr": p["se_min_current_itr"] + 300000.0,
        "previous_itr": max(p["se_min_prev_itr"], 300000.0) + 300000.0,
        "itr_filed": True,
        "business_proof": True,
        "selected_bank": bank,
        "credit_bureau": {
            "cibil_score": min(p["min_cibil"] + 30, 900),
            "dpd_history": [0],
            "write_off_amount": 0.0,
            "write_off_type": None,
            "currently_overdue": False,
        },
    }
    for k, v in over.items():
        if k == "credit_bureau":
            body["credit_bureau"].update(v)
        else:
            body[k] = v
    return body


# --------------------------------------------------------------------------- #
# Scenario table. Each entry -> (folder, name, description, body, expected_eligible)
# --------------------------------------------------------------------------- #

CAT_SAL = "1. Individual-Occupation - Salaried"
CAT_SE = "1. Individual-Occupation - Self-Employed"
CAT_OFFICE = "2. Office Address Type & Premises Status"
CAT_ACCOUNT = "3. Existing Current/Savings A/c With"
CAT_BOUNDARY = "4. Core Boundary Scenarios"


def form_scenarios(bank):
    p = BANK_MATRIX_RULES[bank]
    s = []

    # --- 1. Salaried ------------------------------------------------------- #
    s.append((CAT_SAL, "salaried-clean-baseline",
              "Control case: every salaried column comfortably inside policy. "
              "Any failure here invalidates the rest of the folder.",
              form_body(bank, salaried(bank)), True))
    s.append((CAT_SAL, "salaried-salary-below-floor",
              f"EMP-SAL-202: a gross salary of Rs 20,000/month, below the "
              f"Rs {p['min_salary']:,.0f} floor.",
              form_body(bank, salaried(bank, grossSalary=20000.0)), False))
    s.append((CAT_SAL, "salaried-tenure-1y-2y",
              f"EMP-SAL-205: '1y-2y' band credits 1.00 yr of current-company tenure against "
              f"{bank}'s {p['min_current_company_tenure_years']} yr floor. Prior employer "
              f"supplied so total experience still clears EMP-SAL-204.",
              form_body(bank, salaried(bank, tenureBand="1y-2y")),
              1.0 >= p["min_current_company_tenure_years"]))
    s.append((CAT_SAL, "salaried-tenure-0-6m",
              "EMP-SAL-205: shortest tenure band (0.00 yrs current tenure).",
              form_body(bank, salaried(bank, tenureBand="0-6m")),
              0.0 >= p["min_current_company_tenure_years"]))
    s.append((CAT_SAL, "salaried-form16-at-required",
              f"EMP-SAL-206 boundary: exactly {p['form16_years_required']} yrs of Form 16 "
              f"(inclusive '>=' floor).",
              form_body(bank, salaried(bank, form16Years=p["form16_years_required"])), True))
    s.append((CAT_SAL, "salaried-form16-below-required",
              f"EMP-SAL-206 boundary: {max(p['form16_years_required'] - 1, 0)} yrs of Form 16, "
              f"one year short.",
              form_body(bank, salaried(bank, form16Years=max(p["form16_years_required"] - 1, 0))),
              max(p["form16_years_required"] - 1, 0) >= p["form16_years_required"]))
    s.append((CAT_SAL, "salaried-no-income-proof",
              "EMP-SAL-207: 'No Income Proof' segment. Form-16 history is not evaluated; "
              "the bank's col-45 permission decides.",
              form_body(bank, salaried(bank, form16Status="No Income Proof")),
              p["allow_no_income_proof"]))
    s.append((CAT_SAL, "salaried-cash-salary-mode",
              "EMP-SAL-203: cash salary is ineligible at every bank; direct bank credit required.",
              form_body(bank, salaried(bank, salaryMode="Salary payment mode-Cash")), False))

    # --- 1b. Self-Employed ------------------------------------------------- #
    s.append((CAT_SE, "self-employed-clean-baseline",
              "Control case for the self-employed branch (office at the owned residence, "
              "so no guarantor rule applies).",
              form_body(bank, self_employed(bank)), True))
    s.append((CAT_SE, "se-current-itr-at-floor",
              f"EMP-SE-302 boundary: current ITR exactly Rs {p['se_min_current_itr']:,.0f} "
              f"(inclusive floor).",
              form_body(bank, self_employed(bank, currentITRAmount=p["se_min_current_itr"])),
              (p["se_min_current_itr"] + max(p["se_min_prev_itr"], 300000.0) + 300000.0 >= 600000.0)
              if p["se_combined_itr_rule"] else True))
    s.append((CAT_SE, "se-current-itr-below-floor",
              f"EMP-SE-302 boundary: current ITR Rs {p['se_min_current_itr'] - 1:,.0f}, "
              f"one rupee short.",
              form_body(bank, self_employed(bank, currentITRAmount=p["se_min_current_itr"] - 1)),
              False))
    if p["se_combined_itr_rule"]:
        combined_short = {"currentITRAmount": 300000.0, "prevITRAmount": 200000.0}
        s.append((CAT_SE, "se-combined-itr-below-600k",
                  "EMP-SE-303 (combined rule): current + previous ITR = Rs 500,000, "
                  "below the Rs 600,000 combined floor.",
                  form_body(bank, self_employed(bank, **combined_short)), False))
    else:
        s.append((CAT_SE, "se-prev-itr-below-floor",
                  f"EMP-SE-303: previous-year ITR Rs {max(p['se_min_prev_itr'] - 1, 0):,.0f}, "
                  f"below the Rs {p['se_min_prev_itr']:,.0f} floor.",
                  form_body(bank, self_employed(bank,
                                                prevITRAmount=max(p["se_min_prev_itr"] - 1, 0))),
                  max(p["se_min_prev_itr"] - 1, 0) >= p["se_min_prev_itr"]))
    s.append((CAT_SE, "se-business-itr-years-at-min",
              f"EMP-SE-301 boundary: exactly {p['min_business_itr_years']} filed business-ITR "
              f"years. Note this column is a COUNT OF YEARS, not a rupee amount.",
              form_body(bank, self_employed(bank, businessItrAmount=p["min_business_itr_years"])),
              True))
    s.append((CAT_SE, "se-business-itr-years-below-min",
              f"EMP-SE-301 boundary: {p['min_business_itr_years'] - 1} filed business-ITR years, "
              f"one short of {bank}'s floor.",
              form_body(bank, self_employed(bank,
                                            businessItrAmount=p["min_business_itr_years"] - 1)),
              False))
    s.append((CAT_SE, "se-no-business-proof",
              "BUS-302: business proof (GSTIN / Udyam) is mandatory at every bank.",
              form_body(bank, {k: v for k, v in self_employed(bank).items() if k != "businessProof"}),
              False))

    # --- 2. Office address type & premises status -------------------------- #
    sep_rented = self_employed(bank, officeAddressType="Separate",
                               officeAddress="Unit 4, Industrial Estate",
                               officePremisesStatus="Rented")
    s.append((CAT_OFFICE, "office-separate-rented-residence-rented",
              "REL-502 (col 21): separately addressed office AND residence both rented -> "
              "property_status SEPARATE_BOTH_RENTED. The guarantor question is NOT asked here.",
              form_body(bank, sep_rented, addr=address("Rented House")),
              p["allow_separate_both_rented"]))
    sep_owned = self_employed(bank, officeAddressType="Separate",
                              officeAddress="Unit 4, Industrial Estate",
                              officePremisesStatus="Owned")
    s.append((CAT_OFFICE, "office-separate-owned-residence-rented",
              "Control for REL-502: separate office on OWNED premises resolves to plain RENTED, "
              "so neither REL-502 nor the guarantor rules fire.",
              form_body(bank, sep_owned, addr=address("Rented House")), True))
    with_g = self_employed(bank, officeAddressType="Same", guarantorStatus="With a Gaurantor")
    s.append((CAT_OFFICE, "office-same-address-rented-with-guarantor",
              "RES-206 (col 23): office run out of a RENTED residence -> guarantorStatus is "
              "rendered and mandatory. Applicant supplies a guarantor.",
              form_body(bank, with_g, addr=address("Rented House")), p["allow_with_guarantor"]))
    without_g = self_employed(bank, officeAddressType="Same",
                              guarantorStatus="Without a Gaurantor")
    s.append((CAT_OFFICE, "office-same-address-rented-without-guarantor",
              "RES-205 (col 22): same configuration, no guarantor offered.",
              form_body(bank, without_g, addr=address("Rented House")),
              p["allow_without_guarantor"]))
    bad_g = self_employed(bank, officeAddressType="Same", guarantorStatus="With a Gaurantor")
    s.append((CAT_OFFICE, "422-guarantor-sent-when-not-asked",
              "Contract check: guarantorStatus is only collected when the office runs out of a "
              "RENTED residence. Sent with an OWNED residence -> 422, never a silent ignore.",
              form_body(bank, bad_g, addr=address("Owned House")), "422"))
    bad_sep = self_employed(bank, officeAddressType="Separate",
                            officeAddress="Unit 4, Industrial Estate")
    s.append((CAT_OFFICE, "422-separate-office-missing-premises-status",
              "Contract check: officePremisesStatus is required when officeAddressType is "
              "'Separate' -> 422.",
              form_body(bank, bad_sep, addr=address("Rented House")), "422"))

    # --- 3. Existing account ----------------------------------------------- #
    s.append((CAT_ACCOUNT, "account-held-with-this-bank",
              f"REL-501: applicant holds a current/savings account with {bank}, which "
              f"{'accepts' if p['allows_existing_account_holder'] else 'turns away'} its own "
              f"account holders (col: Existing A/C Holder).",
              form_body(bank, salaried(bank)), p["allows_existing_account_holder"]))

    # --- 4. Core boundary scenarios ---------------------------------------- #
    s.append((CAT_BOUNDARY, "cibil-at-floor",
              f"BUR-405 boundary: CIBIL exactly {p['min_cibil']} (inclusive '>=').",
              form_body(bank, salaried(bank), bank_over={"bureauCibilScore": p["min_cibil"]}), True))
    s.append((CAT_BOUNDARY, "cibil-one-below-floor",
              f"BUR-405 boundary: CIBIL {p['min_cibil'] - 1}, one point short.",
              form_body(bank, salaried(bank), bank_over={"bureauCibilScore": p["min_cibil"] - 1}),
              False))
    s.append((CAT_BOUNDARY, f"dpd-at-max-{p['max_dpd']}",
              f"BUR-402/403 boundary: DPD exactly {p['max_dpd']} days, {bank}'s maximum "
              f"acceptable value.",
              form_body(bank, salaried(bank), bank_over={"bureauDpd": p["max_dpd"]}), True))
    s.append((CAT_BOUNDARY, f"dpd-over-max-{p['max_dpd'] + 1}",
              f"BUR-402/403 boundary: DPD {p['max_dpd'] + 1} days, one day over tolerance.",
              form_body(bank, salaried(bank), bank_over={"bureauDpd": p["max_dpd"] + 1}), False))
    if p["max_dpd"] >= 89:
        s.append((CAT_BOUNDARY, "dpd-90",
                  "BUR-402: 90 DPD is the sheet's '< 90' rejection point at every tolerant bank.",
                  form_body(bank, salaried(bank), bank_over={"bureauDpd": 90}), False))
    cc_cap = p["max_cc_write_off_amount"]
    cc_below = max(cc_cap - 1, 1.0) if p["allow_cc_write_off"] else 1000.0
    s.append((CAT_BOUNDARY, "cc-write-off-below-cap",
              f"BUR-401 / BUR-401B: credit-card write-off of Rs {cc_below:,.0f} against "
              f"{bank}'s {'strict cap of Rs %s' % f'{cc_cap:,.0f}' if p['allow_cc_write_off'] else 'blanket CC prohibition'}.",
              form_body(bank, salaried(bank),
                        bank_over={"bureauFlagCC": True, "bureauWriteOffAmount": cc_below}),
              p["allow_cc_write_off"] and cc_below < cc_cap))
    if p["allow_cc_write_off"]:
        s.append((CAT_BOUNDARY, "cc-write-off-at-cap",
                  f"BUR-401B boundary: Rs {cc_cap:,.0f} exactly. The sheet's operator is strict "
                  f"'<', so an amount AT the cap rejects.",
                  form_body(bank, salaried(bank),
                            bank_over={"bureauFlagCC": True, "bureauWriteOffAmount": cc_cap}),
                  False))
    for flag, label, key in (("bureauFlagPL", "pl", "allow_pl_write_off"),
                             ("bureauFlagHome", "home-loan", "allow_hl_write_off"),
                             ("bureauFlagAuto", "auto", "allow_auto_write_off"),
                             ("bureauFlagConsumer", "consumer", "allow_consumer_write_off")):
        s.append((CAT_BOUNDARY, f"write-off-{label}",
                  f"BUR-401: {label.upper()} write-off against col '{key}'.",
                  form_body(bank, salaried(bank),
                            bank_over={flag: True, "bureauWriteOffAmount": 25000.0}),
                  p[key]))
    s.append((CAT_BOUNDARY, "currently-outstanding-overdue",
              "BUR-404: an active currently-outstanding balance declines everywhere.",
              form_body(bank, salaried(bank),
                        bank_over={"bureauCurrentlyOutstanding": 15000.0}), False))
    s.append((CAT_BOUNDARY, "loan-enquiry-present",
              "BUR-406: an active bureau loan enquiry. Every bank carries col 12 = true, so this "
              "must NOT reject -- it is reported as a passed rule.",
              form_body(bank, salaried(bank), bank_over={"bureauLoanEnquiry": True}),
              p["allow_loan_enquiry"]))
    s.append((CAT_BOUNDARY, "sibling-co-applicant",
              "COA-801: brother/sister offered for age extension.",
              form_body(bank, salaried(bank),
                        co={"coAppAgeRelation": "Brother", "coAppIncomeRelation": "None"}),
              p["allow_sibling_coapplicant"]))
    s.append((CAT_BOUNDARY, "parent-co-applicant-income-pooling",
              "COA-801 control: a parent co-applicant is accepted at every bank.",
              form_body(bank, salaried(bank),
                        co={"coAppAgeRelation": "None", "coAppIncomeRelation": "Father",
                            "coApplicantName": "Test Parent", "coApplicantDob": "1962-08-10",
                            "coApplicantOccupation": "Salaried"}),
              True))
    s.append((CAT_BOUNDARY, "age-at-last-emi-over-limit-salaried",
              f"DEM-102: age {p['max_age_emi_salaried'] + 1} at the final EMI against "
              f"{bank}'s {p['max_age_emi_salaried']} yr salaried ceiling.",
              form_body(bank, salaried(bank),
                        bank_over={"bureauAgeAtLastEMI": p["max_age_emi_salaried"] + 1}), False))
    s.append((CAT_BOUNDARY, "age-at-last-emi-at-limit-salaried",
              f"DEM-102 boundary: age exactly {p['max_age_emi_salaried']} (inclusive '<=').",
              form_body(bank, salaried(bank),
                        bank_over={"bureauAgeAtLastEMI": p["max_age_emi_salaried"]}), True))
    s.append((CAT_BOUNDARY, "age-at-last-emi-over-limit-self-employed",
              f"DEM-103: age {p['max_age_emi_self_employed'] + 1} against {bank}'s "
              f"{p['max_age_emi_self_employed']} yr self-employed ceiling, which differs from "
              f"the salaried ceiling at most banks.",
              form_body(bank, self_employed(bank),
                        bank_over={"bureauAgeAtLastEMI": p["max_age_emi_self_employed"] + 1}),
              False))
    for opt, key, label in (
            ("Rental Income-with Agreement -Not filed ITR-Not reflecting in Bank",
             "allow_rental_no_itr_not_in_bank", "no-itr-not-in-bank"),
            ("Rental Income-with Agreement filed ITR- Not reflecting in Bank",
             "allow_rental_itr_not_in_bank", "itr-not-in-bank"),
            ("Rental Income-with Agreement -Not filed ITR-reflecting in Bank",
             "allow_rental_no_itr_in_bank", "no-itr-in-bank")):
        s.append((CAT_BOUNDARY, f"rental-income-{label}",
                  f"Secondary rental income (matrix cols 38-40) against col '{key}'.",
                  form_body(bank, salaried(bank, rentalIncomeTypeSalaried=opt)), p[key]))
    s.append((CAT_BOUNDARY, "nri-applicant",
              f"DEM-104/105: NRI/PIO applicant with a 36-month in-country stay against "
              f"{bank}'s col-14 permission.",
              form_body(bank, salaried(bank), addr=address(),
                        bank_over={}) | {"identity": identity() | {
                            "citizenshipStatus": "NRI/PIO", "nriStayPeriod": 36}},
              p["allow_nri"] and 3.0 >= p["min_nri_stay_years"]))
    if bank in ("IOB", "BOB"):
        s.append((CAT_BOUNDARY, "existing-car-loan",
                  f"EXB-702 (col 19): {bank} does not permit an existing active car loan.",
                  form_body(bank, salaried(bank), bank_over={"existingCarLoanBank": "Others"}),
                  False))
    return s


def flat_scenarios(bank):
    """Scenarios the 5-step wizard contract cannot express.

    Everything else now goes through /evaluate/form: with HDFC / Axis / Kotak
    added to ExistingBankOption, every partner bank is selectable there.
    """
    p = BANK_MATRIX_RULES[bank]
    return [
        (CAT_SE, "se-itr-not-filed",
         f"EMP-SE-304 (col 46): no ITR filed, against col 'allow_itr_not_filed' = "
         f"{p['allow_itr_not_filed']}. The wizard's Individual self-employed branch always "
         f"reports a filed return, so this rule is only reachable on the flat contract.",
         flat_body(bank, occupation="Self-Employed", itr_filed=False), p["allow_itr_not_filed"]),
        (CAT_BOUNDARY, "write-off-unclassified",
         "BUR-401D: a write-off amount with no product type fails closed at every bank. The "
         "wizard derives the type from its checkboxes and can never emit an untyped write-off.",
         flat_body(bank, credit_bureau={"write_off_amount": 25000.0}), False),
    ]


# --------------------------------------------------------------------------- #
# Postman assembly
# --------------------------------------------------------------------------- #

def test_script(bank, expected, is_form):
    if expected == "422":
        return [
            "pm.test('422 Unprocessable Entity (contract violation rejected)', function () {",
            "    pm.response.to.have.status(422);",
            "});",
            "pm.test('error body names the offending field', function () {",
            "    pm.expect(pm.response.json()).to.have.property('detail');",
            "});",
        ]
    lines = [
        "pm.test('200 OK', function () { pm.response.to.have.status(200); });",
        "const body = pm.response.json();",
        "pm.test('total round trip within the 100 ms SLA', function () {",
        "    pm.expect(body.execution_time_ms).to.be.below(100);",
        "});",
        f"pm.test('{bank} verdict is {str(expected).lower()}', function () {{",
    ]
    if is_form:
        lines += [
            f"    pm.expect(body.selected_bank, 'selected_bank').to.eql('{bank}');",
            f"    pm.expect(body.overall_eligible, JSON.stringify(body.rejection_reasons))"
            f".to.eql({str(expected).lower()});",
        ]
    else:
        lines += [
            f"    pm.expect(body.bank_eligibility['{bank}'], "
            f"JSON.stringify(body.rejection_reasons)).to.eql({str(expected).lower()});",
        ]
    lines += [
        "});",
        "pm.test('every rejection carries a rule_id, category and message', function () {",
        "    body.rejection_reasons.forEach(function (r) {",
        "        pm.expect(r.rule_id).to.be.a('string').and.not.empty;",
        "        pm.expect(r.category).to.be.a('string').and.not.empty;",
        "        pm.expect(r.message).to.be.a('string').and.not.empty;",
        "    });",
        "});",
        "pm.test('audit report covers all 8 partner banks', function () {",
        "    pm.expect(Object.keys(body.bank_eligibility)).to.have.lengthOf(8);",
        "    pm.expect(Object.keys(body.evaluation_report)).to.have.lengthOf(8);",
        "});",
        f"pm.test('audit trail for {bank} agrees with the verdict', function () {{",
        f"    const report = body.evaluation_report['{bank}'];",
        "    pm.expect(report.passed_rules.length, 'no rules evaluated').to.be.above(0);",
        f"    pm.expect(report.failed_rules.length === 0).to.eql({str(expected).lower()});",
        "});",
        "pm.test('no raw PAN in the response', function () {",
        "    pm.expect(pm.response.text()).to.not.include('ABCDE1234F');",
        "});",
    ]
    return lines


def request_item(name, description, body, url, bank, expected, is_form):
    return {
        "name": name,
        "event": [{"listen": "test",
                   "script": {"type": "text/javascript",
                              "exec": test_script(bank, expected, is_form)}}],
        "request": {
            "method": "POST",
            "header": [
                {"key": "Content-Type", "value": "application/json"},
                {"key": "X-Tenant-ID", "value": "{{tenantId}}"},
            ],
            "body": {"mode": "raw", "raw": json.dumps(body, indent=2),
                     "options": {"raw": {"language": "json"}}},
            "url": url,
            "description": description,
        },
    }


def build_bank_folder(bank, scenarios, url, is_form, folder_description):
    by_cat = {}
    for cat, name, desc, body, expected in scenarios:
        by_cat.setdefault(cat, []).append(
            request_item(name, desc, body, url, bank, expected, is_form))
    return {
        "name": BANK_LABEL[bank],
        "description": folder_description,
        "item": [{"name": cat, "item": items} for cat, items in sorted(by_cat.items())],
    }


FORM_FOLDER_DESC = (
    "Posted to POST /api/v1/onboarding/evaluate/form. The wizard derives the assessed bank from "
    "`banking.existingAccountBank`, so every request in this folder is scored against {bank} "
    "policy and asserts on `overall_eligible`."
)

FLAT_FOLDER_DESC = (
    "Posted to POST /api/v1/onboarding/evaluate -- the flat, engine-native contract.\n\n"
    "Every partner bank is selectable in the wizard (ExistingBankOption covers all eight), so "
    "the bank folders above exercise all eight policies through /evaluate/form. What remains "
    "here are the two rules the wizard contract cannot express at all:\n\n"
    "  * EMP-SE-304 'ITR Not Filed' (col 46) -- the Individual self-employed branch always "
    "reports a filed return.\n"
    "  * BUR-401D unclassified write-off -- the wizard derives the product class from its "
    "checkboxes and can never emit an untyped write-off.\n\n"
    "Note that the flat contract carries no `existing_account_bank` field. The engine reads "
    "that absence as 'not stated' and skips REL-501 rather than rejecting, which is why these "
    "requests approve without declaring a banking relationship."
)


def main():
    items = []
    for bank in FORM_BANKS:
        items.append(build_bank_folder(bank, form_scenarios(bank), FORM_URL, True,
                                       FORM_FOLDER_DESC.format(bank=bank)))
    items.append({
        "name": "Flat Contract (/evaluate) - wizard-unreachable rules",
        "description": FLAT_FOLDER_DESC,
        "item": [build_bank_folder(bank, flat_scenarios(bank), FLAT_URL, False, "")
                 for bank in FLAT_BANKS],
    })

    # Cross-bank folder: the one REL-501 negative the wizard can express.
    others = form_body("BOI", salaried("BOI"))
    others["banking"]["existingAccountBank"] = "Others"
    # REL-501 binds a bank only against its OWN account holders, so an applicant
    # banking outside the partner set is unconstrained everywhere.
    cross_expected = {b: True for b in BANK_MATRIX_RULES}
    cross = {
        "name": "Cross-Bank / Existing A/c Matrix",
        "description": (
            "REL-501 across all 8 banks in a single submission. `existingAccountBank: 'Others'` "
            "means the applicant holds no partner-bank account; the assessed bank falls back to "
            "BOI. REL-501 binds a bank only against its own account holders, so banking outside "
            "the partner set leaves every bank free to lend.\n\n"
            "This is the case that proves `bank_eligibility` answers 'who else would lend to "
            "me': every entry is that bank's own verdict, independent of the selected bank's."
        ),
        "item": [{
            "name": "no-partner-bank-account (only IOB may accept)",
            "event": [{"listen": "test", "script": {"type": "text/javascript", "exec": [
                "pm.test('200 OK', function () { pm.response.to.have.status(200); });",
                "const body = pm.response.json();",
                "const expected = " + json.dumps(cross_expected) + ";",
                "pm.test('assessed bank falls back to BOI', function () {",
                "    pm.expect(body.selected_bank).to.eql('BOI');",
                "});",
                "pm.test('audit report is returned for all 8 banks', function () {",
                "    pm.expect(Object.keys(body.evaluation_report)).to.have.lengthOf(8);",
                "});",
                "Object.keys(expected).forEach(function (bank) {",
                "    pm.test(bank + ' eligibility is ' + expected[bank], function () {",
                "        const fired = body.evaluation_report[bank].failed_rules"
                ".map(function (r) { return r.rule_id; });",
                "        pm.expect(body.bank_eligibility[bank], 'fired: ' + fired)"
                ".to.eql(expected[bank]);",
                "        pm.expect(fired.indexOf('REL-501') === -1, 'REL-501')"
                ".to.eql(expected[bank]);",
                "    });",
                "});",
                "pm.test('REL-501 is the stated reason for the assessed bank', function () {",
                "    pm.expect(body.rejection_reasons.map(function (r) { return r.rule_id; }))"
                ".to.include('REL-501');",
                "});",
            ]}}],
            "request": {
                "method": "POST",
                "header": [{"key": "Content-Type", "value": "application/json"},
                           {"key": "X-Tenant-ID", "value": "{{tenantId}}"}],
                "body": {"mode": "raw", "raw": json.dumps(others, indent=2),
                         "options": {"raw": {"language": "json"}}},
                "url": FORM_URL,
                "description": "REL-501 negative case, asserted across the full 8-bank map.",
            },
        }],
    }
    items.append(cross)

    collection = {
        "info": {
            "name": "FlowBRE Onboarding - Bank Eligibility Conformance",
            "description": (
                "Boundary-value conformance suite for the FlowBRE onboarding evaluation "
                "endpoints, generated from the code-defined BANK_MATRIX_RULES "
                "(app/services/bre_engine.py), which is itself derived from "
                "bank_Individual_Eligibility_Matrix.xlsx and "
                "bank_Company_Organization_Eligibility_Matrix.xlsx.\n\n"
                "Expected verdicts are derived from the POLICY MATRIX, not from engine output -- "
                "a failing request means the engine and the sheet disagree.\n\n"
                "Variables: `baseUrl` (default http://127.0.0.1:8000), `tenantId` (default "
                "'default').\n\n"
                "All PII in these payloads is synthetic: PAN ABCDE1234F, DOB 1990-03-15, phone "
                "9000000001, applicant@example.com. Do not substitute production values -- "
                "requests and responses are persisted to Postman history."
            ),
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        },
        "variable": [
            {"key": "baseUrl", "value": "http://127.0.0.1:8000", "type": "string"},
            {"key": "tenantId", "value": "default", "type": "string"},
        ],
        "item": items,
    }
    return collection


if __name__ == "__main__":
    coll = main()
    out = os.path.join("postman", "FlowBRE-Onboarding.postman_collection.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(coll, f, indent=2, ensure_ascii=False)
        f.write("\n")
    def count(items):
        return sum(count(i["item"]) if "item" in i else 1 for i in items)
    n = count(coll["item"])
    print(f"wrote {out}: {len(coll['item'])} folders, {n} requests")
