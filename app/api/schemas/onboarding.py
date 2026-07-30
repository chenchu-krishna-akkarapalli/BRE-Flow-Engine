"""Request / response contracts for the onboarding BRE endpoints.

Two request shapes are supported:

* :class:`OnboardingEvaluationRequest` — the flat, engine-native payload used
  by ``POST /onboarding/evaluate``. It mirrors the bank-matrix input vocabulary
  one-for-one and is what integrators with their own data model post.
* :class:`OnboardingFormRequest` — the 5-step wizard payload defined by
  ``onboading-form.json``, used by ``POST /onboarding/evaluate/form``. It is
  polymorphic on ``entityType`` (Individual / Company / HUF) and translates
  itself into the flat engine payload via :meth:`to_engine_payload`.
"""

from datetime import date, datetime, timezone
from typing import Annotated, Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.constants import (
    EMAIL_REGEX_PATTERN,
    PAN_REGEX_PATTERN,
    PHONE_REGEX_PATTERN,
    PINCODE_REGEX_PATTERN,
    BankCode,
    CitizenshipStatus,
    CoApplicantAgeRelation,
    CoApplicantIncomeRelation,
    CompanyType,
    EmployerType,
    EntityType,
    ExistingBankOption,
    Form16Status,
    FormBusinessEntityType,
    Gender,
    GrossSalaryBand,
    GuarantorStatus,
    ITRFilingStatus,
    LoanType,
    MaritalStatus,
    OccupationType,
    OfficeAddressType,
    OfficePremisesStatus,
    PropertyStatus,
    RentalIncomeType,
    ResidentDetails,
    SalaryMode,
    TenureBand,
)
from app.constants.form_mappings import (
    DEFAULT_SELECTED_BANK,
    EXISTING_BANK_TO_BANK_CODE,
    FORM_16_ABSENT_YEARS,
    FORM_16_AVAILABLE_YEARS,
    MONTHS_PER_YEAR,
    NON_INDIVIDUAL_PROXY_AGE,
    PROPERTY_STATUS_MATRIX,
    RENTAL_INCOME_TO_CLASS,
    SIBLING_RELATIONS,
    SALARY_BAND_TO_MONTHLY_AMOUNT,
    SALARY_MODE_TO_ENGINE_MODE,
    TENURE_BAND_TO_MONTHS,
    WRITE_OFF_FLAG_PRECEDENCE,
)


# --------------------------------------------------------------------------- #
# Flat engine-native contract (POST /onboarding/evaluate)
# --------------------------------------------------------------------------- #


class CreditBureauPayload(BaseModel):
    cibil_score: int = Field(default=750, ge=300, le=900)
    dpd_history: List[Any] = Field(default_factory=lambda: [0, 0, 0])
    write_off_amount: float = Field(default=0.0, ge=0.0)
    write_off_type: Optional[str] = Field(
        default=None,
        description="Write-off product type when write_off_amount > 0: "
        "CC | PL | HL | CONSUMER | AGRI | MSME | AUTO. "
        "Omitted/unknown types fail closed (BUR-401D).",
    )
    currently_overdue: bool = Field(default=False)


