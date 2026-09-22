"""Schemas for Phase 1 Document-Based Income Assessment (ITR + COI)."""

from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


class YearlyIncomeInput(BaseModel):
    """Input fields extracted from a single year's ITR and COI documents."""

    # From ITR
    total_income: float = Field(
        default=0.0,
        description="Total annual income reported in ITR (taxable_income_and_tax_details.total_income)",
    )
    total_tax_interest_and_fee_payable: float = Field(
        default=0.0,
        description="Total tax, interest and fee payable from ITR",
    )

    # From COI
    total_other_interest_income: float = Field(
        default=0.0,
        description="Total income from other sources before operational exclusions",
    )
    interest_on_partners_capital: float = Field(
        default=0.0,
        description="Interest on partner's capital (exempt from other sources deduction)",
    )
    partner_remuneration: float = Field(
        default=0.0,
        description="Partner remuneration (exempt from other sources deduction)",
    )
    income_from_capital_gain: float = Field(
        default=0.0,
        description="Total capital gains income from COI to be deducted",
    )

    model_config = ConfigDict(extra="ignore")


class YearlyIncomeBreakdown(BaseModel):
    """Audit breakdown for a single tax year's income computation."""

    total_income: float
    total_tax_interest_and_fee_payable: float
    # income_from_calc = total_income - total_tax_interest_and_fee_payable
    income_from_calc: float

    total_other_interest_income: float
    interest_on_partners_capital: float
    partner_remuneration: float
    # income_from_other_sources = total_other_interest_income - (interest_on_partners_capital + partner_remuneration)
    income_from_other_sources: float

    income_from_capital_gain: float
    # total_deductions = income_from_other_sources + income_from_capital_gain
    total_passive_deductions: float

    # final_yearly_income = income_from_calc - (income_from_other_sources + income_from_capital_gain)
    final_yearly_income: float

    model_config = ConfigDict(extra="ignore")


class Phase1IncomeCalculationRequest(BaseModel):
    """Request envelope carrying current and previous year document values."""

    current_year: YearlyIncomeInput
    previous_year: YearlyIncomeInput

    model_config = ConfigDict(extra="ignore")


class Phase1IncomeCalculationResponse(BaseModel):
    """Audited result of Phase 1 2-year income calculation."""

    current_year_breakdown: YearlyIncomeBreakdown
    previous_year_breakdown: YearlyIncomeBreakdown
    income_current_year: float
    income_previous_year: float
    # average_income = (income_current_year + income_previous_year) / 2
    average_income: float

    model_config = ConfigDict(extra="ignore")
