from app.services.pre_foir_service import (
    pre_foir_service,
    PreFoirYearInput,
    DocumentIncomeInput,
    TaxDeductionDetails,
)
from app.services.foir_service import foir_service, calculate_emi, calculate_present_value_loan


def test_pre_foir_calculation_with_deductions():
    # Test year 1: Line 1A=15L, Line 6=3L -> Base=12L
    # Deductions: other interest = 1L, partner remuneration = 40K -> deductible interest = 60K
    # Capital gains: STCG=50K, LTCG=90K -> capital gains deduction = 1.4L
    # Adjusted = 12L - 60K - 1.4L = 10L (1,000,000)
    curr_doc = DocumentIncomeInput(
        gross_receipts_line_1a=1500000.0,
        expenses_line_6=300000.0,
        deductions=TaxDeductionDetails(
            other_interest_income=100000.0,
            interest_on_partners_capital=0.0,
            partner_remuneration=40000.0,
            short_term_capital_gains=50000.0,
            long_term_capital_gains=90000.0,
        )
    )
    # Year 2: Line 1A=10L, Line 6=2L -> Base=8L, no deductions -> Adjusted = 8L
    prev_doc = DocumentIncomeInput(
        gross_receipts_line_1a=1000000.0,
        expenses_line_6=200000.0,
    )
    result = pre_foir_service.compute_self_employed_income(
        current_year=PreFoirYearInput(itr=curr_doc),
        previous_year=PreFoirYearInput(itr=prev_doc),
    )
    assert result.current_year_adjusted == 1000000.0
    assert result.previous_year_adjusted == 800000.0
    # Average = (10L + 8L) / 2 = 9L (900,000)
    assert result.two_year_average_annual_income == 900000.0
    assert result.monthly_equivalent_income == 75000.0


def test_foir_bob_salaried():
    # BOB Salaried: Gross = 75,000 (Slab 50k-150k -> 70% FOIR)
    # Net = 65,000, Existing EMI = 10,000
    # Max allowable EMI = 65,000 * 0.70 = 45,500
    # Capacity = 45,500 - 10,000 = 35,500
    res = foir_service.evaluate_bank_foir(
        bank_code="BOB",
        occupation="Salaried",
        gross_monthly_income=75000.0,
        net_monthly_income=65000.0,
        annual_income=900000.0,
        existing_monthly_emi=10000.0,
        requested_loan_amount=1000000.0,
        loan_tenure_months=84,
        loan_type="Auto Loan",
    )
    assert res.foir_percentage == 0.70
    assert res.max_allowable_emi == 45500.0
    assert res.eligible_emi_capacity == 35500.0
    assert res.is_eligible is True
    assert res.max_eligible_loan_amount > 1500000.0  # ~22L capacity for 35.5k EMI at 9% for 84m
    assert res.loan_amount_approved == 1000000.0  # requested was 10L, so approved 10L


def test_foir_indian_bank_flat_deduction():
    # Indian Bank Salaried above 15 Lakh: Net - 50,000 - Existing EMI
    res = foir_service.evaluate_bank_foir(
        bank_code="INDIAN_BANK",
        occupation="Salaried",
        gross_monthly_income=150000.0,  # 18L per year (> 15L)
        net_monthly_income=130000.0,
        annual_income=1800000.0,
        existing_monthly_emi=20000.0,
        loan_tenure_months=84,
    )
    assert res.rule_type == "flat_deduction"
    # Max EMI = 130,000 - 50,000 = 80,000
    assert res.max_allowable_emi == 80000.0
    # Capacity = 80,000 - 20,000 = 60,000
    assert res.eligible_emi_capacity == 60000.0


def test_foir_iob_dgm_approval():
    # IOB income > 1 Lakh triggers DGM approval tag
    res = foir_service.evaluate_bank_foir(
        bank_code="IOB",
        occupation="Salaried",
        gross_monthly_income=120000.0,
        net_monthly_income=105000.0,
        annual_income=1440000.0,
        existing_monthly_emi=15000.0,
    )
    assert res.foir_percentage == 0.70
    assert res.dgm_approval_required is True
