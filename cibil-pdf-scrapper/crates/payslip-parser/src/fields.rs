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
            // Next non-empty segment across the column gap.
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
    let next = lines.get(index + 1)?;
    if next.page != line.page {
        return None;
    }

    let position = line.segments.iter().position(|s| {
        let trimmed = s.trim().trim_end_matches(':').trim().to_ascii_uppercase();
        trimmed == label
    })?;
    let anchor = *line.segment_boxes.get(position)?;

    next.segments
        .iter()
        .zip(next.segment_boxes.iter())
        .find(|(text, bbox)| anchor.horizontally_overlaps(bbox) && !text.trim().is_empty())
        .map(|(text, _)| text.trim().to_string())
}

pub fn extract_employee(lines: &[Line]) -> EmployeeInfo {
    let mut info = EmployeeInfo::default();

    for (index, line) in lines.iter().enumerate() {
        // Longest labels first so a prefix never shadows a more specific one.
        let mut labels: Vec<&(&str, &str)> = EMPLOYEE_LABELS.iter().collect();
        labels.sort_by_key(|(label, _)| std::cmp::Reverse(label.len()));

        for (label, slot) in labels {
            let Some(value) = value_for(line, label).or_else(|| value_below(lines, index, label))
            else {
                continue;
            };
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
            // First hit wins: headers appear before any repetition in footers.
            if target.is_none() {
                *target = Some(value);
            }
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
    for line in lines {
        for label in labels {
            for (index, segment) in line.segments.iter().enumerate() {
                let Some(at) = segment.to_ascii_uppercase().find(label) else { continue };

                // Same cell, amount after the label: "Total Earnings: 1,234.00".
                if let Some(money) = Money::find_first_from(segment, at + label.len()) {
                    return Some(money);
                }
                // Otherwise the first amount in a following cell.
                for next in line.segments.iter().skip(index + 1) {
                    if let Some(money) = Money::find_first(next) {
                        return Some(money);
                    }
                }
            }
        }
    }
    None
}
