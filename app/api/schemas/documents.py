from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

# Generic document extraction envelope
class DocumentExtractionResponse(BaseModel):
    document_type: str = Field(..., description="Classification category of uploaded document")
    file_name: str = Field(..., description="Sanitized file name")
    file_hash: str = Field(..., description="SHA-256 integrity hash of document payload")
    extracted_data: Dict[str, Any] = Field(default_factory=dict, description="Parsed structured fields")
    confidence_score: float = Field(default=1.0, description="Parser or OCR confidence level")
    execution_time_ms: float = Field(default=0.0, description="Extraction runtime duration in ms")

# CIBIL report parser extraction response
class CibilExtractionResponse(BaseModel):
    cibil_score: int = Field(..., description="Extracted consumer bureau score")
    cibil_pl_score: Optional[int] = Field(None, description="Extracted personal loan bureau score")
    max_dpd_days: int = Field(default=0, description="Peak Days Past Due across all accounts")
    dpd_count: int = Field(default=0, description="Total number of delinquent months")
    currently_outstanding: float = Field(default=0.0, description="Total active overdue balance in INR")
    write_off_amount: float = Field(default=0.0, description="Total written-off settled amount in INR")
    write_off_type: Optional[str] = Field(None, description="Category of bad debt write-off")
    loan_enquiry_count: int = Field(default=0, description="Inquiries within the last six months")
    account_count: int = Field(default=0, description="Total reported loan and credit card accounts")

# Payslip parser extraction response
class PayslipExtractionResponse(BaseModel):
    employer_name: Optional[str] = Field(None, description="Extracted employer trade name")
    employee_name: Optional[str] = Field(None, description="Extracted employee full name")
    pay_period: Optional[str] = Field(None, description="Salary month and year")
    basic_pay: float = Field(default=0.0, description="Basic monthly salary in INR")
    gross_salary: float = Field(default=0.0, description="Gross monthly remuneration in INR")
    total_deductions: float = Field(default=0.0, description="Sum of monthly deductions in INR")
    net_salary: float = Field(default=0.0, description="Net take-home monthly salary in INR")
    pf_deduction: float = Field(default=0.0, description="Provident fund deduction amount in INR")

# Computation of Income tax schedule response
class CoiExtractionResponse(BaseModel):
    assessment_year: Optional[str] = Field(None, description="Income tax assessment year")
    financial_year: Optional[str] = Field(None, description="Income tax financial year")
    gross_total_income: float = Field(default=0.0, description="Gross total income before deductions in INR")
    business_profession_income: float = Field(default=0.0, description="Income from business or profession in INR")
    depreciation_addback: float = Field(default=0.0, description="Depreciation amount added back in INR")
    taxable_income: float = Field(default=0.0, description="Total taxable income in INR")
    tax_paid: float = Field(default=0.0, description="Total income tax paid in INR")

# OpenBharatOCR identity extraction response
class OcrExtractionResponse(BaseModel):
    card_type: str = Field(..., description="Identity document type (PAN or AADHAAR)")
    id_number_masked: str = Field(..., description="PII-masked identity credential number")
    name: Optional[str] = Field(None, description="Extracted legal cardholder name")
    date_of_birth: Optional[str] = Field(None, description="Extracted date of birth (YYYY-MM-DD)")
    confidence: float = Field(default=1.0, description="Tesseract OCR confidence score")
