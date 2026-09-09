use coi_core::{Result, TextRun};
use coi_domain::{
    AdjustmentItem, AnnexureDetails, AnnexureIncomeItem, AssesseeInfo, BankDetails,
    BusinessIncomeAdjustments, BusinessIncomeDetails, BusinessIncomeSection, CapitalGainSection,
    CaVerification, CoiDocument, ComputationOfTaxOnTotalIncome, ComputationOfTotalIncome,
    CreditEngineSummary, DeductionsSection, FinancialParticulars, GstTurnoverDetail,
    HealthAndEducationCess, IncomeDeclaredBusinessTurnover, LongTermCapitalGainDetails,
    NormalIncomeTaxCalculation, OtherSourcesBreakdown, OtherSourcesDetails, OtherSourcesSection,
    PartnershipFirmShare, PresumptiveTier, ProfitsAndGainsBusinessProfession, RateAmount,
    RefundDetails, ReturnDetails, SalariesLayout, SelfAssessmentChallan, ShortTermCapitalGainDetails,
    TaxCalculationDetails, TaxComputationContract, TaxComputationExtended, TaxSlab, TaxSlabItem,
    TdsDeductedItem, TdsItem, TotalIncomeDetails,
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
    let bank_details = bank_details(&pairs, lines);
    let return_details = return_details(&text);
    let computation_of_total_income = computation_of_total_income(lines, &computation);
    let tax_computation = tax_computation(lines, &computation);
    let financial_particulars = financial_particulars(lines);
    let business_income_adjustments = business_income_adjustments(lines, &computation);
    let other_sources_breakdown = other_sources_breakdown(lines, &computation);
    let tax_computation_extended = tax_computation_extended(lines, &computation);
    let ca_verification = ca_verification(lines);
    let annexures = annexures(lines);

    let income_declared_business_turnover = computation_of_total_income.income_declared_business_turnover.clone();

    let summary = Some(build_credit_summary(
        &assessee_info,
        &bank_details,
        &computation_of_total_income,
        &income_declared_business_turnover,
        &tax_computation,
        &other_sources_breakdown,
        &tax_computation_extended,
    ));

    Ok(CoiDocument {
        meta: Default::default(),
        summary,
        assessee_info,
        bank_details,
        return_details,
        computation_of_total_income,
        income_declared_business_turnover,
        tax_computation,
        financial_particulars,
        business_income_adjustments,
        other_sources_breakdown,
        tax_computation_extended,
        ca_verification,
        annexures,
    })
}

// single concise context line
fn build_credit_summary(
    assessee_info: &AssesseeInfo,
    bank_details: &BankDetails,
    comp_tot: &ComputationOfTotalIncome,
    income_declared_business_turnover: &Option<IncomeDeclaredBusinessTurnover>,
    tax_comp: &TaxComputationContract,
    other_sources: &OtherSourcesBreakdown,
    tax_ext: &TaxComputationExtended,
) -> CreditEngineSummary {
    let tax_regime = comp_tot.tax_regime.clone();
    let assessment_year = assessee_info.assessment_year.clone();
    let financial_year = assessee_info.financial_year.clone();
    let assessee_name = assessee_info.name.clone();
    let pan = assessee_info.pan.clone();

    let gross_total_income = comp_tot.gross_total_income;
    let total_deductions_chapter_6a = comp_tot.deductions.as_ref().and_then(|d| d.total);
    let total_income = comp_tot
        .total_income
        .as_ref()
        .and_then(|t| t.amount)
        .filter(|&amt| {
            if let Some(g) = gross_total_income {
                let d = total_deductions_chapter_6a.unwrap_or(0);
                if d > 0 {
                    amt == g.saturating_sub(d)
                } else {
                    amt == g
                }
            } else {
                true
            }
        })
        .or_else(|| match (gross_total_income, total_deductions_chapter_6a) {
            (Some(g), Some(d)) => Some(g.saturating_sub(d)),
            (Some(g), None) => Some(g),
            _ => None,
        })
        .or(comp_tot.gross_total_income);
    let total_income_rounded = comp_tot
        .total_income_rounded_288a
        .or(comp_tot.total_income_rounded_off_u_s_288a)
        .or(total_income);

    let business_turnover = comp_tot
        .profits_and_gains_business_profession
        .as_ref()
        .and_then(|p| p.turnover_base_44ad.filter(|&v| v > 0))
        .or_else(|| {
            income_declared_business_turnover
                .as_ref()
                .and_then(|t| t.gross_receipts_total.or(t.gross_receipts_turnover))
        })
        .or_else(|| comp_tot.profits_and_gains_business_profession.as_ref().and_then(|p| p.turnover_base_44ad));

    let taxable_business_profit = comp_tot
        .profits_and_gains_business_profession
        .as_ref()
        .and_then(|p| p.section_total.or(p.declared_profit_44ad).or(p.taxable_business_profit));

    let deemed_profit_44ad_6pct = income_declared_business_turnover
        .as_ref()
        .and_then(|t| t.deemed_profit_digital_mode.as_ref().map(|p| p.amount))
        .or_else(|| {
            comp_tot.profits_and_gains_business_profession.as_ref().and_then(|p| {
                p.tiers.iter().find_map(|t| {
                    if t.presumptive_rate_pct == Some(6.0) {
                        t.deemed_profit.or_else(|| {
                            t.deemed_base_turnover.map(|base| ((base as f64) * 0.06).round() as i64)
                        })
                    } else {
                        None
                    }
                })
            })
        });

    let deemed_profit_44ad_8pct = income_declared_business_turnover
        .as_ref()
        .and_then(|t| t.deemed_profit_other_than_digital.as_ref().map(|p| p.amount))
        .or_else(|| {
            comp_tot.profits_and_gains_business_profession.as_ref().and_then(|p| {
                p.tiers.iter().find_map(|t| {
                    if t.presumptive_rate_pct == Some(8.0) {
                        t.deemed_profit.or_else(|| {
                            t.deemed_base_turnover.map(|base| ((base as f64) * 0.08).round() as i64)
                        })
                    } else {
                        None
                    }
                })
            })
        });

    let deemed_profit_44ad = match (deemed_profit_44ad_6pct, deemed_profit_44ad_8pct) {
        (Some(d6), Some(d8)) => Some(d6 + d8),
        (Some(d6), None) if d6 > 0 => Some(d6),
        (None, Some(d8)) => Some(d8),
        _ => income_declared_business_turnover
            .as_ref()
            .and_then(|t| t.deemed_profit.as_ref().map(|p| p.amount))
            .or_else(|| comp_tot.profits_and_gains_business_profession.as_ref().and_then(|p| p.deemed_profit_44ad)),
    };

    let declared_profit_44ad = comp_tot
        .profits_and_gains_business_profession
        .as_ref()
        .and_then(|p| p.section_total.or(p.declared_profit_44ad))
        .or_else(|| {
            income_declared_business_turnover
                .as_ref()
                .and_then(|t| t.net_profit_declared.as_ref().map(|p| p.amount))
        });

    let total_salaries_gross = comp_tot.salaries.as_ref().and_then(|s| s.gross_salary);
    let taxable_salary = comp_tot.salaries.as_ref().and_then(|s| s.taxable_salary);
    let total_other_sources = other_sources.total_other_sources.or_else(|| comp_tot.income_from_other_sources.as_ref().and_then(|o| o.total));

    let total_tax_computed = comp_tot
        .computation_of_tax_on_total_income
        .as_ref()
        .and_then(|c| c.total_tax)
        .or_else(|| comp_tot.tax_calculation.as_ref().and_then(|t| t.total_tax))
        .or(tax_ext.total_tax_calculated);

    let rebate_87a = tax_comp.rebate_87a
        .or_else(|| comp_tot.tax_calculation.as_ref().and_then(|t| t.rebate_u_s_87a))
        .or_else(|| comp_tot.computation_of_tax_on_total_income.as_ref().and_then(|c| c.rebate_u_s_87a));

    let refundable_amount = comp_tot
        .refund
        .as_ref()
        .and_then(|r| r.tax_refundable_rounded_off_u_s_288b.or(r.amount))
        .or(tax_comp.refundable);

    let total_tds_tcs = comp_tot.total_tds_tcs.map(|tds| {
        if let Some(ref_amt) = refundable_amount {
            if ref_amt > 0 && tds >= 8 * ref_amt && ((tds / 10) - ref_amt).abs() <= 500 {
                return tds / 10;
            }
        }
        tds
    });

    let self_assessment_tax_140a = comp_tot
        .tax_calculation
        .as_ref()
        .and_then(|t| t.deposit_u_s_140a)
        .or(tax_ext.deposit_140a_self_assessment);

    let bank_account_no = bank_details.account_no.clone();
    let ifsc_code = bank_details.ifsc_code.clone();
    let bank_name = bank_details.bank_name.clone();

    CreditEngineSummary {
        assessee_name,
        pan,
        assessment_year,
        financial_year,
        tax_regime,
        gross_total_income,
        total_income,
        total_income_rounded,
        business_turnover,
        taxable_business_profit,
        deemed_profit_44ad,
        deemed_profit_44ad_6pct,
        deemed_profit_44ad_8pct,
        declared_profit_44ad,
        total_salaries_gross,
        taxable_salary,
        total_other_sources,
        total_deductions_chapter_6a,
        total_tax_computed,
        rebate_87a,
        total_tds_tcs,
        self_assessment_tax_140a,
        refundable_amount,
        bank_account_no,
        ifsc_code,
        bank_name,
    }
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
            "GROSS PROFIT TRANSFERRED FROM TRADING ACCOUNT",
            "GROSS PROFIT TRANSFERRED",
            "GROSS PROFIT",
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
    let net_business_income = labelled_amount(
        lines,
        &[
            "TOTAL BUSINESS INCOME",
            "NET BUSINESS INCOME",
            "INCOME FROM BUSINESS OR PROFESSION",
            "PROFIT OR GAINS OF BUSINESS OR PROFESSION",
            "PROFITS OR GAINS OF BUSINESS OR PROFESSION",
            "PROFITS AND GAINS OF BUSINESS OR PROFESSION",
            "PROFITOR GAINS OF BUSINESS OR PROFESSION",
            "INCOME FROM BUSINESS",
            "PROFIT U/S 44AD",
        ],
    )
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
        profit_as_per_pnl: profit_as_per_pnl.or(net_business_income),
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
            "INTEREST FROM SAVINGS BANK ACCOUNT",
            "INTEREST FROM SAVINGS ACCOUNT",
            "INTEREST FROM SAVING ACCOUNT",
            "INTEREST ON SAVINGS BANK ACCOUNT",
            "INTEREST ON SAVINGS ACCOUNT",
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
            "INTEREST FROM TIME-DEPOSIT",
            "INTEREST FROM TIME DEPOSIT",
            "INTEREST FROM DEPOSIT",
            "INTEREST ON DEPOSIT",
            "INTEREST FROM DEPOSITS",
            "INTEREST ON DEPOSITS",
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
            "INCOME FROM OTHER SOURCE",
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
        let re = Regex::new(r"(?i)\bCA\.?\s*([A-Za-z]+(?:\s+[A-Za-z]+)*)").ok()?;
        for caps in re.captures_iter(&text) {
            let matched = caps[1].trim();
            let upper = matched.to_ascii_uppercase();
            if upper.starts_with("PITAL") || upper == "SH" || upper.starts_with("LCULAT") || upper.starts_with("RRIED") {
                continue;
            }
            let full = caps.get(0).unwrap().as_str();
            let prefix_len = full.len() - matched.len();
            let prefix = &full[..prefix_len];
            if !prefix.contains('.') && !prefix.contains(' ') {
                if let Some(first_char) = matched.chars().next() {
                    if !first_char.is_ascii_uppercase() {
                        continue;
                    }
                }
            }
            let with_spaces = crate::assessee::clean_name(matched);
            if with_spaces.trim().len() >= 3 {
                return Some(format!("CA {}", with_spaces));
            }
        }
        None
    });
    let firm_name = lines.iter().enumerate().find_map(|(index, line)| {
        let u = line.upper().replace(' ', "");
        u.contains("CHARTEREDACCOUNTANTS").then(|| {
            let own = line.text();
            if own.len() > "CHARTERED ACCOUNTANTS".len() + 4 {
                Some(own)
            } else {
                lines.get(index.saturating_sub(1)).map(|l| {
                    let t = l.text();
                    if let Some(stripped) = t.strip_prefix("For ") {
                        stripped.trim().to_string()
                    } else {
                        t
                    }
                })
            }
        }).flatten()
    });
    CaVerification { firm_name, ca_name, membership_no }
}

