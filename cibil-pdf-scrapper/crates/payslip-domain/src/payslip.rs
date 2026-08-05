use crate::money::Money;
use payslip_layout::{Line, Table};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct EmployeeInfo {
    pub name: Option<String>,
    pub employee_id: Option<String>,
    pub designation: Option<String>,
    pub department: Option<String>,
    pub pan: Option<String>,
    pub uan: Option<String>,
    pub pf_number: Option<String>,
    pub esi_number: Option<String>,
    pub bank_account: Option<String>,
    pub date_of_joining: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct EmployerDetails {
    pub name: Option<String>,
    pub address: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PayPeriod {
    /// Verbatim period text, e.g. "April 2025" or "01-Apr-2025 to 30-Apr-2025".
    pub raw: Option<String>,
    pub month: Option<String>,
    pub year: Option<u16>,
    pub paid_days: Option<String>,
    pub lop_days: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Earning {
    pub label: String,
    pub amount: Option<Money>,
    /// The full source line, kept so an unparsed amount is still inspectable.
    pub raw_line: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Deduction {
    pub label: String,
    pub amount: Option<Money>,
    pub raw_line: String,
}

/// Everything read off the page, untouched.
///
/// Carried alongside the parsed fields so extraction is lossless: if the parser
/// misses a vendor's layout, the caller still has the complete document.
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
    pub source: String,
    pub format: String,
    pub employee: EmployeeInfo,
    pub employer: EmployerDetails,
    pub period: PayPeriod,
    pub earnings: Vec<Earning>,
    pub deductions: Vec<Deduction>,
    pub gross_earnings: Option<Money>,
    pub total_deductions: Option<Money>,
    pub net_pay: Option<Money>,
    pub net_pay_words: Option<String>,
    pub raw: RawContent,
}

impl Payslip {
    pub fn sum_earnings(&self) -> i64 {
        self.earnings.iter().filter_map(|e| e.amount.as_ref()).map(|m| m.paise).sum()
    }

    pub fn sum_deductions(&self) -> i64 {
        self.deductions.iter().filter_map(|d| d.amount.as_ref()).map(|m| m.paise).sum()
    }

    /// True when gross - deductions equals the stated net pay.
    ///
    /// Reported, never enforced: a payslip that does not balance is still the
    /// document the employer issued, and dropping it would lose information.
    pub fn balances(&self) -> Option<bool> {
        let gross = self.gross_earnings.as_ref()?.paise;
        let deductions = self.total_deductions.as_ref()?.paise;
        let net = self.net_pay.as_ref()?.paise;
        Some(gross - deductions == net)
    }
}
