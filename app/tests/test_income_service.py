"""Unit and integration tests for Phase 1 Income Calculation Service and API endpoint."""

import pytest
from fastapi.testclient import TestClient

from app.api.schemas.income import (
    Phase1IncomeCalculationRequest,
    Phase1IncomeCalculationResponse,
    YearlyIncomeInput,
)
from app.main import app
from app.services.income_service import income_service

client = TestClient(app)


def test_yearly_income_calculation_basic():
    """Verify standard formula calculations for a single tax year:

    income_from_calc = total_income - total_tax_interest_and_fee_payable
    income_from_other_sources = total_other_interest_income - (interest_on_partners_capital + partner_remuneration)
    total_passive_deductions = income_from_other_sources + income_from_capital_gain
    final_yearly_income = income_from_calc - total_passive_deductions
    """
    year_data = YearlyIncomeInput(
        total_income=1200000,
        total_tax_interest_and_fee_payable=150000,
        total_other_interest_income=80000,
        interest_on_partners_capital=20000,
        partner_remuneration=30000,
        income_from_capital_gain=40000,
    )

    breakdown = income_service.compute_yearly_income(year_data)

    # 1. 1,200,000 - 150,000 = 1,050,000
    assert breakdown.income_from_calc == 1050000.0

    # 2. 80,000 - (20,000 + 30,000) = 30,000
    assert breakdown.income_from_other_sources == 30000.0

    # 3. 30,000 + 40,000 = 70,000
    assert breakdown.total_passive_deductions == 70000.0

    # 4. 1,050,000 - 70,000 = 980,000
    assert breakdown.final_yearly_income == 980000.0


def test_yearly_income_other_sources_clamped_to_zero():
    """When partner remuneration and interest exceed other interest income,

    income_from_other_sources must not become negative.
    """
    year_data = YearlyIncomeInput(
        total_income=800000,
        total_tax_interest_and_fee_payable=50000,
        total_other_interest_income=20000,
        interest_on_partners_capital=30000,  # exceeds other income
        partner_remuneration=10000,
        income_from_capital_gain=0,
    )

    breakdown = income_service.compute_yearly_income(year_data)

    assert breakdown.income_from_calc == 750000.0
    assert breakdown.income_from_other_sources == 0.0
    assert breakdown.total_passive_deductions == 0.0
    assert breakdown.final_yearly_income == 750000.0


def test_phase1_2year_average_calculation():
    """Verify 2-year average calculation with current year and previous year."""
    req = Phase1IncomeCalculationRequest(
        current_year=YearlyIncomeInput(
            total_income=1200000,
            total_tax_interest_and_fee_payable=150000,
            total_other_interest_income=80000,
            interest_on_partners_capital=20000,
            partner_remuneration=30000,
            income_from_capital_gain=40000,
        ),
        previous_year=YearlyIncomeInput(
            total_income=1000000,
            total_tax_interest_and_fee_payable=120000,
            total_other_interest_income=60000,
            interest_on_partners_capital=15000,
            partner_remuneration=25000,
            income_from_capital_gain=20000,
        ),
    )

    res = income_service.calculate_phase1_income(req)

    # Current year: 1,050,000 - (30,000 + 40,000) = 980,000
    assert res.income_current_year == 980000.0

    # Previous year: 880,000 - (20,000 + 20,000) = 840,000
    assert res.income_previous_year == 840000.0

    # Average: (980,000 + 840,000) / 2 = 910,000
    assert res.average_income == 910000.0


def test_phase1_api_endpoint():
    """Test POST /api/v1/onboarding/income/phase1-calculate."""
    payload = {
        "current_year": {
            "total_income": 1200000,
            "total_tax_interest_and_fee_payable": 150000,
            "total_other_interest_income": 80000,
            "interest_on_partners_capital": 20000,
            "partner_remuneration": 30000,
            "income_from_capital_gain": 40000,
        },
        "previous_year": {
            "total_income": 1000000,
            "total_tax_interest_and_fee_payable": 120000,
            "total_other_interest_income": 60000,
            "interest_on_partners_capital": 15000,
            "partner_remuneration": 25000,
            "income_from_capital_gain": 20000,
        },
    }

    response = client.post(
        "/api/v1/onboarding/income/phase1-calculate",
        json=payload,
        headers={"X-Tenant-ID": "tenant_alpha"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["income_current_year"] == 980000.0
    assert data["income_previous_year"] == 840000.0
    assert data["average_income"] == 910000.0
    assert data["current_year_breakdown"]["income_from_calc"] == 1050000.0
    assert data["previous_year_breakdown"]["income_from_calc"] == 880000.0


def test_extract_from_documents_mapping():
    """Test extracting values from mock ITR and COI schemas."""
    mock_itr = {
        "data": {
            "taxable_income_and_tax_details": {
                "total_income": 1500000,
                "total_tax_interest_and_fee_payable": 200000,
            }
        }
    }
    mock_coi = {
        "summary": {
            "total_other_sources": 50000,
            "total_capital_gains": 25000,
        }
    }

    extracted = income_service.extract_from_documents(
        itr_payload=mock_itr,
        coi_payload=mock_coi,
        manual_overrides={"partner_remuneration": 10000},
    )

    assert extracted.total_income == 1500000.0
    assert extracted.total_tax_interest_and_fee_payable == 200000.0
    assert extracted.total_other_interest_income == 50000.0
    assert extracted.income_from_capital_gain == 25000.0
    assert extracted.partner_remuneration == 10000.0
