use serde::{Deserialize, Serialize};

/// An amount plus the text it was read from.
///
/// Stored in paise as i64: payroll figures are summed and compared, and binary
/// floats make those comparisons wrong by a paisa in ways that surface as
/// mismatched totals. `raw` is retained so a misparse is always traceable.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Money {
    pub paise: i64,
    pub raw: String,
}

impl Money {
    pub fn from_paise(paise: i64, raw: impl Into<String>) -> Self {
        Self { paise, raw: raw.into() }
    }

    pub fn rupees(&self) -> f64 {
        self.paise as f64 / 100.0
    }

    /// Parse a string that is ENTIRELY an amount: "1,23,456.78", "₹ 45000", "(1,200.00)".
    ///
    /// Strict by design. Harvesting digits out of a longer sentence silently
    /// welds unrelated numbers together — "Net Amount paid in Jan, 25: INR
    /// 2,04,151.00" parsed that way yields ₹25,204,151. Use [`Money::find`] to
    /// pull an amount out of surrounding prose.
    ///
    /// Returns None rather than zero for unparseable text — a deduction that
    /// silently became 0.00 would balance a payslip that does not balance.
    pub fn parse(text: &str) -> Option<Money> {
        let raw = text.trim();
        if raw.is_empty() {
            return None;
        }
        if !is_amount_token(raw) {
            return None;
        }

        // Trailing CR/DR and parenthesised figures both mean a negative amount.
        let upper = raw.to_ascii_uppercase();
        let bracketed = raw.starts_with('(') && raw.ends_with(')');
        let negative = bracketed || raw.starts_with('-') || upper.ends_with("DR");

        let digits: String = raw
            .chars()
            .filter(|c| c.is_ascii_digit() || *c == '.')
            .collect();
        if digits.is_empty() || !digits.chars().any(|c| c.is_ascii_digit()) {
            return None;
        }

        // More than one dot is a thousands separator style we cannot read safely.
        let mut parts = digits.split('.');
        let whole: i64 = parts.next().unwrap_or("0").parse().ok()?;
        let frac_text = parts.next().unwrap_or("");
        if parts.next().is_some() {
            return None;
        }

        let frac: i64 = match frac_text.len() {
            0 => 0,
            1 => frac_text.parse::<i64>().ok()? * 10,
            _ => frac_text[..2].parse().ok()?,
        };

        let paise = whole.checked_mul(100)?.checked_add(frac)?;
        Some(Money::from_paise(if negative { -paise } else { paise }, raw))
    }
}

// Currency and sign markers allowed to surround an amount. Anything else
// alphabetic means the string is prose, not a figure.
const CURRENCY_TOKENS: &[&str] = &["INR", "RS", "CR", "DR"];

/// True when the whole string is one amount, allowing currency and sign markers.
fn is_amount_token(text: &str) -> bool {
    let mut stripped = text.to_ascii_uppercase();
    for token in CURRENCY_TOKENS {
        stripped = stripped.replace(token, " ");
    }
    // Whatever remains must be digits and formatting only. The rupee sign and
    // the replacement char it often decodes to are treated as punctuation.
    stripped.chars().all(|c| {
        c.is_ascii_digit()
            || matches!(c, '.' | ',' | '(' | ')' | '-' | '+' | ' ' | ':' | '/')
            || matches!(c, '\u{20B9}' | '\u{FFFD}' | '\u{A0}' | '!')
    }) && text.chars().any(|c| c.is_ascii_digit())
}

impl Money {
    /// Pull the last amount out of a longer string, e.g. a labelled total row.
    ///
    /// Scans right-to-left because the figure column sits at the end of a row,
    /// and requires a separator or four digits so a stray year or employee
    /// number is not mistaken for money.
    pub fn find(text: &str) -> Option<Money> {
        let chars: Vec<char> = text.chars().collect();
        let mut end = chars.len();

        while end > 0 {
            if !chars[end - 1].is_ascii_digit() {
                end -= 1;
                continue;
            }
            let mut start = end;
            while start > 0
                && (chars[start - 1].is_ascii_digit() || matches!(chars[start - 1], ',' | '.'))
            {
                start -= 1;
            }
            let candidate: String = chars[start..end].iter().collect();
            let separated = candidate.contains(',') || candidate.contains('.');
            if separated || candidate.len() >= 4 {
                if let Some(money) = Money::parse(&candidate) {
                    // Keep the caller's full line so the figure stays traceable.
                    return Some(Money::from_paise(money.paise, text.trim()));
                }
            }
            end = start.saturating_sub(1);
        }
        None
    }
}

