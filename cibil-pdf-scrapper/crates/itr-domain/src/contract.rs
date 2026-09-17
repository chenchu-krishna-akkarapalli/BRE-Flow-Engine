use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Meta {
    pub ocr_used: bool,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AssesseeInfo {
    pub pan: Option<String>,
    pub name: Option<String>,
    pub address: Option<String>,
    pub status: Option<String>,
    pub assessment_year: Option<String>,
    pub financial_year: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ReturnDetails {
    pub form_number: Option<String>,
    pub filed_u_s: Option<String>,
    pub acknowledgement_number: Option<String>,
    pub date_of_filing: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TaxableIncomeAndTaxDetails {
    pub current_year_business_loss: Option<i64>,
    pub total_income: Option<i64>,
    pub book_profit_under_mat: Option<i64>,
    pub adjusted_total_income_under_amt: Option<i64>,
    pub net_tax_payable: Option<i64>,
    pub interest_and_fee_payable: Option<i64>,
    pub total_tax_interest_and_fee_payable: Option<i64>,
    pub taxes_paid: Option<i64>,
    pub tax_payable_or_refundable: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AccretedIncomeAndTaxDetails {
    pub accreted_income_u_s_115td: Option<i64>,
    pub additional_tax_payable_u_s_115td: Option<i64>,
    pub interest_payable_u_s_115te: Option<i64>,
    pub additional_tax_and_interest_payable: Option<i64>,
    pub tax_and_interest_paid: Option<i64>,
    pub accreted_tax_payable_or_refundable: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VerificationDetails {
    pub electronically_transmitted_on: Option<String>,
    pub ip_address: Option<String>,
    pub verified_by: Option<String>,
    pub verifier_pan: Option<String>,
    pub verification_date: Option<String>,
    pub evc_code: Option<String>,
    pub verification_mode: Option<String>,
    pub barcode_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ItrDocument {
    pub _meta: Meta,
    pub assessee_info: AssesseeInfo,
    pub return_details: ReturnDetails,
    pub taxable_income_and_tax_details: TaxableIncomeAndTaxDetails,
    pub accreted_income_and_tax_details: AccretedIncomeAndTaxDetails,
    pub verification_details: VerificationDetails,
}
