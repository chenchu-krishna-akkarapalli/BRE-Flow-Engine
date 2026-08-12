use coi_core::{Result, TextRun};
use coi_domain::{
    AssesseeInfo, BankDetails, BusinessProfession, CoiDocument, ComputationOfTotalIncome,
    FinancialParticulars, PresumptiveTier, ReturnDetails, TaxComputationContract, TaxSlab,
    TdsItem,
};
use coi_layout::{label_value_pairs, LabelValue, Line};
use regex::Regex;

pub fn parse_document(
    source: &str,
    format: &str,
    runs: &[TextRun<'_>],
    page_count: u32,
) -> Result<CoiDocument> {
    let computation = super::parser::parse_computation(source, format, runs, page_count)?;
    let lines = &computation.raw.lines;
    let pairs = label_value_pairs(lines);
    let text = computation.raw.full_text();
    let assessee_info = assessee_info(&pairs, &computation, &text);
    let bank_details = bank_details(&pairs);
    let return_details = return_details(&text);
    let computation_of_total_income = computation_of_total_income(lines, &computation);
    let tax_computation = tax_computation(lines, &computation);
    let financial_particulars = financial_particulars(lines);

    Ok(CoiDocument {
        meta: Default::default(),
        assessee_info,
        bank_details,
        return_details,
        computation_of_total_income,
        tax_computation,
        financial_particulars,
    })
}

fn assessee_info(pairs: &[LabelValue], computation: &coi_domain::Computation, text: &str) -> AssesseeInfo {
    let first_line_name = text.lines().next().and_then(|line| {
        let mut parts = line.split('|').map(str::trim);
        let candidate = parts.next()?;
        let second = parts.next()?;
        second.to_ascii_uppercase().contains("AY ").then(|| candidate.to_string())
    });
    AssesseeInfo {
        name: pair_value(pairs, &["NAMEOFASSESSEE", "ASSESSEENAME"]).or(first_line_name),
        pan: computation.assessee.pan.clone(),
        father_name: pair_value(pairs, &["FATHERSNAME", "FATHER'SNAME"]).or_else(|| inline_value(text, "FATHER'S?NAME")),
        residential_address: pair_value(pairs, &["RESIDENTIALADDRESS"]).or_else(|| first_address(pairs)).or_else(|| inline_value(text, "ADDRESS")),
        status: computation.assessee.status.clone().or_else(|| inline_value(text, "STATUS")),
        assessment_year: pair_value(pairs, &["ASSESSMENTYEAR"]).or_else(|| inline_value(text, "AY")),
        ward_no: pair_value(pairs, &["WARDNO", "WARD"]),
        financial_year: pair_value(pairs, &["FINANCIALYEAR"]).or_else(|| computation.financial_year.map(|year| format!("{} - {}", year.start, year.end))),
        gender: pair_value(pairs, &["GENDER"]).or_else(|| inline_value(text, "GENDER")),
        date_of_birth: pair_value(pairs, &["DATEOFBIRTH"]).or_else(|| inline_value(text, r"DATE\s*OF\s*BIRTH")),
        email: pair_value(pairs, &["EMAILADDRESS", "EMAIL"]).or_else(|| inline_value(text, "E-?MAIL")),
        residential_status: pair_value(pairs, &["RESIDENTIALSTATUS"]).or_else(|| inline_value(text, r"RESIDENTIAL\s+STATUS")),
    }
}

fn bank_details(pairs: &[LabelValue]) -> BankDetails {
    BankDetails {
        bank_name: pair_value(pairs, &["NAMEOFBANK", "BANKNAME"]),
        ifsc_code: pair_value(pairs, &["IFSCCODE"]),
        account_no: pair_value(pairs, &["ACCOUNTNO", "ACCOUNTNUMBER"]),
        branch_address: pair_value(pairs, &["BRANCHADDRESS"]).or_else(|| {
            pairs.iter().find_map(|pair| {
                let label = normalise(&pair.label);
                (label == "ADDRESS" && pair.value.trim() != "").then(|| pair.value.trim().to_string())
            })
        }),
    }
}

fn return_details(text: &str) -> ReturnDetails {
    let Some(return_line) = text.lines().find(|line| line.to_ascii_uppercase().contains("RETURN")) else {
        return ReturnDetails::default();
    };
    let form_type = Regex::new(r"(?i)\b(ITR\s*[- ]?\s*\d+)\b")
        .ok()
        .and_then(|re| re.captures(return_line).map(|c| c[1].replace(' ', "")));
    let filing_status = Regex::new(r"(?i)\b(ORIGINAL|REVISED|BELATED|UPDATED)\b")
        .ok()
        .and_then(|re| re.captures(return_line).map(|c| c[1].to_ascii_uppercase()));
    let filing_date = Regex::new(r"(?i)FILING\s*DATE\s*:\s*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})")
        .ok()
        .and_then(|re| re.captures(return_line).map(|c| c[1].to_string()));
    let acknowledgement_no = Regex::new(r"(?i)(?:NO\.?|ACKNOWLEDGEMENT(?:\s*NO\.?)?)\s*:\s*([0-9]{8,})")
        .ok()
        .and_then(|re| re.captures(return_line).map(|c| c[1].to_string()));
    ReturnDetails { form_type, filing_status, filing_date, acknowledgement_no }
}

fn computation_of_total_income(lines: &[Line], computation: &coi_domain::Computation) -> ComputationOfTotalIncome {
    let mut tiers = Vec::new();
    for (index, line) in lines.iter().enumerate() {
        let upper = line.upper();
        if !upper.contains("PROFIT DEEMED U/S 44AD") {
            continue;
        }
        let (rate, base) = deemed_rate_and_base(&upper);
        let declared = following_amount(lines, index, "PROFIT DECLARED");
        let higher = following_amount(lines, index, "PROFIT (HIGHER OF THE ABOVE)");
        let deemed_profit = line_amount(line);
        tiers.push(PresumptiveTier {
            presumptive_rate_pct: rate,
            deemed_base_turnover: base,
            deemed_profit,
            declared_profit: declared,
            profit_taken_higher_of_declared_or_deemed: higher,
        });
    }
    let section_total = lines.iter().find_map(|line| {
        let upper = line.upper();
        (upper.contains("PROFIT U/S 44AD") && !upper.contains("DEEMED"))
            .then(|| line_amount(line))
            .flatten()
    });
    ComputationOfTotalIncome {
        profits_and_gains_business_profession: BusinessProfession {
            tiers,
            section_total: section_total.or_else(|| money_rupees(computation.heads.business_profession.as_ref())),
        },
        gross_total_income: money_rupees(computation.gross_total_income.as_ref()),
        total_income: money_rupees(computation.total_income.as_ref()),
        total_income_rounded_288a: money_rupees(computation.rounded_total_income.as_ref()),
    }
}

fn tax_computation(lines: &[Line], computation: &coi_domain::Computation) -> TaxComputationContract {
    let slabs = lines.iter().filter_map(|line| {
        let upper = line.upper();
        if !upper.starts_with("TAX ON") {
            return None;
        }
        let slab_amount = first_amount_after_tax_on(&line.text());
        let tax = if upper.contains("NIL") { Some(0) } else { line_amount(line) };
        Some(TaxSlab { slab_upper_limit_or_amount: slab_amount, tax })
    }).collect();
    let tds = lines.iter().filter_map(tds_item).collect();
    let refundable = lines.iter().find_map(|line| {
        line.upper().contains("REFUNDABLE").then(|| line_amount(line).map(i64::abs)).flatten()
    });
    TaxComputationContract {
        slabs,
        rebate_87a: money_rupees(computation.tax.rebate_87a.as_ref()),
        tds,
        refundable,
    }
}

fn financial_particulars(lines: &[Line]) -> FinancialParticulars {
    let value = |labels: &[&str]| lines.iter().find_map(|line| {
        let label = normalise(&line.text());
        labels.iter().any(|candidate| label == *candidate).then(|| line_amount(line)).flatten()
            .or_else(|| labels.iter().any(|candidate| label.contains(candidate)).then(|| line_amount(line)).flatten())
    });
    FinancialParticulars {
        sundry_creditors: value(&["SUNDRYCREDITORS"]),
        total_capital_and_liabilities: value(&["TOTALCAPITALANDLIABILITIES"]),
        inventories: value(&["INVENTORIES"]),
        sundry_debtors: value(&["SUNDRYDEBTORS"]),
        balance_with_banks: value(&["BALANCEWITHBANKS"]),
        cash_in_hand: value(&["CASHINHAND", "CASHINHAND"]),
        total_assets: value(&["TOTALASSETS"]),
    }
}

fn tds_item(line: &Line) -> Option<TdsItem> {
    let text = line.segments.first()?.clone();
    let captures = Regex::new(r"(?i)SECTION\s*([0-9A-Z()]+)\s*:\s*(.+?)\s*$").ok()?.captures(&text)?;
    let section = captures.get(1)?.as_str().to_ascii_uppercase();
    let description = captures.get(2)?.as_str().trim().to_ascii_uppercase()
        .replace("CONTRACTORSAND", "CONTRACTORS AND")
        .replace("CONTRACTORSANDSUB", "CONTRACTORS AND SUB");
    Some(TdsItem { section: Some(section), description: Some(description), amount: line_amount(line) })
}

fn deemed_rate_and_base(text: &str) -> (Option<i64>, Option<i64>) {
    let captures = Regex::new(r"(?i)@\s*(\d+)\s*%.*?(?:RS\.?\s*)?([0-9][0-9,]*)").ok()
        .and_then(|re| re.captures(text));
    captures.map(|c| (c[1].parse().ok(), parse_rupees(&c[2]))).unwrap_or((None, None))
}

fn first_amount_after_tax_on(text: &str) -> Option<i64> {
    let start = text.to_ascii_uppercase().find("TAX ON")?;
    let after = &text[start..];
    let candidate = Regex::new(r"(?i)TAX\s+ON\s+(?:RS\.?\s*)?([0-9][0-9,]*)").ok()?.captures(after)?;
    parse_rupees(&candidate[1])
}

fn following_amount(lines: &[Line], index: usize, label: &str) -> Option<i64> {
    lines.iter().skip(index + 1).take(4).find_map(|line| {
        let upper = line.upper();
        if upper.contains("PROFIT DEEMED") { return None; }
        upper.contains(label).then(|| line_amount(line)).flatten()
    })
}

fn line_amount(line: &Line) -> Option<i64> {
    line.segments.iter().rev().find_map(|segment| {
        if segment.trim().eq_ignore_ascii_case("NIL") || segment.trim() == "-" { Some(0) } else { parse_rupees(segment) }
    })
}

fn parse_rupees(text: &str) -> Option<i64> {
    let amount = coi_domain::Money::parse(text.trim())?;
    Some(amount.paise / 100)
}

fn money_rupees(value: Option<&coi_domain::Money>) -> Option<i64> {
    value.map(|money| money.paise / 100)
}

fn first_address(pairs: &[LabelValue]) -> Option<String> {
    pairs.iter().find_map(|pair| (normalise(&pair.label) == "ADDRESS").then(|| pair.value.trim().to_string()))
}

fn pair_value(pairs: &[LabelValue], labels: &[&str]) -> Option<String> {
    pairs.iter().find_map(|pair| {
        let label = normalise(&pair.label);
        labels.iter().any(|candidate| label == *candidate).then(|| pair.value.trim().to_string())
    })
}

fn normalise(value: &str) -> String {
    value.chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>().to_ascii_uppercase()
}

fn inline_value(text: &str, label: &str) -> Option<String> {
    let pattern = format!(r"(?im)\b{}\s*:?\s*([^|\n]+)", label);
    let captures = Regex::new(&pattern).ok()?.captures(text)?;
    let value = captures.get(1)?.as_str().trim().trim_end_matches(':').trim();
    (!value.is_empty()).then(|| value.to_string())
}

#[cfg(test)]
mod tests {
    use super::{deemed_rate_and_base, first_amount_after_tax_on};

    #[test]
    fn parses_presumptive_rate_and_turnover() {
        assert_eq!(deemed_rate_and_base("PROFIT DEEMED U/S 44AD @ 8% OF RS. 9,86,248"), (Some(8), Some(986248)));
    }

    #[test]
    fn parses_tax_slab_amount() {
        assert_eq!(first_amount_after_tax_on("TAX ON RS. 2,15,160 (6,15,160 - 4,00,000)@ 5%"), Some(215160));
    }
}
