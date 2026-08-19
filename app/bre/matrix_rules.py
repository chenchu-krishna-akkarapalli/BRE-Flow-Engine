from typing import Any, Dict, List

# Single-line context: Canonical RAM-resident 8-bank matrix rules definition
BANK_MATRIX_COLUMNS: List[str] = [
    "Bank", "Min Age", "Max Age Salaried", "Max Age SE", "Allow NRI",
    "Min Salary", "Min CIBIL", "Max DPD", "Allow Write-Off", "Min ITR",
]

# Canonical in-memory matrix configuration for supported lender banks
BANK_MATRIX_RULES: Dict[str, Dict[str, Any]] = {
    "BOI": {"min_age": 21, "max_age_salaried": 60, "max_age_se": 65, "min_cibil": 700, "allow_nri": False},
    "INDIAN_BANK": {"min_age": 21, "max_age_salaried": 60, "max_age_se": 65, "min_cibil": 700, "max_dpd": 0},
    "IOB": {"min_age": 21, "max_age_salaried": 60, "max_age_se": 65, "min_cibil": 675},
    "BOB": {"min_age": 21, "max_age_salaried": 65, "max_age_se": 70, "min_cibil": 700},
    "BOM": {"min_age": 21, "max_age_salaried": 60, "max_age_se": 65, "min_cibil": 650},
    "HDFC": {"min_age": 21, "max_age_salaried": 60, "max_age_se": 65, "min_cibil": 720},
    "AXIS": {"min_age": 21, "max_age_salaried": 60, "max_age_se": 65, "min_cibil": 700},
    "KOTAK": {"min_age": 21, "max_age_salaried": 60, "max_age_se": 65, "min_cibil": 700},
}
