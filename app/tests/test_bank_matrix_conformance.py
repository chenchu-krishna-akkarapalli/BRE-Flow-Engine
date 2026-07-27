"""Conformance test: the onboarding API must agree with the bank policy
spreadsheet, cell for cell.

`Bank_Eligibility_Matrix_v1.xlsx` is the contract. This module parses it into an
independent reference evaluator and replays edge-case submissions through
POST /api/v1/onboarding/evaluate/form, asserting the API's 8-bank verdict map
matches the sheet's. It is a differential test on purpose: it shares no code
with the engine, so a policy column the engine forgets to evaluate shows up as
a failure rather than passing by construction.

It exists because ten sheet columns were once declared in the policy matrix and
never evaluated (loan enquiry, rental income, HUF, agriculture, sibling
co-applicant, business ITR years, unfiled ITR, and the with/without-guarantor
split), and a hand-transcribed constant silently disagreed with its cell.

Four layers, each closing a hole the previous one leaves open:
  * policy constants    — every threshold equals its cell (catches transcription)
  * endpoint verdicts   — the API's answer over the wire (catches the route/schema)
  * per-bank verdicts   — every bank scored directly (catches the three banks the
                          form cannot select, and de-vacuizes rejecting cases)
  * column coverage     — every column is evaluated, provably inert, or an
                          explicitly documented deferral (catches silent omission)
"""

import asyncio
import re
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from unittest.mock import AsyncMock, MagicMock

import openpyxl
import pytest
from fastapi.testclient import TestClient

import app.core.redis as redis_module
from app.api.deps import get_db, get_redis
from app.api.schemas.onboarding import OnboardingFormRequest
from app.main import app
from app.services.bre_engine import BANK_MATRIX_RULES, RENTAL_CLASS_TO_FLAG, bre_engine_service

SHEET_PATH = Path(__file__).resolve().parents[2] / "app" / "zen_rules" / "Bank_Eligibility_Matrix_v1.xlsx"
TENANT = "tenant_beta"
TODAY = date.today()

SHEET_NAME_TO_CODE = {
    "BOI": "BOI",
    "Indian Bank": "INDIAN_BANK",
    "IOB": "IOB",
    "BOB": "BOB",
    "BOM": "BOM",
    "HDFC": "HDFC",
    "AXIS": "AXIS",
    "Kotak": "KOTAK",
}
# Only these five are reachable as the *selected* bank from the form's
# "Existing Current/Savings Bank A/c With" options. HDFC / AXIS / Kotak are
# covered by test_every_bank_verdict_matches_spreadsheet, which scores every
# bank directly — the eligibility map alone cannot verify them, because it is
# ANDed with the selected bank's verdict.
FORM_SELECTABLE = {"BOI": "BOI", "INDIAN_BANK": "Indian Bank", "IOB": "IOB", "BOB": "BOB", "BOM": "BOM"}


# --------------------------------------------------------------------------- #
# 1. Parse the spreadsheet into per-bank policy dicts
# --------------------------------------------------------------------------- #

def _flag(v: Any) -> bool:
    return str(v).strip().lower() == "true"


def _threshold(v: Any) -> float:
    """'>= 701' -> 701, '< 5000' -> 5000, '<= 0' -> 0."""
    m = re.search(r"(-?\d+(?:\.\d+)?)", str(v))
    return float(m.group(1)) if m else 0.0


def _max_acceptable(v: Any) -> int:
    """'<= 0' -> 0 (0 is acceptable); '< 90' -> 89 (90 rejects)."""
    text = str(v).strip()
    n = int(_threshold(text))
    return n if text.startswith("<=") else n - 1


