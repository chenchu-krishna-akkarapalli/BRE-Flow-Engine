use crate::fields;
use crate::patterns;
use payslip_core::{Result, TextRun};
use payslip_domain::{Deduction, Earning, Money, Payslip, RawContent};
use payslip_layout::{group_lines, group_rows, Line};

/// Which side of the payslip a line item belongs to.
#[derive(Clone, Copy, PartialEq)]
enum Section {
    None,
    Earnings,
    Deductions,
}

/// Build a Payslip from decoded runs. Raw lines and the reconstructed table are
/// always attached, so a vendor layout the field parsers miss is still complete.
pub fn parse_payslip(source: &str, runs: &[TextRun<'_>], page_count: u32) -> Result<Payslip> {
    let lines = group_lines(runs);
    let table = group_rows(&lines);

    let (earnings, deductions) = split_line_items(&lines);

    let gross = fields::labelled_amount(&lines, &["GROSS EARNINGS", "GROSS SALARY", "GROSS PAY", "TOTAL EARNINGS"]);
    let total_deductions = fields::labelled_amount(&lines, &["TOTAL DEDUCTIONS", "TOTAL DEDUCTION", "GROSS DEDUCTIONS"]);
    let net_pay = fields::labelled_amount(&lines, &["NET PAY", "NET SALARY", "NET AMOUNT", "TAKE HOME", "NET PAYABLE"]);

    Ok(Payslip {
        source: source.to_string(),
        format: detect_format(&lines),
        employee: fields::extract_employee(&lines),
        employer: fields::extract_employer(&lines),
        period: fields::extract_period(&lines),
        earnings,
        deductions,
        gross_earnings: gross,
        total_deductions,
        net_pay,
        net_pay_words: fields::extract_net_pay_words(&lines),
        raw: RawContent { page_count, lines, table },
    })
}

/// A coarse vendor label, used to explain which heuristics applied.
fn detect_format(lines: &[Line]) -> String {
    let text = lines
        .iter()
        .take(15)
        .map(|l| l.text())
        .collect::<Vec<_>>()
        .join(" ")
        .to_ascii_uppercase();

    for (needle, label) in [
        ("ZOHO", "zoho-payroll"),
        ("RAZORPAY", "razorpayx"),
        ("KEKA", "keka"),
        ("DARWINBOX", "darwinbox"),
        ("GREYTHR", "greythr"),
        ("QUESS", "quess"),
        ("SALARY SLIP", "generic-salary-slip"),
        ("PAY SLIP", "generic-payslip"),
        ("PAYSLIP", "generic-payslip"),
    ] {
        if text.contains(needle) {
            return label.to_string();
        }
    }
    "unknown".to_string()
}

/// Walk the document assigning rows to earnings or deductions.
///
/// Section state is driven by headers, with a side-by-side fallback: many
/// payslips put earnings and deductions in two columns of one row, so a line
/// carrying two amounts is split across both sides rather than dropped.
fn split_line_items(lines: &[Line]) -> (Vec<Earning>, Vec<Deduction>) {
    let mut earnings = Vec::new();
    let mut deductions = Vec::new();
    let mut section = Section::None;

    let two_column = lines.iter().any(|l| {
        let has_earn = l.contains_ignore_case("EARNING");
        let has_deduct = l.contains_ignore_case("DEDUCTION");
        has_earn && has_deduct
    });

    for line in lines {
        let raw = line.text();
        let first = line.segments.first().map(String::as_str).unwrap_or("");

        if two_column && line.contains_ignore_case("EARNING") && line.contains_ignore_case("DEDUCTION") {
            section = Section::Earnings;
            continue;
        }
        if patterns::is_section_header(first, patterns::EARNINGS_HEADERS) {
            section = Section::Earnings;
            continue;
        }
        if patterns::is_section_header(first, patterns::DEDUCTIONS_HEADERS) {
            section = Section::Deductions;
            continue;
        }
        if section == Section::None || patterns::is_total_row(&raw) {
            continue;
        }

        let amounts: Vec<Money> = line.segments.iter().filter_map(|s| Money::parse(s)).collect();
        let label = line
            .segments
            .iter()
            .find(|s| Money::parse(s).is_none() && !s.trim().is_empty())
            .map(|s| s.trim().to_string());

        let Some(label) = label else { continue };
        if label.len() < 2 {
            continue;
        }

        // Two amounts on one row in a side-by-side layout: left is the earning,
        // right the deduction, and the row feeds both sides.
        if two_column && amounts.len() >= 2 {
            let labels: Vec<&String> = line
                .segments
                .iter()
                .filter(|s| Money::parse(s).is_none() && s.trim().len() > 1)
                .collect();
            earnings.push(Earning {
                label: labels.first().map(|s| s.trim().to_string()).unwrap_or_else(|| label.clone()),
                amount: Some(amounts[0].clone()),
                raw_line: raw.clone(),
            });
            deductions.push(Deduction {
                label: labels.get(1).map(|s| s.trim().to_string()).unwrap_or_else(|| label.clone()),
                amount: Some(amounts[1].clone()),
                raw_line: raw,
            });
            continue;
        }

        let amount = amounts.into_iter().next_back();
        match section {
            Section::Earnings => earnings.push(Earning { label, amount, raw_line: raw }),
            Section::Deductions => deductions.push(Deduction { label, amount, raw_line: raw }),
            Section::None => {}
        }
    }

    (earnings, deductions)
}