class OnboardingEvaluationRequest(BaseModel):
    # Identity / audit (persisted + PII-redacted in logs; not part of the verdict)
    entity_type: EntityType = EntityType.INDIVIDUAL
    occupation: OccupationType = OccupationType.SALARIED
    applicant_name: Optional[str] = "Jane Doe"
    pan: Optional[str] = Field(default="ABCDE1234F", description="Permanent Account Number")
    dob: Optional[str] = Field(default="1995-05-15", description="Date of Birth")

    # Demographics
    age: int = Field(default=30, ge=18, le=100)
    age_at_last_emi_salaried: int = Field(default=45, ge=18, le=100)
    age_at_last_emi_self_employed: int = Field(default=50, ge=18, le=100)
    is_nri: bool = False
    minimum_stay_period_nri_days: int = 365
    property_status: PropertyStatus = PropertyStatus.OWNED
    guarantor_provided: bool = False

    # Salaried
    net_monthly_salary: float = Field(default=50000.0, ge=0.0)
    current_company_tenure_months: int = Field(default=36, ge=0)
    minimum_work_experience_years: int = Field(default=5, ge=0)
    salary_payment_mode: str = "BANK_TRANSFER"
    form_16_years: int = Field(default=2, ge=0)
    no_income_proof_segment: bool = False
    active_car_loan: bool = False

    # Self-Employed
    business_experience_years: int = Field(default=5, ge=0)
    current_itr: float = Field(default=500000.0, ge=0.0)
    previous_itr: float = Field(default=450000.0, ge=0.0)
    itr_filed: bool = True
    business_proof: bool = True

    # Bank selection & bureau
    selected_bank: BankCode = BankCode.BOI
    credit_bureau: CreditBureauPayload = Field(default_factory=CreditBureauPayload)

    # Pre-filled example shown in Swagger "Try it out": a clean salaried applicant
    # that APPROVES at BOI. Change selected_bank / a single field to test rejects.
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "entity_type": "Individual",
                "occupation": "Salaried",
                "applicant_name": "Jane Doe",
                "pan": "ABCDE1234F",
                "dob": "1995-05-15",
                "age": 32,
                "age_at_last_emi_salaried": 55,
                "age_at_last_emi_self_employed": 60,
                "is_nri": False,
                "minimum_stay_period_nri_days": 365,
                "property_status": "OWNED",
                "guarantor_provided": False,
                "net_monthly_salary": 60000,
                "current_company_tenure_months": 36,
                "minimum_work_experience_years": 5,
                "salary_payment_mode": "BANK_TRANSFER",
                "form_16_years": 2,
                "no_income_proof_segment": False,
                "active_car_loan": False,
                "business_experience_years": 5,
                "current_itr": 500000,
                "previous_itr": 450000,
                "itr_filed": True,
                "business_proof": True,
                "selected_bank": "BOI",
                "credit_bureau": {
                    "cibil_score": 800,
                    "dpd_history": [0, 0, 0],
                    "write_off_amount": 0,
                    "write_off_type": None,
                    "currently_overdue": False,
                },
            }
        }
    )


# --------------------------------------------------------------------------- #
# 5-step wizard contract (POST /onboarding/evaluate/form)
# --------------------------------------------------------------------------- #


def _completed_years(start: date, end: Optional[date] = None) -> int:
    """Whole years elapsed, counted on the calendar.

    Day-count division (days / 365.25) truncates an exact N-year anniversary to
    N-1 once leap days accumulate — a business incorporated exactly 2 years ago
    scored as 1 year and was rejected against the matrix's ">= 2" floor. The
    calendar comparison has no such drift.
    """
    reference = end or datetime.now(timezone.utc).date()
    years = reference.year - start.year
    if (reference.month, reference.day) < (start.month, start.day):
        years -= 1
    return max(years, 0)


class FormModel(BaseModel):
    """Base for every wizard model.

    ``populate_by_name`` lets integrators post either the form's camelCase field
    ids or the python snake_case names. ``extra="forbid"`` is deliberate: it is
    what makes the discriminated unions load-bearing — a Company-only field
    smuggled into an Individual branch is a 422, not a silently ignored key.
    """

    model_config = ConfigDict(populate_by_name=True, extra="forbid")


# --- Step 1: Identity ------------------------------------------------------ #

PanField = Annotated[str, Field(pattern=PAN_REGEX_PATTERN, max_length=10)]
PhoneField = Annotated[str, Field(pattern=PHONE_REGEX_PATTERN, max_length=10)]
EmailField = Annotated[str, Field(pattern=EMAIL_REGEX_PATTERN, max_length=254)]


class IndividualIdentity(FormModel):
    entity_type: Literal[EntityType.INDIVIDUAL] = Field(alias="entityType")
    applicant_name: str = Field(alias="applicantName", min_length=1, max_length=128)
    dob: date
    gender: Optional[Gender] = None
    pan: PanField
    marital_status: Optional[MaritalStatus] = Field(default=None, alias="maritalStatus")
    citizenship_status: CitizenshipStatus = Field(
        default=CitizenshipStatus.RESIDENT_INDIAN, alias="citizenshipStatus"
    )
    nri_stay_period_months: Optional[int] = Field(default=None, alias="nriStayPeriod", ge=0)
    phone: PhoneField
    email: EmailField

    @model_validator(mode="after")
    def _require_nri_stay_period(self) -> "IndividualIdentity":
        if self.citizenship_status is CitizenshipStatus.NRI_PIO and self.nri_stay_period_months is None:
            raise ValueError("nriStayPeriod is required when citizenshipStatus is 'NRI/PIO'.")
        return self

    @property
    def display_name(self) -> str:
        return self.applicant_name

    @property
    def primary_pan(self) -> str:
        return self.pan

    def engine_inputs(self) -> Dict[str, Any]:
        return {
            "entity_type": EntityType.INDIVIDUAL.value,
            "applicant_name": self.applicant_name,
            "pan": self.pan,
            "dob": self.dob.isoformat(),
            "age": _completed_years(self.dob),
            "is_nri": self.citizenship_status is CitizenshipStatus.NRI_PIO,
            "minimum_stay_period_nri_years": (self.nri_stay_period_months or 0) / MONTHS_PER_YEAR,
        }


