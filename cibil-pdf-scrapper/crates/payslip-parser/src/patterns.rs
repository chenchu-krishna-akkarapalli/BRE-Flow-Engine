use regex::Regex;
use std::sync::OnceLock;

// Compiled once per process; these run against every line of every document.
macro_rules! lazy_regex {
    ($name:ident, $pattern:literal) => {
        pub fn $name() -> &'static Regex {
            static CELL: OnceLock<Regex> = OnceLock::new();
            CELL.get_or_init(|| Regex::new($pattern).expect("pattern is a literal, checked at test time"))
        }
    };
}

lazy_regex!(pan, r"(?i)\b([A-Z]{5}[0-9]{4}[A-Z])\b");
lazy_regex!(uan, r"(?i)\bUAN\s*(?:no\.?|number)?\s*[:\-]?\s*(\d{12})\b");
lazy_regex!(month_year, r"(?i)\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s,\-/']*(\d{4})\b");
lazy_regex!(amount, r"(?:(?:\(|-)?\s*(?:INR|Rs\.?|₹)?\s*\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?\s*\)?)");
lazy_regex!(account_number, r"\b(\d{9,18})\b");

// Amounts are the last numeric token on a table row; the label is what precedes.
lazy_regex!(trailing_amount, r"(-?\(?\s*(?:INR|Rs\.?|₹)?\s*[\d,]+(?:\.\d{1,2})?\s*\)?(?:\s*(?:CR|DR))?)\s*$");

/// Labels that introduce an earnings block, across the vendors in the corpus.
pub const EARNINGS_HEADERS: &[&str] = &[
    "EARNINGS", "EARNING", "INCOME", "SALARY DETAILS", "PARTICULARS",
    "DESCRIPTION", "ALLOWANCES", "GROSS SALARY",
];

/// Labels that introduce a deductions block.
pub const DEDUCTIONS_HEADERS: &[&str] = &[
    "DEDUCTIONS", "DEDUCTION", "RECOVERIES", "TAXES & DEDUCTIONS",
];

/// Labels that represent annual compensation or YTD tax figures, not monthly items.
pub const ANNUAL_LABELS: &[&str] = &[
    "COMPENSATION", "ANNUAL", "YTD", "PROJECTED", "CTC",
    "TAXABLE INCOME", "RETAINER", "REPORTED BY THE EMPLOYEE",
    "TAX PAYABLE", "TAX DEDUCTED SO FAR", "TAX DEDUCTED SO-FAR", "TAX PAYABLE/REFUNDABLE",
    "CHAPTER VI-A", "CHAPTER - VIA", "EXEMPTION UNDER SECTION", "ADD ANY OTHER INCOME",
    "OTHER SECTIONS UNDER", "TOTAL INCOME", "SEC 10 EXEMPTION",
    "FORM 16", "FORM-16", "ANNUAL SUMMARY", "INCM UNDER SALARY HEAD",
    "GROSS TOTAL INCOME", "TAX ON TOTAL INCOME", "TAX PAYABLE AND SURCHARG",
    "TAX BREAKUP FOR THE FINANCIAL YEAR", "TAX BREAKUP", "FINANCIAL YEAR",
    "ANNUAL GROSS INCOME", "TOTAL DEDUCTION FOR THE FINANCIAL YEAR", "NET TAX FOR THE FINANCIAL YEAR",
    "TAX TO BE DEDUCTED", "INVESTMENT DETAILS", "ANNUAL INCOME", "FY 20", "FY20", "FY 2", "ANNUAL CTC",
    "ANNUAL INCOME TAX", "TAX REGIME", "TAX UNDER NEW", "TAX UNDER OLD",
];

pub fn is_annual_row(label: &str) -> bool {
    let upper = label.to_ascii_uppercase();
    ANNUAL_LABELS.iter().any(|a| upper.contains(a))
}

