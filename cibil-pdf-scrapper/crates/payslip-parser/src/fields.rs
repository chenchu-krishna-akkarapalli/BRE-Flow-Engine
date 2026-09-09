use crate::patterns;
use payslip_domain::{EmployeeInfo, EmployerDetails, Money, Period};
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
    let dict = crate::dictionary::get_dictionary();

    for (index, line) in lines.iter().enumerate() {
        for (slot, aliases) in &dict.employee {
            let target = match slot.as_str() {
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
                "bank_name" => &mut info.bank_name,
                "ifsc_or_routing_code" => &mut info.ifsc_or_routing_code,
                _ => continue,
            };
            if target.is_some() {
                continue;
            }

            for alias in aliases {
                let upper_alias = alias.to_ascii_uppercase();
                if let Some(value) = value_for(line, &upper_alias)
                    .or_else(|| next_line_colon_value(lines, index, &upper_alias))
                    .or_else(|| value_below(lines, index, &upper_alias))
                {
                    *target = Some(value);
                    break;
                }
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

    for line in lines.iter().take(4) {
        let text = line.text().trim().to_string();
        if text.len() < 3 || patterns::amount().is_match(&text) {
            continue;
        }
        let upper = text.to_ascii_uppercase();
        if upper.contains("PAYSLIP") || upper.contains("PAY SLIP") || upper.contains("SALARY SLIP") {
            if let Some(first_seg) = line.segments.first() {
                let seg_text = first_seg.trim().to_string();
                let seg_upper = seg_text.to_ascii_uppercase();
                if seg_text.len() >= 3
                    && !seg_upper.contains("PAYSLIP")
                    && !seg_upper.contains("PAY SLIP")
                    && !seg_upper.contains("SALARY SLIP")
                    && !seg_upper.contains("FOR THE MONTH")
                {
                    if employer.name.is_none() {
                        employer.name = Some(seg_text);
                        continue;
                    }
                }
            }
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

#[derive(Debug, Clone, Default)]
pub struct RawPeriod {
    pub raw: Option<String>,
    pub month: Option<String>,
    pub year: Option<u16>,
    pub paid_days: Option<String>,
    pub lop_days: Option<String>,
}

pub fn extract_period(lines: &[Line]) -> RawPeriod {
    let mut period = RawPeriod::default();

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
                if slot == 0 {
                    if period.paid_days.is_none() {
                        period.paid_days = Some(value);
                    }
                } else if period.lop_days.is_none() {
                    period.lop_days = Some(value);
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
        if upper.contains("EARNINGS/ALLOWANCE") || upper.contains("BASIC PAY") {
            return None;
        }
        if upper.contains("IN WORDS") || ((upper.contains("RUPEES") || upper.contains("INDIAN RUPEE")) && upper.contains("ONLY")) {
            let mut s = text.trim().to_string();
            if let Some(pos) = s.to_ascii_uppercase().find("IN WORDS") {
                s = s[pos + 8..].trim().to_string();
            }
            if let Some(pos) = s.find(". Net Amount").or_else(|| s.find(" Net Amount")) {
                s = s[..pos].trim().to_string();
            }
            if s.starts_with("Rupees ") {
                s = s[7..].trim().to_string();
            }
            if s.starts_with(':') || s.starts_with('-') {
                s = s[1..].trim().to_string();
            }
            if s.ends_with(':') || s.ends_with('-') {
                s = s[..s.len() - 1].trim().to_string();
            }
            if s.starts_with('(') && s.ends_with(')') {
                s = s[1..s.len() - 1].trim().to_string();
            }
            if !s.is_empty() {
                return Some(s);
            }
        }
        None
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
        let label_upper = label.to_ascii_uppercase();
        // Iterate bottom-up (rev) so explicit summary rows take priority over upper table rates/components
        for (line_idx, line) in lines.iter().enumerate().rev() {
            let line_txt = line.text();
            let upper_txt = line_txt.to_ascii_uppercase();
            if upper_txt.contains("GROSS EARNINGS - TOTAL DEDUCTIONS")
                || upper_txt.contains("EARNINGS - DEDUCTIONS")
                || upper_txt.contains("EMPLOYEE ID")
                || upper_txt.contains("EMP ID")
                || patterns::is_annual_row(&upper_txt)
            {
                continue;
            }
            for (index, segment) in line.segments.iter().enumerate() {
                if patterns::is_annual_row(segment) {
                    continue;
                }
                let Some(at) = segment.to_ascii_uppercase().find(&label_upper) else { continue };

                // Same cell, amount after the label: "Gross Salary : 1,75,000".
                if let Some(money) = Money::find_first_from(segment, at + label_upper.len()) {
                    return Some(money);
                }
                // Otherwise the first amount in a following cell on the same line.
                let is_deduction_search = label_upper.contains("DEDUCT");
                let mut line_amounts = Vec::new();
                for (s_idx, next) in line.segments.iter().enumerate().skip(index + 1) {
                    if patterns::is_annual_row(next) {
                        continue;
                    }
                    if let Some(money) = Money::find_first(next) {
                        let box_x = line.segment_boxes.get(s_idx).map_or(0.0, |b| b.x);
                        line_amounts.push((money, box_x));
                    }
                }
                if !line_amounts.is_empty() {
                    if is_deduction_search && line_amounts.len() >= 2 {
                        let ded_amt = line_amounts.iter().find(|(_, x)| *x >= 200.0).map(|(m, _)| m.clone())
                            .unwrap_or_else(|| line_amounts.last().unwrap().0.clone());
                        return Some(ded_amt);
                    } else if !is_deduction_search && line_amounts.len() >= 2 && (label_upper.contains("GROSS") || label_upper.contains("INCOME")) {
                        let earn_amts: Vec<&(Money, f32)> = line_amounts.iter().filter(|(_, x)| *x < 380.0).collect();
                        if earn_amts.len() >= 2 {
                            return Some(earn_amts[1].0.clone());
                        }
                    }
                    return Some(line_amounts.first().unwrap().0.clone());
                }

                // If no amount on the same line, check adjacent lines using horizontal bbox alignment
                let label_box = line.segment_boxes.get(index);
                for dist in 1..lines.len() {
                    for &dir in &[1isize, -1isize] {
                        let target_idx = line_idx as isize + (dist as isize * dir);
                        if target_idx >= 0 && (target_idx as usize) < lines.len() {
                            let adj_line = &lines[target_idx as usize];
                            if !patterns::is_annual_row(&adj_line.text()) {
                                if let Some(l_box) = label_box {
                                    let mut best_match: Option<(Money, f32)> = None;
                                    for (s_idx, seg) in adj_line.segments.iter().enumerate() {
                                        if let Some(money) = Money::find_first(seg) {
                                            if let Some(s_box) = adj_line.segment_boxes.get(s_idx) {
                                                let dx = (s_box.x - l_box.x).abs();
                                                if dx < 15.0f32 || (label.contains("TAKE HOME") || label.contains("NET")) {
                                                    let is_ded_label = label.contains("DEDUCT");
                                                    if !is_ded_label || money.rupees() < 300_000.0 {
                                                        if best_match.as_ref().map_or(true, |(_, min_dx)| dx < *min_dx) {
                                                            best_match = Some((money, dx));
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    if let Some((money, _)) = best_match {
                                        return Some(money);
                                    }
                                } else if let Some(seg) = adj_line.segments.get(index) {
                                    if let Some(money) = Money::find_first(seg) {
                                        return Some(money);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

/// Extracts (gross, deduction, net) from equation-style summary header rows:
/// "Earnings - Deductions + Adjustment = Net Amount"
/// "79,010.00 - 12,357.00 + 0.00 = 66,653.00"
pub fn extract_equation_summary(lines: &[Line]) -> Option<(Money, Money, Money)> {
    for (line_idx, line) in lines.iter().enumerate() {
        let text = line.text();
        if (text.contains("Earnings") || text.contains("Gross")) && text.contains("Deduction") && (text.contains("Net Amount") || text.contains("Net Pay") || text.contains("Net")) {
            // Check current or subsequent line for numeric figures
            for search_idx in line_idx..std::cmp::min(line_idx + 4, lines.len()) {
                let target_line = &lines[search_idx];
                let moneys: Vec<Money> = Money::find_all(&target_line.text())
                    .into_iter()
                    .filter(|m| m.rupees() < 10_000_000.0)
                    .collect();
                if moneys.len() >= 3 {
                    let gross = moneys[0].clone();
                    let ded = moneys[1].clone();
                    let net = moneys.last().cloned().unwrap();
                    if (gross.paise - ded.paise - net.paise).abs() <= 100 {
                        return Some((gross, ded, net));
                    }
                }
            }
        }
    }
    None
}
