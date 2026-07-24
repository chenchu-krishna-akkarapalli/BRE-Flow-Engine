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
