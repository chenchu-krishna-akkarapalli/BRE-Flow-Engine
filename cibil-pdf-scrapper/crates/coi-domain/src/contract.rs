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
    pub tax_regime: Option<String>,
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
    pub exempt_income_sec_10: Option<i64>,
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
pub struct AdjustmentItem {
    pub particulars: String,
    pub amount: Option<i64>,
}

// Partnership firm share details under Section 115BAC / P&L
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PartnershipFirmShare {
    pub firm_name: String,
    pub firm_pan: Option<String>,
    pub share_pct: Option<f64>,
    pub remuneration: i64,
    pub interest: i64,
    pub exempt_profit_10_2a: Option<i64>,
    pub capital_balance: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BusinessIncomeAdjustments {
    pub partnership_shares: Vec<PartnershipFirmShare>,
    pub income_44ad: Option<i64>,
    pub profit_as_per_pnl: Option<i64>,
    pub additions_salary_non_allowable: Option<i64>,
    pub total_business_income: Option<i64>,
    pub additions: Vec<AdjustmentItem>,
    pub deductions: Vec<AdjustmentItem>,
    pub net_business_income: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct OtherSourcesBreakdown {
    pub savings_bank_interest: Option<i64>,
    pub fdr_interest: Option<i64>,
    pub commission_interest: Option<i64>,
    pub total_other_sources: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TaxComputationExtended {
    pub total_tax_calculated: Option<i64>,
    pub interest_234a: Option<i64>,
    pub interest_234b: Option<i64>,
    pub interest_234c: Option<i64>,
    pub total_interest_234: Option<i64>,
    pub tcs_amount: Option<i64>,
    pub deposit_140a_self_assessment: Option<i64>,
    pub tax_payable: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CaVerification {
    pub firm_name: Option<String>,
    pub ca_name: Option<String>,
    pub membership_no: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct GstTurnoverDetail {
    pub gstin: Option<String>,
    pub turnover: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AnnexureIncomeItem {
    pub particulars: String,
    pub amount: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AnnexureDetails {
    pub gst_turnover_details: Vec<GstTurnoverDetail>,
    pub bank_interest_list: Vec<AnnexureIncomeItem>,
    pub fdr_interest_list: Vec<AnnexureIncomeItem>,
    pub dividend_list: Vec<AnnexureIncomeItem>,
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
    pub business_income_adjustments: BusinessIncomeAdjustments,
    pub other_sources_breakdown: OtherSourcesBreakdown,
    pub tax_computation_extended: TaxComputationExtended,
    pub ca_verification: CaVerification,
    pub annexures: AnnexureDetails,
}
