use regex::Regex;
use std::sync::OnceLock;

pub const AADHAAR_REDACTED: &str = "[Aadhaar Redacted]";

// Rust's regex engine has no look-around, so the digit boundaries either side
// are checked here rather than expressed in the pattern. Without that check a
// 16-digit account number yields a false match on its first twelve digits.
fn candidate() -> &'static Regex {
    static CELL: OnceLock<Regex> = OnceLock::new();
    CELL.get_or_init(|| Regex::new(r"[2-9][0-9]{3}[ -]?[0-9]{4}[ -]?[0-9]{4}").expect("literal"))
}

/// Byte spans of every Aadhaar-shaped number, bounded to a whole numeric token.
///
/// The match must BE the entire number, not a window inside one. A longer digit
/// run (a 16-digit account number) and a decimal fraction (`194.830810546875`,
/// which JSON coordinates produce in quantity) both contain 12-digit windows;
/// counting those redacts real data and reports leaks that do not exist.
///
/// Aadhaar numbers never begin with 0 or 1, so the leading class also keeps PIN
/// codes and short identifiers out.
pub fn spans(text: &str) -> Vec<(usize, usize)> {
    let bytes = text.as_bytes();
    let numeric = |i: usize| bytes.get(i).is_some_and(|b| b.is_ascii_digit() || *b == b'.');

    candidate()
        .find_iter(text)
        .filter(|m| {
            // Neither side may continue the number, through a digit or a point.
            let extends_left = m.start() > 0 && numeric(m.start() - 1);
            let extends_right = numeric(m.end());
            !extends_left && !extends_right
        })
        .map(|m| (m.start(), m.end()))
        .collect()
}

pub fn count(text: &str) -> usize {
    spans(text).len()
}

pub fn contains(text: &str) -> bool {
    !spans(text).is_empty()
}

/// Replace every Aadhaar-shaped run with the redaction marker.
pub fn redact(text: &str) -> String {
    let found = spans(text);
    if found.is_empty() {
        return text.to_string();
    }

    let mut out = String::with_capacity(text.len());
    let mut cursor = 0usize;
    for (start, end) in found {
        out.push_str(&text[cursor..start]);
        out.push_str(AADHAAR_REDACTED);
        cursor = end;
    }
    out.push_str(&text[cursor..]);
    out
}

#[cfg(test)]
mod tests {
    use super::{contains, count, redact, AADHAAR_REDACTED};

    #[test]
    fn every_written_form_is_redacted() {
        for input in ["Aadhaar No: 975490473406", "9754 9047 3406", "9754-9047-3406"] {
            let out = redact(input);
            assert!(out.contains(AADHAAR_REDACTED), "{input} -> {out}");
            assert!(!out.contains("9047"), "digits survived: {out}");
        }
    }

    #[test]
    fn longer_digit_runs_are_not_aadhaar() {
        // A 16-digit account number contains a 12-digit substring; matching it
        // would both corrupt the account number and report a false leak.
        assert_eq!(count("A/C NO:4688000103410401"), 0);
        assert_eq!(redact("A/C NO:4688000103410401"), "A/C NO:4688000103410401");
        assert_eq!(count("367933300311025"), 0);
    }

    #[test]
    fn decimal_fractions_are_not_aadhaar() {
        // JSON bounding boxes serialise as long fractions; a 12-digit window
        // inside one is not an identity number and must not be redacted.
        assert_eq!(count("194.830810546875"), 0);
        assert_eq!(count(r#"{"x":48.0,"y":194.830810546875}"#), 0);
        assert_eq!(redact("194.830810546875"), "194.830810546875");
    }

    #[test]
    fn numbers_starting_below_two_are_rejected() {
        assert!(!contains("199999990019"));
        assert!(contains("999999990019"));
    }

    #[test]
    fn surrounding_text_is_preserved_exactly() {
        assert_eq!(redact("PAN ABCPE1234F Aadhaar 999999990019 end"),
                   format!("PAN ABCPE1234F Aadhaar {AADHAAR_REDACTED} end"));
    }
}
