// Flat computation -> nested relational view.
//
// Every vendor in this corpus prints a head's total on the head line and its
// working on the lines beneath, down to the next head or the next summary row.
// That containment is the whole nesting rule; the slot tables below only name
// what each contained line turned out to be.

use crate::{heads, patterns};
use coi_domain::relational::{
    credits_from, BusinessDetail, CapitalGainsDetail, ChapterViA, Component, DeductionEntry,
    DocumentMetadata, HeadDetail, HeadKind, HousePropertyDetail, IncomeHead, OtherSourcesDetail,
    RelationalComputation, SalaryDetail, TaxMatrix, SCHEMA_VERSION,
};
use coi_domain::{Computation, Money};
use coi_layout::Line;

// A head's working never runs longer than this before the sheet moves on; the
// cap stops a missing boundary from swallowing the rest of the document.
const MAX_COMPONENT_LINES: usize = 40;

/// Summary rows that close a head's block. These carry a figure themselves, so
/// they end the block whether or not an amount is present.
const SUMMARY_BOUNDARIES: &[&str] = &[
    "GROSSTOTALINCOME",
    "TOTALINCOME",
    "CHAPTERVI-A",
    "CHAPTERVIA",
    "ROUNDOFF",
    "TAXDUE",
    "TAXPAYABLE",
    "TAXREFUNDABLE",
    // The running page header, which carries the assessee's PAN and a code that
    // parses as a figure.
    "NAMEOFASSESSEE",
];

/// Headings that start an annexure repeating figures already counted above.
const SECTION_BOUNDARIES: &[&str] = &[
    "TAXCALCULATION",
    "STATEMENTOF",
    "DETAILSOF",
    "DETAILOF",
    "ANNEXURE",
    "BANKACCOUNT",
    "GSTTURNOVER",
    "BALANCESHEET",
    "SIGNATURE",
    "COMPUTATIONOFTOTALINCOME",
];

/// Whether this row closes a head's block.
///
/// A section heading only counts as one when it carries no figure. Several
/// vendors label a data row "Interest on F.D.R.(as per Annexure)"; treating the
/// word as a heading there truncates the head at its first component and drops
/// the dividend and other-item lines beneath it.
fn is_boundary(upper: &str, has_amount: bool) -> bool {
    let squashed = upper.replace(' ', "");
    SUMMARY_BOUNDARIES.iter().any(|marker| squashed.contains(marker))
        || (!has_amount && SECTION_BOUNDARIES.iter().any(|marker| squashed.contains(marker)))
}

fn options_for(head: HeadKind) -> &'static [&'static str] {
    match head {
        HeadKind::Salary => patterns::SALARY,
        HeadKind::HouseProperty => patterns::HOUSE_PROPERTY,
        HeadKind::BusinessProfession => patterns::BUSINESS,
        HeadKind::CapitalGains => patterns::CAPITAL_GAINS,
        HeadKind::OtherSources => patterns::OTHER_SOURCES,
    }
}

fn anchors(lines: &[Line], head: HeadKind) -> Vec<usize> {
    lines
        .iter()
        .enumerate()
        .filter(|(_, line)| {
            let upper = line.upper();
            !patterns::is_slab_working(&upper) && patterns::matches_any(&upper, options_for(head))
        })
        .map(|(index, _)| index)
        .collect()
}

fn any_anchor(lines: &[Line], index: usize) -> bool {
    HeadKind::ALL.iter().any(|head| {
        let upper = lines[index].upper();
        !patterns::is_slab_working(&upper) && patterns::matches_any(&upper, options_for(*head))
    })
}