/// Rows that are totals, not line items. Matched before line-item parsing so a
/// "Total Earnings" row is never mistaken for another allowance.
pub const TOTAL_LABELS: &[&str] = &[
    "TOTAL", "GROSS", "SUB TOTAL", "SUBTOTAL", "NET PAY", "NET SALARY",
    "NET AMOUNT", "TAKE HOME", "NET PAYABLE",
];

pub fn is_total_row(label: &str) -> bool {
    let upper = label.to_ascii_uppercase();
    TOTAL_LABELS.iter().any(|t| upper.contains(t))
}

pub fn is_section_header(label: &str, headers: &[&str]) -> bool {
    let upper = label.trim().to_ascii_uppercase();
    headers.iter().any(|h| upper == *h || upper.starts_with(h))
}

use payslip_core::TextRun;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LayoutSignature {
    UnitsColumn,
    FinancialYearTaxBreakup,
    AirtelMultiPage,
    TotalSalaryLabel,
    DualTaxWorksheet,
    MultiPageTaxSpreadsheet,
    SideBySideITProjection,
    Standard,
}

pub fn is_multipage_tax_spreadsheet_layout(runs: &[TextRun<'_>]) -> bool {
    let p1_text: String = runs.iter().filter(|r| r.page == 1).map(|r| r.text.as_ref()).collect::<Vec<_>>().join(" ").to_ascii_uppercase();
    let p2_text: String = runs.iter().filter(|r| r.page == 2).map(|r| r.text.as_ref()).collect::<Vec<_>>().join(" ").to_ascii_uppercase();
    p1_text.contains("ANNUAL INCOME TAX CALCULATION FOR FINANCIAL YEAR") && p2_text.contains("SALARY SLIP")
}

pub fn is_sidebyside_it_projection_layout(full_text: &str) -> bool {
    let upper = full_text.to_ascii_uppercase();
    upper.contains("ELECTRONIC PAY-SLIP CUM IT PROJECTION") || upper.contains("INCOME TAX CALCULATION IN RS.")
}

pub fn detect_layout_signature(full_text: &str, runs: &[TextRun<'_>]) -> LayoutSignature {
    if is_multipage_tax_spreadsheet_layout(runs) {
        LayoutSignature::MultiPageTaxSpreadsheet
    } else if is_sidebyside_it_projection_layout(full_text) {
        LayoutSignature::SideBySideITProjection
    } else {
        let upper = full_text.to_ascii_uppercase();
        if upper.contains("UNITS") && (upper.contains("AMOUNT (INR)") || upper.contains("EARNINGS/ALLOWANCE")) {
            LayoutSignature::UnitsColumn
        } else if upper.contains("TAX BREAKUP FOR THE FINANCIAL YEAR") || upper.contains("TAX BREAKUP") {
            LayoutSignature::FinancialYearTaxBreakup
        } else if upper.contains("AIRTEL") || upper.contains("BHARTI AIRTEL") || upper.contains("SIPPAYOUT") || upper.contains("SIP PAYOUT") {
            LayoutSignature::AirtelMultiPage
        } else if upper.contains("TOTAL SALARY") || upper.contains("GROSS DEDUCTION") {
            LayoutSignature::TotalSalaryLabel
        } else if upper.contains("INCOME TAX WORKSHEET") || upper.contains("INCOME TAX CALCULATION") {
            LayoutSignature::DualTaxWorksheet
        } else {
            LayoutSignature::Standard
        }
    }
}

pub fn is_incentive_or_bonus_item(raw_label: &str, canonical_category: &str) -> bool {
    let lower_label = raw_label.to_ascii_lowercase();
    let cat = canonical_category;
    if cat == "production_incentive_bonus"
        || cat == "statutory_bonus"
        || cat == "performance_incentive"
        || cat == "bonus_incentive"
    {
        return true;
    }
    lower_label.contains("incentive")
        || lower_label.contains("performance incentive")
        || lower_label.contains("sales incentive")
        || lower_label.contains("bonus")
        || lower_label.contains("exgratia")
        || lower_label.contains("ex-gratia")
        || lower_label.contains("sip payout")
        || lower_label.contains("sip")
}
