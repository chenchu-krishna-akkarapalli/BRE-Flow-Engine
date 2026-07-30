from enum import Enum


class EntityType(str, Enum):
    INDIVIDUAL = "Individual"
    COMPANY = "Company"
    HUF = "HUF"


class OccupationType(str, Enum):
    SALARIED = "Salaried"
    SELF_EMPLOYED = "Self-Employed"


class BusinessEntityType(str, Enum):
    PROPRIETORSHIP = "PROPRIETORSHIP"
    PARTNERSHIP = "PARTNERSHIP"
    PVT_LTD = "PVT_LTD"
    PUBLIC_LTD = "PUBLIC_LTD"
    HUF = "HUF"


class PropertyStatus(str, Enum):
    OWNED = "OWNED"
    RENTED = "RENTED"
    RESI_CUM_OFFICE_OWNED = "RESI_CUM_OFFICE_OWNED"
    RESI_CUM_OFFICE_RENTED = "RESI_CUM_OFFICE_RENTED"
    SEPARATE_BOTH_RENTED = "SEPARATE_BOTH_RENTED"


class BankCode(str, Enum):
    BOI = "BOI"
    INDIAN_BANK = "INDIAN_BANK"
    IOB = "IOB"
    BOB = "BOB"
    BOM = "BOM"
    HDFC = "HDFC"
    AXIS = "AXIS"
    KOTAK = "KOTAK"


class ApplicationStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    MANUAL_REVIEW = "MANUAL_REVIEW"


class RuleAction(str, Enum):
    PASS = "PASS"
    REJECT = "REJECT"
    FLAG = "FLAG"
    REQUIRE_GUARANTOR = "REQUIRE_GUARANTOR"
    DISCOUNT_25PCT = "DISCOUNT_25PCT"
    DISCOUNT_50PCT = "DISCOUNT_50PCT"


# --------------------------------------------------------------------------- #
# Onboarding form option sets (onboading-form.json).
#
# Values are the wire values emitted by the form widget verbatim — including
# the source spelling of "Gaurantor" and "Propreitorship" — so a payload
# produced by the UI validates without a client-side translation layer.
# --------------------------------------------------------------------------- #


class Gender(str, Enum):
    MALE = "Male"
    FEMALE = "Female"
    OTHER = "Other"


class MaritalStatus(str, Enum):
    MARRIED = "Married"
    UNMARRIED = "Unmarried"


class CitizenshipStatus(str, Enum):
    RESIDENT_INDIAN = "Resident Indian"
    NRI_PIO = "NRI/PIO"


class CompanyType(str, Enum):
    """Legal constitution of a corporate applicant (was: industry type)."""

    PARTNERSHIP_FIRM = "partnership_firm"
    PROPRIETORSHIP = "proprietorship"
    PRIVATE_LIMITED = "private_limited"
    PUBLIC_LIMITED = "public_limited"


class ResidentDetails(str, Enum):
    OWNED_HOUSE = "Owned House"
    RENTED_HOUSE = "Rented House"


class EmployerType(str, Enum):
    PVT_LTD = "Employment-Pvt Ltd"
    PUBLIC_LTD = "Employment-Public Ltd"
    GOVT = "Employment-Govt"
    PSU = "Employment-PSU"
    FIRM = "Employment-Firm"


class TenureBand(str, Enum):
    UPTO_6M = "0-6m"
    SIX_M_TO_1Y = "6m-1y"
    ONE_TO_2Y = "1y-2y"
    TWO_Y_PLUS = "2y+"


class GrossSalaryBand(str, Enum):
    LT_25000 = "lt25000"
    GT_25000 = "gt25000"


class SalaryMode(str, Enum):
    BANK_CREDIT = "Salary payment mode- Bank Credit"
    CASH = "Salary payment mode-Cash"


class Form16Status(str, Enum):
    FORM_16 = "Form 16"
    NO_INCOME_PROOF = "No Income Proof"


class RentalIncomeType(str, Enum):
    NONE = "None"
    AGREEMENT_NO_ITR_NOT_IN_BANK = "Rental Income-with Agreement -Not filed ITR-Not reflecting in Bank"
    AGREEMENT_ITR_NOT_IN_BANK = "Rental Income-with Agreement filed ITR- Not reflecting in Bank"
    AGREEMENT_NO_ITR_IN_BANK = "Rental Income-with Agreement -Not filed ITR-reflecting in Bank"


class OfficeAddressType(str, Enum):
    SAME = "Same"
    SEPARATE = "Separate"


class OfficePremisesStatus(str, Enum):
    OWNED = "Owned"
    RENTED = "Rented"


class GuarantorStatus(str, Enum):
    WITHOUT_GUARANTOR = "Without a Gaurantor"
    WITH_GUARANTOR = "With a Gaurantor"


class FormBusinessEntityType(str, Enum):
    """Step-3 business entity options as spelled by the form widget."""

    PROPRIETORSHIP = "Propreitorship"
    PARTNERSHIP_FIRM = "Parternship Firm"
    PRIVATE_LIMITED = "Private Limited"
    PUBLIC_LIMITED = "Public Limited"
    HUF = "HUF"
    AGRICULTURE = "Agriculture"


class ITRFilingStatus(str, Enum):
    FILED = "Self employed ITR Filled"
    NOT_FILED = "ITR Not Filed"


class ExistingBankOption(str, Enum):
    """Where the applicant already banks — one option per partner bank.

    Every member of :class:`BankCode` must appear here: the option selects
    which bank's policy drives the verdict, and the private banks all carry
    ``requires_existing_account = True``, so an unrepresented partner bank can
    never be scored (REL-501 rejects it on every submission).
    """

    NONE = "None"
    BOB = "BOB"
    INDIAN_BANK = "Indian Bank"
    IOB = "IOB"
    BOI = "BOI"
    BOM = "BOM"
    HDFC = "HDFC"
    AXIS = "Axis"
    KOTAK = "Kotak"
    OTHERS = "Others"


class LoanType(str, Enum):
    AUTO_LOAN = "Auto Loan"
    PERSONAL_LOAN = "Personal Loan"
    HOME_LOAN = "Home Loan"


class CoApplicantAgeRelation(str, Enum):
    NONE = "None"
    BROTHER = "Brother"
    SISTER = "Sister"


class CoApplicantIncomeRelation(str, Enum):
    NONE = "None"
    FATHER = "Father"
    MOTHER = "Mother"
    BROTHER = "Brother"
    SISTER = "Sister"


class WriteOffType(str, Enum):
    """Bureau write-off product classes recognized by the bank matrix."""

    PL = "PL"
    HL = "HL"
    CONSUMER = "CONSUMER"
    AGRI = "AGRI"
    MSME = "MSME"
    AUTO = "AUTO"
    CC = "CC"