class CompanyIdentity(FormModel):
    entity_type: Literal[EntityType.COMPANY] = Field(alias="entityType")
    applicant_name: str = Field(alias="applicantName", min_length=1, max_length=128)
    company_name: str = Field(alias="companyName", min_length=1, max_length=180)
    company_type: CompanyType = Field(alias="companyType")
    company_pan: PanField = Field(alias="companyPan")
    company_location: str = Field(alias="companyLocation", min_length=1, max_length=256)
    contact_person_name: str = Field(alias="contactPersonName", min_length=1, max_length=128)
    contact_person_designation: Optional[str] = Field(
        default=None, alias="contactPersonDesignation", max_length=128
    )
    company_mobile: PhoneField = Field(alias="companyMobile")
    company_email: EmailField = Field(alias="companyEmail")
    company_employees: Optional[int] = Field(default=None, alias="companyEmployees", ge=0)

    @property
    def display_name(self) -> str:
        return self.company_name

    @property
    def primary_pan(self) -> str:
        return self.company_pan

    def engine_inputs(self) -> Dict[str, Any]:
        # A company has no date of birth; the matrix's age rules are scored
        # against a proxy age that clears every partner bank's floor.
        return {
            "entity_type": EntityType.COMPANY.value,
            "applicant_name": self.company_name,
            "pan": self.company_pan,
            "dob": None,
            "age": NON_INDIVIDUAL_PROXY_AGE,
            "is_nri": False,
            "minimum_stay_period_nri_years": 0.0,
        }


class HUFIdentity(FormModel):
    entity_type: Literal[EntityType.HUF] = Field(alias="entityType")
    applicant_name: str = Field(alias="applicantName", min_length=1, max_length=128)
    huf_name: str = Field(alias="hufName", min_length=1, max_length=180)
    huf_pan: PanField = Field(alias="hufPan")
    udyam_reg_no: Optional[str] = Field(default=None, alias="udyamRegNoHUF", max_length=64)
    huf_location: Optional[str] = Field(default=None, alias="hufLocation", max_length=256)
    huf_formation_date: Optional[date] = Field(default=None, alias="hufFormationDate")
    karta_name: str = Field(alias="kartaName", min_length=1, max_length=128)
    karta_pan: PanField = Field(alias="kartaPan")
    karta_mobile: Optional[PhoneField] = Field(default=None, alias="kartaMobile")

    @property
    def display_name(self) -> str:
        return self.huf_name

    @property
    def primary_pan(self) -> str:
        return self.huf_pan

    def engine_inputs(self) -> Dict[str, Any]:
        return {
            "entity_type": EntityType.HUF.value,
            "applicant_name": self.huf_name,
            "pan": self.huf_pan,
            "dob": None,
            "age": NON_INDIVIDUAL_PROXY_AGE,
            "is_nri": False,
            "minimum_stay_period_nri_years": 0.0,
        }


IdentityStep = Annotated[
    Union[IndividualIdentity, CompanyIdentity, HUFIdentity],
    Field(discriminator="entity_type"),
]


# --- Step 2: Address & Residence (skipped for Company) --------------------- #


class AddressStep(FormModel):
    pincode: str = Field(pattern=PINCODE_REGEX_PATTERN, max_length=6)
    city_name: Optional[str] = Field(default=None, alias="cityName", max_length=128)
    state_name: Optional[str] = Field(default=None, alias="stateName", max_length=128)
    resident_details: ResidentDetails = Field(alias="residentDetails")


# --- Step 3: Occupation & Business ----------------------------------------- #


