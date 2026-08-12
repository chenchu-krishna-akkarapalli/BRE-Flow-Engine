use crate::patterns;
use payslip_domain::{EmployeeInfo, EmployerDetails, Money, PayPeriod};
use payslip_layout::Line;

// Label -> which EmployeeInfo slot it fills. Longest match wins, so
// "Employee Name" is not captured by the shorter "Name".
const EMPLOYEE_LABELS: &[(&str, &str)] = &[
    ("EMPLOYEE NAME", "name"),
    ("EMP NAME", "name"),
    ("NAME OF EMPLOYEE", "name"),
    ("NAME/PSNO", "name"),
    // Safe as a bare label because matching is exact-or-prefix on the whole
    // cell: "Bank Name" and "Company Name" do not start with "NAME".
    ("NAME", "name"),
    ("EMPLOYEE CODE", "employee_id"),
    ("EMPLOYEE ID", "employee_id"),
    ("EMPLOYEE NO", "employee_id"),
    ("EMP CODE", "employee_id"),
    ("EMP ID", "employee_id"),
    ("EMP NO", "employee_id"),
    ("DESIGNATION", "designation"),
    ("GRADE", "designation"),
    ("DEPARTMENT", "department"),
    ("DIVISION", "department"),
    ("PAN NO", "pan"),
    ("PAN NUMBER", "pan"),
    ("PAN", "pan"),
    ("UAN NO", "uan"),
    ("UAN NUMBER", "uan"),
    ("UAN", "uan"),
    ("PF NO", "pf_number"),
    ("PF NUMBER", "pf_number"),
    ("PF ACCOUNT", "pf_number"),
    ("ESI NO", "esi_number"),
    ("ESI NUMBER", "esi_number"),
    ("BANK ACCOUNT", "bank_account"),
    ("ACCOUNT NO", "bank_account"),
    ("A/C NO", "bank_account"),
    ("DATE OF JOINING", "date_of_joining"),
    ("DOJ", "date_of_joining"),
];

/// Value following a label on the same line, whether split across segments or
/// joined by a colon inside one.
fn value_for(line: &Line, label: &str) -> Option<String> {
    let upper_segments: Vec<String> =
        line.segments.iter().map(|s| s.to_ascii_uppercase()).collect();

    for (index, segment) in upper_segments.iter().enumerate() {
        let trimmed = segment.trim_end_matches(':').trim();
        if trimmed == label || trimmed.starts_with(label) {
            // Same segment: "Employee Name : A B"
            if let Some((_, tail)) = line.segments[index].split_once(':') {
                let value = tail.trim();
                if !value.is_empty() {
                    return Some(value.to_string());
                }
            }
            // Next non-empty segment across the column gap on same line.
            for candidate in line.segments.iter().skip(index + 1) {
                let value = candidate.trim().trim_start_matches(':').trim();
                if !value.is_empty() {
                    return Some(value.to_string());
                }
            }
        }
    }
    None
}

/// Value sitting directly beneath a label, for header-row table layouts.
///
/// Some vendors lay identity fields out as a row of headings with the values on
/// the row below; the value is the cell in the next line whose x range overlaps
/// the label's.
fn value_below(lines: &[Line], index: usize, label: &str) -> Option<String> {
    let line = lines.get(index)?;
    let mut next_idx = index + 1;

    // If next line is a secondary label row (e.g. "Gender", "Days Worked"), skip to the value row beneath it
    if let Some(candidate_line) = lines.get(next_idx) {
        let text_upper = candidate_line.text().to_ascii_uppercase();
        if text_upper.contains("GENDER") || text_upper.contains("DAYS WORKED") || text_upper.contains("DATE OF JOINING") || text_upper.contains("LOP DAYS") {
            next_idx += 1;
        }
    }

    let next = lines.get(next_idx)?;
    if next.page != line.page {
        return None;
    }

    let position = line.segments.iter().position(|s| {
        let trimmed = s.trim().trim_end_matches(':').trim().to_ascii_uppercase();
        trimmed == label
    })?;

    // Index-based matching for two-tier header/value rows with matching segment counts
    if line.segments.len() > 1 && line.segments.len() == next.segments.len() {
        if let Some(val_seg) = next.segments.get(position) {
            let trimmed_val = val_seg.trim().trim_start_matches(':').trim();
            let upper_val = trimmed_val.to_ascii_uppercase();
            if !trimmed_val.is_empty() && !EMPLOYEE_LABELS.iter().any(|(l, _)| upper_val == *l || upper_val.starts_with(l)) {
                return Some(trimmed_val.to_string());
            }
        }
    }

    let anchor = *line.segment_boxes.get(position)?;
    next.segments
        .iter()
        .zip(next.segment_boxes.iter())
        .find(|(text, bbox)| {
            let t_upper = text.trim().to_ascii_uppercase();
            anchor.horizontally_overlaps(bbox)
                && !text.trim().is_empty()
                && !EMPLOYEE_LABELS.iter().any(|(l, _)| t_upper == *l || t_upper.starts_with(l))
        })
        .map(|(text, _)| text.trim().trim_start_matches(':').trim().to_string())
}