fn annexures(lines: &[Line]) -> AnnexureDetails {
    let mut section = "";
    let mut gst_turnover_details = Vec::new();
    let mut gst_turnover_printed_total: Option<i64> = None;

    let mut bank_interest_list = Vec::new();
    let mut bank_interest_printed_total: Option<i64> = None;

    let mut fdr_interest_list = Vec::new();
    let mut fdr_interest_printed_total: Option<i64> = None;

    let mut dividend_list = Vec::new();
    let mut dividend_printed_total: Option<i64> = None;

    let mut tsd_non_salary_list = Vec::new();
    let mut tsd_non_salary_printed_total: Option<i64> = None;

    let mut pending_sno: Option<u32> = None;

    let gstin = Regex::new(r"(?i)\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z][A-Z0-9][A-Z0-9])\b")
        .expect("literal regex");

    for line in lines {
        let upper = line.upper();
        let text = line.text();

        if upper.contains("GST TURNOVER") || upper.contains("GST DETAILS") {
            section = "gst";
            pending_sno = None;
            continue;
        }
        if upper.contains("DETAILS OF INTEREST FROM BANK") || upper.contains("BANK INTEREST") {
            section = "bank";
            pending_sno = None;
            continue;
        }
        if upper.contains("DETAILS OF INTEREST ON F.D.R")
            || upper.contains("DETAILS OF INTEREST ON FDR")
            || upper.contains("FDR INTEREST")
        {
            section = "fdr";
            pending_sno = None;
            continue;
        }
        if upper.contains("DETAILS OF DIVIDEND FROM SHARES") || upper.contains("DIVIDEND INCOME") {
            section = "dividend";
            pending_sno = None;
            continue;
        }
        if upper.contains("DETAILS OF T.D.S. ON NON-SALARY")
            || upper.contains("DETAILS OF TDS ON NON-SALARY")
            || upper.contains("T.D.S. ON NON-SALARY")
            || upper.contains("TDS ON NON-SALARY")
        {
            section = "tsd_non_salary";
            pending_sno = None;
            continue;
        }
        if upper.contains("DETAILS OF T.C.S") || upper.contains("DETAILS OF TCS") {
            section = "tcs";
            pending_sno = None;
            continue;
        }
        if upper.contains("PER 26AS")
            || upper.contains("STATEMENT OF")
            || upper.contains("SCHEDULE")
            || upper.contains("DETAILS OF TAXPAYER INFORMATION SUMMARY")
            || upper.contains("TAXPAYER INFORMATION SUMMARY")
            || upper.contains("STATEMENT OF LONG TERM CAPITAL")
            || upper.contains("COMPUTATION OF TOTAL INCOME")
        {
            section = "";
            pending_sno = None;
            continue;
        }

        if let Some(captures) = gstin.captures(&text) {
            gst_turnover_details.push(GstTurnoverDetail {
                gstin: Some(captures[1].to_ascii_uppercase()),
                turnover: line_amount(line),
            });
            continue;
        }

        if section.is_empty() {
            continue;
        }

        if upper.contains("TOTAL") || upper.contains("SUBTOTAL") {
            if let Some(amt) = line_amount(line) {
                match section {
                    "gst" => gst_turnover_printed_total = Some(amt),
                    "bank" => bank_interest_printed_total = Some(amt),
                    "fdr" => fdr_interest_printed_total = Some(amt),
                    "dividend" => dividend_printed_total = Some(amt),
                    "tsd_non_salary" => tsd_non_salary_printed_total = Some(amt),
                    _ => {}
                }
            }
            continue;
        }

        if section == "gst" {
            continue;
        }

        let trimmed_text = text.trim();
        if let Ok(num) = trimmed_text.trim_end_matches('.').parse::<u32>() {
            pending_sno = Some(num);
            continue;
        }

        if upper.contains("PARTICULARS") || upper.contains("S.NO") {
            continue;
        }

        let Some(amount) = line_amount(line) else {
            continue;
        };

        let mut serial_no = pending_sno.take();
        let mut particulars = line.segments.first().cloned().unwrap_or_default().trim().to_string();

        let leading_sno_re = Regex::new(r"^(?P<sno>\d+)\.\s*(?P<rest>.+)$").ok();
        if let Some(ref re) = leading_sno_re {
            if let Some(caps) = re.captures(&particulars) {
                if serial_no.is_none() {
                    serial_no = caps["sno"].parse().ok();
                }
                particulars = caps["rest"].trim().to_string();
            }
        }

        if particulars.is_empty()
            || particulars.eq_ignore_ascii_case("TOTAL")
            || particulars.chars().all(|c| c.is_ascii_digit() || c == '.')
        {
            particulars = match section {
                "bank" => "Bank Interest",
                "fdr" => "FDR Interest",
                "dividend" => "Dividend Income",
                "tsd_non_salary" => "TDS on Non-Salary",
                _ => "Interest Income",
            }.to_string();
        }

        let item = AnnexureIncomeItem {
            serial_no,
            particulars,
            amount: Some(amount),
        };

        match section {
            "bank" => bank_interest_list.push(item),
            "fdr" => fdr_interest_list.push(item),
            "dividend" => dividend_list.push(item),
            "tsd_non_salary" => tsd_non_salary_list.push(item),
            _ => {}
        }
    }

    if bank_interest_list.is_empty() {
        for line in lines {
            let u = line.upper();
            if u.contains("INTEREST FROM SAVINGS ACCOUNT") || u.contains("INTEREST FROM SAVING ACCOUNT") {
                if let Some(amt) = line_amount(line) {
                    bank_interest_list.push(AnnexureIncomeItem {
                        serial_no: None,
                        particulars: "Interest from Savings Account".to_string(),
                        amount: Some(amt),
                    });
                    break;
                }
            }
        }
    }
    if fdr_interest_list.is_empty() {
        for line in lines {
            let u = line.upper();
            if u.contains("INTEREST FROM DEPOSIT") || u.contains("INTEREST ON DEPOSIT") {
                if let Some(amt) = line_amount(line) {
                    fdr_interest_list.push(AnnexureIncomeItem {
                        serial_no: None,
                        particulars: "Interest from Deposit".to_string(),
                        amount: Some(amt),
                    });
                    break;
                }
            }
        }
    }

    let gst_turnover_total = gst_turnover_printed_total
        .unwrap_or_else(|| gst_turnover_details.iter().filter_map(|i| i.turnover).sum());
    let bank_interest_total = bank_interest_printed_total
        .unwrap_or_else(|| bank_interest_list.iter().filter_map(|i| i.amount).sum());
    let fdr_interest_total = fdr_interest_printed_total
        .unwrap_or_else(|| fdr_interest_list.iter().filter_map(|i| i.amount).sum());
    let dividend_total = dividend_printed_total
        .unwrap_or_else(|| dividend_list.iter().filter_map(|i| i.amount).sum());
    let tsd_non_salary_total = tsd_non_salary_printed_total
        .unwrap_or_else(|| tsd_non_salary_list.iter().filter_map(|i| i.amount).sum());

    AnnexureDetails {
        gst_turnover_details,
        gst_turnover_total,
        bank_interest_list,
        bank_interest_total,
        fdr_interest_list,
        fdr_interest_total,
        dividend_list,
        dividend_total,
        tsd_non_salary_list,
        tsd_non_salary_total,
    }
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

fn extract_tds_tax_amount(lines: &[Line]) -> Option<i64> {
    for line in lines {
        let upper = line.upper();
        if (upper.contains("T.D.S.") || upper.contains("TDS") || upper.contains("T.C.S.") || upper.contains("TCS"))
            && !upper.contains("COMPUTATION OF TOTAL")
            && !upper.contains("115BAC")
        {
            let amounts: Vec<i64> = line.segments.iter().filter_map(|s| parse_rupees(s)).collect();
            if amounts.len() >= 2 {
                if amounts[0] > amounts[1] && amounts[0] >= 5 * amounts[1] {
                    return Some(amounts[1]);
                } else if amounts[1] > amounts[0] && amounts[1] >= 5 * amounts[0] {
                    return Some(amounts[0]);
                } else {
                    return Some(amounts[amounts.len() - 1]);
                }
            } else if let Some(amt) = line_amount(line) {
                return Some(amt);
            }
        }
    }
    None
}

fn labelled_amount(lines: &[Line], labels: &[&str]) -> Option<i64> {
    let looking_for_tax = labels.iter().any(|l| l.contains("TAX PAYABLE"));
    lines.iter().find_map(|line| {
        let upper = line.upper();
        if upper.contains("115BAC")
            || upper.contains("COMPUTATION OF TOTAL INCOME")
            || upper.contains("COMPUTATION OF TOTAL")
        {
            return None;
        }
        if !looking_for_tax && (upper.contains("TAX PAYABLE") || upper.contains("TAX ON TOTAL INCOME")) {
            return None;
        }
        let squashed = upper.replace([' ', '"', '\''], "");
        labels.iter().any(|label| {
            let opt_squashed = label.replace([' ', '"', '\''], "");
            upper.contains(label) || squashed.contains(&opt_squashed)
        }).then(|| line_amount(line)).flatten()
    })
}

fn assessee_info(pairs: &[LabelValue], computation: &coi_domain::Computation, text: &str) -> AssesseeInfo {
    let first_line_name = {
        let mut l_iter = text.lines().map(str::trim).filter(|l| !l.is_empty());
        if let Some(l0) = l_iter.next() {
            if let Some(l1) = l_iter.next() {
                let u0 = l0.to_ascii_uppercase();
                let u1 = l1.to_ascii_uppercase();
                if !u0.contains(':') && !u0.contains("COMPUTATION") && !u0.contains("INCOME")
                    && (u1.contains("AY ") || u1.contains("AY 20") || u1.contains("A.Y."))
                {
                    Some(l0.to_string())
                } else {
                    let mut parts = l0.split('|').map(str::trim);
                    let cand = parts.next();
                    let sec = parts.next();
                    if let (Some(c), Some(s)) = (cand, sec) {
                        if s.to_ascii_uppercase().contains("AY ") {
                            Some(c.to_string())
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                }
            } else {
                None
            }
        } else {
            None
        }
    };
    let raw_name = pair_value(pairs, &["NAMEOFASSESSEE", "ASSESSEENAME", "NAME"])
        .filter(|n| {
            let u = n.to_ascii_uppercase();
            !u.contains("ACCOUNT") && !u.contains("BANK")
        })
        .or(first_line_name)
        .or_else(|| computation.assessee.name.clone())
        .or_else(|| inline_value(text, "NAME"));
    let name = raw_name.map(|n| crate::assessee::clean_name(&n));

    let pan = computation.assessee.pan.clone().or_else(|| {
        crate::patterns::pan().captures(&text.to_ascii_uppercase()).map(|c| c[1].to_string())
    });

    let assessment_year = pair_value(pairs, &["ASSESSMENTYEAR", "AY"])
        .or_else(|| computation.assessment_year.map(|ay| format!("{}-{}", ay.start, ay.end)))
        .or_else(|| inline_value(text, r"(?:ASSESSMENT\s*YEAR|A\.?Y\.?)"));

    let email = pair_value(pairs, &["EMAILADDRESS", "EMAIL"])
        .or_else(|| inline_value(text, "E-?MAIL"))
        .filter(|e| e.contains('@'));

    AssesseeInfo {
        name,
        pan,
        father_name: pair_value(pairs, &["FATHERSNAME", "FATHER'SNAME"]).or_else(|| inline_value(text, "FATHER'S?NAME")),
        residential_address: pair_value(pairs, &["RESIDENTIALADDRESS"]).or_else(|| first_address(pairs)).or_else(|| inline_value(text, "ADDRESS")),
        status: computation.assessee.status.clone().or_else(|| inline_value(text, "STATUS")),
        assessment_year,
        ward_no: pair_value(pairs, &["WARDNO", "WARD"]),
        financial_year: pair_value(pairs, &["FINANCIALYEAR"]).or_else(|| computation.financial_year.map(|year| format!("{} - {}", year.start, year.end))),
        gender: pair_value(pairs, &["GENDER"]).or_else(|| inline_value(text, "GENDER")),
        date_of_birth: pair_value(pairs, &["DATEOFBIRTH"]).or_else(|| inline_value(text, r"DATE\s*OF\s*BIRTH")),
        email,
        residential_status: pair_value(pairs, &["RESIDENTIALSTATUS"]).or_else(|| inline_value(text, r"RESIDENTIAL\s+STATUS")),
    }
}

fn is_valid_ifsc(code: &str) -> bool {
    let cleaned = code.trim().to_ascii_uppercase();
    if cleaned.len() != 11 {
        return false;
    }
    Regex::new(r"^[A-Z]{4}0[A-Z0-9]{6}$")
        .map(|re| re.is_match(&cleaned))
        .unwrap_or(false)
}

fn bank_details(pairs: &[LabelValue], lines: &[Line]) -> BankDetails {
    let mut name = pair_value(pairs, &["NAMEOFBANK", "BANKNAME"]);
    let mut ifsc = pair_value(pairs, &["IFSCCODE", "IFSC"]);
    let mut account = pair_value(pairs, &["ACCOUNTNO", "ACCOUNTNUMBER", "ACCOUNT"]);

    for line in lines {
        let text = line.text();
        let u = text.to_ascii_uppercase();
        if u.contains("A/C NO") || u.contains("BANK") || u.contains("IFSC") {
            if name.is_none() {
                if let Some(caps) = Regex::new(r"(?i)([A-Z0-9\s]+?BANK)\s*,*\s*A/C").ok().and_then(|re| re.captures(&text)) {
                    name = Some(caps[1].trim().to_string());
                } else if let Some(caps) = Regex::new(r"(?i)^([A-Z0-9\s]+?BANK)").ok().and_then(|re| re.captures(&text)) {
                    name = Some(caps[1].trim().to_string());
                }
            }
            if account.is_none() {
                if let Some(caps) = Regex::new(r"(?i)A/C\s*(?:NO\.?|NUMBER)?\s*:?\s*([0-9A-Z]+)").ok().and_then(|re| re.captures(&text)) {
                    account = Some(caps[1].trim().to_string());
                }
            }
            if ifsc.is_none() {
                if let Some(caps) = Regex::new(r"(?i)IFSC\s*:?\s*([A-Z]{4}0[A-Z0-9]{6})").ok().and_then(|re| re.captures(&text)) {
                    ifsc = Some(caps[1].trim().to_string());
                }
            }
        }
    }

    if ifsc.is_none() {
        let ifsc_re = Regex::new(r"\b([A-Z]{4}0[A-Z0-9]{6})\b").ok();
        for line in lines {
            let t = line.text();
            if let Some(caps) = ifsc_re.as_ref().and_then(|re| re.captures(&t)) {
                if is_valid_ifsc(&caps[1]) {
                    ifsc = Some(caps[1].trim().to_ascii_uppercase());
                    break;
                }
            }
        }
    }

    if let Some(ref mut n) = name {
        let mut cleaned = n.trim().trim_matches(',').trim();
        if let Some(idx) = cleaned.find(',') {
            cleaned = cleaned[..idx].trim();
        }
        if let Some(idx) = cleaned.to_ascii_uppercase().find("A/C") {
            cleaned = cleaned[..idx].trim();
        }
        let upper = cleaned.to_ascii_uppercase();
        if upper.starts_with("INTEREST") || upper.starts_with("SAVINGS") || upper.starts_with("DEPOSIT") || upper.contains("INTEREST ON") || upper == "TYPE" {
            name = None;
        } else {
            *n = cleaned.to_string();
        }
    }

    if let Some(code) = ifsc {
        if is_valid_ifsc(&code) {
            ifsc = Some(code.trim().to_ascii_uppercase());
        } else {
            ifsc = None;
        }
    }

    BankDetails {
        bank_name: name,
        ifsc_code: ifsc,
        account_no: account,
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
    let tax_regime = lines.iter().find_map(|line| {
        let u = line.upper();
        if u.contains("115BAC") || u.contains("NEW TAX REGIME") {
            Some("Section 115BAC - New Tax Regime".to_string())
        } else if u.contains("OLD TAX REGIME") {
            Some("Old Tax Regime".to_string())
        } else {
            None
        }
    });

    let assessment_year = computation.assessment_year.as_ref().map(|y| format!("{}-{}", y.start, y.end)).or_else(|| {
        lines.iter().find_map(|line| {
            let u = line.upper();
            if u.contains("A.Y.") || u.contains("ASSESSMENT YEAR") {
                Regex::new(r"20\d{2}\s*[-–]\s*20?\d{2}").ok().and_then(|re| re.find(&line.text()).map(|m| m.as_str().replace(' ', "")))
            } else {
                None
            }
        })
    });

    let bus_total = labelled_amount(
        lines,
        &[
            "PROFITS AND GAINS OF BUSINESS OR PROFESSION",
            "INCOME FROM BUSINESS OR PROFESSION",
            "PROFITS AND GAINS OF BUSINESS",
            "PROFIT OR GAINS OF BUSINESS OR PROFESSION",
            "PROFITS OR GAINS OF BUSINESS OR PROFESSION",
            "PROFIT OR GAINS OF BUSINESS",
            "PROFITOR GAINS OF BUSINESS OR PROFESSION",
            "PROFITOR GAINS",
            "INCOME FROM BUSINESS",
            "TOTAL BUSINESS INCOME",
            "PROFIT U/S 44AD",
            "U/S 28",
        ],
    )
    .or_else(|| money_rupees(computation.heads.business_profession.as_ref()));

    let firm_shares = extract_partnership_shares(lines);
    let bus_details = firm_shares.into_iter().next().map(|share| BusinessIncomeDetails {
        firm_name: Some(share.firm_name),
        pan: share.firm_pan,
        share_percentage: share.share_pct,
        remuneration: Some(share.remuneration),
        interest: Some(share.interest),
        profit_exempt_u_s_10_2a: share.exempt_profit_10_2a,
        capital_balance: share.capital_balance,
    });

    let bus_section = Some(BusinessIncomeSection {
        chapter: Some("IV D".to_string()),
        total: bus_total,
        details: bus_details,
    });

    let stcg_amt = labelled_amount(lines, &["SHORT TERM CAPITAL GAIN", "STCG", "CAPITAL GAIN AS PER DETAILS ATTACHED"]);
    let ltcg_112a = labelled_amount(lines, &["LONG TERM CAPITAL GAIN U/S 112A", "112A(2)(I)", "U/S 112A"]);
    let ltcg_loss = labelled_amount(lines, &["BROUGHT FORWARD LONG TERM CAPITAL LOSS", "BROUGHT FORWARD LOSS"]);
    let cg_total = labelled_amount(lines, &["CAPITAL GAINS", "INCOME FROM CAPITAL GAIN", "TOTAL CAPITAL GAIN"])
        .or_else(|| money_rupees(computation.heads.capital_gains.as_ref()));

    let cg_section = Some(CapitalGainSection {
        chapter: Some("IV E".to_string()),
        total: cg_total,
        short_term_capital_gain: Some(ShortTermCapitalGainDetails {
            capital_gain_as_per_details_attached: stcg_amt,
        }),
        long_term_capital_gain: Some(LongTermCapitalGainDetails {
            long_term_capital_gain_u_s_112a_before_23_07_2024: ltcg_112a,
            threshold_limit: Some(125000),
            brought_forward_long_term_capital_loss: ltcg_loss,
        }),
    });

    let sav_int = labelled_amount(
        lines,
        &[
            "INTEREST FROM SAVING BANK ACCOUNT",
            "INTEREST FROM SAVINGS BANK ACCOUNT",
            "INTEREST FROM SAVING BANK AC",
            "INTEREST FROM SAVING BANK",
            "INTEREST FROM SAVINGS BANK",
            "INTEREST FROM SAVINGS ACCOUNT",
            "INTEREST FROM SAVING ACCOUNT",
            "INTEREST ON SAVINGS BANK ACCOUNT",
            "INTEREST ON SAVINGS ACCOUNT",
            "INTEREST ON SAVING ACCOUNT",
            "INTEREST FROM SAVING BANK A/C",
            "INTEREST FROM SAVING BANK A/C(AS PER ANNEXURE)",
            "INTEREST FROM SAVING BANK ACCOUNTS",
            "SAVINGS BANK INTEREST",
            "INTEREST FROM BANK",
        ],
    );
    let fdr_int = labelled_amount(
        lines,
        &[
            "INTEREST ON FDR",
            "INTEREST ON F.D.R.",
            "INTEREST FROM DEPOSIT",
            "INTEREST ON DEPOSIT",
            "INTEREST FROM DEPOSITS",
            "INTEREST ON DEPOSITS",
        ],
    );
    let time_dep = labelled_amount(
        lines,
        &[
            "INTEREST FROM TIME-DEPOSIT",
            "INTEREST FROM TIME DEPOSIT",
            "INTEREST ON TIME-DEPOSIT",
            "INTEREST ON TIME DEPOSIT",
            "TIME DEPOSIT INTEREST",
            "TIME-DEPOSIT INTEREST",
            "INTEREST FROM DEPOSIT",
            "INTEREST ON DEPOSIT",
            "INTEREST FROM DEPOSITS",
            "INTEREST ON DEPOSITS",
        ],
    );
    let tax_ref = labelled_amount(
        lines,
        &[
            "INTEREST ON INCOME TAX REFUND",
            "INTEREST ON IT REFUND",
            "INTEREST FROM INCOME TAX REFUND",
            "INTEREST FROM IT REFUND",
        ],
    );
    let div_amt = labelled_amount(lines, &["DIVIDEND FROM SHARES", "DIVIDEND INCOME"]);
    let oth_item = lines.iter().find_map(|line| {
        let u = line.upper();
        let other_item_labels = [
            "OTHER INCOME",
            "COMMISSION INTEREST AND OTHER INCOME",
            "OTHER ITEM",
            "COMMISSION / INTEREST",
            "ANY OTHER INCOME",
            "MISCELLANEOUS INCOME",
        ];
        if (u.contains("INCOME FROM OTHER SOURCE") && !u.contains("INCOME FROM OTHER SOURCES"))
            || other_item_labels.iter().any(|lbl| u.contains(lbl))
        {
            line_amount(line)
        } else {
            None
        }
    });
    let os_total = labelled_amount(lines, &["INCOME FROM OTHER SOURCES", "TOTAL OTHER SOURCES"])
        .or_else(|| money_rupees(computation.heads.other_sources.as_ref()));

    let os_section = Some(OtherSourcesSection {
        chapter: Some("IV F".to_string()),
        total: os_total,
        details: Some(OtherSourcesDetails {
            interest_from_saving_bank_accounts: sav_int,
            interest_from_time_deposit: time_dep.or(fdr_int),
            interest_on_fdr: fdr_int,
            interest_on_income_tax_refund: tax_ref,
            other_item: oth_item,
            dividend_from_shares: div_amt,
            total: os_total,
        }),
    });

    let gti = labelled_amount(lines, &["GROSS TOTAL INCOME"]).or_else(|| money_rupees(computation.gross_total_income.as_ref()));

    let ded_total = labelled_amount(
        lines,
        &[
            "CHAPTER VI-A DEDUCTIONS",
            "TOTAL DEDUCTIONS U/C VI-A",
            "DEDUCTIONS UNDER CHAPTER VI-A",
            "TOTAL DEDUCTIONS",
            "LESS: DEDUCTIONS",
            "DEDUCTIONS (CHAPTER VI-A)",
        ],
    )
    .filter(|&val| val > 0)
    .or_else(|| money_rupees(computation.deductions.total.as_ref()))
    .or_else(|| {
        let items_sum: i64 = computation
            .deductions
            .items
            .iter()
            .filter_map(|i| i.amount.as_ref().map(|m| m.paise.abs() / 100))
            .sum();
        (items_sum > 0).then_some(items_sum)
    })
    .or(Some(0));
    let ded_section = Some(DeductionsSection {
        chapter: Some("VI-A".to_string()),
        total: ded_total,
    });

    let mut tot_inc_amt = labelled_amount(lines, &["TOTAL INCOME"]).or_else(|| money_rupees(computation.total_income.as_ref()));
    if let Some(g) = gti {
        let d = ded_total.unwrap_or(0);
        let expected = g.saturating_sub(d);
        if tot_inc_amt.is_none() || (d > 0 && tot_inc_amt == Some(g)) {
            tot_inc_amt = Some(expected);
        }
    }
    let round_288a = labelled_amount(
        lines,
        &[
            "NET TAXABLE INCOME (R/O TO NEAREST RUPEES TEN)",
            "NET TAXABLE INCOME (R/O TO NEAREST RUPEE TEN)",
            "NET TAXABLE INCOME (R/O",
            "NET TAXABLE INCOME",
            "ROUNDING OFF U/S 288 A",
            "ROUNDING OFF U/S 288A",
            "ROUNDING OFF U/S 288",
            "ROUNDING OFF UNDER SECTION 288A",
            "ROUND OFF U/S 288 A",
            "ROUND OFF U/S 288A",
            "ROUND OFF U/S 288",
            "ROUNDED OFF U/S 288 A",
            "ROUNDED OFF U/S 288A",
            "ROUND OFF UNDER SECTION 288A",
        ],
    )
    .or(tot_inc_amt);
    let exempt_10 = labelled_amount(lines, &["INCOME EXEMPT U/S 10", "PROFIT EXEMPT U/S 10(2A)", "EXEMPT INCOME U/S 10"]);
    let adj_tot_inc = labelled_amount(lines, &["ADJUSTED TOTAL INCOME"]).or(tot_inc_amt);

    let tot_inc_details = Some(TotalIncomeDetails {
        amount: tot_inc_amt,
        round_off_u_s_288a: round_288a,
        income_exempt_u_s_10: exempt_10,
        adjusted_total_income: adj_tot_inc,
        amt_applicable: Some(false),
        amt_note: Some("Adjusted total income (ATI) is not more than Rs. 20 lakh hence AMT not applicable.".to_string()),
    });

    let tax_due_ex = labelled_amount(
        lines,
        &[
            "TAX DUE (EXEMPTION LIMIT",
            "TAX DUE EXEMPTION LIMIT",
            "TAX ON EXEMPTION LIMIT",
        ],
    );
    let stcg_tax = labelled_amount(
        lines,
        &[
            "SHORT TERM CAPITAL GAIN @",
            "SHORT TERM CAPITAL GAIN TAX",
            "TAX ON STCG",
            "SHORT TERM CAPITAL GAIN",
        ],
    );
    let mut tot_tax = labelled_amount(lines, &["GROSS TAX PAYABLE", "TOTAL TAX", "TOTAL TAX CALCULATED"]);
    let rebate_87a = labelled_amount(lines, &["REBATE U/S 87A", "REBATE UNDER SECTION 87A"]);
    let tax_after_reb = labelled_amount(lines, &["TAX AFTER REBATE"]).or_else(|| {
        match (tot_tax, rebate_87a) {
            (Some(t), Some(r)) => Some(t.saturating_sub(r)),
            _ => None,
        }
    });
    let cess_amt = labelled_amount(
        lines,
        &[
            "HEALTH & EDUCATION CESS",
            "HEALTH AND EDUCATION CESS",
            "HEC @",
            "CESS @ 4%",
        ],
    );
    let tax_after_c = labelled_amount(lines, &["TAX AFTER CESS", "TOTAL TAX AND CESS"]).or_else(|| {
        match (tax_after_reb, cess_amt) {
            (Some(tar), Some(c)) => Some(tar + c),
            _ => None,
        }
    });
    let tds_tcs_amt = extract_tds_tax_amount(lines).or_else(|| labelled_amount(lines, &["T.D.S. / T.C.S.", "TDS / TCS", "TOTAL TDS/TCS"]));
    let dep_140a = labelled_amount(
        lines,
        &[
            "DEPOSIT U/S 140A",
            "SELF ASSESSMENT TAX",
            "DEPOSIT UNDER SECTION 140A",
        ],
    );
    let ref_288b = labelled_amount(lines, &["REFUNDABLE (ROUND OFF U/S 288B)", "ROUND OFF U/S 288B"]);

    let tax_calc = Some(TaxCalculationDetails {
        tax_due_exemption_limit: tax_due_ex,
        short_term_capital_gain_tax: stcg_tax,
        total_tax: tot_tax,
        rebate_u_s_87a: rebate_87a,
        tax_after_rebate: tax_after_reb,
        health_and_education_cess: Some(HealthAndEducationCess {
            rate: Some(4.0),
            amount: cess_amt,
        }),
        tax_after_cess: tax_after_c,
        tds_tcs: tds_tcs_amt,
        deposit_u_s_140a: dep_140a,
        refundable_round_off_u_s_288b: ref_288b,
    });

    let norm_inc_re = Regex::new(r"(?i)TAX\s+CALCULATION\s+ON\s+NORMAL\s+INCOME\s+OF\s+RS\.?\s*([\d,]+)").unwrap();
    let exemp_re = Regex::new(r"(?i)EXEMPTION\s+LIMIT\s*[:=]?\s*([\d,]+)").unwrap();
    let slab_re = Regex::new(r"(?i)TAX\s+ON\s*\([\d,]+[-–]([\d,]+)\)\s*=\s*([\d,]+)\s*@\s*([\d\.]+)%\s*=\s*([\d,]+)").unwrap();
    let total_tax_re = Regex::new(r"(?i)TOTAL\s+TAX\s*[:=]?\s*([\d,]+)").unwrap();

    let mut norm_inc = None;
    let mut ex_lim = None;
    let mut tax_norm_inc = None;
    let mut tax_rate = None;
    let mut tax_on_norm = None;
    let mut tot_tax_norm = None;

    for line in lines {
        let text = line.text();
        if let Some(caps) = norm_inc_re.captures(&text) {
            if let Some(amt) = parse_rupees(&caps[1]) {
                norm_inc = Some(amt);
            }
        }
        if let Some(caps) = exemp_re.captures(&text) {
            if let Some(amt) = parse_rupees(&caps[1]) {
                ex_lim = Some(amt);
            }
        }
        if let Some(caps) = slab_re.captures(&text) {
            if let Some(taxable) = parse_rupees(&caps[2]) {
                tax_norm_inc = Some(taxable);
            }
            if let Ok(rate) = caps[3].parse::<f64>() {
                tax_rate = Some(rate);
            }
            if let Some(tax) = parse_rupees(&caps[4]) {
                tax_on_norm = Some(tax);
            }
        }
        if let Some(caps) = total_tax_re.captures(&text) {
            if tot_tax_norm.is_none() {
                if let Some(tax) = parse_rupees(&caps[1]) {
                    tot_tax_norm = Some(tax);
                }
            }
        }
    }

    if tot_tax_norm.is_none() {
        tot_tax_norm = tax_on_norm;
    }
    if tax_on_norm.is_none() {
        tax_on_norm = tot_tax_norm;
    }

    let norm_tax_calc = Some(NormalIncomeTaxCalculation {
        normal_income: norm_inc,
        exemption_limit: ex_lim.or(Some(300000)),
        taxable_normal_income: tax_norm_inc,
        tax_rate,
        tax_on_normal_income: tax_on_norm,
        total_tax: tot_tax_norm,
    });

    let gross_sal = labelled_amount(lines, &["GROSS SALARY", "SALARY RECEIVED"]);
    let std_ded_16ia = labelled_amount(lines, &["STANDARD DEDUCTION U/S 16(IA)", "STANDARD DEDUCTION U/S 16IA", "STANDARD DEDUCTION", "DEDUCTION U/S 16(IA)"]);
    let tax_sal = labelled_amount(lines, &["TAXABLE SALARY", "NET SALARY", "INCOME CHARGEABLE UNDER THE HEAD SALARIES", "SALARIES"]);
    let salaries = if gross_sal.is_some() || tax_sal.is_some() || std_ded_16ia.is_some() {
        Some(SalariesLayout {
            gross_salary: gross_sal,
            standard_deduction_u_s_16_ia: std_ded_16ia,
            taxable_salary: tax_sal,
        })
    } else {
        None
    };

    let tier_start_re = Regex::new(r"(?i)PROFIT\s+DEEMED\s+U/S\s+44AD\s*@\s*([\d\.]+)%\s*OF\s*(?:RS\.?\s*)?([\d,]+)(?:\s*[:=]?\s*|\s+)([\d,]+)").unwrap();
    let decl_tier_re = Regex::new(r"(?i)PROFIT\s+DECLARED\s+U/S\s+44AD\s*[:=]?\s*([\d,]+)").unwrap();
    let higher_tier_re = Regex::new(r"(?i)PROFIT\s*\(\s*HIGHER\s+OF\s+THE\s+ABOVE\s*\)\s*[:=]?\s*([\d,]+)").unwrap();
    let sec_total_re = Regex::new(r"(?i)(?:PROFIT\s+U/S\s+44AD|PROFITS\s+AND\s+GAINS\s+FROM\s+BUSINESS\s+OR\s+PROFESSION)\s*[:=]?\s*([\d,]+)").unwrap();

    let mut tiers = Vec::new();
    let mut current_tier: Option<PresumptiveTier> = None;
    let mut section_total = None;

    let mut deemed_p = labelled_amount(lines, &["PROFIT DEEMED U/S 44AD", "DEEMED PROFIT"]);
    let mut decl_p = labelled_amount(lines, &["PROFIT DECLARED U/S 44AD", "DECLARED PROFIT"]);
    let mut turn_base = labelled_amount(lines, &["GROSS RECEIPT / TURNOVER", "TURNOVER"]);
    let tax_bus_p = labelled_amount(lines, &["PROFIT (HIGHER OF THE ABOVE)", "PROFIT TAKEN HIGHER OF DECLARED OR DEEMED", "PROFITS AND GAINS FROM BUSINESS OR PROFESSION", "PROFIT U/S 44AD"]);

    for line in lines {
        let t = line.text();
        if let Some(caps) = tier_start_re.captures(&t) {
            if let Some(completed) = current_tier.take() {
                tiers.push(completed);
            }
            let rate = caps[1].parse::<f64>().ok();
            let turnover = parse_rupees(&caps[2]);
            let deemed = parse_rupees(&caps[3]);
            current_tier = Some(PresumptiveTier {
                presumptive_rate_pct: rate,
                deemed_base_turnover: turnover,
                deemed_profit: deemed,
                declared_profit: None,
                profit_taken_higher_of_declared_or_deemed: None,
            });
        } else if let Some(ref mut tier) = current_tier {
            if let Some(caps) = decl_tier_re.captures(&t) {
                if tier.declared_profit.is_none() {
                    tier.declared_profit = parse_rupees(&caps[1]);
                }
            } else if let Some(caps) = higher_tier_re.captures(&t) {
                if tier.profit_taken_higher_of_declared_or_deemed.is_none() {
                    tier.profit_taken_higher_of_declared_or_deemed = parse_rupees(&caps[1]);
                    if let Some(completed) = current_tier.take() {
                        tiers.push(completed);
                    }
                }
            }
        }
        let u = t.to_ascii_uppercase();
        if !u.contains("DECLARED") && !u.contains("DEEMED") && !u.contains('@') && !u.contains("HIGHER") {
            if let Some(caps) = sec_total_re.captures(&t) {
                if let Some(tot) = parse_rupees(&caps[1]) {
                    section_total = Some(tot);
                }
            }
        }
    }

    if let Some(completed) = current_tier.take() {
        tiers.push(completed);
    }

    for tier in &mut tiers {
        if tier.deemed_profit.is_none() {
            if let (Some(rate), Some(turnover)) = (tier.presumptive_rate_pct, tier.deemed_base_turnover) {
                let calc = ((turnover as f64) * (rate / 100.0)).round() as i64;
                tier.deemed_profit = Some(calc);
            }
        }
    }

    let inc_hdr_re = Regex::new(r"(?i)Income\s+Declared\s+u/s\s*(44\s*AD|44\s*ADA|44\s*AE)\s*BUSINESS\s*TURNOVER").unwrap();
    let due_date_re = Regex::new(r"(?i)Due\s+Date\s+for\s+filing\s+of\s+Return\s*[:=]?\s*([A-Za-z0-9, ]+)").unwrap();
    let ext_due_date_re = Regex::new(r"(?i)Due\s+date\s+extended\s+to\s*[:=]?\s*([\d/\.-]+)").unwrap();
    let gross_other_re = Regex::new(r"(?i)Gross\s+Receipts\s*/?\s*Turnover\s*\(\s*Other\s+than\s+ECS/Cheque/DD\s*\)\s*[:=]?\s*([\d,]+(?:\.\d+)?)").unwrap();
    let gross_digital_re = Regex::new(r"(?i)Gross\s+Receipts\s*/?\s*Turnover\s*\(\s*ECS/Cheque/DD\s+Mode\s*\)\s*[:=]?\s*([\d,]+(?:\.\d+)?)").unwrap();
    let gross_cash_re = Regex::new(r"(?i)Gross\s+Receipts\s*/?\s*Turnover\s*\(\s*Cash\s+Receipt\s*\)\s*[:=]?\s*([\d,]+(?:\.\d+)?)").unwrap();
    let gross_tot_re = Regex::new(r"(?i)(?:Total\s+Gross\s+Rec[ei]{2}pts|Gross\s+Rec[ei]{2}pts\s*/?\s*Turnover\s*\(\s*Total\s*\)|Gross\s+Rec[ei]{2}pts\s*\(\s*Total\s*\))\s*[:=]?\s*([\d,]+(?:\.\d+)?)").unwrap();
    let gross_re = Regex::new(r"(?i)(?:Total\s+Gross\s+Rec[ei]{2}pts|Gross\s+Rec[ei]{2}pts(?:\s+from\s+Business(?:\s*(?:&|and)\s*Prof[ei]ssion)?)?|Turnover)(?:\s*/?\s*Turnover)?\s*[:=]?\s*([\d,]+(?:\.\d+)?)").unwrap();

    let book_re = Regex::new(r"(?i)Book\s+Profit\s*[:=]?\s*([\d,]+(?:\.\d+)?)(?:\s+([\d\.]+)\s*%?)?").unwrap();
    let deemed_other_re = Regex::new(r"(?i)Deemed\s+Profit.*?(?:Other|Non-Digital|@\s*8\s*%).*?[:=]?\s*([\d,]+(?:\.\d+)?)(?:\s+([\d\.]+)\s*%?)?").unwrap();
    let deemed_digital_re = Regex::new(r"(?i)Deemed\s+Profit.*?(?:ECS|Cheque|DD|Mode|@\s*6\s*%).*?[:=]?\s*([\d,]+(?:\.\d+)?)(?:\s+([\d\.]+)\s*%?)?").unwrap();
    let deemed_re = Regex::new(r"(?i)Deemed\s+Profit.* philosophy?.*?[:=]?\s*([\d,]+(?:\.\d+)?)(?:\s+([\d\.]+)\s*%?)?").unwrap();
    let deemed_simple_re = Regex::new(r"(?i)Deemed\s+Profit\s*[:=]?\s*([\d,]+(?:\.\d+)?)").unwrap();
    let net_decl_re = Regex::new(r"(?i)Net\s+Profit\s+Declared\s*[:=]?\s*([\d,]+(?:\.\d+)?)(?:\s+([\d\.]+)\s*%?)?").unwrap();

    let mut inc_decl_sec = None;
    let mut due_date = None;
    let mut ext_due_date = None;
    let mut gross_other = None;
    let mut gross_digital = None;
    let mut gross_cash = None;
    let mut gross_tot = None;
    let mut gross_turnover = None;
    let mut book_profit_info = None;
    let mut deemed_other = None;
    let mut deemed_digital = None;
    let mut deemed_profit_info = None;
    let mut net_decl_info = None;

    for line in lines {
        let t = line.text();
        if let Some(caps) = inc_hdr_re.captures(&t) {
            inc_decl_sec = Some(caps[1].replace(' ', "").to_ascii_uppercase());
        }
        if let Some(caps) = due_date_re.captures(&t) {
            if due_date.is_none() {
                due_date = Some(caps[1].trim().to_string());
            }
        }
        if let Some(caps) = ext_due_date_re.captures(&t) {
            if ext_due_date.is_none() {
                let cleaned = caps[1].trim().trim_matches('.').trim().to_string();
                ext_due_date = Some(cleaned);
            }
        }
        if let Some(caps) = gross_other_re.captures(&t) {
            if gross_other.is_none() { gross_other = parse_rupees(&caps[1]); }
        } else if let Some(caps) = gross_digital_re.captures(&t) {
            if gross_digital.is_none() { gross_digital = parse_rupees(&caps[1]); }
        } else if let Some(caps) = gross_cash_re.captures(&t) {
            if gross_cash.is_none() { gross_cash = parse_rupees(&caps[1]); }
        } else if let Some(caps) = gross_tot_re.captures(&t) {
            if gross_tot.is_none() { gross_tot = parse_rupees(&caps[1]); }
        } else if let Some(caps) = gross_re.captures(&t) {
            if gross_turnover.is_none() && !t.to_ascii_uppercase().contains("DEEMED") { gross_turnover = parse_rupees(&caps[1]); }
        }

        if let Some(caps) = book_re.captures(&t) {
            if book_profit_info.is_none() || book_profit_info.as_ref().and_then(|i: &RateAmount| i.rate_pct).is_none() {
                let amt = parse_rupees(&caps[1]);
                let rate = caps.get(2).and_then(|m| m.as_str().parse::<f64>().ok());
                if let Some(a) = amt {
                    book_profit_info = Some(RateAmount { amount: a, rate_pct: rate });
                }
            }
        }

        if let Some(caps) = deemed_other_re.captures(&t) {
            if deemed_other.is_none() || deemed_other.as_ref().and_then(|i: &RateAmount| i.rate_pct).is_none() {
                let amt = parse_rupees(&caps[1]);
                let rate = caps.get(2).and_then(|m| m.as_str().parse::<f64>().ok());
                if let Some(a) = amt {
                    deemed_other = Some(RateAmount { amount: a, rate_pct: rate.or(Some(8.0)) });
                }
            }
        } else if let Some(caps) = deemed_digital_re.captures(&t) {
            if deemed_digital.is_none() || deemed_digital.as_ref().and_then(|i: &RateAmount| i.rate_pct).is_none() {
                let amt = parse_rupees(&caps[1]);
                let rate = caps.get(2).and_then(|m| m.as_str().parse::<f64>().ok());
                if let Some(a) = amt {
                    deemed_digital = Some(RateAmount { amount: a, rate_pct: rate.or(Some(6.0)) });
                }
            }
        } else if let Some(caps) = deemed_re.captures(&t) {
            if deemed_profit_info.is_none() || deemed_profit_info.as_ref().and_then(|i: &RateAmount| i.rate_pct).is_none() {
                let amt = caps.get(1).and_then(|m| parse_rupees(m.as_str()));
                let rate = caps.get(2).and_then(|m| m.as_str().parse::<f64>().ok());
                if let Some(a) = amt {
                    deemed_profit_info = Some(RateAmount { amount: a, rate_pct: rate.or(Some(8.0)) });
                }
            }
        } else if let Some(caps) = deemed_simple_re.captures(&t) {
            if deemed_profit_info.is_none() {
                let amt = caps.get(1).and_then(|m| parse_rupees(m.as_str()));
                if let Some(a) = amt {
                    deemed_profit_info = Some(RateAmount { amount: a, rate_pct: Some(8.0) });
                }
            }
        }

        if let Some(caps) = net_decl_re.captures(&t) {
            if net_decl_info.is_none() || net_decl_info.as_ref().and_then(|i: &RateAmount| i.rate_pct).is_none() {
                let amt = parse_rupees(&caps[1]);
                let rate = caps.get(2).and_then(|m| m.as_str().parse::<f64>().ok());
                if let Some(a) = amt {
                    net_decl_info = Some(RateAmount { amount: a, rate_pct: rate });
                }
            }
        }
    }

    if gross_turnover.is_none() {
        gross_turnover = labelled_amount(
            lines,
            &[
                "GROSS RECEIPTS FROM BUSINESS",
                "GROSS RECIEPTS FROM BUSINESS",
                "GROSS RECEIPTS",
                "GROSS RECIEPTS",
                "GROSS TURNOVER",
                "TURNOVER",
            ],
        );
    }
    if due_date.is_none() {
        if let Some(line) = lines.iter().find(|l| l.upper().contains("DUE DATE FOR FILING OF RETURN")) {
            let t = line.text();
            if let Some(caps) = due_date_re.captures(&t) {
                let cleaned = caps[1].trim().trim_end_matches('.').trim().to_string();
                due_date = Some(cleaned);
            }
        }
    }
    if net_decl_info.is_none() {
        if let Some(bt) = bus_total {
            net_decl_info = Some(RateAmount { amount: bt, rate_pct: None });
        }
    }
    if book_profit_info.is_none() {
        let gp = labelled_amount(
            lines,
            &[
                "GROSS PROFIT TRANSFERRED FROM TRADING ACCOUNT",
                "GROSS PROFIT TRANSFERRED",
                "GROSS PROFIT",
            ],
        );
        if let Some(amt) = gp.or(bus_total) {
            book_profit_info = Some(RateAmount { amount: amt, rate_pct: None });
        }
    }

    let sum_parts = match (gross_other, gross_digital) {
        (Some(o), Some(d)) => Some(o + d + gross_cash.unwrap_or(0)),
        (Some(o), None) => gross_cash.map(|c| o + c),
        (None, Some(d)) => gross_cash.map(|c| d + c),
        _ => None,
    };
    let final_gross_tot = sum_parts.or(gross_tot).or(gross_turnover);

    let income_declared_business_turnover = if final_gross_tot.is_some() || gross_digital.is_some() || deemed_digital.is_some() || net_decl_info.is_some() || inc_decl_sec.is_some() {
        Some(IncomeDeclaredBusinessTurnover {
            due_date_for_filing_return: due_date,
            due_date_extended_to: ext_due_date,
            section: inc_decl_sec.or_else(|| Some("44AD".to_string())),
            gross_receipts_other_than_digital: gross_other,
            gross_receipts_digital_mode: gross_digital,
            gross_receipts_cash: gross_cash,
            gross_receipts_total: final_gross_tot,
            book_profit: book_profit_info,
            deemed_profit_other_than_digital: deemed_other.clone(),
            deemed_profit_digital_mode: deemed_digital.clone(),
            net_profit_declared: net_decl_info.clone(),
            gross_receipts_turnover: final_gross_tot,
            deemed_profit: deemed_profit_info.or(deemed_digital.clone()).or(deemed_other.clone()),
        })
    } else {
        None
    };

    let deemed_p_flat = if !tiers.is_empty() {
        let sum: i64 = tiers.iter().filter_map(|t| t.deemed_profit).sum();
        if sum > 0 { Some(sum) } else { deemed_p }
    } else {
        deemed_p
    };

    let decl_p_flat = if !tiers.is_empty() {
        let sum: i64 = tiers.iter().filter_map(|t| t.declared_profit).sum();
        if sum > 0 { Some(sum) } else { decl_p }
    } else {
        decl_p
    };

    let turn_base_flat = if !tiers.is_empty() {
        let sum: i64 = tiers.iter().filter_map(|t| t.deemed_base_turnover).sum();
        if sum > 0 { Some(sum) } else { turn_base }
    } else {
        turn_base
    };

    let tax_bus_p_flat = section_total.or(decl_p_flat).or(tax_bus_p);

    let mut profits_and_gains_business_profession = if !tiers.is_empty() || section_total.is_some() || deemed_p_flat.is_some() || decl_p_flat.is_some() {
        Some(ProfitsAndGainsBusinessProfession {
            tiers,
            section_total: section_total.or(tax_bus_p_flat),
            deemed_profit_44ad: deemed_p_flat,
            declared_profit_44ad: decl_p_flat,
            turnover_base_44ad: turn_base_flat,
            taxable_business_profit: tax_bus_p_flat,
        })
    } else {
        None
    };

    if let Some(ref idbt) = income_declared_business_turnover {
        let decl_amt = idbt.net_profit_declared.as_ref().map(|p| p.amount);

        let pgbp = profits_and_gains_business_profession.get_or_insert_with(Default::default);
        if pgbp.tiers.is_empty() {
            if let Some(ref dig) = idbt.deemed_profit_digital_mode {
                let turnover = idbt.gross_receipts_digital_mode;
                let higher = decl_amt.or(Some(dig.amount));
                pgbp.tiers.push(PresumptiveTier {
                    presumptive_rate_pct: dig.rate_pct.or(Some(6.0)),
                    deemed_base_turnover: turnover,
                    deemed_profit: Some(dig.amount),
                    declared_profit: decl_amt,
                    profit_taken_higher_of_declared_or_deemed: higher,
                });
            }
            if let Some(ref oth) = idbt.deemed_profit_other_than_digital {
                let turnover = idbt.gross_receipts_other_than_digital;
                let higher = decl_amt.or(Some(oth.amount));
                pgbp.tiers.push(PresumptiveTier {
                    presumptive_rate_pct: oth.rate_pct.or(Some(8.0)),
                    deemed_base_turnover: turnover,
                    deemed_profit: Some(oth.amount),
                    declared_profit: decl_amt,
                    profit_taken_higher_of_declared_or_deemed: higher,
                });
            }
            if pgbp.tiers.is_empty() {
                let turnover = idbt.gross_receipts_total.or(idbt.gross_receipts_turnover);
                let deemed_amt = idbt.deemed_profit.as_ref().map(|p| p.amount);
                let deemed_rate = idbt.deemed_profit.as_ref().and_then(|p| p.rate_pct);
                if turnover.is_some() || deemed_amt.is_some() || decl_amt.is_some() {
                    let higher = match (decl_amt, deemed_amt) {
                        (Some(decl), Some(deem)) => Some(if decl >= deem { decl } else { deem }),
                        (Some(decl), None) => Some(decl),
                        (None, Some(deem)) => Some(deem),
                        _ => None,
                    };
                    pgbp.tiers.push(PresumptiveTier {
                        presumptive_rate_pct: deemed_rate.or(Some(8.0)),
                        deemed_base_turnover: turnover,
                        deemed_profit: deemed_amt,
                        declared_profit: decl_amt,
                        profit_taken_higher_of_declared_or_deemed: higher,
                    });
                }
            }
            let total_profit = decl_amt.or_else(|| {
                pgbp.tiers.iter().find_map(|t| t.profit_taken_higher_of_declared_or_deemed)
            });
            if pgbp.section_total.is_none() {
                pgbp.section_total = total_profit;
            }
            if pgbp.turnover_base_44ad.is_none() || pgbp.turnover_base_44ad == Some(0) {
                pgbp.turnover_base_44ad = idbt.gross_receipts_total.or(idbt.gross_receipts_turnover);
            }
            if pgbp.deemed_profit_44ad.is_none() {
                pgbp.deemed_profit_44ad = idbt.deemed_profit_digital_mode.as_ref().map(|p| p.amount).or_else(|| idbt.deemed_profit.as_ref().map(|p| p.amount));
            }
            if pgbp.declared_profit_44ad.is_none() {
                pgbp.declared_profit_44ad = decl_amt;
            }
        }
    }

    if let Some(ref mut pgbp) = profits_and_gains_business_profession {
        if pgbp.section_total.is_none() {
            pgbp.section_total = bus_total;
        }
    } else if let Some(bt) = bus_total {
        profits_and_gains_business_profession = Some(ProfitsAndGainsBusinessProfession {
            tiers: vec![],
            section_total: Some(bt),
            deemed_profit_44ad: None,
            declared_profit_44ad: Some(bt),
            turnover_base_44ad: final_gross_tot,
            taxable_business_profit: Some(bt),
        });
    }

    // single concise context line
    let slab_item_re = Regex::new(r"(?i)(TAX\s+ON\s+RS\.?\s*[\d,]+(?:\s*\([\d,]+\s*[-–]\s*[\d,]+\)\s*@\s*[\d\.]+%|\s*@\s*[\d\.]+%|\s+NIL)?)\s*[:=]?\s*([\d,]+)").unwrap();
    let tax_on_tot_re = Regex::new(r"(?i)TAX\s+ON\s+TOTAL\s+INCOME\s+RS\.?\s*(\(?.+?\)?)\s+([\d,]+)$").unwrap();
    let agri_reb_re = Regex::new(r"(?i)REBATE\s+OF\s+TAX\s+ON\s+AGRICULTURE\s+INCOME\s+RS\.?\s*(\(?.+?\)?)\s+([\d,]+)$").unwrap();
    let tax_after_agri_re = Regex::new(r"(?i)TAX\s+ON\s+RS\.?\s*[\d,]+\s+([\d,]+)$").unwrap();
    let challan_re = Regex::new(r"(?i)(.+?)\s*[-–]\s*(\d{5,7})\s*[-–]\s*(\d{4,8})\s*[-–]\s*([\d/-]+)\s+([\d,]+)").unwrap();

    let mut tax_slabs = Vec::new();
    let mut tot_tax_found = None;
    let mut tax_on_tot_amt = None;
    let mut tax_on_tot_desc = None;
    let mut agri_reb_amt = None;
    let mut agri_reb_desc = None;
    let mut tax_after_agri_amt = None;
    let mut self_assess_140a_amt = None;
    let mut self_assess_details = None;
    let mut fee_234f_amt = None;

    for (idx, line) in lines.iter().enumerate() {
        let t = line.text();
        let u = line.upper();

        if let Some(caps) = slab_item_re.captures(&t) {
            if let Some(amt) = parse_rupees(&caps[2]) {
                let slab_label = caps[1].trim();
                let upper_label = slab_label.to_ascii_uppercase();
                if upper_label.contains('@') || upper_label.contains('%') || upper_label.contains("NIL") || upper_label.contains('(') {
                    tax_slabs.push(TaxSlabItem {
                        slab: slab_label.to_string(),
                        tax_amount: amt,
                    });
                } else {
                    tot_tax_found = Some(amt);
                }
            }
        }

        if let Some(caps) = tax_on_tot_re.captures(&t) {
            if tax_on_tot_amt.is_none() {
                tax_on_tot_amt = parse_rupees(&caps[2]);
                tax_on_tot_desc = Some(format!("TAX ON TOTAL INCOME RS. {}", &caps[1]));
            }
        }

        if let Some(caps) = agri_reb_re.captures(&t) {
            if agri_reb_amt.is_none() {
                agri_reb_amt = parse_rupees(&caps[2]);
                let raw_desc = caps[1].trim();
                let desc_str = if raw_desc.starts_with('(') && !raw_desc.ends_with(')') {
                    format!("{raw_desc})")
                } else {
                    raw_desc.to_string()
                };
                agri_reb_desc = Some(format!("REBATE OF TAX ON AGRICULTURE INCOME RS. {desc_str}"));
            }
            for k in 1..=3 {
                if let Some(next_line) = lines.get(idx + k) {
                    if let Some(caps2) = tax_after_agri_re.captures(&next_line.text()) {
                        if tax_after_agri_amt.is_none() {
                            tax_after_agri_amt = parse_rupees(&caps2[1]);
                            break;
                        }
                    }
                }
            }
        }

        if u.contains("234F") && fee_234f_amt.is_none() {
            fee_234f_amt = line_amount(line);
        }

        if u.contains("140A") {
            if let Some(caps) = challan_re.captures(&t) {
                if self_assess_140a_amt.is_none() {
                    let amt = parse_rupees(&caps[5]).unwrap_or(0);
                    self_assess_140a_amt = Some(amt);
                    self_assess_details = Some(SelfAssessmentChallan {
                        bank_name: Some(caps[1].trim().to_string()),
                        bsr_code: Some(caps[2].trim().to_string()),
                        challan_no: Some(caps[3].trim().to_string()),
                        date: Some(caps[4].trim().to_string()),
                        amount: amt,
                    });
                }
            } else if let Some(next_line) = lines.get(idx + 1) {
                let nt = next_line.text();
                if let Some(caps) = challan_re.captures(&nt) {
                    if self_assess_140a_amt.is_none() {
                        let amt = parse_rupees(&caps[5]).unwrap_or(0);
                        self_assess_140a_amt = Some(amt);
                        self_assess_details = Some(SelfAssessmentChallan {
                            bank_name: Some(caps[1].trim().to_string()),
                            bsr_code: Some(caps[2].trim().to_string()),
                            challan_no: Some(caps[3].trim().to_string()),
                            date: Some(caps[4].trim().to_string()),
                            amount: amt,
                        });
                    }
                }
            }
        }
    }

    if tot_tax.is_none() {
        tot_tax = tot_tax_found;
    }

    let comp_tax_on_tot = if !tax_slabs.is_empty() || tot_tax.is_some() || tax_on_tot_amt.is_some() {
        let final_tax_after_reb = tax_after_reb.or_else(|| {
            match (tot_tax, rebate_87a) {
                (Some(t), Some(r)) => Some(t.saturating_sub(r)),
                (Some(t), None) => Some(t),
                _ => None,
            }
        });
        Some(ComputationOfTaxOnTotalIncome {
            tax_slabs,
            tax_on_total_income: tax_on_tot_amt,
            tax_on_total_income_description: tax_on_tot_desc,
            agriculture_tax_rebate: agri_reb_amt,
            agriculture_tax_rebate_description: agri_reb_desc,
            tax_after_agriculture_rebate: tax_after_agri_amt,
            total_tax: tot_tax,
            rebate_u_s_87a: rebate_87a,
            tax_after_rebate: final_tax_after_reb,
            fee_payable_u_s_234f: fee_234f_amt,
            self_assessment_tax_140a: self_assess_140a_amt,
            self_assessment_tax_details: self_assess_details,
        })
    } else {
        None
    };

    let tds_re = Regex::new(r"(?i)(?:SECTION\s+)?(194[A-Z0-9]*|206[A-Z0-9]*)\s*[:|-]?\s*(.+?)\s+([\d,]+)$").unwrap();
    let mut tax_deducted_at_source_list = Vec::new();
    let mut total_tds_sum: i64 = 0;

    for line in lines {
        let t = line.text();
        if let Some(caps) = tds_re.captures(&t) {
            if let Some(amt) = parse_rupees(&caps[3]) {
                tax_deducted_at_source_list.push(TdsDeductedItem {
                    section: caps[1].trim().to_string(),
                    description: caps[2].trim().to_string(),
                    amount: amt,
                });
                total_tds_sum += amt;
            }
        }
    }

    let total_tds_tcs = if total_tds_sum > 0 {
        Some(total_tds_sum)
    } else {
        tds_tcs_amt
    };

    let mut refund_amt = None;
    let mut refund_rounded = None;

    let explicit_refund_labels = [
        "REFUND RECIEVABLE",
        "REFUND RECEIVABLE",
        "REFUND DUE",
        "NET REFUND",
        "REFUNDABLE (ROUND OFF",
        "REFUNDABLE ROUND OFF",
        "TAX REFUNDABLE",
        "NET REFUNDABLE",
    ];

    for line in lines {
        let u = line.upper();
        if u.contains("INTEREST ON") {
            continue;
        }
        if explicit_refund_labels.iter().any(|lbl| u.contains(lbl)) {
            if let Some(amt) = line_amount(line) {
                if amt > 0 {
                    refund_amt = Some(amt);
                    refund_rounded = Some(amt);
                    break;
                }
            }
        }
    }

    if refund_amt.is_none() {
        for line in lines {
            let u = line.upper();
            if u.contains("INTEREST") {
                continue;
            }
            if u.contains("288B") || u.contains("288 B") {
                if refund_rounded.is_none() {
                    refund_rounded = line_amount(line);
                }
            } else if u.contains("REFUND") || u.contains("REFUNDABLE") {
                if refund_amt.is_none() {
                    refund_amt = line_amount(line);
                }
            }
        }
    }

    if refund_rounded.is_none() {
        refund_rounded = refund_amt;
    }
    if refund_amt.is_none() {
        refund_amt = refund_rounded;
    }

    let refund = if refund_amt.is_some() || refund_rounded.is_some() {
        Some(RefundDetails {
            amount: refund_amt,
            tax_refundable_rounded_off_u_s_288b: refund_rounded,
        })
    } else {
        None
    };

    let spec_note = lines.iter().find_map(|line| {
        let u = line.upper();
        if u.contains("SPECIAL RATE INCOME HAS NOT BEEN CONSIDERED") || u.contains("CHANGES MADE IN THE INCOME TAX LAW") {
            Some(line.text())
        } else {
            None
        }
    }).unwrap_or_else(|| "Special Rate income has not been considered while calculating rebate u/s 87A, as per the changes made in the Income Tax Law on 05/07/2024.".to_string());

    ComputationOfTotalIncome {
        tax_regime,
        assessment_year,
        salaries,
        profits_and_gains_business_profession,
        income_declared_business_turnover: income_declared_business_turnover.clone(),
        income_from_business_or_profession: bus_section,
        income_from_capital_gain: cg_section,
        income_from_other_sources: os_section,
        gross_total_income: gti,
        deductions: ded_section,
        total_income: tot_inc_details,
        total_income_rounded_288a: round_288a,
        total_income_rounded_off_u_s_288a: round_288a,
        exempt_income_sec_10: exempt_10,
        computation_of_tax_on_total_income: comp_tax_on_tot,
        tax_calculation: tax_calc,
        normal_income_tax_calculation: norm_tax_calc,
        tax_deducted_at_source_list,
        total_tds_tcs,
        refund,
        special_rate_income_note: Some(spec_note),
    }
}

fn tax_computation(lines: &[Line], computation: &coi_domain::Computation) -> TaxComputationContract {
    let slabs = lines.iter().filter_map(|line| {
        let upper = line.upper();
        if !upper.starts_with("TAX ON") && !upper.starts_with("TAX DUE") {
            return None;
        }
        if !upper.contains('@') && !upper.contains('%') && !upper.contains("NIL") {
            return None;
        }
        let text = line.text();
        let slab_amount = first_amount_after_tax_on(&text);
        let tax = if upper.contains("NIL") { 0 } else { line_amount(line).unwrap_or(0) };
        let category = classify_slab_category(&text);
        Some(TaxSlab {
            category,
            description: text,
            slab_upper_limit_or_amount: slab_amount,
            tax,
        })
    }).collect();

    let rebate_agri = labelled_amount(
        lines,
        &[
            "REBATE OF TAX ON AGRICULTURE INCOME",
            "AGRICULTURE INCOME REBATE",
            "AGRICULTURAL INCOME REBATE",
        ],
    );

    let fee_234f = labelled_amount(
        lines,
        &[
            "ADD: FEE PAYABLE U/S 234F",
            "FEE PAYABLE U/S 234F",
            "FEE U/S 234F",
            "FEE PAYABLE UNDER SECTION 234F",
        ],
    );

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
        if upper.contains("INTEREST") {
            return None;
        }
        (upper.contains("REFUNDABLE") || upper.contains("REFUND") || upper.contains("NET PAYABLE/REFUNDABLE"))
            .then(|| line_amount(line))
            .flatten()
    });

    TaxComputationContract {
        slabs,
        rebate_of_tax_on_agriculture_income: rebate_agri,
        rebate_87a,
        fee_payable_u_s_234f: fee_234f,
        refundable,
        tds,
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

// single concise context line
fn extract_balance_sheet_totals(lines: &[Line]) -> (Option<i64>, Option<i64>) {
    let mut left_total = None;
    let mut right_total = None;

    let ignored_labels = [
        "TOTAL INCOME",
        "GROSS TOTAL",
        "TOTAL DEDUCTIONS",
        "TOTAL TAX",
        "TOTAL ADVANCE",
        "TOTAL TDS",
        "TOTAL TCS",
        "ROUND OFF",
        "ROUNDED OFF",
        "TAXABLE INCOME",
    ];

    let bs_indicators = [
        "CAPITAL",
        "LIABILIT",
        "ASSET",
        "BALANCE SHEET",
    ];

    for line in lines {
        let upper = line.upper();
        if !upper.contains("TOTAL") {
            continue;
        }

        if ignored_labels.iter().any(|lbl| upper.contains(lbl)) {
            continue;
        }

        if !bs_indicators.iter().any(|lbl| upper.contains(lbl)) {
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

    let explicit_total_cap = find_value(&["TOTALCAPITALANDLIABILITIES", "TOTALCAPITAL", "LIABILITIESTOTAL", "TOTALLIABILITIES", "CAPITALANDLIABILITIESTOTAL"]);
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

// single concise context line
fn classify_slab_category(text: &str) -> Option<String> {
    let u = text.to_ascii_uppercase();
    if u.contains("111A") {
        Some("Special Rate u/s 111A @ 15%".to_string())
    } else if u.contains("112A") {
        Some("Special Rate u/s 112A @ 10%".to_string())
    } else if u.contains("112") {
        Some("Special Rate u/s 112 @ 20%".to_string())
    } else if u.contains("@ 5%") || u.contains("@5%") {
        Some("Normal Income Slab @ 5%".to_string())
    } else if u.contains("@ 10%") || u.contains("@10%") {
        Some("Normal Income Slab @ 10%".to_string())
    } else if u.contains("@ 15%") || u.contains("@15%") {
        Some("Normal Income Slab @ 15%".to_string())
    } else if u.contains("@ 20%") || u.contains("@20%") {
        Some("Normal Income Slab @ 20%".to_string())
    } else if u.contains("@ 30%") || u.contains("@30%") {
        Some("Normal Income Slab @ 30%".to_string())
    } else if u.contains("@ 0%") || u.contains("@0%") || u.contains("NIL") || u.contains("3,00,000") || u.contains("2,50,000") {
        Some("Normal Income Slab @ 0%".to_string())
    } else {
        None
    }
}

// single concise context line
fn first_amount_after_tax_on(text: &str) -> Option<i64> {
    let start = text.to_ascii_uppercase().find("TAX ON")?;
    let after = &text[start..];
    let re = Regex::new(r"(?i)(?:RS\.?\s*([0-9][0-9,]*)|TAX\s+ON\s+(?:[A-Z0-9\s/()\-+]+?\s+)?RS\.?\s*([0-9][0-9,]*)|TAX\s+ON\s+(?:RS\.?\s*)?([0-9][0-9,]*))").ok()?;
    if let Some(caps) = re.captures(after) {
        if let Some(m) = caps.get(1).or_else(|| caps.get(2)).or_else(|| caps.get(3)) {
            return parse_rupees(m.as_str());
        }
    }
    None
}

fn following_amount(lines: &[Line], index: usize, label: &str) -> Option<i64> {
    lines.iter().skip(index + 1).take(4).find_map(|line| {
        let upper = line.upper();
        if upper.contains("PROFIT DEEMED") { return None; }
        upper.contains(label).then(|| line_amount(line)).flatten()
    })
}

// single concise context line
pub fn parse_amount(text: &str) -> Option<i64> {
    let mut trimmed = text.trim();
    if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("NIL") || trimmed == "-" {
        return Some(0);
    }
    if trimmed.ends_with(|c: char| c.is_ascii_alphabetic()) {
        return None;
    }
    if let Some(dot_idx) = trimmed.rfind('.') {
        if dot_idx > 0 && trimmed[dot_idx + 1..].chars().all(|c| c.is_ascii_digit()) {
            trimmed = &trimmed[..dot_idx];
        }
    }
    let is_parenthesized = trimmed.starts_with('(') && trimmed.ends_with(')');
    let cleaned: String = trimmed
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '-')
        .collect();

    let val: i64 = cleaned.parse().ok()?;
    if is_parenthesized && val > 0 {
        Some(-val)
    } else if trimmed.ends_with('-') && val > 0 {
        Some(-val)
    } else {
        Some(val)
    }
}

fn line_amount(line: &Line) -> Option<i64> {
    line.segments.iter().rev().find_map(|segment| {
        parse_amount(segment).or_else(|| parse_rupees(segment))
    })
}

fn parse_rupees(text: &str) -> Option<i64> {
    if let Some(amt) = parse_amount(text) {
        return Some(amt);
    }
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
    fn extracts_tds_non_salary_and_serial_no() {
        let test_lines = lines(&[
            ("Details of Interest From Bank", ""),
            ("1. CANARA BANK", "1,801"),
            ("TOTAL", "1,801"),
            ("Details of Dividend From Shares", ""),
            ("1. BHARAT HEAVY ELECTRIALS LIMITED", "2"),
            ("TOTAL", "2"),
            ("Details of T.D.S. on Non-Salary", ""),
            ("1. XOTIK TRAVEL AND FOREX PRIVATE LIMITED", "50"),
            ("2. ASEGO TRAVEL LLP", "457"),
            ("TOTAL", "507"),
        ]);
        let detail = annexures(&test_lines);
        assert_eq!(detail.bank_interest_list.len(), 1);
        assert_eq!(detail.bank_interest_list[0].serial_no, Some(1));
        assert_eq!(detail.bank_interest_list[0].particulars, "CANARA BANK");
        assert_eq!(detail.bank_interest_list[0].amount, Some(1801));

        assert_eq!(detail.bank_interest_total, 1801);
        assert_eq!(detail.dividend_list.len(), 1);
        assert_eq!(detail.dividend_list[0].particulars, "BHARAT HEAVY ELECTRIALS LIMITED");
        assert_eq!(detail.dividend_total, 2);

        assert_eq!(detail.tsd_non_salary_list.len(), 2);
        assert_eq!(detail.tsd_non_salary_list[0].serial_no, Some(1));
        assert_eq!(detail.tsd_non_salary_list[0].particulars, "XOTIK TRAVEL AND FOREX PRIVATE LIMITED");
        assert_eq!(detail.tsd_non_salary_list[0].amount, Some(50));
        assert_eq!(detail.tsd_non_salary_list[1].serial_no, Some(2));
        assert_eq!(detail.tsd_non_salary_list[1].particulars, "ASEGO TRAVEL LLP");
        assert_eq!(detail.tsd_non_salary_list[1].amount, Some(457));
        assert_eq!(detail.tsd_non_salary_total, 507);
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

        assert_eq!(total_comp.total_income.as_ref().unwrap().income_exempt_u_s_10, Some(30850));
        assert_eq!(tax.rebate_87a, Some(21459));
        assert_eq!(tax.refundable, Some(-2489));
    }
}