class SalariedOccupation(FormModel):
    profile_type: Literal["Salaried"] = Field(alias="profileType")
    occupation: Literal[OccupationType.SALARIED] = OccupationType.SALARIED
    employer_type: Optional[EmployerType] = Field(default=None, alias="employerType")
    tenure_band: TenureBand = Field(alias="tenureBand")
    prev_company_name: Optional[str] = Field(default=None, alias="prevCompanyName", max_length=180)
    prev_company_joining: Optional[date] = Field(default=None, alias="prevCompanyJoining")
    gross_salary_band: GrossSalaryBand = Field(
        default=GrossSalaryBand.GT_25000, alias="grossSalaryBand"
    )
    salary_mode: SalaryMode = Field(default=SalaryMode.BANK_CREDIT, alias="salaryMode")
    form_16_status: Form16Status = Field(default=Form16Status.FORM_16, alias="form16Status")
    # Years of Form 16 on file, scored against matrix col 55. Required when
    # Form 16 is claimed; meaningless (and rejected) when it is not.
    form_16_years: Optional[int] = Field(default=None, alias="form16Years", ge=0, le=50)
    rental_income_type: RentalIncomeType = Field(
        default=RentalIncomeType.NONE, alias="rentalIncomeTypeSalaried"
    )

    @model_validator(mode="after")
    def _validate_form_16_years(self) -> "SalariedOccupation":
        claims_form_16 = self.form_16_status is Form16Status.FORM_16
        if claims_form_16 and self.form_16_years is None:
            raise ValueError("form16Years is required when Form 16 is claimed.")
        if not claims_form_16 and self.form_16_years is not None:
            raise ValueError("form16Years is only collected when Form 16 is claimed.")
        return self

    @model_validator(mode="after")
    def _require_previous_employer(self) -> "SalariedOccupation":
        # Under 2 years with the current employer, the prior employment record
        # is what establishes total work experience — the matrix scores it.
        if self.tenure_band is not TenureBand.TWO_Y_PLUS:
            if not self.prev_company_name or self.prev_company_joining is None:
                raise ValueError(
                    "prevCompanyName and prevCompanyJoining are required when tenureBand is below '2y+'."
                )
        return self

    @property
    def office_address_type(self) -> Optional[OfficeAddressType]:
        return None

    @property
    def office_premises_status(self) -> Optional[OfficePremisesStatus]:
        return None

    @property
    def guarantor_provided(self) -> bool:
        return False

    def engine_inputs(self) -> Dict[str, Any]:
        tenure_months = TENURE_BAND_TO_MONTHS[self.tenure_band]
        # Only the current tenure is provable without a prior employer. When one
        # IS on file the engine recomputes from the raw date below — the whole-
        # year value here would discard the fractional span the matrix floors
        # are measured in.
        work_experience_years = tenure_months // 12
        no_income_proof = self.form_16_status is Form16Status.NO_INCOME_PROOF
        return {
            "occupation": OccupationType.SALARIED.value,
            "net_monthly_salary": SALARY_BAND_TO_MONTHLY_AMOUNT[self.gross_salary_band],
            "current_company_tenure_months": tenure_months,
            "minimum_work_experience_years": work_experience_years,
            "salary_payment_mode": SALARY_MODE_TO_ENGINE_MODE[self.salary_mode],
            # Raw date: the engine adds the prior-employment span to the current
            # tenure itself, so no precision is lost in transit.
            "prev_company_joining": (
                self.prev_company_joining.isoformat() if self.prev_company_joining else None
            ),
            "form_16_years": FORM_16_ABSENT_YEARS if no_income_proof else (self.form_16_years or 0),
            "no_income_proof_segment": no_income_proof,
            "rental_income_class": RENTAL_INCOME_TO_CLASS[self.rental_income_type],
        }