def load_policies() -> Dict[str, Dict[str, Any]]:
    ws = openpyxl.load_workbook(str(SHEET_PATH), data_only=True)["decision table"]
    rows = list(ws.iter_rows(values_only=True))
    policies: Dict[str, Dict[str, Any]] = {}
    for row in rows[1:]:
        code = SHEET_NAME_TO_CODE[row[0]]
        policies[code] = {
            "min_cibil": _threshold(row[2]),                      # col 2
            "allow_write_off": {                                  # cols 3-9
                "PL": _flag(row[3]), "HL": _flag(row[4]), "CONSUMER": _flag(row[5]),
                "AGRI": _flag(row[6]), "MSME": _flag(row[7]), "AUTO": _flag(row[8]),
                "CC": _flag(row[9]),
            },
            "max_cc_write_off": _threshold(row[10]),              # col 10 (strict <)
            "max_dpd": _max_acceptable(row[11]),                  # col 11
            "allow_loan_enquiry": _flag(row[12]),                 # col 12
            "allow_currently_outstanding": _flag(row[13]),        # col 13
            "min_age": int(row[14]),                              # col 14
            "max_age_emi_salaried": _threshold(row[15]),          # col 15
            "max_age_emi_self_employed": _threshold(row[16]),     # col 16
            "allow_existing_car_loan": _flag(row[18]),            # col 18
            "allow_both_rented_config": _flag(row[21]),           # col 21
            "allow_without_guarantor": _flag(row[22]),            # col 22
            "allow_with_guarantor": _flag(row[23]),               # col 23
            "allow_nri": _flag(row[25]),                          # col 25
            "min_nri_stay_years": _threshold(row[26]),            # col 26
            "allow_agriculture": _flag(row[27]),                  # col 27
            "min_total_experience_years": _threshold(row[33]),    # col 33
            "min_current_company_years": _threshold(row[34]),     # col 34
            "allow_cash_salary": _flag(row[35]),                  # col 35
            "allow_no_income_proof": _flag(row[37]),              # col 37
            "allow_rental": {                                     # cols 38-40
                "NO_ITR_NOT_IN_BANK": _flag(row[38]),
                "NO_ITR_IN_BANK": _flag(row[39]),
                "ITR_NOT_IN_BANK": _flag(row[40]),
            },
            "min_salary": _threshold(row[41]),                    # col 41
            "se_min_current_itr": _threshold(row[42]),            # col 42
            "se_combined_itr": "Current + Prev" in str(row[43]),  # col 43
            "se_min_prev_itr": _threshold(row[43]),               # col 43
            "allow_itr_not_filed": _flag(row[46]),                # col 46
            "min_business_itr_years": _threshold(row[47]),        # col 47
            "allow_huf": _flag(row[54]),                          # col 54
            "form16_years_required": _threshold(row[55]),         # col 55
            "coapp": {                                            # cols 56-61
                "AGE_Brother": _flag(row[56]), "AGE_Sister": _flag(row[57]),
                "INC_Brother": _flag(row[58]), "INC_Father": _flag(row[59]),
                "INC_Mother": _flag(row[60]), "INC_Sister": _flag(row[61]),
            },
        }
    return policies


POLICIES = load_policies()


# --------------------------------------------------------------------------- #
# 2. Reference evaluator — the spreadsheet's verdict for one applicant
# --------------------------------------------------------------------------- #
#
# Tie-break note: cols 21/22/23 are mutually inconsistent for BOB and HDFC
# (col21 permits the both-rented configuration while col22/23 refuse it either
# way). The guarantor-specific columns 22/23 are treated as authoritative
# because they address the guarantor question directly; col21 is read as a
# descriptive flag. Under that reading only BOM waives the guarantor, and
# IOB/BOB decline the configuration outright.