/// Slot tables, most specific first. "PROFIT DEEMED U/S 44AD @ 8%" names both a
/// deemed profit and section 44AD; the deemed reading is the correct one, so
/// order here is the classification rule, not presentation.
fn slot_for(head: HeadKind, upper: &str) -> Option<&'static str> {
    let table: &[(&str, &[&str])] = match head {
        HeadKind::Salary => &[
            ("standard_deduction_16ia", &["16(IA)", "STANDARD DEDUCTION"]),
            ("professional_tax_16iii", &["PROFESSIONAL TAX", "16(III)"]),
            ("gross_salary", &["GROSS SALARY"]),
            ("taxable_salary", &["TAXABLE SALARY", "NET SALARY"]),
            ("perquisites", &["PERQUISITE"]),
            ("hra", &["H.R.A", "HOUSE RENT ALLOWANCE", "HRA"]),
            ("allowances", &["ALLOWANCE"]),
            ("basic", &["BASIC"]),
        ],
        HeadKind::HouseProperty => &[
            ("interest_24b", &["24(B)", "INTEREST ON BORROWED", "INTEREST ON HOUSING", "HOUSING LOAN"]),
            ("standard_deduction_24a", &["24(A)", "STANDARD DEDUCTION", "30%"]),
            ("municipal_tax", &["MUNICIPAL TAX", "MUNICIPAL"]),
            ("annual_value", &["ANNUAL VALUE", "ANNUAL LETTABLE"]),
        ],
        HeadKind::BusinessProfession => &[
            ("presumptive_44ada", &["44ADA"]),
            ("presumptive_44ae", &["44AE"]),
            ("deemed_profit", &["DEEMED PROFIT", "PROFIT DEEMED"]),
            ("assessable_profit", &["HIGHER OF THE ABOVE"]),
            ("book_profit", &["BOOK PROFIT", "PROFIT AND LOSS", "PROFIT & LOSS"]),
            ("net_profit", &["NET PROFIT", "PROFIT DECLARED"]),
            ("gross_receipts", &["GROSS RECEIPT", "TURNOVER"]),
            ("depreciation", &["DEPRECIATION"]),
            ("presumptive_44ad", &["44AD"]),
        ],
        HeadKind::CapitalGains => &[
            ("brought_forward_loss", &["BROUGHT FORWARD", "B/F LOSS"]),
            ("long_term_112a", &["112A"]),
            ("short_term_111a", &["111A", "@ 15%", "@15%"]),
            ("long_term", &["LONG TERM"]),
            ("short_term", &["SHORT TERM"]),
        ],
        HeadKind::OtherSources => &[
            ("income_tax_refund_interest", &["INCOME TAX REFUND", "IT REFUND", "I.T. REFUND"]),
            ("savings_bank_interest", &["SAVING BANK", "SAVINGS BANK", "SAVING A/C"]),
            ("fixed_deposit_interest", &["F.D.R", "FDR", "FIXED DEPOSIT", "TIME-DEPOSIT", "TIME DEPOSIT"]),
            ("dividend", &["DIVIDEND"]),
            ("family_pension", &["FAMILY PENSION"]),
            ("agricultural_income", &["AGRICULTURE", "AGRICULTURAL"]),
            ("other", &["OTHER ITEM"]),
        ],
    };

    let squashed = upper.replace(' ', "");
    table
        .iter()
        .find(|(_, keywords)| keywords.iter().any(|k| squashed.contains(&k.replace(' ', ""))))
        .map(|(slot, _)| *slot)
}

fn components_for(lines: &[Line], head: HeadKind) -> Vec<Component> {
    let mut out: Vec<Component> = Vec::new();

    for anchor in anchors(lines, head) {
        for index in (anchor + 1)..lines.len().min(anchor + 1 + MAX_COMPONENT_LINES) {
            let line = &lines[index];
            let upper = line.upper();
            let label = line.segments.first().cloned().unwrap_or_default();
            let amount = heads::amount_on_line(line, &label.to_ascii_uppercase());

            if is_boundary(&upper, amount.is_some()) || any_anchor(lines, index) {
                break;
            }
            let slot = slot_for(head, &upper);
            // A line with neither a figure nor a recognised name carries nothing
            // a relational consumer can use; it survives in `raw.lines` regardless.
            if amount.is_none() && slot.is_none() {
                continue;
            }

            let raw_line = line.text();
            if out.iter().any(|c| c.raw_line == raw_line) {
                continue;
            }
            out.push(Component { label, amount, slot: slot.map(String::from), page: line.page, raw_line });
        }
    }
    out
}

/// First component filling a slot. First, not last: sheets repeat a figure in
/// annexures further down, and the head's own block is the authoritative one.
fn slot_value(components: &[Component], slot: &str) -> Option<Money> {
    components
        .iter()
        .find(|c| c.slot.as_deref() == Some(slot))
        .and_then(|c| c.amount.clone())
}

