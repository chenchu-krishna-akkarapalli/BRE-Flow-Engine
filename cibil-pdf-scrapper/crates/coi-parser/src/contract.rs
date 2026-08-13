use coi_core::{Result, TextRun};
use coi_domain::{
    AdjustmentItem, AnnexureDetails, AnnexureIncomeItem, AssesseeInfo, BankDetails,
    BusinessIncomeAdjustments, BusinessProfession, CaVerification, CoiDocument,
    ComputationOfTotalIncome, FinancialParticulars, GstTurnoverDetail, OtherSourcesBreakdown,
    PartnershipFirmShare, PresumptiveTier, ReturnDetails, TaxComputationContract,
    TaxComputationExtended, TaxSlab, TdsItem,
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
    let business_income_adjustments = business_income_adjustments(lines, &computation);
    let other_sources_breakdown = other_sources_breakdown(lines, &computation);
    let tax_computation_extended = tax_computation_extended(lines, &computation);
    let ca_verification = ca_verification(lines);
    let annexures = annexures(lines);

    Ok(CoiDocument {
        meta: Default::default(),
        assessee_info,
        bank_details,
        return_details,
        computation_of_total_income,
        tax_computation,
        financial_particulars,
        business_income_adjustments,
        other_sources_breakdown,
        tax_computation_extended,
        ca_verification,
        annexures,
    })
}

// Extract partnership firm share and capital details
fn extract_partnership_shares(lines: &[Line]) -> Vec<PartnershipFirmShare> {
    let mut shares = Vec::new();
    let firm_re = Regex::new(r"(?i)From\s+Firm\s+(?P<name>.*?)(?:,\s*PAN\s*:\s*(?P<pan>[A-Z0-9]+))?\s*\((?P<share>[\d\.]+)%\s*Share\)").ok();
    let exempt_10_2a_re = Regex::new(r"(?i)Profit\s+Exempt\s+u/s\s+10\(2A\)\s*(?:Rs\.?)?\s*([0-9,]+)").ok();
    let capital_bal_re = Regex::new(r"(?i)Capital\s+Bal\w*\s*(?:Rs\.?)?\s*([0-9,]+)").ok();

    for (idx, line) in lines.iter().enumerate() {
        let text = line.text();
        let Some(ref re) = firm_re else { break };
        let Some(caps) = re.captures(&text) else { continue };

        let firm_name = caps.name("name").map_or("", |m| m.as_str()).trim().to_string();
        let firm_pan = caps.name("pan").map(|m| m.as_str().trim().to_ascii_uppercase());
        let share_pct = caps.name("share").and_then(|m| m.as_str().parse::<f64>().ok());

        let mut remuneration = 0;
        let mut interest = 0;
        let mut exempt_profit_10_2a = None;
        let mut capital_balance = None;

        for sub_line in lines.iter().skip(idx + 1).take(5) {
            let sub_text = sub_line.text();
            let sub_upper = sub_text.to_ascii_uppercase();

            if sub_upper.contains("REMUNERATION") {
                if let Some(amt) = line_amount(sub_line) {
                    remuneration = amt;
                }
            }
            if sub_upper.contains("INTEREST") && !sub_upper.contains("SAVING") && !sub_upper.contains("COMMISSION") {
                if let Some(amt) = line_amount(sub_line) {
                    interest = amt;
                }
            }
            if let Some(ref e_re) = exempt_10_2a_re {
                if let Some(c) = e_re.captures(&sub_text) {
                    exempt_profit_10_2a = parse_rupees(&c[1]);
                }
            }
            if let Some(ref c_re) = capital_bal_re {
                if let Some(c) = c_re.captures(&sub_text) {
                    capital_balance = parse_rupees(&c[1]);
                }
            }
        }

        shares.push(PartnershipFirmShare {
            firm_name,
            firm_pan,
            share_pct,
            remuneration,
            interest,
            exempt_profit_10_2a,
            capital_balance,
        });
    }

    shares
}