def sheet_rejects(bank: str, f: Dict[str, Any]) -> List[str]:
    p = POLICIES[bank]
    out: List[str] = []

    # Demographics
    if f["age"] < p["min_age"]:
        out.append("min_age")
    if f["is_nri"]:
        if not p["allow_nri"]:
            out.append("nri_not_allowed")
        elif f["nri_stay_years"] < p["min_nri_stay_years"]:
            out.append("nri_stay")

    # Bureau
    if f["cibil"] < p["min_cibil"]:
        out.append("cibil")
    if f["dpd"] > p["max_dpd"]:
        out.append("dpd")
    if f["currently_outstanding"] > 0 and not p["allow_currently_outstanding"]:
        out.append("currently_outstanding")
    if f["loan_enquiry"] > 0 and not p["allow_loan_enquiry"]:
        out.append("loan_enquiry")
    if f["write_off_amount"] > 0:
        wtype = f["write_off_type"]
        if wtype is None:
            out.append("write_off_unclassified")
        elif not p["allow_write_off"][wtype]:
            out.append(f"write_off_{wtype}")
        elif wtype == "CC" and f["write_off_amount"] >= p["max_cc_write_off"]:
            out.append("write_off_cc_cap")

    # Entity / business classification
    if f["is_huf"] and not p["allow_huf"]:
        out.append("huf")
    if f["is_agriculture"] and not p["allow_agriculture"]:
        out.append("agriculture")

    # Employment & income
    if f["occupation"] == "Salaried":
        if f["salary"] < p["min_salary"]:
            out.append("min_salary")
        if f["cash_salary"] and not p["allow_cash_salary"]:
            out.append("cash_salary")
        if f["work_exp_years"] < p["min_total_experience_years"]:
            out.append("work_experience")
        if f["current_company_years"] < p["min_current_company_years"]:
            out.append("company_tenure")
        if f["no_income_proof"]:
            if not p["allow_no_income_proof"]:
                out.append("no_income_proof")
        elif f["form_16_years"] < p["form16_years_required"]:
            out.append("form16")
        if f["age_at_last_emi"] > p["max_age_emi_salaried"]:
            out.append("age_emi_salaried")
    else:
        if f["business_years"] < p["min_business_itr_years"]:
            out.append("business_itr_years")
        if not f["itr_filed"]:
            if not p["allow_itr_not_filed"]:
                out.append("itr_not_filed")
        else:
            if f["current_itr"] < p["se_min_current_itr"]:
                out.append("se_current_itr")
            if p["se_combined_itr"]:
                if f["current_itr"] + f["previous_itr"] < 600000:
                    out.append("se_combined_itr")
            elif f["previous_itr"] < p["se_min_prev_itr"]:
                out.append("se_prev_itr")
        if not f["business_proof"]:
            out.append("business_proof")
        if f["age_at_last_emi"] > p["max_age_emi_self_employed"]:
            out.append("age_emi_self_employed")

    # Secondary rental income
    if f["rental"] and not p["allow_rental"][f["rental"]]:
        out.append(f"rental_{f['rental']}")

    # Residence / office tenure & guarantor
    if f["both_rented"]:
        permitted = p["allow_with_guarantor"] if f["guarantor"] else p["allow_without_guarantor"]
        if not permitted:
            out.append("both_rented_guarantor")

    # Existing banking relationship
    if f["car_loan"] and not p["allow_existing_car_loan"]:
        out.append("existing_car_loan")

    # Co-applicant relationships
    for key in f["coapp"]:
        if not p["coapp"][key]:
            out.append(f"coapp_{key}")

    return out


# --------------------------------------------------------------------------- #
# 3. Case construction: semantic facts -> (form payload, derived facts)
# --------------------------------------------------------------------------- #

RENTAL_FORM_VALUE = {
    "NO_ITR_NOT_IN_BANK": "Rental Income-with Agreement -Not filed ITR-Not reflecting in Bank",
    "ITR_NOT_IN_BANK": "Rental Income-with Agreement filed ITR- Not reflecting in Bank",
    "NO_ITR_IN_BANK": "Rental Income-with Agreement -Not filed ITR-reflecting in Bank",
}
WRITE_OFF_FORM_FLAG = {
    "PL": "bureauFlagPL", "HL": "bureauFlagHome", "CONSUMER": "bureauFlagConsumer",
    "AGRI": "bureauFlagAgri", "MSME": "bureauFlagMSME", "AUTO": "bureauFlagAuto",
    "CC": "bureauFlagCC",
}

DEFAULTS: Dict[str, Any] = {
    "entity": "Individual", "occupation": "Salaried", "selected": "BOI",
    "age": 34, "is_nri": False, "nri_months": 0,
    "cibil": 800, "dpd": 0, "currently_outstanding": 0.0, "loan_enquiry": 0,
    "write_off_type": None, "write_off_amount": 0.0,
    "age_at_last_emi": 55, "car_loan": False,
    "salary_band": "gt25000", "cash_salary": False, "tenure_band": "2y+",
    "prev_joining_years_ago": None, "no_income_proof": False, "rental": None,
    "current_itr": 500000.0, "previous_itr": 350000.0, "itr_filed": True,
    "business_years_ago": 10, "business_proof": True, "business_entity": "Propreitorship",
    "residence": "Owned House", "office": None, "office_status": None, "guarantor": None,
    "coapp_age": "None", "coapp_income": "None",
}

