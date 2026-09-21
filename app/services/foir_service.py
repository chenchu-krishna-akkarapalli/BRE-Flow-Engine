"""FOIR calculation and Loan Sanction Amount engine.

Encodes policy matrices from CRE-docs/FOIR Calculation (1).xlsx:
- Bank of Baroda (BOB)
- Bank of Maharashtra (BOM)
- Bank of India (BOI)
- Indian Bank (with flat 50k deduction and 40% gross rules)
- Indian Overseas Bank (IOB with DGM approval tag)
- Benchmark defaults for HDFC, Axis, Kotak

Computes:
1. FOIR percentage applied
2. Maximum allowable total monthly EMI
3. Eligible monthly EMI capacity after deducting existing EMIs
4. Maximum sanctionable loan amount using present-value (PV) formula
5. DGM approval / special escalation tags
"""

from typing import Any, Dict, Optional, Tuple
from pydantic import BaseModel, Field


DEFAULT_BENCHMARK_RATES = {
    "AUTO LOAN": 9.0,
    "PERSONAL LOAN": 12.0,
    "HOME LOAN": 8.5,
    "DEFAULT": 9.5,
}

DEFAULT_LOAN_TENOR_MONTHS = 84  # 7 years


class BankFoirResult(BaseModel):
    bank_code: str
    is_eligible: bool
    foir_percentage: float
    max_allowable_emi: float
    eligible_emi_capacity: float
    max_eligible_loan_amount: float
    requested_loan_amount: Optional[float] = None
    loan_amount_approved: float = 0.0
    proposed_emi: float = 0.0
    existing_monthly_emi: float = 0.0
    dgm_approval_required: bool = False
    rule_type: str = "percentage"
    notes: str = ""


def calculate_emi(principal: float, annual_rate: float, tenure_months: int) -> float:
    """Standard banking monthly EMI formula: P * r * (1+r)^n / ((1+r)^n - 1)"""
    if principal <= 0 or tenure_months <= 0:
        return 0.0
    if annual_rate <= 0:
        return round(principal / tenure_months, 2)

    r = (annual_rate / 100.0) / 12.0
    n = tenure_months
    factor = (1.0 + r) ** n
    emi = principal * r * factor / (factor - 1.0)
    return round(emi, 2)


def calculate_present_value_loan(monthly_emi_capacity: float, annual_rate: float, tenure_months: int) -> float:
    """Calculates maximum loan amount from monthly EMI capacity: PV = E * [1 - (1+r)^(-n)] / r"""
    if monthly_emi_capacity <= 0 or tenure_months <= 0:
        return 0.0
    if annual_rate <= 0:
        return round(monthly_emi_capacity * tenure_months, 2)

    r = (annual_rate / 100.0) / 12.0
    n = tenure_months
    pv = monthly_emi_capacity * (1.0 - (1.0 + r) ** (-n)) / r
    return round(max(0.0, pv), 2)