fn next_line_colon_value(lines: &[Line], index: usize, label: &str) -> Option<String> {
    let line = lines.get(index)?;
    let upper = line.text().to_ascii_uppercase();
    let trimmed_upper = upper.trim();
    if (trimmed_upper == label || trimmed_upper.starts_with(label)) && trimmed_upper != "BANK NAME" && trimmed_upper != "COMPANY NAME" {
        if let Some(next_line) = lines.get(index + 1) {
            let next_text = next_line.text().trim().to_string();
            if next_text.starts_with(':') {
                let val = next_text.trim_start_matches(':').trim();
                if !val.is_empty() {
                    return Some(val.to_string());
                }
            }
        }
    }
    None
}

fn value_in_other_lines(lines: &[Line], label: &str) -> Option<String> {
    for (line_idx, line) in lines.iter().enumerate() {
        for (seg_idx, segment) in line.segments.iter().enumerate() {
            let trimmed = segment.trim_end_matches(':').trim().to_ascii_uppercase();
            if (trimmed == label || trimmed.starts_with(label)) && trimmed != "BANK NAME" && trimmed != "COMPANY NAME" {
                for (other_idx, other_line) in lines.iter().enumerate() {
                    if other_idx == line_idx {
                        continue;
                    }
                    if let Some(candidate) = other_line.segments.get(seg_idx) {
                        let candidate_trim = candidate.trim().trim_start_matches(':').trim();
                        let candidate_upper = candidate_trim.to_ascii_uppercase();
                        if !candidate_trim.is_empty()
                            && candidate_trim.len() > 1
                            && !candidate_trim.starts_with(':')
                            && Money::parse(candidate_trim).is_none()
                            && !EMPLOYEE_LABELS.iter().any(|(l, _)| candidate_upper == *l || candidate_upper.starts_with(l))
                            && !candidate_upper.contains("BANK")
                            && !candidate_upper.contains("A/C")
                            && !candidate_upper.contains("NO.")
                            && !candidate_upper.contains("DAYS")
                            && candidate_upper != "MALE"
                            && candidate_upper != "FEMALE"
                            && candidate_upper != "GENDER"
                            && candidate_upper != "DETAILS"
                            && candidate_upper != "OTHER COMPONENTS"
                            && candidate_upper != "TOTAL"
                            && candidate_upper != "CURRENT MONTH"
                            && candidate_upper != "YTD"
                        {
                            return Some(candidate_trim.to_string());
                        }
                    }
                }
            }
        }
    }
    None
}

pub fn extract_employee(lines: &[Line]) -> EmployeeInfo {
    let mut info = EmployeeInfo::default();

    for (index, line) in lines.iter().enumerate() {
        // Longest labels first so a prefix never shadows a more specific one.
        let mut labels: Vec<&(&str, &str)> = EMPLOYEE_LABELS.iter().collect();
        labels.sort_by_key(|(label, _)| std::cmp::Reverse(label.len()));

        for (label, slot) in labels {
            let target = match *slot {
                "name" => &mut info.name,
                "employee_id" => &mut info.employee_id,
                "designation" => &mut info.designation,
                "department" => &mut info.department,
                "pan" => &mut info.pan,
                "uan" => &mut info.uan,
                "pf_number" => &mut info.pf_number,
                "esi_number" => &mut info.esi_number,
                "bank_account" => &mut info.bank_account,
                "date_of_joining" => &mut info.date_of_joining,
                _ => continue,
            };
            if target.is_some() {
                continue;
            }

            let Some(value) = value_for(line, label)
                .or_else(|| next_line_colon_value(lines, index, label))
                .or_else(|| value_below(lines, index, label))
                .or_else(|| value_in_other_lines(lines, label))
            else {
                continue;
            };

            *target = Some(value);
        }
    }

    // A bare PAN anywhere is better than nothing when no label was found.
    if info.pan.is_none() {
        for line in lines {
            if let Some(caps) = patterns::pan().captures(&line.text()) {
                info.pan = Some(caps[1].to_ascii_uppercase());
                break;
            }
        }
    }
    if info.uan.is_none() {
        for line in lines {
            if let Some(caps) = patterns::uan().captures(&line.text()) {
                info.uan = Some(caps[1].to_string());
                break;
            }
        }
    }
    info
}

