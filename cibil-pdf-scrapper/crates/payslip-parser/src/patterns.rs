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