TENURE_MONTHS = {"0-6m": 0, "6m-1y": 6, "1y-2y": 12, "2y+": 24}


def derive(c: Dict[str, Any]) -> Dict[str, Any]:
    """The numeric inputs the engine is expected to see for this case."""
    months = TENURE_MONTHS[c["tenure_band"]]
    work_exp = c["prev_joining_years_ago"] if c["prev_joining_years_ago"] else months // 12
    is_huf = c["entity"] == "HUF" or c["business_entity"] == "HUF"
    coapp = []
    if c["coapp_age"] != "None":
        coapp.append(f"AGE_{c['coapp_age']}")
    if c["coapp_income"] != "None":
        coapp.append(f"INC_{c['coapp_income']}")
    return {
        "age": c["age"],
        "is_nri": c["is_nri"],
        "nri_stay_years": c["nri_months"] / 12.0,
        "cibil": c["cibil"],
        "dpd": c["dpd"],
        "currently_outstanding": c["currently_outstanding"],
        "loan_enquiry": c["loan_enquiry"],
        "write_off_type": c["write_off_type"],
        "write_off_amount": c["write_off_amount"],
        "is_huf": is_huf,
        "is_agriculture": c["business_entity"] == "Agriculture",
        "occupation": c["occupation"],
        "salary": 50000.0 if c["salary_band"] == "gt25000" else 20000.0,
        "cash_salary": c["cash_salary"],
        "work_exp_years": work_exp,
        "current_company_years": months / 12.0,
        "no_income_proof": c["no_income_proof"],
        "form_16_years": 0 if c["no_income_proof"] else 2,
        "age_at_last_emi": c["age_at_last_emi"],
        "business_years": c["business_years_ago"],
        "itr_filed": c["itr_filed"],
        "current_itr": c["current_itr"],
        "previous_itr": c["previous_itr"],
        "business_proof": c["business_proof"],
        "rental": c["rental"],
        "both_rented": c["residence"] == "Rented House" and c["office"] == "Separate"
                       and c["office_status"] == "Rented",
        "guarantor": c["guarantor"] == "With a Gaurantor",
        "car_loan": c["car_loan"],
        "coapp": coapp,
    }


