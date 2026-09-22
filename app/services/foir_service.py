"""Phase 2: Bank-Specific FOIR and Processed Income Calculation Service.

Implements the FOIR calculation tiers defined in 'CRE_docs/FOIR Calculation (2).xlsx'
for Salaried and Self-Employed applicants across partner banks:
- BOB (Bank of Baroda)
- BOM (Bank of Maharashtra)
- BOI (Bank of India)
- INDIAN_BANK / INDIAN (Indian Bank)
- IOB (Indian Overseas Bank)
Plus standard industry fallbacks for HDFC, AXIS, and KOTAK.
"""

from typing import Dict, Optional, Tuple
from app.api.schemas.income import (
    BankFoirDetail,
    Phase2FoirCalculationResponse,
)

BANK_NAMES: Dict[str, str] = {
    "BOB": "Bank of Baroda",
    "BOM": "Bank of Maharashtra",
    "BOI": "Bank of India",
    "INDIAN_BANK": "Indian Bank",
    "IOB": "Indian Overseas Bank",
    "HDFC": "HDFC Bank",
    "AXIS": "Axis Bank",
    "KOTAK": "Kotak Mahindra Bank",
}


class FOIRService:
    """Service to evaluate FOIR tiers and compute final processed income per bank."""

    def get_bank_foir_ratio(
        self, bank_code: str, work_type: str, average_income: float
    ) -> Tuple[float, str, Optional[str]]:
        """Determine FOIR percentage and tier description according to bank policies.

        Returns: (foir_percentage, tier_description, notes)
        """
        code = bank_code.upper()
        is_salaried = "salaried" in work_type.lower()
        gmi = round(average_income / 12.0, 2)

        # ------------------------------------------------------------------ #
        # 1. Bank of Baroda (BOB)
        # ------------------------------------------------------------------ #
        if code == "BOB":
            if is_salaried:
                if gmi <= 50_000:
                    return 0.60, "Gross Monthly Income ≤ ₹50,000 (60%)", None
                elif gmi <= 150_000:
                    return 0.70, "Gross Monthly Income ₹50,000 – ₹1,50,000 (70%)", None
                else:
                    return 0.80, "Gross Monthly Income > ₹1,50,000 (80%)", None
            else:
                if average_income < 600_000:
                    return 0.60, "Avg Annual Income < ₹6 Lakh (60%)", None
                else:
                    return 0.80, "Avg Annual Income ≥ ₹6 Lakh (80%)", None

        # ------------------------------------------------------------------ #
        # 2. Bank of Maharashtra (BOM)
        # ------------------------------------------------------------------ #
        elif code == "BOM":
            if is_salaried:
                if gmi <= 50_000:
                    return 0.60, "Gross Monthly Income ≤ ₹50,000 (60%)", None
                elif gmi <= 100_000:
                    return 0.65, "Gross Monthly Income ₹50,000 – ₹1,00,000 (65%)", None
                elif gmi <= 200_000:
                    return 0.70, "Gross Monthly Income ₹1,00,000 – ₹2,00,000 (70%)", None
                elif gmi <= 50_0000:
                    return 0.75, "Gross Monthly Income ₹2,00,000 – ₹5,00,000 (75%)", None
                else:
                    return 0.80, "Gross Monthly Income > ₹5,00,000 (80%)", None
            else:
                if average_income < 600_000:
                    return 0.60, "Avg Annual Income < ₹6 Lakh (60%)", None
                elif average_income < 1_200_000:
                    return 0.65, "Avg Annual Income ₹6 Lakh – ₹12 Lakh (65%)", None
                elif average_income < 2_400_000:
                    return 0.70, "Avg Annual Income ₹12 Lakh – ₹24 Lakh (70%)", None
                elif average_income < 6_000_000:
                    return 0.75, "Avg Annual Income ₹24 Lakh – ₹60 Lakh (75%)", None
                else:
                    return 0.80, "Avg Annual Income ≥ ₹60 Lakh (80%)", None

        # ------------------------------------------------------------------ #
        # 3. Bank of India (BOI)
        # ------------------------------------------------------------------ #
        elif code == "BOI":
            if is_salaried:
                if gmi < 100_000:
                    return 0.60, "Gross Monthly Income < ₹1 Lakh (60%)", None
                elif gmi <= 500_000:
                    return 0.70, "Gross Monthly Income ₹1 Lakh – ₹5 Lakh (70%)", None
                else:
                    return 0.75, "Gross Monthly Income > ₹5 Lakh (75%)", None
            else:
                # Sheet note: Avg Gross Annual Income of 2 yrs Convert into GMI
                if gmi < 100_000:
                    return 0.60, "Converted GMI < ₹1 Lakh (60%)", "Evaluated on converted monthly income"
                elif gmi <= 500_000:
                    return 0.70, "Converted GMI ₹1 Lakh – ₹5 Lakh (70%)", "Evaluated on converted monthly income"
                else:
                    return 0.75, "Converted GMI > ₹5 Lakh (75%)", "Evaluated on converted monthly income"

        # ------------------------------------------------------------------ #
        # 4. Indian Overseas Bank (IOB)
        # ------------------------------------------------------------------ #
        elif code == "IOB":
            if is_salaried:
                if gmi <= 100_000:
                    return 0.60, "Gross Monthly Income ≤ ₹1 Lakh (60%)", None
                else:
                    return 0.70, "Gross Monthly Income > ₹1 Lakh (70%)", "Requires DGM Approval"
            else:
                # Sheet note: Avg Gross Annual Income of 2 yrs (Will be converted into GMI)
                if gmi <= 100_000:
                    return 0.60, "Converted GMI ≤ ₹1 Lakh (60%)", "Evaluated on converted monthly income"
                else:
                    return 0.70, "Converted GMI > ₹1 Lakh (70%)", "Requires DGM Approval"

        # ------------------------------------------------------------------ #
        # 5. Indian Bank (INDIAN_BANK / INDIAN)
        # ------------------------------------------------------------------ #
        elif code in ("INDIAN", "INDIAN_BANK"):
            # Sheet: Below 15 Lakhs: 0.6; Above 15 Lakhs: 50K (70% with 50k surplus floor)
            ref_income = gmi if is_salaried and average_income > 15_000_000 else average_income
            if ref_income < 1_500_000:
                return 0.60, "Income < ₹15 Lakhs (60%)", None
            else:
                return 0.70, "Income ≥ ₹15 Lakhs (70%)", "Subject to ₹50,000 minimum net take-home surplus condition"

        # ------------------------------------------------------------------ #
        # 6. Default Fallback (HDFC, AXIS, KOTAK, etc.)
        # ------------------------------------------------------------------ #
        else:
            if is_salaried:
                return 0.50, "Standard Industry Benchmark for Salaried (50%)", "Default partner benchmark"
            else:
                return 0.60, "Standard Industry Benchmark for Self-Employed (60%)", "Default partner benchmark"

    def calculate_phase2_foir(
        self, average_income: float, occupation: str, existing_emi: float = 0.0
    ) -> Phase2FoirCalculationResponse:
        """Compute FOIR and Final Processed Income for all partner banks."""
        is_salaried = "salaried" in occupation.lower()
        work_type_label = "Salaried" if is_salaried else "Self-Employed"
        average_monthly = round(average_income / 12.0, 2)
        base_income = average_monthly if is_salaried else round(average_income, 2)
        existing_emi = max(0.0, float(existing_emi or 0.0))

        bank_results: Dict[str, BankFoirDetail] = {}

        # Canonical partner bank order
        all_banks = ["BOB", "BOM", "BOI", "IOB", "INDIAN_BANK", "HDFC", "AXIS", "KOTAK"]

        for code in all_banks:
            foir_pct, desc, notes = self.get_bank_foir_ratio(code, work_type_label, average_income)
            foir_based_income = round(base_income * foir_pct, 2)
            final_processed = round(foir_based_income - existing_emi, 2)

            bank_results[code] = BankFoirDetail(
                bank_code=code,
                bank_name=BANK_NAMES.get(code, code),
                work_type=work_type_label,
                base_income=base_income,
                foir_percentage=foir_pct,
                foir_based_income=foir_based_income,
                existing_emi=existing_emi,
                final_processed_income=final_processed,
                bracket_description=desc,
                notes=notes,
            )

        return Phase2FoirCalculationResponse(
            average_income=round(average_income, 2),
            average_monthly_income=average_monthly,
            occupation=work_type_label,
            existing_emi=existing_emi,
            bank_foir_results=bank_results,
        )


foir_service = FOIRService()