class SelfEmployedOccupation(FormModel):
    profile_type: Literal["Self-Employed"] = Field(alias="profileType")
    occupation: Literal[OccupationType.SELF_EMPLOYED] = OccupationType.SELF_EMPLOYED
    office_address_type: OfficeAddressType = Field(
        default=OfficeAddressType.SAME, alias="officeAddressType"
    )
    office_address: Optional[str] = Field(default=None, alias="officeAddress", max_length=256)
    office_premises_status: Optional[OfficePremisesStatus] = Field(
        default=None, alias="officePremisesStatus"
    )
    guarantor_status: Optional[GuarantorStatus] = Field(default=None, alias="guarantorStatus")
    business_entity_type: FormBusinessEntityType = Field(
        default=FormBusinessEntityType.PROPRIETORSHIP, alias="businessEntityType"
    )
    business_proof: Optional[str] = Field(default=None, alias="businessProof", max_length=128)
    business_establishment_date: date = Field(alias="businessEstablishmentDate")
    current_itr_amount: float = Field(alias="currentITRAmount", ge=0.0)
    prev_itr_amount: float = Field(alias="prevITRAmount", ge=0.0)
    # Years of filed business ITRs (matrix col 47), NOT a rupee amount. The
    # form labels it "Business ITR" but the matrix threshold it feeds is a
    # count of filing years.
    business_itr_years: int = Field(alias="businessItrAmount", ge=0, le=60)
    rental_income_type: RentalIncomeType = Field(
        default=RentalIncomeType.NONE, alias="rentalIncomeTypeSelfEmployed"
    )

    @model_validator(mode="after")
    def _require_separate_office_details(self) -> "SelfEmployedOccupation":
        if self.office_address_type is OfficeAddressType.SEPARATE:
            if not self.office_address or self.office_premises_status is None:
                raise ValueError(
                    "officeAddress and officePremisesStatus are required when officeAddressType is 'Separate'."
                )
        elif self.office_premises_status is not None:
            raise ValueError(
                "officePremisesStatus is only accepted when officeAddressType is 'Separate'."
            )
        return self

    @property
    def guarantor_provided(self) -> bool:
        return self.guarantor_status is GuarantorStatus.WITH_GUARANTOR

    def engine_inputs(self) -> Dict[str, Any]:
        return {
            "occupation": OccupationType.SELF_EMPLOYED.value,
            "business_establishment_date": self.business_establishment_date.isoformat(),
            "business_experience_years": (_completed_years(self.business_establishment_date)),
            "current_itr": self.current_itr_amount,
            "previous_itr": self.prev_itr_amount,
            "itr_filed": True,
            "business_itr_years": self.business_itr_years,
            "business_proof": bool(self.business_proof),
            "business_entity_type": self.business_entity_type.value,
            "rental_income_class": RENTAL_INCOME_TO_CLASS[self.rental_income_type],
        }


class HUFBusiness(FormModel):
    profile_type: Literal["HUF"] = Field(alias="profileType")
    office_address_type: OfficeAddressType = Field(
        default=OfficeAddressType.SAME, alias="officeAddressType"
    )
    office_address: Optional[str] = Field(default=None, alias="officeAddress", max_length=256)
    udyam_reg_no: Optional[str] = Field(default=None, alias="udyamRegNoSelfEmployed", max_length=64)
    business_establishment_date: date = Field(alias="businessEstablishmentDate")
    itr_filing_status: ITRFilingStatus = Field(
        default=ITRFilingStatus.FILED, alias="itrFilingStatus"
    )
    current_itr_amount: Optional[float] = Field(default=None, alias="currentITRAmount", ge=0.0)
    prev_itr_amount: Optional[float] = Field(default=None, alias="prevITRAmount", ge=0.0)
    rental_income_type: RentalIncomeType = Field(
        default=RentalIncomeType.NONE, alias="rentalIncomeTypeSelfEmployed"
    )
    business_proof: Optional[str] = Field(default=None, alias="businessProof", max_length=128)

    @model_validator(mode="after")
    def _require_conditional_fields(self) -> "HUFBusiness":
        if self.office_address_type is OfficeAddressType.SEPARATE and not self.office_address:
            raise ValueError("officeAddress is required when officeAddressType is 'Separate'.")
        if self.itr_filing_status is ITRFilingStatus.FILED:
            if self.current_itr_amount is None or self.prev_itr_amount is None:
                raise ValueError(
                    "currentITRAmount and prevITRAmount are required when itrFilingStatus is filed."
                )
        return self

    @property
    def office_premises_status(self) -> Optional[OfficePremisesStatus]:
        return None

    @property
    def guarantor_provided(self) -> bool:
        return False

    def engine_inputs(self) -> Dict[str, Any]:
        itr_filed = self.itr_filing_status is ITRFilingStatus.FILED
        return {
            "occupation": OccupationType.SELF_EMPLOYED.value,
            "business_establishment_date": self.business_establishment_date.isoformat(),
            "business_experience_years": (_completed_years(self.business_establishment_date)),
            # An unfiled ITR contributes zero provable income rather than
            # falling through to the engine's permissive default.
            "current_itr": self.current_itr_amount or 0.0,
            "previous_itr": self.prev_itr_amount or 0.0,
            "itr_filed": itr_filed,
            "business_proof": bool(self.business_proof or self.udyam_reg_no),
            "rental_income_class": RENTAL_INCOME_TO_CLASS[self.rental_income_type],
        }