def build_form(c: Dict[str, Any]) -> Dict[str, Any]:
    dob = TODAY.replace(year=TODAY.year - c["age"])
    est = TODAY.replace(year=TODAY.year - c["business_years_ago"])

    banking: Dict[str, Any] = {
        "existingAccountBank": FORM_SELECTABLE[c["selected"]],
        "existingCarLoanBank": "BOB" if c["car_loan"] else "None",
        "loanType": "Auto Loan",
        "bureauCibilScore": c["cibil"],
        "bureauDpd": c["dpd"],
        "bureauLoanEnquiry": c["loan_enquiry"],
        "bureauCurrentlyOutstanding": c["currently_outstanding"],
        "bureauAgeAtLastEMI": c["age_at_last_emi"],
    }
    if c["write_off_type"]:
        banking[WRITE_OFF_FORM_FLAG[c["write_off_type"]]] = True
        banking["bureauWriteOffAmount"] = c["write_off_amount"]

    if c["entity"] == "HUF":
        identity = {
            "entityType": "HUF", "applicantName": "Sharma HUF", "hufName": "Sharma HUF",
            "hufPan": "AAAHS1234F", "kartaName": "Rakesh Sharma", "kartaPan": "ABCDE1234F",
        }
        occupation = {
            "profileType": "HUF", "officeAddressType": "Same",
            "businessEstablishmentDate": est.isoformat(),
            "itrFilingStatus": "Self employed ITR Filled" if c["itr_filed"] else "ITR Not Filed",
            "businessProof": "GSTIN: 29AAAAA0000A1Z5" if c["business_proof"] else None,
        }
        if c["itr_filed"]:
            occupation["currentITRAmount"] = c["current_itr"]
            occupation["prevITRAmount"] = c["previous_itr"]
        if c["rental"]:
            occupation["rentalIncomeTypeSelfEmployed"] = RENTAL_FORM_VALUE[c["rental"]]
    else:
        identity = {
            "entityType": "Individual", "applicantName": "Rohan Sharma",
            "dob": dob.isoformat(), "pan": "ABCDE1234F", "phone": "9876543210",
            "email": "rohan.sharma@example.com",
            "citizenshipStatus": "NRI/PIO" if c["is_nri"] else "Resident Indian",
        }
        if c["is_nri"]:
            identity["nriStayPeriod"] = c["nri_months"]

        if c["occupation"] == "Salaried":
            occupation = {
                "profileType": "Salaried", "tenureBand": c["tenure_band"],
                "grossSalaryBand": c["salary_band"],
                "salaryMode": "Salary payment mode-Cash" if c["cash_salary"]
                              else "Salary payment mode- Bank Credit",
                "form16Status": "No Income Proof" if c["no_income_proof"] else "Form 16",
            }
            if c["prev_joining_years_ago"]:
                prev = TODAY.replace(year=TODAY.year - c["prev_joining_years_ago"])
                occupation["prevCompanyName"] = "Prior Employer Pvt Ltd"
                occupation["prevCompanyJoining"] = prev.isoformat()
            if c["rental"]:
                occupation["rentalIncomeTypeSalaried"] = RENTAL_FORM_VALUE[c["rental"]]
        else:
            occupation = {
                "profileType": "Self-Employed",
                "businessEntityType": c["business_entity"],
                "businessEstablishmentDate": est.isoformat(),
                "currentITRAmount": c["current_itr"], "prevITRAmount": c["previous_itr"],
                "businessItrAmount": c["current_itr"],
                "businessProof": "GSTIN: 29AAAAA0000A1Z5" if c["business_proof"] else None,
            }
            if c["office"]:
                occupation["officeAddressType"] = c["office"]
                if c["office"] == "Separate":
                    occupation["officeAddress"] = "Indiranagar, Bengaluru"
                    occupation["officePremisesStatus"] = c["office_status"]
            if c["guarantor"]:
                occupation["guarantorStatus"] = c["guarantor"]
            if c["rental"]:
                occupation["rentalIncomeTypeSelfEmployed"] = RENTAL_FORM_VALUE[c["rental"]]

    payload: Dict[str, Any] = {
        "identity": identity,
        "address": {"pincode": "560001", "residentDetails": c["residence"]},
        "occupation": occupation,
        "banking": banking,
        "coApplicant": {"coAppAgeRelation": c["coapp_age"], "coAppIncomeRelation": c["coapp_income"]},
    }
    if c["coapp_income"] != "None":
        payload["coApplicant"].update({
            "coApplicantName": "Anil Sharma", "coApplicantDob": "1965-03-10",
            "coApplicantOccupation": "Salaried",
        })
    return payload


# --------------------------------------------------------------------------- #
# 4. Test cases — one clean baseline plus a targeted mutation per policy column
# --------------------------------------------------------------------------- #

SELF_EMPLOYED = {"occupation": "Self-Employed", "office": "Same"}


