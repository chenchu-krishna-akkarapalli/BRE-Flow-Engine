use crate::patterns;
use coi_domain::{ChapterViaDeductions, DeductionItem, HeadsOfIncome, Money};
use coi_layout::Line;

/// The amount belonging to a label on this line.
///
/// Anchored to the label's position, not the rightmost figure: computation
/// sheets carry running sub-totals in intermediate columns, and a head's own
/// figure is the one printed against it.
pub fn amount_on_line(line: &Line, label_upper: &str) -> Option<Money> {
    // Whole-cell amounts first; these are unambiguous.
    let cell = line
        .segments
        .iter()
        .skip(1)
        .rev()
        .find_map(|segment| Money::parse(segment));
    if cell.is_some() {
        return cell;
    }

    let text = line.text();
    let upper = text.to_ascii_uppercase();
    let after = upper.find(label_upper).map(|i| i + label_upper.len()).unwrap_or(0);
    Money::find_first_from(&text, after)
}

fn head_amount(lines: &[Line], options: &[&str]) -> Option<Money> {
    for line in lines {
        let upper = line.upper();
        if patterns::is_slab_working(&upper) {
            continue;
        }
        // Compared with spaces stripped: these generators drop inter-word gaps
        // ("BUSINESSOR PROFESSION", "FATHER'SNAME") as a glyph-spacing artifact,
        // and an exact match then misses the head entirely.
        let squashed = upper.replace(' ', "");
        for option in options {
            if !squashed.contains(&option.replace(' ', "")) {
                continue;
            }
            if let Some(money) = amount_on_line(line, option) {
                return Some(money);
            }
        }
    }
    None
}

pub fn extract_heads(lines: &[Line]) -> HeadsOfIncome {
    HeadsOfIncome {
        salary: head_amount(lines, patterns::SALARY),
        house_property: head_amount(lines, patterns::HOUSE_PROPERTY),
        business_profession: head_amount(lines, patterns::BUSINESS),
        capital_gains: head_amount(lines, patterns::CAPITAL_GAINS),
        other_sources: head_amount(lines, patterns::OTHER_SOURCES),
    }
}

pub fn labelled(lines: &[Line], options: &[&str]) -> Option<Money> {
    head_amount(lines, options)
}

/// Chapter VI-A deductions: the stated total plus every section line found.
///
/// Totals are taken as magnitudes. Sheets print the summary row as
/// "Less: Total Deductions   - 623", where the dash marks the subtraction the
/// sheet is about to perform, not a negative amount — reading it as a sign
/// makes the deduction ADD to total income.
pub fn extract_deductions(lines: &[Line]) -> ChapterViaDeductions {
    let total = head_amount(lines, patterns::DEDUCTIONS_VIA)
        .map(|m| Money::from_paise(m.paise.abs(), m.raw));
    let mut items = Vec::new();
    let mut inside = false;

    for line in lines {
        let upper = line.upper();
        if patterns::matches_any(&upper, patterns::DEDUCTIONS_VIA) {
            inside = true;
            continue;
        }
        // The block ends at the next total line.
        if inside && (upper.contains("TOTAL INCOME") || upper.contains("GROSS TOTAL INCOME")) {
            inside = false;
        }

        // Section lines are recognised anywhere: some vendors list 80C under a
        // sub-schedule far from the summary block.
        let Some(caps) = patterns::section_code().captures(&upper) else { continue };
        let section = caps[1].to_string();
        if section.starts_with("87") || section.starts_with("89") {
            continue;
        }
        let amount = amount_on_line(line, &section);
        if amount.is_none() && !inside {
            continue;
        }
        items.push(DeductionItem {
            section,
            label: line.segments.first().cloned().unwrap_or_default(),
            amount,
            raw_line: line.text(),
        });
    }

    ChapterViaDeductions { items, total }
}

#[cfg(test)]
mod tests {
    use super::{amount_on_line, extract_heads};
    use coi_core::{BoundingBox, TextRun};
    use coi_layout::group_lines;

    fn line(parts: &[(&str, f32)]) -> Vec<coi_layout::Line> {
        let runs: Vec<TextRun<'static>> = parts
            .iter()
            .map(|(t, x)| TextRun::new(t.to_string(), BoundingBox::new(*x, 100.0, 60.0, 10.0), 1))
            .collect();
        group_lines(&runs)
    }

    #[test]
    fn a_head_takes_the_amount_printed_against_it() {
        let lines = line(&[("Income from Other Sources (Chapter IV F)", 48.0), ("1,130", 480.0)]);
        let heads = extract_heads(&lines);

        assert_eq!(heads.other_sources.unwrap().paise, 113_000);
        assert!(heads.salary.is_none(), "absent heads stay absent, not zero");
    }

    #[test]
    fn slab_working_lines_are_not_mistaken_for_heads() {
        // "Tax on 7,00,001 To 10,00,000= 3,00,000 @10%" is arithmetic, not income.
        let lines = line(&[("Tax on 7,00,001 To 10,00,000= 3,00,000 @10% = 30,000", 48.0)]);
        let heads = extract_heads(&lines);

        assert!(heads.all().iter().all(|h| h.is_none()));
    }

    #[test]
    fn amount_is_anchored_after_its_label() {
        let lines = line(&[("Tax Due (Exemption Limit Rs. 300000)", 48.0), ("1,23,234", 480.0)]);
        assert_eq!(amount_on_line(&lines[0], "TAX DUE").unwrap().paise, 12_323_400);
    }
}

#[cfg(test)]
mod deduction_tests {
    use super::extract_deductions;
    use coi_core::{BoundingBox, TextRun};
    use coi_layout::group_lines;

    #[test]
    fn a_less_marker_is_not_a_negative_deduction() {
        // "Less: Total Deductions | - 623" subtracts 623; read as -623 the
        // deduction would increase total income instead of reducing it.
        let runs: Vec<TextRun<'static>> = [("Less: Total Deductions", 48.0), ("- 623", 480.0)]
            .iter()
            .map(|(t, x)| TextRun::new(t.to_string(), BoundingBox::new(*x, 100.0, 60.0, 10.0), 1))
            .collect();

        let deductions = extract_deductions(&group_lines(&runs));
        assert_eq!(deductions.total.expect("total found").paise, 62_300);
    }
}