class FoirService:
    """Multi-bank FOIR and Loan Eligibility Engine."""

    def evaluate_bank_foir(
        self,
        bank_code: str,
        occupation: str,  # "Salaried" or "Self-Employed"
        gross_monthly_income: float,
        net_monthly_income: Optional[float],
        annual_income: float,
        existing_monthly_emi: float = 0.0,
        requested_loan_amount: Optional[float] = None,
        loan_tenure_months: int = DEFAULT_LOAN_TENOR_MONTHS,
        loan_type: str = "Auto Loan",
        custom_interest_rate: Optional[float] = None,
    ) -> BankFoirResult:
        code = bank_code.upper().replace(" ", "_")
        is_salaried = (occupation or "").lower() == "salaried"
        net_salary = net_monthly_income if (net_monthly_income and net_monthly_income > 0) else gross_monthly_income
        rate = custom_interest_rate or DEFAULT_BENCHMARK_RATES.get(loan_type.upper(), DEFAULT_BENCHMARK_RATES["DEFAULT"])

        # 1. Evaluate bank-specific FOIR % and EMI capacity
        if code == "BOB":
            result = self._eval_bob(is_salaried, gross_monthly_income, net_salary, annual_income, existing_monthly_emi)
        elif code == "BOM":
            result = self._eval_bom(is_salaried, gross_monthly_income, net_salary, annual_income, existing_monthly_emi)
        elif code == "BOI":
            result = self._eval_boi(is_salaried, gross_monthly_income, net_salary, annual_income, existing_monthly_emi)
        elif code == "INDIAN_BANK":
            result = self._eval_indian_bank(is_salaried, gross_monthly_income, net_salary, annual_income, existing_monthly_emi)
        elif code == "IOB":
            result = self._eval_iob(is_salaried, gross_monthly_income, net_salary, annual_income, existing_monthly_emi)
        else:
            # Fallback benchmark for HDFC, AXIS, KOTAK, etc.
            result = self._eval_benchmark_bank(code, is_salaried, gross_monthly_income, net_salary, annual_income, existing_monthly_emi)

        foir_pct, max_allowable_emi, emi_capacity, rule_type, dgm_req, notes = result

        # 2. Loan Amount Calculations
        max_loan_pv = calculate_present_value_loan(emi_capacity, rate, loan_tenure_months)

        proposed_emi = 0.0
        approved_amount = max_loan_pv
        is_eligible = emi_capacity > 0

        if requested_loan_amount and requested_loan_amount > 0:
            proposed_emi = calculate_emi(requested_loan_amount, rate, loan_tenure_months)
            approved_amount = min(requested_loan_amount, max_loan_pv)
            # If proposed EMI exceeds capacity, applicant cannot get full requested amount
            if emi_capacity < proposed_emi:
                notes += f" Requested loan EMI (Rs {proposed_emi:,.0f}) exceeds capacity (Rs {emi_capacity:,.0f})."

        return BankFoirResult(
            bank_code=code,
            is_eligible=is_eligible,
            foir_percentage=round(foir_pct, 4),
            max_allowable_emi=round(max_allowable_emi, 2),
            eligible_emi_capacity=round(max(0.0, emi_capacity), 2),
            max_eligible_loan_amount=round(max_loan_pv, 2),
            requested_loan_amount=requested_loan_amount,
            loan_amount_approved=round(approved_amount, 2),
            proposed_emi=proposed_emi,
            existing_monthly_emi=round(existing_monthly_emi, 2),
            dgm_approval_required=dgm_req,
            rule_type=rule_type,
            notes=notes.strip(),
        )

    def _eval_bob(self, is_salaried: bool, gmi: float, net: float, annual: float, existing_emi: float):
        if is_salaried:
            # Categorisation uses Gross Salary; Eligibility uses Net Salary
            if gmi <= 50000:
                foir = 0.60
            elif gmi <= 150000:
                foir = 0.70
            else:
                foir = 0.80
            max_emi = net * foir
            capacity = max_emi - existing_emi
            return foir, max_emi, capacity, "percentage", False, "BOB Salaried: Categorisation on Gross, calculation on Net Salary."
        else:
            # Self-Employed: 2yr avg annual income
            monthly_income = annual / 12.0
            foir = 0.60 if annual <= 600000 else 0.80
            max_emi = monthly_income * foir
            capacity = max_emi - existing_emi
            return foir, max_emi, capacity, "percentage", False, "BOB Self-Employed: 60% below 6L, 80% above 6L."

    def _eval_bom(self, is_salaried: bool, gmi: float, net: float, annual: float, existing_emi: float):
        if is_salaried:
            if gmi <= 50000:
                foir = 0.60
            elif gmi <= 100000:
                foir = 0.65
            elif gmi <= 200000:
                foir = 0.70
            elif gmi <= 500000:
                foir = 0.75
            else:
                foir = 0.80
            max_emi = gmi * foir
            capacity = max_emi - existing_emi
            return foir, max_emi, capacity, "percentage", False, "BOM Salaried: 5-band GMI tier."
        else:
            if annual <= 600000:
                foir = 0.60
            elif annual <= 1200000:
                foir = 0.65
            elif annual <= 2400000:
                foir = 0.70
            elif annual <= 6000000:
                foir = 0.75
            else:
                foir = 0.80
            monthly_income = annual / 12.0
            max_emi = monthly_income * foir
            capacity = max_emi - existing_emi
            return foir, max_emi, capacity, "percentage", False, "BOM Self-Employed: 5-tier annual income matrix."

    def _eval_boi(self, is_salaried: bool, gmi: float, net: float, annual: float, existing_emi: float):
        income = gmi if is_salaried else (annual / 12.0)
        if income <= 100000:
            foir = 0.60
        elif income <= 500000:
            foir = 0.70
        else:
            foir = 0.75
        max_emi = income * foir
        capacity = max_emi - existing_emi
        label = "BOI Salaried" if is_salaried else "BOI Self-Employed (GMI converted)"
        return foir, max_emi, capacity, "percentage", False, f"{label}: 3-tier slab."

    def _eval_indian_bank(self, is_salaried: bool, gmi: float, net: float, annual: float, existing_emi: float):
        if is_salaried:
            annual_equiv = gmi * 12.0
            if annual_equiv <= 1500000:
                # Formula: Net Salary - 40% of Gross - Existing EMI
                max_emi = net - (0.40 * gmi)
                capacity = max_emi - existing_emi
                return 0.60, max_emi, capacity, "deduction_percentage", False, "Indian Bank Salaried (<15L): Net - 40% Gross."
            else:
                # Formula: Net Salary - 50,000 - Existing EMI
                max_emi = net - 50000.0
                capacity = max_emi - existing_emi
                return 0.0, max_emi, capacity, "flat_deduction", False, "Indian Bank Salaried (>15L): Net - Flat 50K."
        else:
            monthly_net = annual / 12.0
            if annual <= 1500000:
                max_emi = monthly_net - (0.40 * monthly_net)
                capacity = max_emi - existing_emi
                return 0.60, max_emi, capacity, "deduction_percentage", False, "Indian Bank Self-Employed (<15L): Net - 40% Total."
            else:
                max_emi = monthly_net - 50000.0
                capacity = max_emi - existing_emi
                return 0.0, max_emi, capacity, "flat_deduction", False, "Indian Bank Self-Employed (>15L): Net - Flat 50K."

    def _eval_iob(self, is_salaried: bool, gmi: float, net: float, annual: float, existing_emi: float):
        income = gmi if is_salaried else (annual / 12.0)
        if income <= 100000:
            foir = 0.60
            dgm = False
            notes = "IOB standard slab (<= 1 Lakh)."
        else:
            foir = 0.70
            dgm = True
            notes = "IOB higher slab (> 1 Lakh): Requires DGM Approval."
        max_emi = income * foir
        capacity = max_emi - existing_emi
        return foir, max_emi, capacity, "percentage", dgm, notes

    def _eval_benchmark_bank(self, code: str, is_salaried: bool, gmi: float, net: float, annual: float, existing_emi: float):
        income = gmi if is_salaried else (annual / 12.0)
        foir = 0.60 if income <= 50000 else 0.70
        max_emi = income * foir
        capacity = max_emi - existing_emi
        return foir, max_emi, capacity, "percentage", False, f"{code} Benchmark: standard 60-70% FOIR rule."


foir_service = FoirService()