def cases() -> List[Tuple[str, Dict[str, Any]]]:
    out: List[Tuple[str, Dict[str, Any]]] = []

    def add(name: str, **over: Any) -> None:
        out.append((name, {**DEFAULTS, **over}))

    for bank in FORM_SELECTABLE:
        b = {"selected": bank}
        floor = int(POLICIES[bank]["min_cibil"])
        add(f"{bank}/clean-salaried", **b)
        add(f"{bank}/clean-self-employed", **b, **SELF_EMPLOYED)
        add(f"{bank}/cibil-at-floor", **b, cibil=floor)
        add(f"{bank}/cibil-below-floor", **b, cibil=floor - 1)
        add(f"{bank}/dpd-1", **b, dpd=1)
        add(f"{bank}/dpd-89", **b, dpd=89)
        add(f"{bank}/dpd-90", **b, dpd=90)
        add(f"{bank}/cc-write-off-4999", **b, write_off_type="CC", write_off_amount=4999.0)
        add(f"{bank}/cc-write-off-5000", **b, write_off_type="CC", write_off_amount=5000.0)
        add(f"{bank}/cc-write-off-9999", **b, write_off_type="CC", write_off_amount=9999.0)
        add(f"{bank}/pl-write-off", **b, write_off_type="PL", write_off_amount=1000.0)
        add(f"{bank}/auto-write-off", **b, write_off_type="AUTO", write_off_amount=1000.0)
        add(f"{bank}/currently-outstanding", **b, currently_outstanding=15000.0)
        add(f"{bank}/loan-enquiry", **b, loan_enquiry=3)
        add(f"{bank}/age-20", **b, age=20)
        add(f"{bank}/emi-age-61", **b, age_at_last_emi=61)
        add(f"{bank}/emi-age-71", **b, age_at_last_emi=71)
        add(f"{bank}/emi-age-66-self-employed", **b, **SELF_EMPLOYED, age_at_last_emi=66)
        add(f"{bank}/cash-salary", **b, cash_salary=True)
        add(f"{bank}/salary-below-floor", **b, salary_band="lt25000")
        add(f"{bank}/no-income-proof", **b, no_income_proof=True)
        add(f"{bank}/tenure-1y", **b, tenure_band="1y-2y", prev_joining_years_ago=4)
        add(f"{bank}/tenure-6m", **b, tenure_band="6m-1y", prev_joining_years_ago=4)
        add(f"{bank}/car-loan", **b, car_loan=True)
        add(f"{bank}/nri-24-months", **b, is_nri=True, nri_months=24)
        add(f"{bank}/nri-12-months", **b, is_nri=True, nri_months=12)
        for rental in RENTAL_FORM_VALUE:
            add(f"{bank}/rental-{rental}", **b, rental=rental)
        add(f"{bank}/se-current-itr-low", **b, **SELF_EMPLOYED, current_itr=90000.0)
        add(f"{bank}/se-prev-itr-low", **b, **SELF_EMPLOYED, previous_itr=90000.0)
        add(f"{bank}/se-business-2y", **b, **SELF_EMPLOYED, business_years_ago=2)
        add(f"{bank}/se-no-business-proof", **b, **SELF_EMPLOYED, business_proof=False)
        add(f"{bank}/se-agriculture", **b, **SELF_EMPLOYED, business_entity="Agriculture")
        add(f"{bank}/huf-entity", **b, entity="HUF")
        add(f"{bank}/huf-itr-not-filed", **b, entity="HUF", itr_filed=False)
        add(f"{bank}/both-rented-with-guarantor", **b, occupation="Self-Employed",
            residence="Rented House", office="Separate", office_status="Rented",
            guarantor="With a Gaurantor")
        add(f"{bank}/both-rented-without-guarantor", **b, occupation="Self-Employed",
            residence="Rented House", office="Separate", office_status="Rented",
            guarantor="Without a Gaurantor")
        add(f"{bank}/resi-cum-office-rented", **b, **SELF_EMPLOYED, residence="Rented House")
        add(f"{bank}/coapp-age-brother", **b, coapp_age="Brother")
        add(f"{bank}/coapp-income-sister", **b, coapp_income="Sister")
        add(f"{bank}/coapp-income-father", **b, coapp_income="Father")

    return out


# --------------------------------------------------------------------------- #
# 5. Test harness
# --------------------------------------------------------------------------- #


async def _mock_db():
    session = MagicMock()
    fut: Any = asyncio.Future()
    fut.set_result(MagicMock())
    session.execute.return_value = fut
    session.flush.return_value = fut
    session.commit.return_value = fut
    session.rollback.return_value = fut
    yield session


mock_redis = AsyncMock()
mock_redis.incr.return_value = 1
mock_redis.expire.return_value = True
mock_redis.get.return_value = None
mock_redis.setex.return_value = True
redis_module.redis_client = mock_redis


async def _mock_redis_dep():
    return mock_redis


app.dependency_overrides[get_db] = _mock_db
app.dependency_overrides[get_redis] = _mock_redis_dep
client = TestClient(app)

CASES = cases()

# Sheet column -> the BANK_MATRIX_RULES key that must carry its value.
CONSTANT_CORRESPONDENCE = [
    ("min_cibil", "min_cibil"),
    ("max_cc_write_off", "max_cc_write_off_amount"),
    ("max_dpd", "max_dpd"),
    ("allow_loan_enquiry", "allow_loan_enquiry"),
    ("min_age", "min_age"),
    ("max_age_emi_salaried", "max_age_emi_salaried"),
    ("max_age_emi_self_employed", "max_age_emi_self_employed"),
    ("allow_without_guarantor", "allow_without_guarantor"),
    ("allow_with_guarantor", "allow_with_guarantor"),
    ("allow_nri", "allow_nri"),
    ("min_nri_stay_years", "min_nri_stay_years"),
    ("allow_agriculture", "allow_agriculture"),
    ("min_total_experience_years", "min_total_experience_years"),
    ("min_current_company_years", "min_current_company_tenure_years"),
    ("allow_no_income_proof", "allow_no_income_proof"),
    ("min_salary", "min_salary"),
    ("se_min_current_itr", "se_min_current_itr"),
    ("allow_itr_not_filed", "allow_itr_not_filed"),
    ("min_business_itr_years", "min_business_itr_years"),
    ("allow_huf", "allow_huf"),
    ("form16_years_required", "form16_years_required"),
]