fn business_income_adjustments(lines: &[Line], computation: &coi_domain::Computation) -> BusinessIncomeAdjustments {
    let partnership_shares = extract_partnership_shares(lines);
    let income_44ad = labelled_amount(
        lines,
        &[
            "INCOME U/S 44AD",
            "INCOME UNDER SECTION 44AD",
            "PROFIT U/S 44AD",
            "PROFIT DEEMED U/S 44AD",
        ],
    ).or_else(|| money_rupees(computation.heads.business_profession.as_ref()));
    let profit_as_per_pnl = labelled_amount(
        lines,
        &[
            "PROFIT AS PER PROFIT AND LOSS A/C",
            "PROFIT AS PER PROFIT AND LOSS",
            "PROFIT AS PER P&L A/C",
            "PROFIT AS PER P&L",
            "PROFIT AS PER P AND L",
            "NET PROFIT AS PER P&L",
        ],
    );
    let additions_salary_non_allowable = labelled_amount(
        lines,
        &[
            "ADD: ANY OTHER INCOME NOT INCLUDED PROFIT AND LOSS ACCOUNT / ANY OTHER EXPENSE NOT ALLOWABLE -SALARY",
            "ANY OTHER INCOME NOT INCLUDED PROFIT AND LOSS ACCOUNT",
            "ANY OTHER EXPENSE NOT ALLOWABLE -SALARY",
            "ANY OTHER EXPENSE NOT ALLOWABLE",
            "ADDITIONS - SALARY",
            "NON ALLOWABLE -SALARY",
        ],
    );
    let additions = adjustment_items(lines, &["DEPRECIATION DEBITED IN P&L", "DEPRECIATION DEBITED IN P AND L"]);
    let deductions = adjustment_items(lines, &["DEPRECIATION AS PER CHART U/S 32", "DEPRECIATION U/S 32", "DEPRECIATION AS PER SECTION 32"]);
    let net_business_income = labelled_amount(lines, &["TOTAL BUSINESS INCOME", "NET BUSINESS INCOME", "INCOME FROM BUSINESS OR PROFESSION"])
        .or_else(|| money_rupees(computation.heads.business_profession.as_ref()));

    let total_business_income = net_business_income.or_else(|| {
        let b1 = income_44ad.unwrap_or(0);
        let b2 = profit_as_per_pnl.unwrap_or(0);
        let b3 = additions_salary_non_allowable.unwrap_or(0);
        let total = b1 + b2 + b3;
        if total > 0 { Some(total) } else { None }
    });

    BusinessIncomeAdjustments {
        partnership_shares,
        income_44ad,
        profit_as_per_pnl,
        additions_salary_non_allowable,
        total_business_income,
        additions,
        deductions,
        net_business_income,
    }
}

fn other_sources_breakdown(lines: &[Line], computation: &coi_domain::Computation) -> OtherSourcesBreakdown {
    let savings_bank_interest = labelled_amount(
        lines,
        &[
            "INTEREST FROM SAVING BANK A/C",
            "INTEREST FROM SAVING BANK",
            "SAVINGS BANK INTEREST",
            "SAVING BANK INTEREST",
        ],
    );
    let fdr_interest = labelled_amount(
        lines,
        &[
            "INTEREST ON F.D.R",
            "INTEREST ON FDR",
            "FIXED DEPOSIT INTEREST",
        ],
    );
    let commission_interest = labelled_amount(
        lines,
        &[
            "COMMISSION INTEREST AND OTHER INCOME",
            "COMMISSION INTEREST",
            "COMMISSION AND OTHER INCOME",
            "COMMISSION INCOME",
        ],
    );
    let total_other_sources = labelled_amount(
        lines,
        &[
            "TOTAL OTHER SOURCES",
            "INCOME FROM OTHER SOURCES",
        ],
    ).or_else(|| money_rupees(computation.heads.other_sources.as_ref()))
     .or_else(|| {
         let sum = savings_bank_interest.unwrap_or(0) + fdr_interest.unwrap_or(0) + commission_interest.unwrap_or(0);
         if sum > 0 { Some(sum) } else { None }
     });

    OtherSourcesBreakdown {
        savings_bank_interest,
        fdr_interest,
        commission_interest,
        total_other_sources,
    }
}