class CompanyBusiness(FormModel):
    profile_type: Literal["Company"] = Field(alias="profileType")
    company_establishment_date: date = Field(alias="companyEstablishmentDate")
    company_gstin: str = Field(alias="companyGstin", min_length=1, max_length=64)
    company_current_itr_amount: float = Field(alias="companyCurrentITRAmount", ge=0.0)
    company_prev_itr_amount: float = Field(alias="companyPrevITRAmount", ge=0.0)
    business_itr_years: int = Field(alias="businessItrAmountCompany", ge=0, le=60)

    @property
    def office_address_type(self) -> Optional[OfficeAddressType]:
        return None

    @property
    def office_premises_status(self) -> Optional[OfficePremisesStatus]:
        return None

    @property
    def guarantor_provided(self) -> bool:
        return False

    def engine_inputs(self) -> Dict[str, Any]:
        return {
            "occupation": OccupationType.SELF_EMPLOYED.value,
            "business_establishment_date": self.company_establishment_date.isoformat(),
            "business_experience_years": (_completed_years(self.company_establishment_date)),
            "current_itr": self.company_current_itr_amount,
            "previous_itr": self.company_prev_itr_amount,
            "itr_filed": True,
            "business_itr_years": self.business_itr_years,
            "business_proof": True,
        }


OccupationStep = Annotated[
    Union[SalariedOccupation, SelfEmployedOccupation, HUFBusiness, CompanyBusiness],
    Field(discriminator="profile_type"),
]

# Which step-3 branches each entity type is allowed to submit.
ENTITY_TYPE_TO_PROFILE_TYPES: Dict[EntityType, frozenset] = {
    EntityType.INDIVIDUAL: frozenset({"Salaried", "Self-Employed"}),
    EntityType.HUF: frozenset({"HUF"}),
    EntityType.COMPANY: frozenset({"Company"}),
}


# --- Step 4: Banking, Bureau & Loan ---------------------------------------- #


class BankingBureauStep(FormModel):
    existing_account_bank: ExistingBankOption = Field(alias="existingAccountBank")
    existing_car_loan_bank: ExistingBankOption = Field(
        default=ExistingBankOption.NONE, alias="existingCarLoanBank"
    )
    loan_type: LoanType = Field(alias="loanType")
    cibil_score: int = Field(default=750, alias="bureauCibilScore", ge=300, le=900)
    dpd: int = Field(default=0, alias="bureauDpd", ge=0)
    has_loan_enquiry: bool = Field(default=False, alias="bureauLoanEnquiry")
    currently_outstanding: float = Field(default=0.0, alias="bureauCurrentlyOutstanding", ge=0.0)
    age_at_last_emi: int = Field(default=35, alias="bureauAgeAtLastEMI", ge=18, le=100)
    cibil_pl_score_available: bool = Field(default=False, alias="cibilPlScoreToggle")
    cibil_pl_score: Optional[int] = Field(
        default=None, alias="bureauCibilPlScore", ge=300, le=900
    )
    pl_write_off: bool = Field(default=False, alias="bureauFlagPL")
    home_loan_write_off: bool = Field(default=False, alias="bureauFlagHome")
    consumer_write_off: bool = Field(default=False, alias="bureauFlagConsumer")
    agri_write_off: bool = Field(default=False, alias="bureauFlagAgri")
    msme_write_off: bool = Field(default=False, alias="bureauFlagMSME")
    auto_write_off: bool = Field(default=False, alias="bureauFlagAuto")
    cc_write_off: bool = Field(default=False, alias="bureauFlagCC")
    write_off_amount: float = Field(default=0.0, alias="bureauWriteOffAmount", ge=0.0)

    @model_validator(mode="after")
    def _require_conditional_bureau_fields(self) -> "BankingBureauStep":
        if self.cibil_pl_score_available and self.cibil_pl_score is None:
            raise ValueError("bureauCibilPlScore is required when cibilPlScoreToggle is true.")
        if self.cc_write_off and self.write_off_amount <= 0:
            raise ValueError("bureauWriteOffAmount is required when bureauFlagCC is true.")
        return self

    @property
    def selected_bank(self) -> BankCode:
        return EXISTING_BANK_TO_BANK_CODE.get(self.existing_account_bank, DEFAULT_SELECTED_BANK)

    @property
    def write_off_type(self) -> Optional[str]:
        """The single write-off class reported to the engine.

        The engine scores one class per evaluation; when several boxes are
        ticked the least-permissive class wins (see WRITE_OFF_FLAG_PRECEDENCE),
        so a multi-write-off applicant can never be approved on the strength of
        the one class a bank happens to tolerate.
        """
        for field_name, write_off_type in WRITE_OFF_FLAG_PRECEDENCE:
            if getattr(self, field_name):
                return write_off_type.value
        return None

    def engine_inputs(self) -> Dict[str, Any]:
        any_write_off = self.write_off_type is not None
        return {
            "selected_bank": self.selected_bank.value,
            # The bank the applicant actually banks with. None for "Others",
            # which holds no partner-bank account at all (REL-501).
            "existing_account_bank": (
                EXISTING_BANK_TO_BANK_CODE[self.existing_account_bank].value
                if self.existing_account_bank in EXISTING_BANK_TO_BANK_CODE
                else None
            ),
            "loan_type": self.loan_type.value,
            "has_loan_enquiry": self.has_loan_enquiry,
            "active_car_loan": self.existing_car_loan_bank is not ExistingBankOption.NONE,
            "age_at_last_emi_salaried": self.age_at_last_emi,
            "age_at_last_emi_self_employed": self.age_at_last_emi,
            "credit_bureau": {
                "cibil_score": self.cibil_score,
                "dpd_history": [self.dpd],
                # A ticked write-off flag with no amount still has to reach the
                # engine as a write-off, so it is floored at a positive rupee.
                "write_off_amount": (
                    self.write_off_amount if self.write_off_amount > 0 else (1.0 if any_write_off else 0.0)
                ),
                "write_off_type": self.write_off_type,
                "currently_overdue": self.currently_outstanding > 0,
            },
        }