@pytest.mark.parametrize("bank", sorted(SHEET_NAME_TO_CODE.values()))
def test_policy_constants_match_spreadsheet(bank: str) -> None:
    """Every threshold and flag in the code matrix equals its spreadsheet cell."""
    sheet, code_policy = POLICIES[bank], BANK_MATRIX_RULES[bank]

    for sheet_key, code_key in CONSTANT_CORRESPONDENCE:
        assert float(sheet[sheet_key]) == float(code_policy[code_key]), (
            f"{bank}.{code_key}: sheet={sheet[sheet_key]} code={code_policy[code_key]}"
        )

    for rental_class, allowed in sheet["allow_rental"].items():
        code_key = RENTAL_CLASS_TO_FLAG[rental_class]
        assert code_policy[code_key] == allowed, f"{bank}.{code_key}"

    for write_off_type, allowed in sheet["allow_write_off"].items():
        code_key = {"PL": "allow_pl_write_off", "HL": "allow_hl_write_off",
                    "CONSUMER": "allow_consumer_write_off", "AGRI": "allow_agri_write_off",
                    "MSME": "allow_msme_write_off", "AUTO": "allow_auto_write_off",
                    "CC": "allow_cc_write_off"}[write_off_type]
        assert code_policy[code_key] == allowed, f"{bank}.{code_key}"

    # Cols 56-58/61 collapse to one flag only while they agree with each other.
    sibling = {sheet["coapp"][k] for k in ("AGE_Brother", "AGE_Sister", "INC_Brother", "INC_Sister")}
    assert len(sibling) == 1, f"{bank}: sheet disagrees across the sibling co-applicant columns"
    assert code_policy["allow_sibling_coapplicant"] == sibling.pop(), (
        f"{bank}.allow_sibling_coapplicant"
    )


@pytest.mark.parametrize("case", [c for _, c in CASES], ids=[n for n, _ in CASES])
def test_endpoint_verdict_matches_spreadsheet(case: Dict[str, Any]) -> None:
    """The API's verdict — and every bank in its eligibility map — matches the sheet."""
    facts = derive(case)
    response = client.post(
        "/api/v1/onboarding/evaluate/form",
        json=build_form(case),
        headers={"X-Tenant-ID": TENANT},
    )
    assert response.status_code == 200, response.text
    body = response.json()

    selected = case["selected"]
    expected_overall = not sheet_rejects(selected, facts)
    assert body["overall_eligible"] == expected_overall, (
        f"selected={selected} sheet_says={sheet_rejects(selected, facts) or ['<eligible>']} "
        f"engine_says={[r['rule_id'] for r in body['rejection_reasons']] or ['<eligible>']}"
    )

    # The map is each bank's own verdict ANDed with the selected bank's.
    for code in POLICIES:
        expected = (not sheet_rejects(code, facts)) and expected_overall
        assert body["bank_eligibility"][code] == expected, (
            f"bank_eligibility[{code}] sheet_says={sheet_rejects(code, facts) or ['<eligible>']}"
        )


# --------------------------------------------------------------------------- #
# 6. Independent per-bank verification
# --------------------------------------------------------------------------- #
#
# The endpoint's bank_eligibility map is each bank's verdict ANDed with the
# selected bank's, so once the selected bank rejects, every entry is False and
# the map assertions above can no longer distinguish a correct policy from a
# broken one. These tests evaluate each bank as the selected bank directly —
# un-ANDed — which is also the only way HDFC / AXIS / Kotak get covered, since
# the form's bank list cannot select them.

SCENARIOS = [(name.split("/", 1)[1], case) for name, case in CASES if case["selected"] == "BOI"]


