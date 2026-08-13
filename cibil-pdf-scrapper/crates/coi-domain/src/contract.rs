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

// single concise context line
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PresumptiveTier {
    pub presumptive_rate_pct: Option<f64>,
    pub deemed_base_turnover: Option<i64>,
    pub deemed_profit: Option<i64>,
    pub declared_profit: Option<i64>,
    pub profit_taken_higher_of_declared_or_deemed: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BusinessIncomeDetails {
    pub firm_name: Option<String>,
    pub pan: Option<String>,
    pub share_percentage: Option<f64>,
    pub remuneration: Option<i64>,
    pub interest: Option<i64>,
    #[serde(rename = "profit_exempt_u_s_10_2A")]
    pub profit_exempt_u_s_10_2a: Option<i64>,
    pub capital_balance: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BusinessIncomeSection {
    pub chapter: Option<String>,
    pub total: Option<i64>,
    pub details: Option<BusinessIncomeDetails>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ShortTermCapitalGainDetails {
    pub capital_gain_as_per_details_attached: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct LongTermCapitalGainDetails {
    pub threshold_limit: Option<i64>,
    #[serde(rename = "long_term_capital_gain_u_s_112A_before_23_07_2024")]
    pub long_term_capital_gain_u_s_112a_before_23_07_2024: Option<i64>,
    pub brought_forward_long_term_capital_loss: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CapitalGainSection {
    pub chapter: Option<String>,
    pub total: Option<i64>,
    pub short_term_capital_gain: Option<ShortTermCapitalGainDetails>,
    pub long_term_capital_gain: Option<LongTermCapitalGainDetails>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SalariesLayout {
    pub gross_salary: Option<i64>,
    #[serde(rename = "standard_deduction_u_s_16_ia")]
    pub standard_deduction_u_s_16_ia: Option<i64>,
    pub taxable_salary: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ProfitsAndGainsBusinessProfession {
    pub tiers: Vec<PresumptiveTier>,
    pub section_total: Option<i64>,
    pub deemed_profit_44ad: Option<i64>,
    pub declared_profit_44ad: Option<i64>,
    pub turnover_base_44ad: Option<i64>,
    pub taxable_business_profit: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TaxSlabItem {
    pub slab: String,
    pub tax_amount: i64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ComputationOfTaxOnTotalIncome {
    pub tax_slabs: Vec<TaxSlabItem>,
    pub total_tax: Option<i64>,
    #[serde(rename = "rebate_u_s_87a")]
    pub rebate_u_s_87a: Option<i64>,
    pub tax_after_rebate: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TdsDeductedItem {
    pub section: String,
    pub description: String,
    pub amount: i64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RefundDetails {
    pub amount: Option<i64>,
    #[serde(rename = "tax_refundable_rounded_off_u_s_288b")]
    pub tax_refundable_rounded_off_u_s_288b: Option<i64>,
}

// single concise context line
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct OtherSourcesDetails {
    pub interest_from_saving_bank_accounts: Option<i64>,
    pub interest_on_fdr: Option<i64>,
    pub interest_from_time_deposit: Option<i64>,
    pub interest_on_income_tax_refund: Option<i64>,
    pub other_item: Option<i64>,
    pub dividend_from_shares: Option<i64>,
    pub total: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct OtherSourcesSection {
    pub chapter: Option<String>,
    pub total: Option<i64>,
    pub details: Option<OtherSourcesDetails>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DeductionsSection {
    pub chapter: Option<String>,
    pub total: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TotalIncomeDetails {
    pub amount: Option<i64>,
    #[serde(rename = "round_off_u_s_288A")]
    pub round_off_u_s_288a: Option<i64>,
    #[serde(rename = "income_exempt_u_s_10")]
    pub income_exempt_u_s_10: Option<i64>,
    pub adjusted_total_income: Option<i64>,
    pub amt_applicable: Option<bool>,
    pub amt_note: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct HealthAndEducationCess {
    pub rate: Option<f64>,
    pub amount: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TaxCalculationDetails {
    pub tax_due_exemption_limit: Option<i64>,
    pub short_term_capital_gain_tax: Option<i64>,
    pub total_tax: Option<i64>,
    #[serde(rename = "rebate_u_s_87a")]
    pub rebate_u_s_87a: Option<i64>,
    pub tax_after_rebate: Option<i64>,
    pub health_and_education_cess: Option<HealthAndEducationCess>,
    pub tax_after_cess: Option<i64>,
    pub tds_tcs: Option<i64>,
    #[serde(rename = "deposit_u_s_140A")]
    pub deposit_u_s_140a: Option<i64>,
    #[serde(rename = "refundable_round_off_u_s_288B")]
    pub refundable_round_off_u_s_288b: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NormalIncomeTaxCalculation {
    pub normal_income: Option<i64>,
    pub exemption_limit: Option<i64>,
    pub taxable_normal_income: Option<i64>,
    pub tax_rate: Option<f64>,
    pub tax_on_normal_income: Option<i64>,
    pub total_tax: Option<i64>,
}

// single concise context line
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RateAmount {
    pub amount: i64,
    pub rate_pct: Option<f64>,
}

// single concise context line
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct IncomeDeclaredBusinessTurnover {
    pub due_date_for_filing_return: Option<String>,
    pub due_date_extended_to: Option<String>,
    pub section: Option<String>,
    pub gross_receipts_other_than_digital: Option<i64>,
    pub gross_receipts_digital_mode: Option<i64>,
    pub gross_receipts_cash: Option<i64>,
    pub gross_receipts_total: Option<i64>,
    pub book_profit: Option<RateAmount>,
    pub deemed_profit_other_than_digital: Option<RateAmount>,
    pub deemed_profit_digital_mode: Option<RateAmount>,
    pub net_profit_declared: Option<RateAmount>,
    pub gross_receipts_turnover: Option<i64>,
    pub deemed_profit: Option<RateAmount>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ComputationOfTotalIncome {
    pub tax_regime: Option<String>,
    pub assessment_year: Option<String>,
    pub salaries: Option<SalariesLayout>,
    pub profits_and_gains_business_profession: Option<ProfitsAndGainsBusinessProfession>,
    pub income_declared_business_turnover: Option<IncomeDeclaredBusinessTurnover>,
    pub income_from_business_or_profession: Option<BusinessIncomeSection>,
    pub income_from_capital_gain: Option<CapitalGainSection>,
    pub income_from_other_sources: Option<OtherSourcesSection>,
    pub gross_total_income: Option<i64>,
    pub deductions: Option<DeductionsSection>,
    pub total_income: Option<TotalIncomeDetails>,
    pub total_income_rounded_288a: Option<i64>,
    #[serde(rename = "total_income_rounded_off_u_s_288a")]
    pub total_income_rounded_off_u_s_288a: Option<i64>,
    pub exempt_income_sec_10: Option<i64>,
    pub computation_of_tax_on_total_income: Option<ComputationOfTaxOnTotalIncome>,
    pub tax_calculation: Option<TaxCalculationDetails>,
    pub normal_income_tax_calculation: Option<NormalIncomeTaxCalculation>,
    pub tax_deducted_at_source_list: Vec<TdsDeductedItem>,
    pub total_tds_tcs: Option<i64>,
    pub refund: Option<RefundDetails>,
    pub special_rate_income_note: Option<String>,
}

// single concise context line
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TaxSlab {
    pub category: Option<String>,
    pub description: String,
    pub slab_upper_limit_or_amount: Option<i64>,
    pub tax: i64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TdsItem {
    pub section: Option<String>,
    pub description: Option<String>,
    pub amount: Option<i64>,
}

// single concise context line
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TaxComputationContract {
    pub slabs: Vec<TaxSlab>,
    pub rebate_of_tax_on_agriculture_income: Option<i64>,
    pub rebate_87a: Option<i64>,
    #[serde(rename = "fee_payable_u_s_234f")]
    pub fee_payable_u_s_234f: Option<i64>,
    pub refundable: Option<i64>,
    pub tds: Vec<TdsItem>,
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
    pub serial_no: Option<u32>,
    pub particulars: String,
    pub amount: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AnnexureDetails {
    pub gst_turnover_details: Vec<GstTurnoverDetail>,
    pub gst_turnover_total: i64,
    pub bank_interest_list: Vec<AnnexureIncomeItem>,
    pub bank_interest_total: i64,
    pub fdr_interest_list: Vec<AnnexureIncomeItem>,
    pub fdr_interest_total: i64,
    pub dividend_list: Vec<AnnexureIncomeItem>,
    pub dividend_total: i64,
    #[serde(alias = "tds_non_salary_list")]
    pub tsd_non_salary_list: Vec<AnnexureIncomeItem>,
    #[serde(alias = "tds_non_salary_total")]
    pub tsd_non_salary_total: i64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CoiDocument {
    #[serde(rename = "_meta")]
    pub meta: Meta,
    pub assessee_info: AssesseeInfo,
    pub bank_details: BankDetails,
    pub return_details: ReturnDetails,
    pub computation_of_total_income: ComputationOfTotalIncome,
    pub income_declared_business_turnover: Option<IncomeDeclaredBusinessTurnover>,
    pub tax_computation: TaxComputationContract,
    pub financial_particulars: FinancialParticulars,
    pub business_income_adjustments: BusinessIncomeAdjustments,
    pub other_sources_breakdown: OtherSourcesBreakdown,
    pub tax_computation_extended: TaxComputationExtended,
    pub ca_verification: CaVerification,
    pub annexures: AnnexureDetails,
}