# --- Step 5: Co-Applicant (skipped for Company) ---------------------------- #


class CoApplicantStep(FormModel):
    age_relation: CoApplicantAgeRelation = Field(
        default=CoApplicantAgeRelation.NONE, alias="coAppAgeRelation"
    )
    income_relation: CoApplicantIncomeRelation = Field(
        default=CoApplicantIncomeRelation.NONE, alias="coAppIncomeRelation"
    )
    co_applicant_name: Optional[str] = Field(default=None, alias="coApplicantName", max_length=128)
    co_applicant_dob: Optional[date] = Field(default=None, alias="coApplicantDob")
    co_applicant_occupation: Optional[OccupationType] = Field(
        default=None, alias="coApplicantOccupation"
    )

    @model_validator(mode="after")
    def _require_co_applicant_profile(self) -> "CoApplicantStep":
        if self.income_relation is not CoApplicantIncomeRelation.NONE:
            missing = [
                name
                for name, value in (
                    ("coApplicantName", self.co_applicant_name),
                    ("coApplicantDob", self.co_applicant_dob),
                    ("coApplicantOccupation", self.co_applicant_occupation),
                )
                if value is None
            ]
            if missing:
                raise ValueError(
                    f"{', '.join(missing)} required when coAppIncomeRelation pools income."
                )
        return self

    @property
    def has_sibling_co_applicant(self) -> bool:
        return (
            self.age_relation.value in SIBLING_RELATIONS
            or self.income_relation.value in SIBLING_RELATIONS
        )


# --- Root wizard request --------------------------------------------------- #


