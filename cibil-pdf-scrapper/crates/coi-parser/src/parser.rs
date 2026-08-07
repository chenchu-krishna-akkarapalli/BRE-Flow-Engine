use crate::{assessee, heads, patterns};
use coi_core::{Result, TextRun};
use coi_domain::{Computation, RawContent, TaxComputation, TaxCredits, YearRange};
use coi_layout::{group_lines, group_rows, label_value_pairs, Line};

/// Build a Computation from decoded runs. Raw lines are always attached, so a
/// vendor layout the field parsers miss is still recoverable from the output.
pub fn parse_computation(
    source: &str,
    format: &str,
    runs: &[TextRun<'_>],
    page_count: u32,
) -> Result<Computation> {
    let decoded = group_lines(runs);

    // Aadhaar presence is read from the untouched text, then every retained line
    // is redacted before anything else sees it. Redacting only the assessee
    // field leaves the number sitting in the raw lines, which are serialised
    // too — extraction is verbatim except for this, and PII wins that trade.
    let source_text = decoded.iter().map(|l| l.text()).collect::<Vec<_>>().join("\n");
    let lines: Vec<Line> = redact_lines(decoded);

    let pairs = label_value_pairs(&lines);
    let assessment_year = find_assessment_year(&lines, &pairs);
    let stated_fy = find_financial_year(&lines, &pairs);

    Ok(Computation {
        source: source.to_string(),
        format: format.to_string(),
        regime: detect_regime(&lines),
        assessment_year,
        // Prefer what the sheet actually printed. Deriving unconditionally makes
        // the AY/FY rule check its own arithmetic and pass on every document.
        financial_year: stated_fy.or_else(|| assessment_year.map(|ay| ay.financial_year())),
        financial_year_source: Some(
            if stated_fy.is_some() { "stated" } else { "derived" }.to_string(),
        ),
        assessee: assessee::extract(&pairs, &source_text),
        heads: heads::extract_heads(&lines),
        gross_total_income: heads::labelled(&lines, patterns::GROSS_TOTAL_INCOME),
        deductions: heads::extract_deductions(&lines),
        total_income: total_income(&lines),
        rounded_total_income: heads::labelled(&lines, patterns::ROUNDED_INCOME),
        tax: extract_tax(&lines),
        credits: extract_credits(&lines),
        raw: RawContent { page_count, table: group_rows(&lines), lines },
    })
}

/// Redact decoded lines. Public because every path that serialises lines must
/// use it — a raw dump that skips redaction prints the applicant's Aadhaar.
pub fn redact_lines(lines: Vec<Line>) -> Vec<Line> {
    lines.into_iter().map(redact_line).collect()
}

/// Redact every Aadhaar-shaped value in a line's segments.
fn redact_line(mut line: Line) -> Line {
    for segment in &mut line.segments {
        if coi_domain::aadhaar::contains(segment) {
            *segment = coi_domain::aadhaar::redact(segment);
        }
    }
    line
}

/// "Total Income" must not be satisfied by "Gross Total Income", which contains it.
fn total_income(lines: &[Line]) -> Option<coi_domain::Money> {
    for line in lines {
        let upper = line.upper();
        if upper.replace(' ', "").contains("GROSSTOTALINCOME") || patterns::is_slab_working(&upper) {
            continue;
        }
        let squashed = upper.replace(' ', "");
        for option in patterns::TOTAL_INCOME {
            if squashed.contains(&option.replace(' ', "")) {
                if let Some(money) = heads::amount_on_line(line, option) {
                    return Some(money);
                }
            }
        }
    }
    None
}

fn detect_regime(lines: &[Line]) -> Option<String> {
    lines.iter().find_map(|line| {
        let upper = line.upper();
        if upper.contains("115BAC") {
            Some("115BAC (New Tax Regime)".to_string())
        } else if upper.contains("OLD TAX REGIME") || upper.contains("OLD REGIME") {
            Some("Old Regime".to_string())
        } else {
            None
        }
    })
}

/// The assessment year, taken from a labelled field before any loose mention.
///
/// Loose scanning alone is unsafe: these sheets also print the previous year's
/// filing details, and the first year-shaped string on the page is often that.
fn find_assessment_year(lines: &[Line], pairs: &[coi_layout::LabelValue]) -> Option<YearRange> {
    for pair in pairs {
        let label = pair.label.to_ascii_uppercase();
        if label.contains("ASSESSMENT YEAR") || label.starts_with("A.Y") || label.starts_with("AY") {
            if let Some(year) = YearRange::parse(&pair.value) {
                return Some(year);
            }
        }
    }
    for line in lines {
        let upper = line.upper();
        if upper.contains("ASSESSMENT YEAR") || upper.contains("A.Y.") {
            if let Some(year) = YearRange::parse(&line.text()) {
                return Some(year);
            }
        }
    }
    None
}

/// The financial year, only where the sheet prints one under its own label.
fn find_financial_year(lines: &[Line], pairs: &[coi_layout::LabelValue]) -> Option<YearRange> {
    let is_fy = |label: &str| {
        let upper = label.to_ascii_uppercase().replace(' ', "");
        upper.contains("FINANCIALYEAR") || upper.starts_with("F.Y") || upper.starts_with("FY")
    };

    for pair in pairs {
        if is_fy(&pair.label) {
            if let Some(year) = YearRange::parse(&pair.value) {
                return Some(year);
            }
        }
    }
    lines.iter().find_map(|line| {
        is_fy(&line.upper()).then(|| YearRange::parse(&line.text())).flatten()
    })
}

fn extract_tax(lines: &[Line]) -> TaxComputation {
    TaxComputation {
        tax_due: heads::labelled(lines, patterns::TAX_DUE),
        surcharge: heads::labelled(lines, patterns::SURCHARGE),
        health_education_cess: heads::labelled(lines, patterns::CESS),
        rebate_87a: heads::labelled(lines, patterns::REBATE),
        relief: heads::labelled(lines, patterns::RELIEF),
        interest_234a: interest(lines, "234 A"),
        interest_234b: interest(lines, "234B"),
        interest_234c: interest(lines, "234C"),
        total_tax: heads::labelled(lines, &["TOTAL TAX"]),
        net_tax_payable: heads::labelled(lines, patterns::NET_TAX),
    }
}

fn interest(lines: &[Line], section: &str) -> Option<coi_domain::Money> {
    let normalised = section.replace(' ', "");
    lines.iter().find_map(|line| {
        let upper = line.upper().replace(' ', "");
        upper
            .contains(&format!("U/S{normalised}"))
            .then(|| heads::amount_on_line(line, section))
            .flatten()
    })
}

fn extract_credits(lines: &[Line]) -> TaxCredits {
    TaxCredits {
        tds: heads::labelled(lines, patterns::TDS),
        tcs: heads::labelled(lines, patterns::TCS),
        advance_tax: heads::labelled(lines, patterns::ADVANCE_TAX),
        self_assessment_140a: heads::labelled(lines, patterns::SELF_ASSESSMENT),
    }
}
