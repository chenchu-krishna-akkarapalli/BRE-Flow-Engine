from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator
from app.constants import BankCode, EntityType, OccupationType, PropertyStatus


class CreditBureauPayload(BaseModel):
    cibil_score: int = Field(default=750, ge=300, le=900)
    cibil_pl_score: Optional[int] = Field(default=700, ge=300, le=900)
    dpd_history: List[Any] = Field(default_factory=lambda: [0, 0, 0])
    indian_bank_dpd: int = Field(default=0, ge=0)
    write_off_amount: float = Field(default=0.0, ge=0.0)
    currently_overdue: bool = Field(default=False)
    loan_enquiry_count_last_6m: int = Field(default=0, ge=0)


class RentalIncomePayload(BaseModel):
    agreement: bool = False
    itr_filed: bool = False
    bank_reflected: bool = False


class CoApplicantPayload(BaseModel):
    relation: str
    age: int
    income: float = 0.0


class OnboardingEvaluationRequest(BaseModel):
    entity_type: EntityType = EntityType.INDIVIDUAL
    occupation: OccupationType = OccupationType.SALARIED
    applicant_name: Optional[str] = "Jane Doe"
    pan: Optional[str] = Field(default="ABCDE1234F", description="Permanent Account Number")
    dob: Optional[str] = Field(default="1995-05-15", description="Date of Birth")
    age: int = Field(default=30, ge=18, le=100)
    age_at_last_emi_salaried: int = Field(default=45, ge=18, le=100)
    age_at_last_emi_self_employed: int = Field(default=50, ge=18, le=100)
    is_nri: bool = False
    minimum_stay_period_nri_days: int = 365
    marital_status: str = "MARRIED"
    property_status: PropertyStatus = PropertyStatus.OWNED
    guarantor_provided: bool = False
    
    # Salaried Fields
    net_monthly_salary: float = Field(default=50000.0, ge=0.0)
    current_company_tenure_months: int = Field(default=36, ge=0)
    minimum_work_experience_years: int = Field(default=5, ge=0)
    employer_type: str = "PVT_LTD"
    salary_payment_mode: str = "BANK_TRANSFER"
    form_16_available: bool = True
    no_income_proof_segment: bool = False
    
    # Self-Employed & Business Fields
    business_experience_years: int = Field(default=5, ge=0)
    current_itr: float = Field(default=500000.0, ge=0.0)
    previous_itr: float = Field(default=450000.0, ge=0.0)
    itr_filed: bool = True
    requested_loan_amount: float = Field(default=500000.0, ge=0.0)
    business_entity_type: str = "PROPRIETORSHIP"
    business_proof: bool = True
    business_itr_amount: float = Field(default=500000.0, ge=0.0)

    # Ratios & Bureau
    emi_income_ratio_foir: float = Field(default=0.40, ge=0.0, le=1.0)
    selected_bank: BankCode = BankCode.BOI
    credit_bureau: CreditBureauPayload = Field(default_factory=CreditBureauPayload)
    rental_income: Optional[RentalIncomePayload] = None
    co_applicants: Optional[List[CoApplicantPayload]] = None


class RejectionReasonDetail(BaseModel):
    rule_id: str
    category: str
    message: str


class OnboardingEvaluationResponse(BaseModel):
    success: bool = True
    status: str
    overall_eligible: bool
    executed_rules_count: int
    execution_time_ms: float
    rejection_reasons: List[RejectionReasonDetail]
    bank_eligibility: Dict[str, bool]
