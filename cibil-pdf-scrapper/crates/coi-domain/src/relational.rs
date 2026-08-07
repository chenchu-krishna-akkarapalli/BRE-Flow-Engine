// The nested relational view of a computation sheet.
//
// The flat `Computation` answers "what is the salary figure"; this answers
// "what did the sheet say the salary was made of". Every component line is
// retained whether or not it maps to a named slot, so nothing is lost to a
// vendor wording the classifier has not seen.

use crate::computation::{AssesseeDetails, Computation};
use crate::money::Money;
use crate::years::YearRange;
use serde::{Deserialize, Serialize};

pub const SCHEMA_VERSION: &str = "1.0";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HeadKind {
    Salary,
    HouseProperty,
    BusinessProfession,
    CapitalGains,
    OtherSources,
}

impl HeadKind {
    pub const ALL: [HeadKind; 5] = [
        HeadKind::Salary,
        HeadKind::HouseProperty,
        HeadKind::BusinessProfession,
        HeadKind::CapitalGains,
        HeadKind::OtherSources,
    ];

    /// The Chapter IV sub-part the head sits under, which several vendors print
    /// instead of the head's name and which disambiguates the rest.
    pub fn chapter(&self) -> &'static str {
        match self {
            HeadKind::Salary => "IV A",
            HeadKind::HouseProperty => "IV C",
            HeadKind::BusinessProfession => "IV D",
            HeadKind::CapitalGains => "IV E",
            HeadKind::OtherSources => "IV F",
        }
    }
}

/// One line printed under a head, with the slot it was recognised as.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Component {
    pub label: String,
    pub amount: Option<Money>,
    /// The named field this line filled, or None when it is unclassified but retained.
    pub slot: Option<String>,
    pub page: u32,
    pub raw_line: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SalaryDetail {
    pub gross_salary: Option<Money>,
    pub basic: Option<Money>,
    pub hra: Option<Money>,
    pub allowances: Option<Money>,
    pub perquisites: Option<Money>,
    /// Standard deduction under section 16(ia).
    pub standard_deduction_16ia: Option<Money>,
    pub professional_tax_16iii: Option<Money>,
    pub taxable_salary: Option<Money>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct HousePropertyDetail {
    /// "self_occupied" or "let_out" where the sheet declares it.
    pub occupancy: Option<String>,
    pub annual_value: Option<Money>,
    pub municipal_tax: Option<Money>,
    pub standard_deduction_24a: Option<Money>,
    /// Interest on borrowed capital, section 24(b).
    pub interest_24b: Option<Money>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BusinessDetail {
    pub gross_receipts: Option<Money>,
    pub book_profit: Option<Money>,
    pub deemed_profit: Option<Money>,
    pub net_profit: Option<Money>,
    /// The figure actually charged under 44AD: the higher of the deemed and the
    /// declared profit, which the uppercase dialect prints as its own row.
    pub assessable_profit: Option<Money>,
    pub depreciation: Option<Money>,
    pub presumptive_44ad: Option<Money>,
    pub presumptive_44ada: Option<Money>,
    pub presumptive_44ae: Option<Money>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CapitalGainsDetail {
    pub short_term: Option<Money>,
    /// STCG on listed securities charged under section 111A.
    pub short_term_111a: Option<Money>,
    pub long_term: Option<Money>,
    /// LTCG on listed securities charged under section 112A.
    pub long_term_112a: Option<Money>,
    pub brought_forward_loss: Option<Money>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct OtherSourcesDetail {
    pub savings_bank_interest: Option<Money>,
    pub fixed_deposit_interest: Option<Money>,
    pub dividend: Option<Money>,
    pub income_tax_refund_interest: Option<Money>,
    pub family_pension: Option<Money>,
    pub agricultural_income: Option<Money>,
    pub other: Option<Money>,
}

/// Named sub-fields per head. Tagged by `head` so a consumer can match on it
/// without inspecting which keys happen to be present.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "head", rename_all = "snake_case")]
pub enum HeadDetail {
    Salary(SalaryDetail),
    HouseProperty(HousePropertyDetail),
    BusinessProfession(BusinessDetail),
    CapitalGains(CapitalGainsDetail),
    OtherSources(OtherSourcesDetail),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IncomeHead {
    pub head: HeadKind,
    pub chapter: String,
    /// True when the sheet printed this head at all. A head that is absent is
    /// not a head reported as nil, and a consumer must be able to tell them apart.
    pub reported: bool,
    pub total: Option<Money>,
    pub detail: HeadDetail,
    pub components: Vec<Component>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeductionEntry {
    pub section: String,
    pub label: String,
    pub gross_amount: Option<Money>,
    pub deductible_amount: Option<Money>,
    pub raw_line: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ChapterViA {
    pub entries: Vec<DeductionEntry>,
    /// The total the sheet stated, which is authoritative even where it differs
    /// from the sum of the entries this parser recovered.
    pub total_claimed: Option<Money>,
    pub sum_of_entries: i64,
}

/// The tax working, in the order the Act applies it.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TaxMatrix {
    pub gross_total_income: Option<Money>,
    pub total_deductions: Option<Money>,
    pub total_income: Option<Money>,
    pub rounded_total_income: Option<Money>,
    pub tax_on_total_income: Option<Money>,
    pub rebate_87a: Option<Money>,
    pub surcharge: Option<Money>,
    pub health_education_cess: Option<Money>,
    pub relief_89: Option<Money>,
    pub interest_234a: Option<Money>,
    pub interest_234b: Option<Money>,
    pub interest_234c: Option<Money>,
    pub total_tax: Option<Money>,
    pub credits: TaxCreditLines,
    pub net_tax_payable: Option<Money>,
    pub refundable: Option<Money>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TaxCreditLines {
    pub tds: Option<Money>,
    pub tcs: Option<Money>,
    pub advance_tax: Option<Money>,
    pub self_assessment_140a: Option<Money>,
    pub total: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentMetadata {
    pub source: String,
    pub format: String,
    pub page_count: u32,
    pub schema_version: String,
    /// "tagged_dom" where the generator wrote a structure tree, "layout_grid"
    /// where the column grid had to be recovered from glyph positions.
    pub structure_source: String,
    pub dom_table_count: usize,
    pub assessment_year: Option<YearRange>,
    pub financial_year: Option<YearRange>,
    pub financial_year_source: Option<String>,
    pub regime: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelationalComputation {
    pub metadata: DocumentMetadata,
    pub assessee: AssesseeDetails,
    pub income_heads: Vec<IncomeHead>,
    pub chapter_vi_a: ChapterViA,
    pub tax_computation: TaxMatrix,
}

impl RelationalComputation {
    /// Sum of the heads the sheet actually reported, in paise.
    pub fn reported_income(&self) -> i64 {
        self.income_heads.iter().filter_map(|h| h.total.as_ref()).map(|m| m.paise).sum()
    }

    pub fn head(&self, kind: HeadKind) -> Option<&IncomeHead> {
        self.income_heads.iter().find(|h| h.head == kind)
    }
}

/// The credit lines and their total, lifted from the flat model.
pub fn credits_from(computation: &Computation) -> TaxCreditLines {
    let credits = &computation.credits;
    TaxCreditLines {
        tds: credits.tds.clone(),
        tcs: credits.tcs.clone(),
        advance_tax: credits.advance_tax.clone(),
        self_assessment_140a: credits.self_assessment_140a.clone(),
        total: credits.sum(),
    }
}
