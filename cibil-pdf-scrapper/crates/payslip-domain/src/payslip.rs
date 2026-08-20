use payslip_layout::{Line, Table};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct EmployeeInfo {
    pub name: Option<String>,
    pub employee_id: Option<String>,
    pub designation: Option<String>,
    pub department: Option<String>,
    pub date_of_joining: Option<String>,
    pub pan: Option<String>,
    pub uan: Option<String>,
    pub pf_number: Option<String>,
    pub esi_number: Option<String>,
    pub bank_account: Option<String>,
    pub bank_name: Option<String>,
    pub ifsc_or_routing_code: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct EmployerDetails {
    pub name: Option<String>,
    pub address: Option<String>,
    pub business_unit: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Period {
    pub period_type: String,
    pub month: Option<String>,
    pub year: Option<u16>,
    pub financial_year: Option<String>,
    pub from_date: Option<String>,
    pub to_date: Option<String>,
    pub days_in_month: Option<u32>,
    pub working_days: Option<u32>,
    pub paid_days: Option<u32>,
    pub lop_days: Option<f64>,
    pub arrear_days: Option<f64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AmountField {
    pub value: Option<f64>,
    pub currency: Option<String>,
    pub raw_label: Option<String>,
    pub raw_value_string: Option<String>,
    pub match_method: Option<String>,
    pub confidence: f64,
}

impl AmountField {
    pub fn new(value: f64, raw_label: &str, raw_val: &str, match_method: &str, confidence: f64) -> Self {
        Self {
            value: Some(value),
            currency: Some("INR".to_string()),
            raw_label: Some(raw_label.to_string()),
            raw_value_string: Some(raw_val.to_string()),
            match_method: Some(match_method.to_string()),
            confidence,
        }
    }

    pub fn from_money(money: &crate::money::Money, raw_label: &str, match_method: &str) -> Self {
        let val = money.paise as f64 / 100.0;
        Self::new(val, raw_label, &money.raw, match_method, 1.0)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LineItem {
    pub raw_label: String,
    pub canonical_category: String,
    pub amount: Option<AmountField>,
    pub amount_actual: Option<AmountField>,
    pub amount_payable: Option<AmountField>,
    pub frequency: String,
    pub page: Option<u32>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ItemsGroup {
    pub items: Vec<LineItem>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Summary {
    pub gross_salary: Option<AmountField>,
    pub net_pay: Option<AmountField>,
    pub total_deductions: Option<AmountField>,
    pub total_allowances: Option<AmountField>,
    pub total_incentives_and_bonus: Option<AmountField>,
    pub amount_in_words: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Reconciliation {
    pub gross_minus_deductions_matches_net: Option<bool>,
    pub delta_vs_stated_net: Option<f64>,
    pub sum_of_earning_items_matches_stated_gross: Option<bool>,
    pub sum_of_deduction_items_matches_stated_total: Option<bool>,
    pub flags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Statement {
    pub period: Period,
    pub earnings: ItemsGroup,
    pub deductions: ItemsGroup,
    pub summary: Summary,
    pub reconciliation: Option<Reconciliation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PayslipMetadata {
    pub source_file: String,
    pub page_count: u32,
    pub layout_signature: String,
    pub detected_locale: Option<String>,
    pub currency: Option<String>,
    pub extraction_confidence_overall: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawContent {
    pub page_count: u32,
    pub lines: Vec<Line>,
    pub table: Table,
}

impl RawContent {
    pub fn full_text(&self) -> String {
        self.lines.iter().map(|l| l.text()).collect::<Vec<_>>().join("\n")
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payslip {
    pub schema_version: String,
    pub metadata: PayslipMetadata,
    pub employer: EmployerDetails,
    pub employee: EmployeeInfo,
    pub statements: Vec<Statement>,
    pub raw: RawContent,
}

impl Payslip {
    pub fn sum_earnings(&self) -> i64 {
        self.statements
            .first()
            .map(|s| {
                s.earnings
                    .items
                    .iter()
                    .filter_map(|i| i.amount.as_ref().and_then(|a| a.value))
                    .map(|v| (v * 100.0).round() as i64)
                    .sum()
            })
            .unwrap_or(0)
    }

    pub fn sum_deductions(&self) -> i64 {
        self.statements
            .first()
            .map(|s| {
                s.deductions
                    .items
                    .iter()
                    .filter_map(|i| i.amount.as_ref().and_then(|a| a.value))
                    .map(|v| (v * 100.0).round() as i64)
                    .sum()
            })
            .unwrap_or(0)
    }

    pub fn balances(&self) -> Option<bool> {
        self.statements
            .first()
            .and_then(|s| s.reconciliation.as_ref())
            .and_then(|r| r.gross_minus_deductions_matches_net)
    }
}
