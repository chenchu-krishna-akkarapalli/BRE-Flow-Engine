use serde::{Deserialize, Serialize};

/// An Indian tax year pair, e.g. 2024-25 stored as (2024, 2025).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct YearRange {
    pub start: u16,
    pub end: u16,
}

impl YearRange {
    pub fn new(start: u16, end: u16) -> Self {
        Self { start, end }
    }

    /// Parse "2024-2025", "2024-25", "2024/25" or "FY 2024-25".
    ///
    /// A two-digit end is expanded from the start year rather than assumed to be
    /// 20xx, so "1999-00" resolves to 2000 and not 1900.
    pub fn parse(text: &str) -> Option<YearRange> {
        let digits: Vec<String> = text
            .split(|c: char| !c.is_ascii_digit())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .collect();

        for window in digits.windows(2) {
            let (first, second) = (&window[0], &window[1]);
            if first.len() != 4 {
                continue;
            }
            let start: u16 = first.parse().ok()?;
            if !(1990..=2100).contains(&start) {
                continue;
            }
            let end: u16 = match second.len() {
                4 => second.parse().ok()?,
                2 => {
                    let century = start / 100 * 100;
                    let candidate = century + second.parse::<u16>().ok()?;
                    // A year pair always advances; "1999-00" means 2000.
                    if candidate < start { candidate + 100 } else { candidate }
                }
                _ => continue,
            };
            if end == start + 1 {
                return Some(YearRange::new(start, end));
            }
        }
        None
    }

    /// The financial year an assessment year assesses: AY 2025-26 taxes FY 2024-25.
    pub fn financial_year(&self) -> YearRange {
        YearRange::new(self.start - 1, self.end - 1)
    }

    pub fn label(&self) -> String {
        format!("{}-{:02}", self.start, self.end % 100)
    }
}

#[cfg(test)]
mod tests {
    use super::YearRange;

    #[test]
    fn parses_both_written_forms() {
        assert_eq!(YearRange::parse("2025-2026"), Some(YearRange::new(2025, 2026)));
        assert_eq!(YearRange::parse("A.Y. 2024-25"), Some(YearRange::new(2024, 2025)));
        assert_eq!(YearRange::parse("Assessment Year 2023-2024"), Some(YearRange::new(2023, 2024)));
    }

    #[test]
    fn rejects_ranges_that_do_not_advance_by_one() {
        assert_eq!(YearRange::parse("2024-2026"), None);
        assert_eq!(YearRange::parse("no years here"), None);
    }

    #[test]
    fn assessment_year_taxes_the_preceding_financial_year() {
        let ay = YearRange::new(2025, 2026);
        assert_eq!(ay.financial_year(), YearRange::new(2024, 2025));
    }

    #[test]
    fn two_digit_end_crossing_a_century_resolves_forward() {
        assert_eq!(YearRange::parse("1999-00"), Some(YearRange::new(1999, 2000)));
    }
}