fn detail_for(head: HeadKind, components: &[Component], lines: &[Line]) -> HeadDetail {
    let value = |slot: &str| slot_value(components, slot);
    match head {
        HeadKind::Salary => HeadDetail::Salary(SalaryDetail {
            gross_salary: value("gross_salary"),
            basic: value("basic"),
            hra: value("hra"),
            allowances: value("allowances"),
            perquisites: value("perquisites"),
            standard_deduction_16ia: value("standard_deduction_16ia"),
            professional_tax_16iii: value("professional_tax_16iii"),
            taxable_salary: value("taxable_salary"),
        }),
        HeadKind::HouseProperty => HeadDetail::HouseProperty(HousePropertyDetail {
            occupancy: occupancy(lines),
            annual_value: value("annual_value"),
            municipal_tax: value("municipal_tax"),
            standard_deduction_24a: value("standard_deduction_24a"),
            interest_24b: value("interest_24b"),
        }),
        HeadKind::BusinessProfession => HeadDetail::BusinessProfession(BusinessDetail {
            gross_receipts: value("gross_receipts"),
            book_profit: value("book_profit"),
            deemed_profit: value("deemed_profit"),
            net_profit: value("net_profit"),
            assessable_profit: value("assessable_profit"),
            depreciation: value("depreciation"),
            presumptive_44ad: value("presumptive_44ad"),
            presumptive_44ada: value("presumptive_44ada"),
            presumptive_44ae: value("presumptive_44ae"),
        }),
        HeadKind::CapitalGains => HeadDetail::CapitalGains(CapitalGainsDetail {
            short_term: value("short_term"),
            short_term_111a: value("short_term_111a"),
            long_term: value("long_term"),
            long_term_112a: value("long_term_112a"),
            brought_forward_loss: value("brought_forward_loss"),
        }),
        HeadKind::OtherSources => HeadDetail::OtherSources(OtherSourcesDetail {
            savings_bank_interest: value("savings_bank_interest"),
            fixed_deposit_interest: value("fixed_deposit_interest"),
            dividend: value("dividend"),
            income_tax_refund_interest: value("income_tax_refund_interest"),
            family_pension: value("family_pension"),
            agricultural_income: value("agricultural_income"),
            other: value("other"),
        }),
    }
}

fn occupancy(lines: &[Line]) -> Option<String> {
    lines.iter().find_map(|line| {
        let upper = line.upper();
        if upper.contains("SELF OCCUPIED") || upper.contains("SELF-OCCUPIED") {
            Some("self_occupied".to_string())
        } else if upper.contains("LET OUT") || upper.contains("LET-OUT") {
            Some("let_out".to_string())
        } else {
            None
        }
    })
}

/// Deduction rows, split into the gross and deductible columns where the sheet
/// prints both. Under section 80 the two differ (80G at 50%, 80TTA capped at
/// 10,000), and only the deductible figure reduces total income.
fn chapter_vi_a(computation: &Computation) -> ChapterViA {
    let lines = &computation.raw.lines;
    let entries: Vec<DeductionEntry> = computation
        .deductions
        .items
        .iter()
        .map(|item| {
            let amounts: Vec<Money> = lines
                .iter()
                .find(|line| line.text() == item.raw_line)
                .map(|line| line.segments.iter().skip(1).filter_map(|s| Money::parse(s)).collect())
                .unwrap_or_default();

            let (gross, deductible) = match amounts.len() {
                0 => (None, item.amount.clone()),
                1 => (None, Some(amounts[0].clone())),
                _ => (Some(amounts[0].clone()), amounts.last().cloned()),
            };
            DeductionEntry {
                section: item.section.clone(),
                label: item.label.clone(),
                gross_amount: gross,
                deductible_amount: deductible,
                raw_line: item.raw_line.clone(),
            }
        })
        .collect();

    let sum_of_entries =
        entries.iter().filter_map(|e| e.deductible_amount.as_ref()).map(|m| m.paise).sum();

    ChapterViA {
        entries,
        total_claimed: computation.deductions.total.clone(),
        sum_of_entries,
    }
}

fn refundable(lines: &[Line]) -> Option<Money> {
    lines.iter().find_map(|line| {
        let upper = line.upper();
        upper.contains("REFUNDABLE").then(|| {
            let label = line.segments.first().cloned().unwrap_or_default();
            heads::amount_on_line(line, &label.to_ascii_uppercase())
        })?
        // A refund is printed as "(90)" to mark the sign flip, not a negative.
        .map(|money| Money::from_paise(money.paise.abs(), money.raw))
    })
}

