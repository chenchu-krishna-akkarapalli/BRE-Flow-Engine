"""Deterministic translation tables between the onboarding form's option
values (onboading-form.json) and the numeric / canonical inputs that the
in-memory bank matrix (`app.services.bre_engine`) evaluates against.

Kept here — never inline in schemas or routes — so a form option change is a
one-line constant edit rather than a hunt through the request pipeline.
"""

from app.constants.enums import (
    BankCode,
    ExistingBankOption,
    GrossSalaryBand,
    OfficeAddressType,
    OfficePremisesStatus,
    PropertyStatus,
    RentalIncomeType,
    ResidentDetails,
    SalaryMode,
    TenureBand,
    WriteOffType,
)

# Representative monthly salary for each band. The matrix floor is Rs 25,000,
# so the band midpoints below sit unambiguously on either side of it.
SALARY_BAND_TO_MONTHLY_AMOUNT: dict[GrossSalaryBand, float] = {
    GrossSalaryBand.LT_25000: 20000.0,
    GrossSalaryBand.GT_25000: 50000.0,
}

# Lower bound of each tenure band in months — the conservative end, so a
# "1y-2y" applicant is never credited with more tenure than proven.
TENURE_BAND_TO_MONTHS: dict[TenureBand, int] = {
    TenureBand.UPTO_6M: 0,
    TenureBand.SIX_M_TO_1Y: 6,
    TenureBand.ONE_TO_2Y: 12,
    TenureBand.TWO_Y_PLUS: 24,
}

SALARY_MODE_TO_ENGINE_MODE: dict[SalaryMode, str] = {
    SalaryMode.BANK_CREDIT: "BANK_TRANSFER",
    SalaryMode.CASH: "CASH",
}

# The applicant's primary banking relationship selects the bank whose policy
# drives the headline verdict. "Others" is outside the partner matrix, so the
# evaluation falls back to the default partner bank.
EXISTING_BANK_TO_BANK_CODE: dict[ExistingBankOption, BankCode] = {
    ExistingBankOption.BOB: BankCode.BOB,
    ExistingBankOption.INDIAN_BANK: BankCode.INDIAN_BANK,
    ExistingBankOption.IOB: BankCode.IOB,
    ExistingBankOption.BOI: BankCode.BOI,
    ExistingBankOption.BOM: BankCode.BOM,
}
DEFAULT_SELECTED_BANK: BankCode = BankCode.BOI

# Residence + office configuration -> the matrix's property_status vocabulary.
# Keyed by (residence, office address type, office premises status). A None
# office address type means no workplace was captured (salaried applicants);
# a None premises status means the branch does not collect one (HUF).
PROPERTY_STATUS_MATRIX: dict[
    tuple[ResidentDetails, OfficeAddressType | None, OfficePremisesStatus | None],
    PropertyStatus,
] = {
    # No workplace captured — residence tenure alone.
    (ResidentDetails.OWNED_HOUSE, None, None): PropertyStatus.OWNED,
    (ResidentDetails.RENTED_HOUSE, None, None): PropertyStatus.RENTED,
    # Office shares the residence address -> residence-cum-office.
    (ResidentDetails.OWNED_HOUSE, OfficeAddressType.SAME, None): PropertyStatus.RESI_CUM_OFFICE_OWNED,
    (ResidentDetails.RENTED_HOUSE, OfficeAddressType.SAME, None): PropertyStatus.RESI_CUM_OFFICE_RENTED,
    # Separate office, premises tenure not collected (HUF branch).
    (ResidentDetails.OWNED_HOUSE, OfficeAddressType.SEPARATE, None): PropertyStatus.OWNED,
    (ResidentDetails.RENTED_HOUSE, OfficeAddressType.SEPARATE, None): PropertyStatus.RENTED,
    # Separate office with known premises tenure. Only rented-on-rented escalates
    # to SEPARATE_BOTH_RENTED, the configuration that makes a guarantor mandatory.
    (ResidentDetails.OWNED_HOUSE, OfficeAddressType.SEPARATE, OfficePremisesStatus.OWNED): PropertyStatus.OWNED,
    (ResidentDetails.OWNED_HOUSE, OfficeAddressType.SEPARATE, OfficePremisesStatus.RENTED): PropertyStatus.OWNED,
    (ResidentDetails.RENTED_HOUSE, OfficeAddressType.SEPARATE, OfficePremisesStatus.OWNED): PropertyStatus.RENTED,
    (ResidentDetails.RENTED_HOUSE, OfficeAddressType.SEPARATE, OfficePremisesStatus.RENTED): PropertyStatus.SEPARATE_BOTH_RENTED,
}

# Write-off checkbox field -> product class. Ordered least-permissive first:
# when an applicant ticks several boxes the engine evaluates a single class, so
# the class most banks forbid outright is the one reported (fail closed). CC is
# last precisely because it is the only class any bank tolerates.
WRITE_OFF_FLAG_PRECEDENCE: tuple[tuple[str, WriteOffType], ...] = (
    ("pl_write_off", WriteOffType.PL),
    ("home_loan_write_off", WriteOffType.HL),
    ("consumer_write_off", WriteOffType.CONSUMER),
    ("agri_write_off", WriteOffType.AGRI),
    ("msme_write_off", WriteOffType.MSME),
    ("auto_write_off", WriteOffType.AUTO),
    ("cc_write_off", WriteOffType.CC),
)

# Form-16 / ITR availability -> years of tax history credited to the applicant.
FORM_16_AVAILABLE_YEARS: int = 2
FORM_16_ABSENT_YEARS: int = 0

# NRI stay is captured in months by the form; the matrix's floor is in years.
# Convert on the calendar (months / 12) — routing through a nominal 30-day
# month made an exact 24-month stay score as 1.97 years and miss a ">= 2" floor.
MONTHS_PER_YEAR: int = 12

# Rental-income option -> the write-off-style class the matrix scores
# (cols 38-40). "None" claims no secondary rental income at all.
RENTAL_INCOME_TO_CLASS: dict[RentalIncomeType, str] = {
    RentalIncomeType.NONE: "NONE",
    RentalIncomeType.AGREEMENT_NO_ITR_NOT_IN_BANK: "NO_ITR_NOT_IN_BANK",
    RentalIncomeType.AGREEMENT_ITR_NOT_IN_BANK: "ITR_NOT_IN_BANK",
    RentalIncomeType.AGREEMENT_NO_ITR_IN_BANK: "NO_ITR_IN_BANK",
}

# Co-applicant relations the matrix gates per bank (cols 56-58, 61); parents
# are accepted everywhere.
SIBLING_RELATIONS: frozenset = frozenset({"Brother", "Sister"})

# Age attributed to non-natural persons (Company / HUF), which have no DOB.
# Chosen to clear every partner bank's min_age without implying a real age.
NON_INDIVIDUAL_PROXY_AGE: int = 35