fn tax_computation_extended(lines: &[Line], computation: &coi_domain::Computation) -> TaxComputationExtended {
    let interest_234a = labelled_amount(lines, &["INTEREST U/S 234A", "INTEREST UNDER SECTION 234A"])
        .or_else(|| money_rupees(computation.tax.interest_234a.as_ref()));
    let interest_234b = labelled_amount(lines, &["INTEREST U/S 234B", "INTEREST UNDER SECTION 234B"])
        .or_else(|| money_rupees(computation.tax.interest_234b.as_ref()));
    let interest_234c = labelled_amount(lines, &["INTEREST U/S 234C", "INTEREST UNDER SECTION 234C"])
        .or_else(|| money_rupees(computation.tax.interest_234c.as_ref()));
    TaxComputationExtended {
        total_tax_calculated: labelled_amount(lines, &["TOTAL TAX CALCULATED", "TOTAL TAX", "TAX ON TOTAL INCOME"])
            .or_else(|| money_rupees(computation.tax.total_tax.as_ref())),
        total_interest_234: match (interest_234a, interest_234b, interest_234c) {
            (None, None, None) => None,
            values => Some(values.0.unwrap_or(0) + values.1.unwrap_or(0) + values.2.unwrap_or(0)),
        },
        interest_234a,
        interest_234b,
        interest_234c,
        tcs_amount: labelled_amount(lines, &["T.C.S.(AS PER ANNEXURE)", "TCS (AS PER ANNEXURE)", "T.C.S.", "TCS"])
            .or_else(|| money_rupees(computation.credits.tcs.as_ref())),
        deposit_140a_self_assessment: labelled_amount(lines, &["DEPOSIT U/S 140A", "SELF ASSESSMENT TAX", "DEPOSIT UNDER SECTION 140A"])
            .or_else(|| money_rupees(computation.credits.self_assessment_140a.as_ref())),
        tax_payable: labelled_amount(lines, &["TAX PAYABLE", "NET TAX PAYABLE"])
            .or_else(|| money_rupees(computation.tax.net_tax_payable.as_ref())),
    }
}

fn ca_verification(lines: &[Line]) -> CaVerification {
    let membership_no = lines.iter().find_map(|line| {
        Regex::new(r"(?i)MEMBERSHIP\s*(?:NO\.?|NUMBER)?\s*:?\s*([0-9]{4,})")
            .ok()?.captures(&line.text()).map(|captures| captures[1].to_string())
    });
    let ca_name = lines.iter().find_map(|line| {
        let text = line.text();
        Regex::new(r"(?i)\b(CA\.?\s+[A-Z][A-Z .]+)").ok()?.captures(&text)
            .map(|captures| captures[1].trim().to_string())
    });
    let firm_name = lines.iter().enumerate().find_map(|(index, line)| {
        line.upper().contains("CHARTERED ACCOUNTANTS").then(|| {
            let own = line.text();
            if own.len() > "CHARTERED ACCOUNTANTS".len() + 4 { Some(own) }
            else { lines.get(index.saturating_sub(1)).map(Line::text) }
        }).flatten()
    });
    CaVerification { firm_name, ca_name, membership_no }
}