/// Build the nested view. `dom_table_count` is how many tagged tables the
/// generator declared; zero means the grid came from glyph positions instead.
pub fn to_relational(computation: &Computation, dom_table_count: usize) -> RelationalComputation {
    let lines = &computation.raw.lines;

    let income_heads = HeadKind::ALL
        .iter()
        .map(|head| {
            let components = components_for(lines, *head);
            let total = match head {
                HeadKind::Salary => computation.heads.salary.clone(),
                HeadKind::HouseProperty => computation.heads.house_property.clone(),
                HeadKind::BusinessProfession => computation.heads.business_profession.clone(),
                HeadKind::CapitalGains => computation.heads.capital_gains.clone(),
                HeadKind::OtherSources => computation.heads.other_sources.clone(),
            };
            IncomeHead {
                head: *head,
                chapter: head.chapter().to_string(),
                reported: total.is_some() || !components.is_empty(),
                total,
                detail: detail_for(*head, &components, lines),
                components,
            }
        })
        .collect();

    let deductions = chapter_vi_a(computation);

    RelationalComputation {
        metadata: DocumentMetadata {
            source: computation.source.clone(),
            format: computation.format.clone(),
            page_count: computation.raw.page_count,
            schema_version: SCHEMA_VERSION.to_string(),
            structure_source: if dom_table_count > 0 { "tagged_dom" } else { "layout_grid" }
                .to_string(),
            dom_table_count,
            assessment_year: computation.assessment_year,
            financial_year: computation.financial_year,
            financial_year_source: computation.financial_year_source.clone(),
            regime: computation.regime.clone(),
        },
        assessee: computation.assessee.clone(),
        income_heads,
        tax_computation: TaxMatrix {
            gross_total_income: computation.gross_total_income.clone(),
            total_deductions: deductions.total_claimed.clone(),
            total_income: computation.total_income.clone(),
            rounded_total_income: computation.rounded_total_income.clone(),
            tax_on_total_income: computation.tax.tax_due.clone(),
            rebate_87a: computation.tax.rebate_87a.clone(),
            surcharge: computation.tax.surcharge.clone(),
            health_education_cess: computation.tax.health_education_cess.clone(),
            relief_89: computation.tax.relief.clone(),
            interest_234a: computation.tax.interest_234a.clone(),
            interest_234b: computation.tax.interest_234b.clone(),
            interest_234c: computation.tax.interest_234c.clone(),
            total_tax: computation.tax.total_tax.clone(),
            credits: credits_from(computation),
            net_tax_payable: computation.tax.net_tax_payable.clone(),
            refundable: refundable(lines),
        },
        chapter_vi_a: deductions,
    }
}

#[cfg(test)]
mod tests {
    use super::{slot_for, to_relational};
    use coi_core::{BoundingBox, TextRun};
    use coi_domain::relational::{HeadDetail, HeadKind};

    fn parse(rows: &[(&str, &str)]) -> coi_domain::Computation {
        let runs: Vec<TextRun<'static>> = rows
            .iter()
            .enumerate()
            .flat_map(|(row, (label, amount))| {
                let y = 100.0 + row as f32 * 20.0;
                let mut cells = vec![TextRun::new(
                    label.to_string(),
                    BoundingBox::new(48.0, y, 300.0, 10.0),
                    1,
                )];
                if !amount.is_empty() {
                    cells.push(TextRun::new(
                        amount.to_string(),
                        BoundingBox::new(480.0, y, 60.0, 10.0),
                        1,
                    ));
                }
                cells
            })
            .collect();
        crate::parse_computation("t.pdf", "Pdf", &runs, 1).expect("parses")
    }

    #[test]
    fn a_head_nests_the_lines_printed_beneath_it() {
        let computation = parse(&[
            ("Income from Business or Profession (Chapter IV D)", "1,86,913"),
            ("Income u/s 44AD", "1,86,913"),
            ("Income from Other Sources (Chapter IV F)", "4,88,370"),
            ("Interest From Saving Bank A/c", "418"),
            ("Interest on F.D.R.", "7,951"),
            ("Dividend From Shares", "1"),
            ("Gross Total Income", "6,75,283"),
        ]);
        let relational = to_relational(&computation, 0);

        let business = relational.head(HeadKind::BusinessProfession).expect("business head");
        assert_eq!(business.total.as_ref().unwrap().paise, 18_691_300);
        let HeadDetail::BusinessProfession(detail) = &business.detail else { panic!("wrong detail") };
        assert_eq!(detail.presumptive_44ad.as_ref().unwrap().paise, 18_691_300);

        let other = relational.head(HeadKind::OtherSources).expect("other sources head");
        let HeadDetail::OtherSources(detail) = &other.detail else { panic!("wrong detail") };
        assert_eq!(detail.savings_bank_interest.as_ref().unwrap().paise, 41_800);
        assert_eq!(detail.fixed_deposit_interest.as_ref().unwrap().paise, 795_100);
        assert_eq!(detail.dividend.as_ref().unwrap().paise, 100);
    }

