use regex::Regex;
use std::sync::OnceLock;

macro_rules! lazy_regex {
    ($name:ident, $pattern:literal) => {
        pub fn $name() -> &'static Regex {
            static CELL: OnceLock<Regex> = OnceLock::new();
            CELL.get_or_init(|| Regex::new($pattern).expect("literal pattern, covered by tests"))
        }
    };
}

lazy_regex!(pan, r"\b([A-Z]{5}[0-9]{4}[A-Z])\b");
lazy_regex!(section_code, r"(?i)\b(80[A-Z]{1,3}\b|87A|89|24\(b\)|10\(\d+[A-Z]*\))");

/// Head-of-income labels, per head, across the vendor dialects in the corpus.
///
/// Matched on a normalised uppercase line. Chapter references are the reliable
/// discriminator where a vendor writes "(Chapter IV D)"; the plain wording is
/// the fallback for the uppercase dialect.
pub const SALARY: &[&str] = &[
    "INCOME FROM SALARY", "SALARIES (CHAPTER IV A)", "INCOME FROM SALARIES",
    "SALARY (CHAPTER IV A)", "CHAPTER IV A",
    // Bare plural only. "SALARY" alone would also match the "GROSS SALARY" and
    // "TAXABLE SALARY" working lines that sit under the head.
    "SALARIES",
];

pub const HOUSE_PROPERTY: &[&str] = &[
    "INCOME FROM HOUSE PROPERTY", "HOUSE PROPERTY (CHAPTER IV C)", "CHAPTER IV C",
];

pub const BUSINESS: &[&str] = &[
    "INCOME FROM BUSINESS OR PROFESSION", "PROFITS AND GAINS FROM BUSINESS OR PROFESSION",
    "INCOME FROM BUSINESS", "PROFITS AND GAINS OF BUSINESS OR PROFESSION", "CHAPTER IV D",
];

pub const CAPITAL_GAINS: &[&str] = &[
    "INCOME FROM CAPITAL GAIN", "CAPITAL GAINS", "CAPITAL GAIN (CHAPTER IV E)", "CHAPTER IV E",
];

pub const OTHER_SOURCES: &[&str] = &[
    "INCOME FROM OTHER SOURCES", "INCOME FROM OTHER SOURCE", "OTHER SOURCES (CHAPTER IV F)",
    "CHAPTER IV F",
];

pub const GROSS_TOTAL_INCOME: &[&str] = &["GROSS TOTAL INCOME"];
pub const DEDUCTIONS_VIA: &[&str] = &[
    "LESS: DEDUCTIONS (CHAPTER VI-A)", "DEDUCTIONS UNDER CHAPTER VI-A",
    "LESS : DEDUCTION UNDER CHAPTER VI-A", "DEDUCTION UNDER CHAPTER VI A",
    "TOTAL DEDUCTIONS", "CHAPTER VI-A",
];
pub const TOTAL_INCOME: &[&str] = &["TOTAL INCOME (TAXABLE)", "TOTAL INCOME"];
pub const ROUNDED_INCOME: &[&str] = &["ROUND OFF U/S 288 A", "TOTAL INCOME ROUNDED OFF U/S 288A", "ROUNDED OFF U/S 288"];

pub const TAX_DUE: &[&str] = &["TAX DUE", "TAX ON TOTAL INCOME", "TOTAL TAX"];
pub const SURCHARGE: &[&str] = &["SURCHARGE"];
pub const CESS: &[&str] = &["HEALTH & EDUCATION CESS", "HEALTH AND EDUCATION CESS", "EDUCATION CESS", "HEC"];
pub const REBATE: &[&str] = &["REBATE U/S 87A", "REBATE"];
pub const RELIEF: &[&str] = &["RELIEF U/S 89", "RELIEF"];
pub const NET_TAX: &[&str] = &["TAX PAYABLE", "NET TAX PAYABLE", "NET TAX"];
pub const TDS: &[&str] = &["T.D.S./T.C.S", "TDS/TCS", "T.D.S.", "TDS"];
pub const TCS: &[&str] = &["T.C.S.", "TCS"];
pub const ADVANCE_TAX: &[&str] = &["ADVANCE TAX"];
pub const SELF_ASSESSMENT: &[&str] = &["DEPOSIT U/S 140A", "SELF ASSESSMENT TAX", "U/S 140A"];

/// Lines that are tax-slab working, not results. A slab row carries several
/// figures and would otherwise be read as a head of income.
pub fn is_slab_working(upper: &str) -> bool {
    upper.starts_with("TAX ON ")
        || upper.contains("EXEMPTION LIMIT :")
        || upper.contains("@5%")
        || upper.contains("@10%")
        || upper.contains("@15%")
        || upper.contains("@20%")
        || upper.contains("@30%")
}

/// True when a label matches any spelling for a field, ignoring inter-word gaps.
pub fn matches_any(upper_label: &str, options: &[&str]) -> bool {
    let squashed = upper_label.replace(' ', "");
    options.iter().any(|o| squashed.contains(&o.replace(' ', "")))
}