fn annexures(lines: &[Line]) -> AnnexureDetails {
    let mut section = "";
    let mut gst_turnover_details = Vec::new();
    let mut bank_interest_list = Vec::new();
    let mut fdr_interest_list = Vec::new();
    let mut dividend_list = Vec::new();
    let gstin = Regex::new(r"(?i)\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z][A-Z0-9][A-Z0-9])\b").expect("literal regex");
    for line in lines {
        let upper = line.upper();
        if upper.contains("GST TURNOVER") || upper.contains("GST DETAILS") { section = "gst"; continue; }
        if upper.contains("DETAILS OF INTEREST FROM BANK") || upper.contains("BANK INTEREST") { section = "bank"; continue; }
        if upper.contains("DETAILS OF INTEREST ON F.D.R") || upper.contains("DETAILS OF INTEREST ON FDR") || upper.contains("FDR INTEREST") { section = "fdr"; continue; }
        if upper.contains("DETAILS OF DIVIDEND FROM SHARES") || upper.contains("DIVIDEND INCOME") { section = "dividend"; continue; }
        if upper.contains("ANNEXURE") || upper.contains("COMPUTATION") || upper.contains("TOTAL INCOME") { section = ""; }
        if let Some(captures) = gstin.captures(&line.text()) {
            gst_turnover_details.push(GstTurnoverDetail { gstin: Some(captures[1].to_ascii_uppercase()), turnover: line_amount(line) });
            continue;
        }
        let Some(amount) = line_amount(line) else { continue };
        let particulars = line.segments.first().cloned().unwrap_or_default().trim().to_string();
        if particulars.is_empty() || particulars.eq_ignore_ascii_case("PARTICULARS") { continue; }
        let item = AnnexureIncomeItem { particulars, amount: Some(amount) };
        match section {
            "bank" => bank_interest_list.push(item),
            "fdr" => fdr_interest_list.push(item),
            "dividend" => dividend_list.push(item),
            _ => {}
        }
    }
    AnnexureDetails { gst_turnover_details, bank_interest_list, fdr_interest_list, dividend_list }
}

fn adjustment_items(lines: &[Line], labels: &[&str]) -> Vec<AdjustmentItem> {
    lines.iter().filter_map(|line| {
        let upper = line.upper();
        labels.iter().any(|label| upper.contains(label)).then(|| AdjustmentItem {
            particulars: line.segments.first().cloned().unwrap_or_else(|| line.text()),
            amount: line_amount(line),
        })
    }).collect()
}

