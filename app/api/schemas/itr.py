"""Pydantic schemas for ITR document extraction response payloads."""

from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class ItrMetaSchema(BaseModel):
    ocr_used: bool = Field(default=False, description="Whether local OCR was used")
    source: str = Field(default="text_layer", description="PDF content source")


class AssesseeInfoSchema(BaseModel):
    pan: Optional[str] = Field(None, description="Permanent Account Number")
    name: Optional[str] = Field(None, description="Assessee Name")
    address: Optional[str] = Field(None, description="Residential Address")
    status: Optional[str] = Field(None, description="Assessee Status")
    assessment_year: Optional[str] = Field(None, description="Assessment Year")
    financial_year: Optional[str] = Field(None, description="Financial Year")


class ReturnDetailsSchema(BaseModel):
    form_number: Optional[str] = Field(None, description="ITR Form Number (e.g. ITR-4)")
    filed_u_s: Optional[str] = Field(None, description="Filing Section u/s 139")
    acknowledgement_number: Optional[str] = Field(None, description="Acknowledgement Number")
    date_of_filing: Optional[str] = Field(None, description="Filing Date")


class TaxableIncomeDetailsSchema(BaseModel):
    current_year_business_loss: Optional[int] = Field(0)
    total_income: Optional[int] = Field(None, description="Total Income in Rupees")
    book_profit_under_mat: Optional[int] = Field(0)
    adjusted_total_income_under_amt: Optional[int] = Field(0)
    net_tax_payable: Optional[int] = Field(0)
    interest_and_fee_payable: Optional[int] = Field(0)
    total_tax_interest_and_fee_payable: Optional[int] = Field(0)
    taxes_paid: Optional[int] = Field(0)
    tax_payable_or_refundable: Optional[int] = Field(0)


class AccretedIncomeDetailsSchema(BaseModel):
    accreted_income_u_s_115td: Optional[int] = Field(0)
    additional_tax_payable_u_s_115td: Optional[int] = Field(0)
    interest_payable_u_s_115te: Optional[int] = Field(0)
    additional_tax_and_interest_payable: Optional[int] = Field(0)
    tax_and_interest_paid: Optional[int] = Field(0)
    accreted_tax_payable_or_refundable: Optional[int] = Field(0)


class VerificationDetailsSchema(BaseModel):
    electronically_transmitted_on: Optional[str] = Field(None)
    ip_address: Optional[str] = Field(None)
    verified_by: Optional[str] = Field(None)
    verifier_pan: Optional[str] = Field(None)
    verification_date: Optional[str] = Field(None)
    evc_code: Optional[str] = Field(None)
    verification_mode: Optional[str] = Field(None)
    barcode_hash: Optional[str] = Field(None)


class ItrExtractionDataSchema(BaseModel):
    _meta: ItrMetaSchema
    assessee_info: AssesseeInfoSchema
    return_details: ReturnDetailsSchema
    taxable_income_and_tax_details: TaxableIncomeDetailsSchema
    accreted_income_and_tax_details: AccretedIncomeDetailsSchema
    verification_details: VerificationDetailsSchema


class ItrExtractionResponseSchema(BaseModel):
    status: str = Field("SUCCESS")
    data: ItrExtractionDataSchema