class OnboardingFormRequest(FormModel):
    """Full 5-step onboarding submission, polymorphic on ``entityType``.

    Step 2 (Address) and step 5 (Co-Applicant) are skipped for Company
    applicants and rejected outright if supplied, matching the wizard's own
    branching so the API and the UI can never disagree about what a valid
    Company submission looks like.
    """

    identity: IdentityStep
    address: Optional[AddressStep] = None
    occupation: OccupationStep
    banking: BankingBureauStep
    co_applicant: Optional[CoApplicantStep] = Field(default=None, alias="coApplicant")

    @model_validator(mode="after")
    def _validate_entity_branching(self) -> "OnboardingFormRequest":
        entity_type = self.identity.entity_type

        allowed_profiles = ENTITY_TYPE_TO_PROFILE_TYPES[entity_type]
        if self.occupation.profile_type not in allowed_profiles:
            raise ValueError(
                f"profileType '{self.occupation.profile_type}' is not valid for entityType "
                f"'{entity_type.value}'; expected one of {sorted(allowed_profiles)}."
            )

        if entity_type is EntityType.COMPANY:
            if self.address is not None:
                raise ValueError("The address step is not collected for Company applicants.")
            if self.co_applicant is not None:
                raise ValueError("The co-applicant step is not collected for Company applicants.")
        elif self.address is None:
            raise ValueError(f"The address step is required for {entity_type.value} applicants.")

        # The guarantor question is only asked — and is then mandatory — when
        # residence and office are both rented (form step-3 description).
        if isinstance(self.occupation, SelfEmployedOccupation):
            # A separately addressed office is assessed on its own premises
            # tenure and never triggers the guarantor question.
            resi_cum_office_rented = (
                self.property_status is PropertyStatus.RESI_CUM_OFFICE_RENTED
            )
            if resi_cum_office_rented and self.occupation.guarantor_status is None:
                raise ValueError(
                    "guarantorStatus is required when the office operates out of a rented residence."
                )
            if not resi_cum_office_rented and self.occupation.guarantor_status is not None:
                raise ValueError(
                    "guarantorStatus is only collected when the office operates out of a "
                    "rented residence."
                )

        return self

    @property
    def property_status(self) -> PropertyStatus:
        """Resolve residence + workplace tenure into the matrix's vocabulary."""
        if self.address is None:
            return PropertyStatus.OWNED
        key = (
            self.address.resident_details,
            self.occupation.office_address_type,
            self.occupation.office_premises_status,
        )
        return PROPERTY_STATUS_MATRIX[key]

    def to_engine_payload(self) -> Dict[str, Any]:
        """Flatten the wizard submission into the bank-matrix input vocabulary.

        Pure in-memory dict assembly — no I/O — so it stays inside the hot-path
        budget alongside the RAM rule evaluation.
        """
        payload: Dict[str, Any] = {}
        payload.update(self.identity.engine_inputs())
        payload.update(self.occupation.engine_inputs())
        payload.update(self.banking.engine_inputs())
        payload["property_status"] = self.property_status.value
        payload["guarantor_provided"] = self.occupation.guarantor_provided
        payload["sibling_co_applicant"] = (
            self.co_applicant.has_sibling_co_applicant if self.co_applicant else False
        )
        if self.address is not None:
            payload["pincode"] = self.address.pincode
            payload["city"] = self.address.city_name
            payload["state"] = self.address.state_name
        return payload

    model_config = ConfigDict(
        populate_by_name=True,
        extra="forbid",
        json_schema_extra={
            "example": {
                "identity": {
                    "entityType": "Individual",
                    "applicantName": "Rohan Sharma",
                    "dob": "1992-05-15",
                    "gender": "Male",
                    "pan": "ABCDE1234F",
                    "maritalStatus": "Married",
                    "citizenshipStatus": "Resident Indian",
                    "phone": "9876543210",
                    "email": "rohan.sharma@example.com",
                },
                "address": {
                    "pincode": "560001",
                    "cityName": "Bengaluru",
                    "stateName": "Karnataka",
                    "residentDetails": "Owned House",
                },
                "occupation": {
                    "profileType": "Salaried",
                    "employerType": "Employment-Pvt Ltd",
                    "tenureBand": "2y+",
                    "grossSalaryBand": "gt25000",
                    "salaryMode": "Salary payment mode- Bank Credit",
                    "form16Status": "Form 16",
                    "rentalIncomeTypeSalaried": "None",
                },
                "banking": {
                    "existingAccountBank": "BOI",
                    "existingCarLoanBank": "None",
                    "loanType": "Auto Loan",
                    "bureauCibilScore": 780,
                    "bureauDpd": 0,
                    "bureauLoanEnquiry": 0,
                    "bureauCurrentlyOutstanding": 0,
                    "bureauAgeAtLastEMI": 55,
                },
                "coApplicant": {
                    "coAppAgeRelation": "None",
                    "coAppIncomeRelation": "None",
                },
            }
        },
    )


# --------------------------------------------------------------------------- #
# Responses
# --------------------------------------------------------------------------- #


class RejectionReasonDetail(BaseModel):
    rule_id: str
    category: str
    message: str


class RuleOutcomeDetail(BaseModel):
    """One evaluated rule, with the applicant's value against the bank's limit."""

    rule_id: str
    name: str
    category: str
    value: str
    limit: str
    message: str = ""


class BankEvaluationReport(BaseModel):
    is_eligible: bool
    passed_rules: List[RuleOutcomeDetail]
    failed_rules: List[RuleOutcomeDetail]


class OnboardingEvaluationResponse(BaseModel):
    success: bool = True
    status: str
    overall_eligible: bool
    executed_rules_count: int
    execution_time_ms: float
    rejection_reasons: List[RejectionReasonDetail]
    bank_eligibility: Dict[str, bool]
    # Per-bank audit trail: every rule evaluated, passed and failed.
    evaluation_report: Dict[str, BankEvaluationReport] = Field(default_factory=dict)


class OnboardingFormEvaluationResponse(OnboardingEvaluationResponse):
    """Wizard verdict plus the audit handles the caller needs to trace it."""

    application_id: Optional[str] = None
    entity_type: EntityType
    selected_bank: BankCode
    persisted: bool = Field(
        default=True,
        description="False when the verdict was returned but the audit trail could not be written.",
    )