    #[test]
    fn a_head_block_stops_at_the_next_head() {
        // Without the boundary the savings interest would be nested under
        // business income, and the business head would cross-foot wrong.
        let computation = parse(&[
            ("Income from Business or Profession (Chapter IV D)", "1,86,913"),
            ("Income u/s 44AD", "1,86,913"),
            ("Income from Other Sources (Chapter IV F)", "418"),
            ("Interest From Saving Bank A/c", "418"),
        ]);
        let relational = to_relational(&computation, 0);

        let business = relational.head(HeadKind::BusinessProfession).expect("business head");
        assert_eq!(business.components.len(), 1);
        assert_eq!(business.components[0].slot.as_deref(), Some("presumptive_44ad"));
    }

    #[test]
    fn an_annexure_reference_in_a_label_does_not_close_the_head() {
        // "(as per Annexure)" is a pointer on a data row, not a section heading.
        // Reading it as one ended the head at its first component and lost the
        // FDR interest, the dividend and the other-item line beneath it.
        let computation = parse(&[
            ("Income from Other Sources (Chapter IV F)", "4,88,370"),
            ("Interest From Saving Bank A/c (as per Annexure)", "418"),
            ("Interest on F.D.R.(as per Annexure)", "7,951"),
            ("Other Item", "4,80,000"),
            ("Dividend From Shares", "1"),
            ("Gross Total Income", "6,75,283"),
        ]);
        let relational = to_relational(&computation, 0);

        let HeadDetail::OtherSources(detail) = &relational.head(HeadKind::OtherSources).unwrap().detail
        else {
            panic!("wrong detail")
        };
        assert_eq!(detail.fixed_deposit_interest.as_ref().unwrap().paise, 795_100);
        assert_eq!(detail.dividend.as_ref().unwrap().paise, 100);
        assert_eq!(detail.other.as_ref().unwrap().paise, 48_000_000);
    }

    #[test]
    fn an_annexure_heading_still_closes_the_head() {
        // The same word with no figure on the row is a genuine heading, and the
        // rows under it repeat figures already counted above.
        let computation = parse(&[
            ("Income from Other Sources (Chapter IV F)", "418"),
            ("Details of Interest From Bank", ""),
            ("Dividend From Shares", "1"),
        ]);
        let relational = to_relational(&computation, 0);

        let HeadDetail::OtherSources(detail) = &relational.head(HeadKind::OtherSources).unwrap().detail
        else {
            panic!("wrong detail")
        };
        assert!(detail.dividend.is_none(), "an annexure row was counted as a component");
    }

    #[test]
    fn an_unreported_head_is_absent_not_zero() {
        let computation = parse(&[("Income from Other Sources (Chapter IV F)", "623")]);
        let relational = to_relational(&computation, 0);

        let salary = relational.head(HeadKind::Salary).expect("salary head is always listed");
        assert!(!salary.reported);
        assert!(salary.total.is_none(), "a head nobody reported must not read as nil");
    }

    #[test]
    fn a_deemed_profit_is_not_read_as_presumptive_income() {
        // "PROFIT DEEMED U/S 44AD @ 8% OF RS. x" names both; it is the deemed
        // figure, and reading it as the declared 44AD income overstates income.
        assert_eq!(
            slot_for(HeadKind::BusinessProfession, "PROFIT DEEMED U/S 44AD @ 8% OF RS. 21,37,638"),
            Some("deemed_profit")
        );
        assert_eq!(slot_for(HeadKind::BusinessProfession, "INCOME U/S 44AD"), Some("presumptive_44ad"));
    }

    #[test]
    fn salary_working_lines_fill_their_named_slots() {
        let computation = parse(&[
            ("SALARIES", "5,76,000"),
            ("GROSS SALARY", "6,51,000"),
            ("LESS: STANDARD DEDUCTION U/S 16(ia)", "75,000"),
            ("TAXABLE SALARY", "5,76,000"),
        ]);
        let relational = to_relational(&computation, 0);

        let HeadDetail::Salary(detail) = &relational.head(HeadKind::Salary).unwrap().detail else {
            panic!("wrong detail")
        };
        assert_eq!(detail.gross_salary.as_ref().unwrap().paise, 65_100_000);
        assert_eq!(detail.standard_deduction_16ia.as_ref().unwrap().paise, 7_500_000);
        assert_eq!(detail.taxable_salary.as_ref().unwrap().paise, 57_600_000);
    }
}
