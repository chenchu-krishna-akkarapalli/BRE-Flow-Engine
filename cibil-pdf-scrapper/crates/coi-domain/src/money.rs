use serde::{Deserialize, Serialize};

/// A rupee amount plus the text it was read from.
///
/// Stored in paise as i64. Computation sheets are cross-footed — GTI must equal
/// the sum of its heads — and binary floats make those equalities fail by a
/// paisa, turning a correct document into a validation error.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(transparent)]
pub struct Paise(pub i64);

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

    /// Parse a string that is ENTIRELY an amount: "14,15,039", "1,23,234.00", "(500)".
    ///
    /// Strict by design. Harvesting digits out of a sentence welds unrelated
    /// numbers together — a line like "Tax on 7,00,001 To 10,00,000" would
    /// otherwise yield a single meaningless figure.
    pub fn parse(text: &str) -> Option<Money> {
        let raw = text.trim();
        if raw.is_empty() || !is_amount_token(raw) {
            return None;
        }

        let upper = raw.to_ascii_uppercase();
        let negative = (raw.starts_with('(') && raw.ends_with(')'))
            || raw.starts_with('-')
            || upper.ends_with("DR");

        let digits: String = raw.chars().filter(|c| c.is_ascii_digit() || *c == '.').collect();
        if !digits.chars().any(|c| c.is_ascii_digit()) {
            return None;
        }

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

    /// The FIRST amount at or after `from`, scanning left to right.
    ///
    /// Needed where a row carries a label and its figure in one string.
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
            while end < chars.len() && (chars[end].is_ascii_digit() || matches!(chars[end], ',' | '.')) {
                end += 1;
            }
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

const CURRENCY_TOKENS: &[&str] = &["INR", "RS.", "RS", "CR", "DR"];

fn is_amount_token(text: &str) -> bool {
    let mut stripped = text.to_ascii_uppercase();
    for token in CURRENCY_TOKENS {
        stripped = stripped.replace(token, " ");
    }
    stripped.chars().all(|c| {
        c.is_ascii_digit()
            || matches!(c, '.' | ',' | '(' | ')' | '-' | '+' | ' ' | '/' | '\u{20B9}' | '\u{A0}')
    }) && text.chars().any(|c| c.is_ascii_digit())
}

#[cfg(test)]
mod tests {
    use super::Money;

    #[test]
    fn parses_indian_grouping_without_decimals() {
        assert_eq!(Money::parse("14,15,039").unwrap().paise, 141_503_900);
        assert_eq!(Money::parse("1,23,234.00").unwrap().paise, 12_323_400);
    }

    #[test]
    fn prose_is_rejected_not_harvested() {
        // "Tax on 7,00,001 To 10,00,000= 3,00,000 @10%" must not collapse into
        // one number; that is how a tax slab table becomes a bogus income figure.
        assert!(Money::parse("Tax on 7,00,001 To 10,00,000= 3,00,000 @10% = 30,000").is_none());
        assert!(Money::parse("Assessment Year").is_none());
    }

    #[test]
    fn brackets_and_dr_are_negative() {
        assert_eq!(Money::parse("(1,200)").unwrap().paise, -120_000);
        assert_eq!(Money::parse("-500").unwrap().paise, -50_000);
    }

    #[test]
    fn find_first_anchors_after_a_label() {
        let row = "Health & Education Cess (HEC) @ 4.00% 4,929";
        let at = row.find("4.00%").map(|i| i + 5).unwrap_or(0);
        assert_eq!(Money::find_first_from(row, at).unwrap().paise, 492_900);
    }
}
