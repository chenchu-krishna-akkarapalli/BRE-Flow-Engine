"""Phase 1 Income Calculation Service.

Computes annual net operational income from Current Year and Previous Year
ITR and COI documents, and calculates the 2-Year Average Income.
"""

from typing import Any, Dict, Optional
from app.api.schemas.income import (
    Phase1IncomeCalculationRequest,
    Phase1IncomeCalculationResponse,
    YearlyIncomeBreakdown,
    YearlyIncomeInput,
)


class IncomeService:
    """Service to compute document-derived annual income and 2-year average."""

    def compute_yearly_income(self, data: YearlyIncomeInput) -> YearlyIncomeBreakdown:
        """Compute net annual income for a single year according to Phase 1 rules:

        1. income_from_calc = total_income - total_tax_interest_and_fee_payable
        2. income_from_other_sources = total_other_interest_income - (interest_on_partners_capital + partner_remuneration)
           (clamped to >= 0 so deductions do not invert other sources)
        3. total_passive_deductions = income_from_other_sources + income_from_capital_gain
        4. final_yearly_income = income_from_calc - total_passive_deductions
        """
        total_income = float(data.total_income or 0.0)
        total_tax = float(data.total_tax_interest_and_fee_payable or 0.0)
        income_from_calc = round(total_income - total_tax, 2)

        other_interest = float(data.total_other_interest_income or 0.0)
        partner_interest = float(data.interest_on_partners_capital or 0.0)
        partner_remun = float(data.partner_remuneration or 0.0)

        # In other sources, reduce everything EXCEPT partner's capital interest and partner remuneration
        income_from_other_sources = round(
            max(0.0, other_interest - (partner_interest + partner_remun)), 2
        )

        capital_gain = float(data.income_from_capital_gain or 0.0)
        total_passive_deductions = round(income_from_other_sources + capital_gain, 2)

        final_yearly_income = round(income_from_calc - total_passive_deductions, 2)

        return YearlyIncomeBreakdown(
            total_income=total_income,
            total_tax_interest_and_fee_payable=total_tax,
            income_from_calc=income_from_calc,
            total_other_interest_income=other_interest,
            interest_on_partners_capital=partner_interest,
            partner_remuneration=partner_remun,
            income_from_other_sources=income_from_other_sources,
            income_from_capital_gain=capital_gain,
            total_passive_deductions=total_passive_deductions,
            final_yearly_income=final_yearly_income,
        )

    def calculate_phase1_income(
        self, request: Phase1IncomeCalculationRequest
    ) -> Phase1IncomeCalculationResponse:
        """Calculate current year and previous year incomes, then compute 2-year average."""
        cy_breakdown = self.compute_yearly_income(request.current_year)
        py_breakdown = self.compute_yearly_income(request.previous_year)

        income_cy = cy_breakdown.final_yearly_income
        income_py = py_breakdown.final_yearly_income
        average_income = round((income_cy + income_py) / 2.0, 2)

        return Phase1IncomeCalculationResponse(
            current_year_breakdown=cy_breakdown,
            previous_year_breakdown=py_breakdown,
            income_current_year=income_cy,
            income_previous_year=income_py,
            average_income=average_income,
        )

    def extract_from_documents(
        self,
        itr_payload: Optional[Dict[str, Any]] = None,
        coi_payload: Optional[Dict[str, Any]] = None,
        manual_overrides: Optional[Dict[str, Any]] = None,
    ) -> YearlyIncomeInput:
        """Helper to extract YearlyIncomeInput from parsed ITR and COI JSON data."""
        total_income = 0.0
        total_tax = 0.0
        other_interest = 0.0
        partner_interest = 0.0
        partner_remun = 0.0
        capital_gain = 0.0

        # Extract from ITR payload
        if itr_payload:
            taxable_details = (
                itr_payload.get("data", {}).get("taxable_income_and_tax_details")
                or itr_payload.get("taxable_income_and_tax_details")
                or {}
            )
            total_income = float(taxable_details.get("total_income") or 0.0)
            total_tax = float(
                taxable_details.get("total_tax_interest_and_fee_payable") or 0.0
            )

        # Extract from COI payload
        if coi_payload:
            summary = coi_payload.get("summary") or {}
            computation = (
                coi_payload.get("computation_of_total_income")
                or coi_payload.get("data", {}).get("computation_of_total_income")
                or {}
            )
            heads = coi_payload.get("heads") or {}

            # Other sources
            other_sources_val = (
                summary.get("total_other_sources")
                or computation.get("income_from_other_sources", {}).get("total")
            )
            if other_sources_val is None and "other_sources" in heads:
                head_os = heads["other_sources"]
                if isinstance(head_os, dict) and "paise" in head_os:
                    other_sources_val = head_os["paise"] / 100.0

            other_interest = float(other_sources_val or 0.0)

            # Capital gains
            cap_gain_val = (
                computation.get("income_from_capital_gain", {}).get("total")
                or summary.get("total_capital_gains")
            )
            if cap_gain_val is None and "capital_gains" in heads:
                head_cg = heads["capital_gains"]
                if isinstance(head_cg, dict) and "paise" in head_cg:
                    cap_gain_val = head_cg["paise"] / 100.0

            capital_gain = float(cap_gain_val or 0.0)

        # Apply any manual overrides
        if manual_overrides:
            if "total_income" in manual_overrides:
                total_income = float(manual_overrides["total_income"] or 0.0)
            if "total_tax_interest_and_fee_payable" in manual_overrides:
                total_tax = float(
                    manual_overrides["total_tax_interest_and_fee_payable"] or 0.0
                )
            if "total_other_interest_income" in manual_overrides:
                other_interest = float(
                    manual_overrides["total_other_interest_income"] or 0.0
                )
            if "interest_on_partners_capital" in manual_overrides:
                partner_interest = float(
                    manual_overrides["interest_on_partners_capital"] or 0.0
                )
            if "partner_remuneration" in manual_overrides:
                partner_remun = float(
                    manual_overrides["partner_remuneration"] or 0.0
                )
            if "income_from_capital_gain" in manual_overrides:
                capital_gain = float(
                    manual_overrides["income_from_capital_gain"] or 0.0
                )

        return YearlyIncomeInput(
            total_income=total_income,
            total_tax_interest_and_fee_payable=total_tax,
            total_other_interest_income=other_interest,
            interest_on_partners_capital=partner_interest,
            partner_remuneration=partner_remun,
            income_from_capital_gain=capital_gain,
        )


income_service = IncomeService()
