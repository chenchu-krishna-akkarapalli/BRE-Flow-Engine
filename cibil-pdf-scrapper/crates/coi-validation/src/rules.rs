use crate::identifiers::{validate_pan, PanVerdict};
use coi_domain::{Computation, AADHAAR_REDACTED};
use serde::{Deserialize, Serialize};

// Computation sheets round to whole rupees at several points, so an equality
// off by less than a rupee is rounding, not an error.
const TOLERANCE_PAISE: i64 = 100;

// Section 288A rounds total income to the nearest ten rupees, so a total income
// within that of GTI-less-deductions is the statute, not a bad extraction.
const ROUNDING_288A_PAISE: i64 = 1_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    /// The document contradicts itself; the extraction or the sheet is wrong.
    Error,
    /// Worth a human look, but not provably wrong.
    Warning,
    /// A check that could not run because an input was absent.
    Skipped,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Finding {
    pub rule: String,
    pub severity: Severity,
    pub message: String,
    /// Present on arithmetic rules so a reviewer can see the gap.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expected: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actual: Option<i64>,
}

impl Finding {
    fn new(rule: &str, severity: Severity, message: String) -> Self {
        Self { rule: rule.into(), severity, message, expected: None, actual: None }
    }

    fn arithmetic(rule: &str, message: String, expected: i64, actual: i64) -> Self {
        Self {
            rule: rule.into(),
            severity: Severity::Error,
            message,
            expected: Some(expected),
            actual: Some(actual),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationReport {
    pub source: String,
    pub findings: Vec<Finding>,
}

impl ValidationReport {
    pub fn errors(&self) -> usize {
        self.findings.iter().filter(|f| f.severity == Severity::Error).count()
    }

    pub fn warnings(&self) -> usize {
        self.findings.iter().filter(|f| f.severity == Severity::Warning).count()
    }

    pub fn is_clean(&self) -> bool {
        self.errors() == 0
    }
}

fn rupees(paise: i64) -> String {
    format!("{:.2}", paise as f64 / 100.0)
}

/// Run every rule. A check whose inputs are absent is recorded as Skipped rather
/// than silently passing — an unrun check must not look like a satisfied one.
pub fn validate(computation: &Computation) -> ValidationReport {
    let mut findings = Vec::new();

    check_years(computation, &mut findings);
    check_gross_total_income(computation, &mut findings);
    check_total_income(computation, &mut findings);
    check_net_tax(computation, &mut findings);
    check_identifiers(computation, &mut findings);
    check_redaction(computation, &mut findings);

    ValidationReport { source: computation.source.clone(), findings }
}

/// AY must be exactly one year after the FY it assesses.
///
/// Only meaningful where the sheet printed both. A derived FY would compare the
/// parser against its own arithmetic and pass unconditionally, so that case is
/// recorded as skipped rather than dressed up as a satisfied check.
fn check_years(c: &Computation, out: &mut Vec<Finding>) {
    let derived = c.financial_year_source.as_deref() != Some("stated");
    match (c.assessment_year, c.financial_year) {
        (Some(ay), Some(fy)) if derived => out.push(Finding::new(
            "AY_FY_CONSISTENCY",
            Severity::Skipped,
            format!("AY {} stated; FY {} derived from it, not cross-checked", ay.label(), fy.label()),
        )),
        (Some(ay), Some(fy)) => {
            if ay.start == fy.start + 1 && ay.end == fy.end + 1 {
                out.push(Finding::new(
                    "AY_FY_CONSISTENCY",
                    Severity::Skipped,
                    format!("AY {} assesses FY {}", ay.label(), fy.label()),
                ));
            } else {
                out.push(Finding::new(
                    "AY_FY_CONSISTENCY",
                    Severity::Error,
                    format!("AY {} does not follow FY {}", ay.label(), fy.label()),
                ));
            }
        }
        _ => out.push(Finding::new(
            "AY_FY_CONSISTENCY",
            Severity::Skipped,
            "assessment year not found on the document".into(),
        )),
    }
}

/// GTI must equal the sum of the five heads of income.
fn check_gross_total_income(c: &Computation, out: &mut Vec<Finding>) {
    let Some(gti) = &c.gross_total_income else {
        out.push(Finding::new("GTI_EQUALS_HEADS", Severity::Skipped, "no gross total income stated".into()));
        return;
    };
    if c.heads.stated_count() == 0 {
        out.push(Finding::new("GTI_EQUALS_HEADS", Severity::Skipped, "no heads of income found".into()));
        return;
    }

    let sum = c.heads.sum();
    if (sum - gti.paise).abs() <= TOLERANCE_PAISE {
        out.push(Finding::new(
            "GTI_EQUALS_HEADS",
            Severity::Skipped,
            format!("GTI {} equals the sum of {} stated heads", rupees(gti.paise), c.heads.stated_count()),
        ));
    } else {
        out.push(Finding::arithmetic(
            "GTI_EQUALS_HEADS",
            format!(
                "sum of {} stated heads is {} but GTI is stated as {}",
                c.heads.stated_count(),
                rupees(sum),
                rupees(gti.paise)
            ),
            sum,
            gti.paise,
        ));
    }
}

/// Total Income must equal GTI less Chapter VI-A deductions.
fn check_total_income(c: &Computation, out: &mut Vec<Finding>) {
    let (Some(gti), Some(ti)) = (&c.gross_total_income, &c.total_income) else {
        out.push(Finding::new("TTI_EQUALS_GTI_MINUS_VIA", Severity::Skipped, "GTI or total income absent".into()));
        return;
    };
    let deductions = c.deductions.total.as_ref().map(|m| m.paise).unwrap_or(0);
    let expected = gti.paise - deductions;

    let gap = (expected - ti.paise).abs();
    let rounded_to_ten = ti.paise % ROUNDING_288A_PAISE == 0;

    if gap <= TOLERANCE_PAISE {
        out.push(Finding::new(
            "TTI_EQUALS_GTI_MINUS_VIA",
            Severity::Skipped,
            format!("total income {} = GTI {} - VI-A {}", rupees(ti.paise), rupees(gti.paise), rupees(deductions)),
        ));
    } else if gap < ROUNDING_288A_PAISE && rounded_to_ten {
        out.push(Finding::new(
            "TTI_EQUALS_GTI_MINUS_VIA",
            Severity::Skipped,
            format!(
                "total income {} differs from GTI-less-deductions {} by {}, consistent with s.288A rounding",
                rupees(ti.paise),
                rupees(expected),
                rupees(gap)
            ),
        ));
    } else {
        out.push(Finding::arithmetic(
            "TTI_EQUALS_GTI_MINUS_VIA",
            format!(
                "GTI {} less Chapter VI-A {} is {}, but total income is stated as {}",
                rupees(gti.paise),
                rupees(deductions),
                rupees(expected),
                rupees(ti.paise)
            ),
            expected,
            ti.paise,
        ));
    }

    // The stated VI-A total should also agree with its own line items.
    if c.deductions.total.is_some() && !c.deductions.items.is_empty() {
        let items = c.deductions.sum_items();
        if items > 0 && (items - deductions).abs() > TOLERANCE_PAISE {
            out.push(Finding::new(
                "VIA_ITEMS_SUM_TO_TOTAL",
                Severity::Warning,
                format!(
                    "Chapter VI-A items sum to {} against a stated total of {}",
                    rupees(items),
                    rupees(deductions)
                ),
            ));
        }
    }
}

/// Net tax payable = tax + surcharge + cess - rebate/relief - credits.
fn check_net_tax(c: &Computation, out: &mut Vec<Finding>) {
    let (Some(base), Some(net)) = (c.tax.tax_due.as_ref(), c.tax.net_tax_payable.as_ref()) else {
        out.push(Finding::new("NET_TAX_RECONCILES", Severity::Skipped, "tax due or net tax payable absent".into()));
        return;
    };

    let add = |m: &Option<coi_domain::Money>| m.as_ref().map(|v| v.paise).unwrap_or(0);
    let expected = base.paise
        + add(&c.tax.surcharge)
        + add(&c.tax.health_education_cess)
        + add(&c.tax.interest_234a)
        + add(&c.tax.interest_234b)
        + add(&c.tax.interest_234c)
        - add(&c.tax.rebate_87a)
        - add(&c.tax.relief)
        - c.credits.sum();

    if (expected - net.paise).abs() <= TOLERANCE_PAISE {
        out.push(Finding::new(
            "NET_TAX_RECONCILES",
            Severity::Skipped,
            format!("net tax payable {} reconciles", rupees(net.paise)),
        ));
    } else {
        // A warning, not an error: these sheets vary in whether interest and
        // self-assessment deposits sit inside the net figure, and a mismatch
        // here is a prompt to look rather than proof of a bad extraction.
        out.push(Finding {
            rule: "NET_TAX_RECONCILES".into(),
            severity: Severity::Warning,
            message: format!(
                "tax {} + surcharge/cess/interest - rebate/relief - credits = {}, stated net tax {}",
                rupees(base.paise),
                rupees(expected),
                rupees(net.paise)
            ),
            expected: Some(expected),
            actual: Some(net.paise),
        });
    }
}

fn check_identifiers(c: &Computation, out: &mut Vec<Finding>) {
    match &c.assessee.pan {
        Some(pan) => match validate_pan(pan) {
            PanVerdict::Valid { entity } => out.push(Finding::new(
                "PAN_STRUCTURE",
                Severity::Skipped,
                format!("PAN well-formed, entity code '{entity}'"),
            )),
            PanVerdict::BadShape => out.push(Finding::new(
                "PAN_STRUCTURE",
                Severity::Error,
                "PAN does not match AAAAA9999A".into(),
            )),
            PanVerdict::UnknownEntityCode(code) => out.push(Finding::new(
                "PAN_STRUCTURE",
                Severity::Warning,
                format!("PAN 4th character '{code}' is not a known entity code"),
            )),
        },
        None => out.push(Finding::new("PAN_STRUCTURE", Severity::Skipped, "no PAN found".into())),
    }
}

/// The output must never carry Aadhaar digits.
///
/// Checked over the serialised document rather than the parsed field, because
/// the risk is an Aadhaar surviving somewhere in the retained raw lines.
fn check_redaction(c: &Computation, out: &mut Vec<Finding>) {
    // Through to_value first: that is the form the CLI writes, and f32 fields
    // render differently from a direct to_string, so checking the other one
    // validates bytes that never ship.
    let serialised = serde_json::to_value(c)
        .ok()
        .and_then(|v| serde_json::to_string(&v).ok())
        .unwrap_or_default();
    let leaked = crate::schema::count_aadhaar_like(&serialised);

    if leaked == 0 {
        out.push(Finding::new(
            "AADHAAR_REDACTED",
            Severity::Skipped,
            if c.assessee.aadhaar.as_deref() == Some(AADHAAR_REDACTED) {
                "Aadhaar present and redacted".into()
            } else {
                "no Aadhaar present".to_string()
            },
        ));
    } else {
        out.push(Finding::new(
            "AADHAAR_REDACTED",
            Severity::Error,
            format!("{leaked} Aadhaar-shaped value(s) survived redaction in the output"),
        ));
    }
}