/// Employer name: the first substantial line above the payslip title.
///
/// Positional by necessity — vendors almost never label it, but every layout in
/// the corpus puts the company letterhead at the top of page one.
pub fn extract_employer(lines: &[Line]) -> EmployerDetails {
    let mut employer = EmployerDetails::default();

    let title_at = lines.iter().position(|l| {
        let upper = l.text().to_ascii_uppercase();
        upper.contains("PAYSLIP") || upper.contains("PAY SLIP") || upper.contains("SALARY SLIP")
    });

    let header_end = title_at.unwrap_or(lines.len().min(4));
    for line in lines.iter().take(header_end.max(1)) {
        let text = line.text().trim().to_string();
        if text.len() < 3 || patterns::amount().is_match(&text) {
            continue;
        }
        let upper = text.to_ascii_uppercase();
        if upper.contains("PAYSLIP") || upper.contains("PAY SLIP") {
            continue;
        }
        if employer.name.is_none() {
            employer.name = Some(text);
        } else if employer.address.is_none() {
            employer.address = Some(text);
        }
    }
    employer
}

pub fn extract_period(lines: &[Line]) -> PayPeriod {
    let mut period = PayPeriod::default();

    for line in lines {
        let text = line.text();
        let upper = text.to_ascii_uppercase();

        if period.raw.is_none()
            && (upper.contains("PAY PERIOD")
                || upper.contains("SALARY FOR")
                || upper.contains("PAYSLIP FOR")
                || upper.contains("FOR THE MONTH")
                || upper.contains("MONTH"))
        {
            period.raw = Some(text.trim().to_string());
        }

        if period.month.is_none() {
            if let Some(caps) = patterns::month_year().captures(&text) {
                period.month = Some(caps[1].to_string());
                period.year = caps[2].parse().ok();
                if period.raw.is_none() {
                    period.raw = Some(text.trim().to_string());
                }
            }
        }

        for (label, slot) in [("PAID DAYS", 0), ("LOP", 1), ("LOSS OF PAY", 1)] {
            if let Some(value) = value_for(line, label) {
                let target = if slot == 0 { &mut period.paid_days } else { &mut period.lop_days };
                if target.is_none() {
                    *target = Some(value);
                }
            }
        }
    }
    period
}

/// Amount stated in words, e.g. "Rupees Forty Five Thousand Only".
pub fn extract_net_pay_words(lines: &[Line]) -> Option<String> {
    lines.iter().find_map(|line| {
        let text = line.text();
        let upper = text.to_ascii_uppercase();
        (upper.contains("IN WORDS") || (upper.contains("RUPEES") && upper.contains("ONLY")))
            .then(|| text.trim().to_string())
    })
}

/// The amount belonging to a label, anchored to where that label appears.
///
/// Anchoring matters: many payslips put earnings and deductions totals on the
/// SAME row, so taking the rightmost figure hands the deductions total to
/// whichever label was searched for first. The amount that belongs to a label
/// is the next one after it.
pub fn labelled_amount(lines: &[Line], labels: &[&str]) -> Option<Money> {
    for label in labels {
        for (line_idx, line) in lines.iter().enumerate() {
            if patterns::is_annual_row(&line.text()) {
                continue;
            }
            for (index, segment) in line.segments.iter().enumerate() {
                let Some(at) = segment.to_ascii_uppercase().find(label) else { continue };

                // Same cell, amount after the label: "Total Earnings: 1,234.00".
                if let Some(money) = Money::find_first_from(segment, at + label.len()) {
                    return Some(money);
                }
                // Otherwise the first amount in a following cell on the same line.
                let mut found_on_line = None;
                for next in line.segments.iter().skip(index + 1) {
                    if let Some(money) = Money::find_first(next) {
                        found_on_line = Some(money);
                        break;
                    }
                }
                if found_on_line.is_some() {
                    return found_on_line;
                }

                // If no amount on the same line, check the line immediately beneath.
                if let Some(next_line) = lines.get(line_idx + 1) {
                    if !patterns::is_annual_row(&next_line.text()) {
                        for seg in &next_line.segments {
                            if let Some(money) = Money::find_first(seg) {
                                return Some(money);
                            }
                        }
                    }
                }
            }
        }
    }
    None
}