impl Money {
    /// The FIRST amount at or after `from`, scanning left to right.
    ///
    /// Needed where one row carries two figures — "Total Earnings: INR X Total
    /// Deductions: INR Y" — and the amount belonging to a label is the next one
    /// after it, not the last one on the line.
    pub fn find_first_from(text: &str, from: usize) -> Option<Money> {
        let chars: Vec<char> = text.chars().collect();
        let mut index = from.min(chars.len());

        while index < chars.len() {
            if !chars[index].is_ascii_digit() {
                index += 1;
                continue;
            }
            let start = index;
            let mut end = index;
            while end < chars.len()
                && (chars[end].is_ascii_digit() || matches!(chars[end], ',' | '.'))
            {
                end += 1;
            }
            // Trim a trailing separator that belonged to the sentence, not the figure.
            while end > start && matches!(chars[end - 1], ',' | '.') {
                end -= 1;
            }
            let candidate: String = chars[start..end].iter().collect();
            if candidate.contains(',') || candidate.contains('.') || candidate.len() >= 4 {
                if let Some(money) = Money::parse(&candidate) {
                    return Some(Money::from_paise(money.paise, candidate));
                }
            }
            index = end.max(start + 1);
        }
        None
    }

    pub fn find_first(text: &str) -> Option<Money> {
        Money::find_first_from(text, 0)
    }
}

#[cfg(test)]
mod tests {
    use super::Money;

    #[test]
    fn parses_indian_grouping() {
        assert_eq!(Money::parse("2,04,151.00").unwrap().paise, 20_415_100);
        assert_eq!(Money::parse("INR 76,809.00").unwrap().paise, 7_680_900);
        assert_eq!(Money::parse("45000").unwrap().paise, 4_500_000);
    }

    #[test]
    fn single_decimal_place_is_tenths_not_hundredths() {
        assert_eq!(Money::parse("12.5").unwrap().paise, 1_250);
    }

    #[test]
    fn negatives_use_every_notation_payslips_use() {
        assert_eq!(Money::parse("(1,200.00)").unwrap().paise, -120_000);
        assert_eq!(Money::parse("-500").unwrap().paise, -50_000);
        assert_eq!(Money::parse("500 DR").unwrap().paise, -50_000);
    }

    #[test]
    fn prose_is_rejected_rather_than_harvested_for_digits() {
        // Harvesting every digit turned this into 2,52,04,151.00 — a hundredfold
        // overstatement of the applicant's take-home pay.
        assert!(Money::parse("Net Amount paid in Jan, 25: INR 2,04,151.00").is_none());
        assert!(Money::parse("Employee No 412929 joined 2024").is_none());
        assert!(Money::parse("").is_none());
        assert!(Money::parse("Basic Salary").is_none());
    }

    #[test]
    fn find_first_takes_the_amount_after_its_label() {
        // One row, two totals: the figure for a label is the NEXT one, not the last.
        let row = "Total Earnings: INR 2,80,960.00 Total Deductions: INR 76,809.00";
        assert_eq!(Money::find_first(row).unwrap().paise, 28_096_000);

        let at = row.find("Total Deductions").unwrap();
        assert_eq!(Money::find_first_from(row, at).unwrap().paise, 7_680_900);
    }

    #[test]
    fn find_scans_from_the_right() {
        assert_eq!(Money::find("Gross 1,000.00 Net 900.00").unwrap().paise, 90_000);
    }

    #[test]
    fn bare_short_integers_are_not_amounts() {
        // A pay period "25" or a column index must not become money.
        assert!(Money::find_first("Jan, 25").is_none());
    }
}