fn labelled_amount(lines: &[Line], labels: &[&str]) -> Option<i64> {
    lines.iter().find_map(|line| {
        let upper = line.upper();
        labels.iter().any(|label| upper.contains(label)).then(|| line_amount(line)).flatten()
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
    let tax_regime = if text.to_ascii_uppercase().contains("115BAC")
        || text.to_ascii_uppercase().contains("NEW TAX REGIME")
    {
        Some("NEW_REGIME_115BAC".to_string())
    } else if text.to_ascii_uppercase().contains("OLD TAX REGIME")
        || text.to_ascii_uppercase().contains("OLD REGIME")
    {
        Some("OLD_REGIME".to_string())
    } else {
        None
    };

    let Some(return_line) = text.lines().find(|line| line.to_ascii_uppercase().contains("RETURN")) else {
        return ReturnDetails {
            tax_regime,
            ..Default::default()
        };
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
    ReturnDetails { tax_regime, form_type, filing_status, filing_date, acknowledgement_no }
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
    let exempt_income_sec_10 = labelled_amount(
        lines,
        &[
            "INCOME EXEMPT U/S 10",
            "EXEMPT INCOME U/S 10",
            "INCOME EXEMPT UNDER SECTION 10",
            "EXEMPT INCOME",
        ],
    );
    ComputationOfTotalIncome {
        profits_and_gains_business_profession: BusinessProfession {
            tiers,
            section_total: section_total.or_else(|| money_rupees(computation.heads.business_profession.as_ref())),
        },
        exempt_income_sec_10,
        gross_total_income: money_rupees(computation.gross_total_income.as_ref()),
        total_income: money_rupees(computation.total_income.as_ref()),
        total_income_rounded_288a: money_rupees(computation.rounded_total_income.as_ref()),
    }
}

fn tax_computation(lines: &[Line], computation: &coi_domain::Computation) -> TaxComputationContract {
    let slabs = lines.iter().filter_map(|line| {
        let upper = line.upper();
        if !upper.starts_with("TAX ON") && !upper.starts_with("TAX DUE") {
            return None;
        }
        let slab_amount = first_amount_after_tax_on(&line.text());
        let tax = if upper.contains("NIL") { Some(0) } else { line_amount(line) };
        Some(TaxSlab { slab_upper_limit_or_amount: slab_amount, tax })
    }).collect();
    let tds = lines.iter().filter_map(tds_item).collect();
    let rebate_87a = labelled_amount(
        lines,
        &[
            "REBATE U/S 87A",
            "REBATE UNDER SECTION 87A",
            "REBATE 87A",
        ],
    ).or_else(|| money_rupees(computation.tax.rebate_87a.as_ref()));
    let refundable = lines.iter().find_map(|line| {
        let upper = line.upper();
        (upper.contains("REFUNDABLE") || upper.contains("REFUND") || upper.contains("NET PAYABLE/REFUNDABLE"))
            .then(|| line_amount(line))
            .flatten()
    });
    TaxComputationContract {
        slabs,
        rebate_87a,
        tds,
        refundable,
    }
}

// Extract immediate numeric amount following label candidates in a line
fn amount_after_label(line: &Line, label_candidates: &[&str]) -> Option<i64> {
    let upper_segments: Vec<String> = line.segments.iter().map(|s| normalise(s)).collect();
    for (idx, seg_norm) in upper_segments.iter().enumerate() {
        if label_candidates.iter().any(|cand| seg_norm.contains(cand)) {
            for sub_seg in &line.segments[idx..] {
                if let Some(amt) = parse_rupees(sub_seg) {
                    return Some(amt);
                }
                if sub_seg.trim().eq_ignore_ascii_case("NIL") || sub_seg.trim() == "-" {
                    return Some(0);
                }
            }
        }
    }
    None
}

// Extract left/right column totals for two-column balance sheet tables
fn extract_balance_sheet_totals(lines: &[Line]) -> (Option<i64>, Option<i64>) {
    let mut left_total = None;
    let mut right_total = None;

    for line in lines {
        let upper = line.upper();
        if !upper.contains("TOTAL") {
            continue;
        }

        let amounts: Vec<i64> = line.segments.iter().filter_map(|s| parse_rupees(s)).collect();
        if amounts.len() >= 2 && upper.matches("TOTAL").count() >= 2 {
            left_total = Some(amounts[0]);
            right_total = Some(amounts[1]);
            break;
        } else if amounts.len() == 1 {
            let seg_box = line.segment_boxes.first();
            let x = seg_box.map_or(0.0, |b| b.x);
            if x >= 300.0 && right_total.is_none() {
                right_total = Some(amounts[0]);
            } else if x < 300.0 && left_total.is_none() {
                left_total = Some(amounts[0]);
            }
        }
    }

    (left_total, right_total)
}

fn financial_particulars(lines: &[Line]) -> FinancialParticulars {
    let find_value = |candidates: &[&str]| {
        lines.iter().find_map(|line| amount_after_label(line, candidates))
    };

    let sundry_creditors = find_value(&["SUNDRYCREDITORS", "SUNDRYCREDITOR"]);
    let inventories = find_value(&["INVENTORIES", "INVENTORY", "STOCK"]);
    let sundry_debtors = find_value(&["SUNDRYDEBTORS", "SUNDRYDEBTOR"]);
    let balance_with_banks = find_value(&["BALANCEWITHBANKS", "BANKBALANCE", "BALANCEWITHBANK"]);
    let cash_in_hand = find_value(&["CASHINHAND"]);

    let explicit_total_cap = find_value(&["TOTALCAPITALANDLIABILITIES", "TOTALCAPITAL", "LIABILITIESTOTAL"]);
    let explicit_total_assets = find_value(&["TOTALASSETS", "ASSETSTOTAL"]);

    let (bs_total_cap, bs_total_assets) = extract_balance_sheet_totals(lines);

    FinancialParticulars {
        sundry_creditors,
        total_capital_and_liabilities: explicit_total_cap.or(bs_total_cap),
        inventories,
        sundry_debtors,
        balance_with_banks,
        cash_in_hand,
        total_assets: explicit_total_assets.or(bs_total_assets),
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
    use super::{annexures, business_income_adjustments, ca_verification, deemed_rate_and_base, first_amount_after_tax_on, other_sources_breakdown, tax_computation_extended};
    use coi_core::{BoundingBox, TextRun};
    use coi_domain::{AssesseeDetails, ChapterViaDeductions, Computation, HeadsOfIncome, RawContent, TaxComputation, TaxCredits};
    use coi_layout::{group_lines, Line, Table};

    fn lines(rows: &[(&str, &str)]) -> Vec<Line> {
        let runs = rows.iter().enumerate().flat_map(|(index, (label, amount))| {
            let y = 100.0 + index as f32 * 20.0;
            [
                TextRun::new((*label).to_string(), BoundingBox::new(40.0, y, 250.0, 10.0), 1),
                TextRun::new((*amount).to_string(), BoundingBox::new(400.0, y, 100.0, 10.0), 1),
            ]
        }).collect::<Vec<_>>();
        group_lines(&runs)
    }

    fn computation() -> Computation {
        Computation {
            source: "test".to_string(),
            format: "Pdf".to_string(),
            regime: None,
            assessment_year: None,
            financial_year: None,
            financial_year_source: None,
            assessee: AssesseeDetails::default(),
            heads: HeadsOfIncome::default(),
            gross_total_income: None,
            deductions: ChapterViaDeductions::default(),
            total_income: None,
            rounded_total_income: None,
            tax: TaxComputation::default(),
            credits: TaxCredits::default(),
            raw: RawContent { page_count: 0, lines: Vec::new(), table: Table { columns: Vec::new(), rows: Vec::new() } },
        }
    }

    #[test]
    fn parses_presumptive_rate_and_turnover() {
        assert_eq!(deemed_rate_and_base("PROFIT DEEMED U/S 44AD @ 8% OF RS. 9,86,248"), (Some(8), Some(986248)));
    }

    #[test]
    fn parses_tax_slab_amount() {
        assert_eq!(first_amount_after_tax_on("TAX ON RS. 2,15,160 (6,15,160 - 4,00,000)@ 5%"), Some(215160));
    }

    #[test]
    fn extracts_extended_business_tax_and_other_source_fields() {
        let lines = lines(&[
            ("Profit as per P&L A/c", "14,15,039"),
            ("Depreciation Debited in P&L A/c", "3,138"),
            ("Depreciation as per Chart u/s 32", "3,138"),
            ("Interest u/s 234B", "7,672"),
            ("Interest u/s 234C", "5,533"),
            ("Deposit u/s 140A", "1,22,820"),
            ("T.C.S. (as per Annexure)", "18,544"),
            ("Savings Bank Interest", "350"),
            ("Interest on FDR", "780"),
        ]);
        let computation = computation();
        let adjustments = business_income_adjustments(&lines, &computation);
        let tax = tax_computation_extended(&lines, &computation);
        let other = other_sources_breakdown(&lines, &computation);
        assert_eq!(adjustments.profit_as_per_pnl, Some(1_415_039));
        assert_eq!(adjustments.additions[0].amount, Some(3_138));
        assert_eq!(adjustments.deductions[0].amount, Some(3_138));
        assert_eq!(tax.total_interest_234, Some(13_205));
        assert_eq!(tax.deposit_140a_self_assessment, Some(122_820));
        assert_eq!(tax.tcs_amount, Some(18_544));
        assert_eq!(other.savings_bank_interest, Some(350));
        assert_eq!(other.fdr_interest, Some(780));
    }

    #[test]
    fn extracts_ca_and_annexure_rows() {
        let lines = lines(&[
            ("Rohit Mangal & Co.", ""),
            ("Chartered Accountants", ""),
            ("CA Rohit Gupta Membership No.: 450221", ""),
            ("GST Turnover Detail", ""),
            ("09AKLPG1674M1ZO", "5,62,442"),
            ("Details of Interest From Bank", ""),
            ("ICICI BANK LIMITED", "345"),
            ("Details of Interest on F.D.R.", ""),
            ("ICICI BANK LIMITED", "7,251"),
            ("Details of Dividend From Shares", ""),
            ("BHARAT HEAVY ELECTRIALS LIMITED", "2"),
        ]);
        let ca = ca_verification(&lines);
        let detail = annexures(&lines);
        assert_eq!(ca.firm_name.as_deref(), Some("Rohit Mangal & Co."));
        assert_eq!(ca.membership_no.as_deref(), Some("450221"));
        assert_eq!(detail.gst_turnover_details[0].turnover, Some(562442));
        assert_eq!(detail.bank_interest_list[0].amount, Some(345));
        assert_eq!(detail.fdr_interest_list[0].amount, Some(7251));
        assert_eq!(detail.dividend_list[0].amount, Some(2));
    }

    #[test]
    fn extracts_section_115bac_and_firm_shares() {
        let text = "Computation of Total Income [As per Section 115BAC (New Tax Regime)]";
        let ret = super::return_details(text);
        assert_eq!(ret.tax_regime.as_deref(), Some("NEW_REGIME_115BAC"));

        let test_lines = lines(&[
            ("From Firm NIRANJAN KHAD BHANDAR, PAN: AAUFN4272F (50.00% Share)", ""),
            ("Remuneration", "0"),
            ("Interest", "0"),
            ("(Profit Exempt u/s 10(2A) 15425/-)", ""),
            ("(Capital Bal 179925/-)", ""),
            ("Income u/s 44AD", "5,53,088"),
            ("Profit as per Profit and Loss a/c", "0"),
            ("Add: Any other income not included Profit and Loss account / any other expense not allowable -Salary", "75,000"),
            ("Interest From Saving Bank A/c", "1,102"),
            ("COMMISSION INTEREST AND OTHER INCOME", "35,400"),
            ("Income Exempt u/s 10", "30,850"),
            ("Tax Due (Exemption Limit Rs. 300000)", "21,459"),
            ("Rebate u/s 87A", "21,459"),
            ("T.D.S./T.C.S", "2,489"),
            ("Net Payable/Refundable", "-2,489"),
        ]);

        let comp = computation();
        let adjustments = business_income_adjustments(&test_lines, &comp);
        let other = other_sources_breakdown(&test_lines, &comp);
        let total_comp = super::computation_of_total_income(&test_lines, &comp);
        let tax = super::tax_computation(&test_lines, &comp);

        assert_eq!(adjustments.partnership_shares.len(), 1);
        assert_eq!(adjustments.partnership_shares[0].firm_name, "NIRANJAN KHAD BHANDAR");
        assert_eq!(adjustments.partnership_shares[0].firm_pan.as_deref(), Some("AAUFN4272F"));
        assert_eq!(adjustments.partnership_shares[0].share_pct, Some(50.0));
        assert_eq!(adjustments.partnership_shares[0].exempt_profit_10_2a, Some(15425));
        assert_eq!(adjustments.partnership_shares[0].capital_balance, Some(179925));

        assert_eq!(adjustments.income_44ad, Some(553088));
        assert_eq!(adjustments.profit_as_per_pnl, Some(0));
        assert_eq!(adjustments.additions_salary_non_allowable, Some(75000));
        assert_eq!(adjustments.total_business_income, Some(628088));

        assert_eq!(other.savings_bank_interest, Some(1102));
        assert_eq!(other.commission_interest, Some(35400));
        assert_eq!(other.total_other_sources, Some(36502));

        assert_eq!(total_comp.exempt_income_sec_10, Some(30850));
        assert_eq!(tax.rebate_87a, Some(21459));
        assert_eq!(tax.refundable, Some(-2489));
    }
}
