use crate::money::Money;
use crate::payslip::{EmployeeInfo, EmployerDetails, PayPeriod, RawContent};
use serde::{Deserialize, Serialize};

pub const SCHEMA_VERSION: &str = "1.0";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PayslipMetadata {
    pub source: String,
    pub format: String,
    pub page_count: u32,
    pub line_count: usize,
    pub schema_version: String,
    pub structure_source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PayComponent {
    pub label: String,
    pub amount: Option<Money>,
    pub raw_line: String,
    pub page: Option<u32>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ComponentSection {
    pub components: Vec<PayComponent>,
    pub stated_total: Option<Money>,
    pub parsed_total: i64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CompensationSummary {
    pub gross_earnings: Option<Money>,
    pub total_deductions: Option<Money>,
    pub net_pay: Option<Money>,
    pub net_pay_words: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Reconciliation {
    pub calculated_net_pay: Option<Money>,
    pub stated_net_pay: Option<Money>,
    pub balances: Option<bool>,
    pub earnings_component_total: i64,
    pub deduction_component_total: i64,
    pub earnings_gap: Option<i64>,
    pub deductions_gap: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelationalPayslip {
    pub metadata: PayslipMetadata,
    pub employee: EmployeeInfo,
    pub employer: EmployerDetails,
    pub pay_period: PayPeriod,
    pub earnings: ComponentSection,
    pub deductions: ComponentSection,
    pub compensation: CompensationSummary,
    pub reconciliation: Reconciliation,
    pub raw: RawContent,
}
