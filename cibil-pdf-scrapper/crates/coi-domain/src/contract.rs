use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Meta {
    pub ocr_used: bool,
    pub source: String,
    pub confidence_score: f64,
    pub confidence_breakdown: ConfidenceBreakdown,
    pub low_confidence_fields: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ConfidenceBreakdown {
    pub assessee_info: f64,
    pub bank_details: f64,
    pub return_details: f64,
    pub computation: f64,
    pub tax_computation: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AssesseeInfo {
    pub name: Option<String>,
    pub pan: Option<String>,
    pub father_name: Option<String>,
    pub residential_address: Option<String>,
    pub status: Option<String>,
    pub assessment_year: Option<String>,
    pub ward_no: Option<String>,
    pub financial_year: Option<String>,
    pub gender: Option<String>,
    pub date_of_birth: Option<String>,
    pub email: Option<String>,
    pub residential_status: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BankDetails {
    pub bank_name: Option<String>,
    pub ifsc_code: Option<String>,
    pub account_no: Option<String>,
    pub branch_address: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ReturnDetails {
    pub form_type: Option<String>,
    pub filing_status: Option<String>,
    pub filing_date: Option<String>,
    pub acknowledgement_no: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PresumptiveTier {
    pub presumptive_rate_pct: Option<i64>,
    pub deemed_base_turnover: Option<i64>,
    pub deemed_profit: Option<i64>,
    pub declared_profit: Option<i64>,
    pub profit_taken_higher_of_declared_or_deemed: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BusinessProfession {
    pub tiers: Vec<PresumptiveTier>,
    pub section_total: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ComputationOfTotalIncome {
    pub profits_and_gains_business_profession: BusinessProfession,
    pub gross_total_income: Option<i64>,
    pub total_income: Option<i64>,
    pub total_income_rounded_288a: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TaxSlab {
    pub slab_upper_limit_or_amount: Option<i64>,
    pub tax: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TdsItem {
    pub section: Option<String>,
    pub description: Option<String>,
    pub amount: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TaxComputationContract {
    pub slabs: Vec<TaxSlab>,
    pub rebate_87a: Option<i64>,
    pub tds: Vec<TdsItem>,
    pub refundable: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct FinancialParticulars {
    pub sundry_creditors: Option<i64>,
    pub total_capital_and_liabilities: Option<i64>,
    pub inventories: Option<i64>,
    pub sundry_debtors: Option<i64>,
    pub balance_with_banks: Option<i64>,
    pub cash_in_hand: Option<i64>,
    pub total_assets: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CoiDocument {
    #[serde(rename = "_meta")]
    pub meta: Meta,
    pub assessee_info: AssesseeInfo,
    pub bank_details: BankDetails,
    pub return_details: ReturnDetails,
    pub computation_of_total_income: ComputationOfTotalIncome,
    pub tax_computation: TaxComputationContract,
    pub financial_particulars: FinancialParticulars,
}
