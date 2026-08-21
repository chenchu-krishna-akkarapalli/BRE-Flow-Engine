"""Tests for Nested Relational Payslip Engine Mapping & Validation."""

import json
from pathlib import Path
import pytest

from app.services.payslip_service import map_to_payslip_fields, _detect_salary_payment_method

PAYSLIP_OUTPUT_DIR = Path("cibil-pdf-scrapper/payslip-output")


def _sample_json_files():
    if not PAYSLIP_OUTPUT_DIR.exists():
        return []
    return [p for p in PAYSLIP_OUTPUT_DIR.glob("*.json") if p.stat().st_size > 500]


@pytest.mark.parametrize("json_path", _sample_json_files())
def test_payslip_nested_relational_mapping(json_path: Path):
    with open(json_path, "r", encoding="utf-8", errors="ignore") as f:
        data = json.load(f)

    mapped = map_to_payslip_fields(data)

    assert "evaluated" in mapped
    assert "transparentBreakdown" in mapped

    evaluated = mapped["evaluated"]
    breakdown = mapped["transparentBreakdown"]

    monthly_gross = evaluated["monthlyGrossSalary"]
    annual_gross = evaluated["annualGrossSalary"]
    payment_method = evaluated["salaryPaymentMethod"]

    # 1. monthlyGrossSalary matches annual / 12
    assert annual_gross == round(monthly_gross * 12.0, 2)

    # 2. totalDeductions matches sum of deductionsBreakdown
    total_deductions = breakdown["totalDeductions"]
    computed_deductions_sum = round(
        sum(item["amount"] for item in breakdown["deductionsBreakdown"] if isinstance(item.get("amount"), (int, float))),
        2,
    )
    assert total_deductions == computed_deductions_sum

    # 3. monthlyNetSalary equals gross - deductions (or parsed net pay)
    monthly_net = breakdown["monthlyNetSalary"]
    assert isinstance(monthly_net, float)
    assert monthly_net >= 0.0

    # 4. salaryPaymentMethod is either 'Bank Account' or 'Cash'
    assert payment_method in ("Bank Account", "Cash")


def test_salary_payment_method_detection():
    data_with_bank = {
        "employee": {"bank_account": "XXXX1234", "pan": "ABCDE1234F"},
        "gross_earnings": {"paise": 5000000},
    }
    assert _detect_salary_payment_method(data_with_bank, data_with_bank["employee"]) == "Bank Account"

    data_with_uan = {
        "employee": {"uan": "100987654321"},
        "gross_earnings": {"paise": 5000000},
    }
    assert _detect_salary_payment_method(data_with_uan, data_with_uan["employee"]) == "Bank Account"

    data_cash = {
        "employee": {"name": "Test User"},
        "gross_earnings": {"paise": 1500000},
    }
    assert _detect_salary_payment_method(data_cash, data_cash["employee"]) == "Cash"
