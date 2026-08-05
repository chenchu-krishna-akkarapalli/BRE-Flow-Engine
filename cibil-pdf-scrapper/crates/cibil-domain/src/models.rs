use std::collections::HashMap;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CibilReport {
    pub report_metadata: ReportMetadata,
    pub consumer_info: ConsumerInfo,
    pub score_info: ScoreInfo,
    pub accounts_summary: AccountsSummary,
    pub accounts: Vec<CreditAccount>,
    pub enquiries: Vec<EnquiryDetail>,
    pub addresses: Vec<AddressDetail>,
    pub employment: Vec<EmploymentDetail>,
    pub confidence: DocumentConfidence,
    pub validation_errors: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReportMetadata {
    pub report_date: String,
    pub control_number: String,
    pub version: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ConsumerInfo {
    pub consumer_name: String,
    pub pan: Option<String>,
    pub date_of_birth: Option<String>,
    pub gender: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ScoreInfo {
    pub cibil_score: u16,
    pub score_factors: Vec<String>,
    pub grameen_score: Option<i16>,
    /// Personal-loan score; absent when the report carries only a CreditVision score.
    pub pl_score: Option<i16>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AccountsSummary {
    pub total_accounts: u32,
    pub active_accounts: u32,
    pub closed_accounts: u32,
    pub total_balance: u64,
    pub total_sanctioned_amount: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CreditAccount {
    pub index: u32,
    pub account_type: String,
    pub status: AccountStatus,
    pub date_opened: Option<String>,
    pub date_closed: Option<String>,
    pub sanctioned_amount: Option<u64>,
    pub current_balance: Option<u64>,
    pub ownership: Option<String>,
    pub collateral_type: Option<String>,
    pub collateral_value: Option<u64>,
    pub credit_facility_status: Option<String>,
    pub written_off_amount_total: Option<u64>,
    pub written_off_amount_principal: Option<u64>,
    pub settlement_amount: Option<u64>,
    pub amount_overdue: Option<u64>,
    pub date_of_last_payment: Option<String>,
    pub payment_history_start_date: Option<String>,
    pub payment_history_end_date: Option<String>,
    pub payment_history: HashMap<String, HashMap<String, Option<String>>>, // Year -> (Month -> DPD/Status)
    pub confidence: f32,
    pub source_pages: Vec<u32>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub enum AccountStatus {
    Active,
    Inactive,
    WrittenOff,
    SuitFiled,
    Repossessed,
    Unknown,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EnquiryDetail {
    pub member_name: String,
    pub date: String,
    pub purpose: String,
    pub amount: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AddressDetail {
    pub address: String,
    pub category: String,
    pub date_reported: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EmploymentDetail {
    pub occupation_code: String,
    pub income: Option<u64>,
    pub income_indicator: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DocumentConfidence {
    pub character_confidence: f32,
    pub layout_confidence: f32,
    pub relationship_confidence: f32,
    pub overall_score: f32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ConsumerProfile {
    pub consumer_name: String,
    pub pan: Option<String>,
    pub date_of_birth: Option<String>,
    pub gender: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub addresses: Vec<AddressDetail>,
    pub employment: Vec<EmploymentDetail>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AccountHistory {
    pub summary: AccountsSummary,
    pub accounts: Vec<CreditAccount>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EnquiryHistory {
    pub enquiries: Vec<EnquiryDetail>,
}
