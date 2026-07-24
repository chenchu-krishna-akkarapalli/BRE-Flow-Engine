from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.constants import BankCode, EntityType, OccupationType, PropertyStatus


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
