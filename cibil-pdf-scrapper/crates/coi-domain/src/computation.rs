use crate::money::Money;
use crate::years::YearRange;
use coi_layout::{Line, Table};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AssesseeDetails {
    pub name: Option<String>,
    pub fathers_name: Option<String>,
    pub address: Option<String>,
    pub email: Option<String>,
    pub status: Option<String>,
    pub pan: Option<String>,
    /// Always the redaction marker when an Aadhaar was present; never the digits.
    pub aadhaar: Option<String>,
    pub date_of_birth: Option<String>,
    pub residential_status: Option<String>,
    pub gender: Option<String>,
    pub ward: Option<String>,
    pub nature_of_business: Option<String>,
    pub filing_status: Option<String>,
    pub bank: Option<String>,
}

/// The five heads of income under the Income Tax Act, 1961.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct HeadsOfIncome {
    pub salary: Option<Money>,
    pub house_property: Option<Money>,
    pub business_profession: Option<Money>,
    pub capital_gains: Option<Money>,
    pub other_sources: Option<Money>,
}

impl HeadsOfIncome {
    pub fn all(&self) -> [&Option<Money>; 5] {
        [
            &self.salary,
            &self.house_property,
            &self.business_profession,
            &self.capital_gains,
            &self.other_sources,
        ]
    }

    /// Sum of the heads that were actually stated.
    ///
    /// An absent head is omitted, not treated as zero: "not reported" and
    /// "reported as nil" are different claims, and only the second is an assertion.
    pub fn sum(&self) -> i64 {
        self.all().iter().filter_map(|h| h.as_ref()).map(|m| m.paise).sum()
    }

    pub fn stated_count(&self) -> usize {
        self.all().iter().filter(|h| h.is_some()).count()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeductionItem {
    /// Section code as written, e.g. "80C", "80TTA".
    pub section: String,
    pub label: String,
    pub amount: Option<Money>,
    pub raw_line: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ChapterViaDeductions {
    pub items: Vec<DeductionItem>,
    /// The stated total, which may differ from the sum of items.
    pub total: Option<Money>,
}

impl ChapterViaDeductions {
    pub fn sum_items(&self) -> i64 {
        self.items.iter().filter_map(|d| d.amount.as_ref()).map(|m| m.paise).sum()
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TaxComputation {
    pub tax_due: Option<Money>,
    pub surcharge: Option<Money>,
    pub health_education_cess: Option<Money>,
    pub rebate_87a: Option<Money>,
    pub relief: Option<Money>,
    pub interest_234a: Option<Money>,
    pub interest_234b: Option<Money>,
    pub interest_234c: Option<Money>,
    pub total_tax: Option<Money>,
    pub net_tax_payable: Option<Money>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TaxCredits {
    pub tds: Option<Money>,
    pub tcs: Option<Money>,
    pub advance_tax: Option<Money>,
    /// Self-assessment tax deposited under section 140A.
    pub self_assessment_140a: Option<Money>,
}

impl TaxCredits {
    pub fn sum(&self) -> i64 {
        [&self.tds, &self.tcs, &self.advance_tax, &self.self_assessment_140a]
            .iter()
            .filter_map(|c| c.as_ref())
            .map(|m| m.paise)
            .sum()
    }
}

/// Everything read off the document, verbatim, alongside the parsed model.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawContent {
    pub page_count: u32,
    pub lines: Vec<Line>,
    /// The same content as a column grid, so a consumer can tell which column a
    /// figure was printed in rather than re-deriving it from coordinates.
    pub table: Table,
}

impl RawContent {
    pub fn full_text(&self) -> String {
        self.lines.iter().map(|l| l.text()).collect::<Vec<_>>().join("\n")
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Computation {
    pub source: String,
    pub format: String,
    /// "115BAC (New Tax Regime)" or "Old Regime" where the sheet declares one.
    pub regime: Option<String>,
    pub assessment_year: Option<YearRange>,
    pub financial_year: Option<YearRange>,
    /// "stated" when the sheet printed the FY, "derived" when it was inferred
    /// from the AY. Without this the AY/FY rule validates its own arithmetic.
    pub financial_year_source: Option<String>,
    pub assessee: AssesseeDetails,
    pub heads: HeadsOfIncome,
    pub gross_total_income: Option<Money>,
    pub deductions: ChapterViaDeductions,
    pub total_income: Option<Money>,
    pub rounded_total_income: Option<Money>,
    pub tax: TaxComputation,
    pub credits: TaxCredits,
    pub raw: RawContent,
}
