"""Pre-FOIR income normalization service for Self-Employed applicants.

Implements the computation specification from CRE-docs/before_FOIR.md:
1. Base income from ITR: Line 1A - Line 6.
2. Deduct other interest income (with carve-outs for partner capital interest
   and partner remuneration).
3. Deduct capital gains in full (STCG + LTCG).
4. Apply the same logic to COI (Computation of Income).
5. Combine ITR + COI per financial year.
6. Compute 2-year average annual income to feed into the FOIR matrix.
"""

from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class TaxDeductionDetails(BaseModel):
    other_interest_income: float = Field(default=0.0, ge=0.0)
    interest_on_partners_capital: float = Field(default=0.0, ge=0.0)
    partner_remuneration: float = Field(default=0.0, ge=0.0)
    income_from_capital_gains: float = Field(default=0.0, ge=0.0)
    short_term_capital_gains: float = Field(default=0.0, ge=0.0)
    long_term_capital_gains: float = Field(default=0.0, ge=0.0)


class DocumentIncomeInput(BaseModel):
    gross_receipts_line_1a: Optional[float] = None
    expenses_line_6: Optional[float] = None
    net_taxable_income: Optional[float] = None
    deductions: TaxDeductionDetails = Field(default_factory=TaxDeductionDetails)


class PreFoirYearInput(BaseModel):
    itr: Optional[DocumentIncomeInput] = None
    coi: Optional[DocumentIncomeInput] = None
    fallback_income: Optional[float] = None


class PreFoirResult(BaseModel):
    current_year_adjusted: float
    previous_year_adjusted: float
    two_year_average_annual_income: float
    monthly_equivalent_income: float
    details: Dict[str, Any] = Field(default_factory=dict)


def _compute_document_adjusted_income(doc: Optional[DocumentIncomeInput]) -> float:
    """Calculates adjusted income for a single ITR or COI document."""
    if doc is None:
        return 0.0

    if doc.gross_receipts_line_1a is not None and doc.expenses_line_6 is not None:
        base_income = max(0.0, doc.gross_receipts_line_1a - doc.expenses_line_6)
    elif doc.net_taxable_income is not None:
        base_income = max(0.0, doc.net_taxable_income)
    else:
        return 0.0

    carve_outs = (
        doc.deductions.interest_on_partners_capital
        + doc.deductions.partner_remuneration
    )
    deductible_interest = max(0.0, doc.deductions.other_interest_income - carve_outs)

    capital_gains_deduction = (
        doc.deductions.income_from_capital_gains
        + doc.deductions.short_term_capital_gains
        + doc.deductions.long_term_capital_gains
    )

    adjusted_income = max(0.0, base_income - deductible_interest - capital_gains_deduction)
    return adjusted_income


class PreFoirService:
    """Pre-FOIR income derivation orchestrator."""

    def compute_self_employed_income(
        self,
        current_year: Optional[PreFoirYearInput] = None,
        previous_year: Optional[PreFoirYearInput] = None,
        fallback_current_itr: float = 0.0,
        fallback_prev_itr: float = 0.0,
    ) -> PreFoirResult:
        """Computes normalized 2-year average annual income."""
        if current_year and (current_year.itr or current_year.coi):
            itr_curr = _compute_document_adjusted_income(current_year.itr)
            coi_curr = _compute_document_adjusted_income(current_year.coi)
            curr_adj = itr_curr + coi_curr if (itr_curr or coi_curr) else (current_year.fallback_income or fallback_current_itr)
        else:
            curr_adj = fallback_current_itr

        if previous_year and (previous_year.itr or previous_year.coi):
            itr_prev = _compute_document_adjusted_income(previous_year.itr)
            coi_prev = _compute_document_adjusted_income(previous_year.coi)
            prev_adj = itr_prev + coi_prev if (itr_prev or coi_prev) else (previous_year.fallback_income or fallback_prev_itr)
        else:
            prev_adj = fallback_prev_itr

        two_year_avg = max(0.0, (curr_adj + prev_adj) / 2.0)
        monthly_eq = round(two_year_avg / 12.0, 2)

        return PreFoirResult(
            current_year_adjusted=round(curr_adj, 2),
            previous_year_adjusted=round(prev_adj, 2),
            two_year_average_annual_income=round(two_year_avg, 2),
            monthly_equivalent_income=monthly_eq,
            details={
                "curr_year_combined": round(curr_adj, 2),
                "prev_year_combined": round(prev_adj, 2),
                "annual_average": round(two_year_avg, 2),
            },
        )


pre_foir_service = PreFoirService()