@pytest.mark.parametrize("case", [c for _, c in SCENARIOS], ids=[n for n, _ in SCENARIOS])
def test_every_bank_verdict_matches_spreadsheet(case: Dict[str, Any]) -> None:
    """Each of the 8 banks, scored independently on the same applicant."""
    facts = derive(case)
    engine_payload = OnboardingFormRequest.model_validate(build_form(case)).to_engine_payload()

    for bank in POLICIES:
        payload = {**engine_payload, "selected_bank": bank}
        verdict = asyncio.run(bre_engine_service.evaluate_application(payload, tenant_id="default"))
        expected = not sheet_rejects(bank, facts)
        assert verdict["overall_eligible"] == expected, (
            f"{bank}: sheet_says={sheet_rejects(bank, facts) or ['<eligible>']} "
            f"engine_says={[r['rule_id'] for r in verdict['rejection_reasons']] or ['<eligible>']}"
        )


# --------------------------------------------------------------------------- #
# 7. Column coverage — no policy column may be silently ignored
# --------------------------------------------------------------------------- #

METADATA_COLUMNS = {0, 1}

# Columns with a rejection path in the engine, conformance-tested above.
EVALUATED_COLUMNS = {
    2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 22, 23, 25, 26, 27,
    33, 34, 35, 37, 38, 39, 40, 41, 42, 43, 46, 47, 48, 54, 55, 56, 57, 58, 59, 60, 61,
}

# Permissive for every bank, so they cannot change any verdict. Deliberately
# unimplemented — but only while they stay uniform, which this module enforces.
INERT_COLUMNS = {19, 20, 24, 28, 29, 30, 31, 32, 36, 44, 45, 49, 50, 51, 52, 53}

# Columns that discriminate between banks but are NOT enforced, each pending a
# policy decision rather than an implementation.
DEFERRED_COLUMNS = {
    17: "Existing A/C Holder (IOB=false): the form's bank selector *is* the "
        "applicant's existing-account bank, so the literal reading makes IOB "
        "reject every applicant who banks with IOB. Needs the sheet owner's intent.",
    21: "Resi-Office-Separate-Both Rented: contradicts cols 22/23 for BOB and "
        "HDFC. Cols 22/23 are treated as authoritative; see sheet_rejects().",
}


def test_column_classification_covers_the_whole_sheet() -> None:
    """Every column is evaluated, provably inert, or explicitly deferred."""
    ws = openpyxl.load_workbook(str(SHEET_PATH), data_only=True)["decision table"]
    classified = METADATA_COLUMNS | EVALUATED_COLUMNS | INERT_COLUMNS | set(DEFERRED_COLUMNS)

    assert classified == set(range(ws.max_column)), (
        f"unclassified columns: {sorted(set(range(ws.max_column)) - classified)} — "
        "the sheet changed shape; classify them before shipping"
    )


@pytest.mark.parametrize("column", sorted(INERT_COLUMNS))
def test_inert_columns_stay_uniform(column: int) -> None:
    """An inert column that starts discriminating needs a rule, not silence."""
    ws = openpyxl.load_workbook(str(SHEET_PATH), data_only=True)["decision table"]
    rows = list(ws.iter_rows(values_only=True))
    values = {str(row[column]).strip().lower() for row in rows[1:]}

    assert values == {"true"}, (
        f"col {column} ({rows[0][column]}) is no longer permissive for every bank "
        f"({values}); it now affects verdicts and needs a rejection path"
    )


def test_deferred_columns_still_need_a_decision() -> None:
    """Guard the deferrals: if the sheet is corrected, revisit them."""
    ws = openpyxl.load_workbook(str(SHEET_PATH), data_only=True)["decision table"]
    rows = list(ws.iter_rows(values_only=True))[1:]
    flag = lambda row, col: str(row[col]).strip().lower() == "true"  # noqa: E731

    assert len({flag(r, 17) for r in rows}) > 1, (
        "col 17 is now uniform — the deferral in DEFERRED_COLUMNS is obsolete"
    )
    contradictory = [r[0] for r in rows if flag(r, 21) and not (flag(r, 22) or flag(r, 23))]
    assert contradictory, (
        "cols 21/22/23 no longer contradict each other — drop the tie-break in "
        "sheet_rejects() and read col 21 directly"
    )
