//! Derives the target output schema from a parsed `CibilReport`.
//!
//! Everything here is a pure projection of already-parsed data: no PDF or
//! layout access, so the shape of the deliverable can change without touching
//! the parsing layer.

use indexmap::IndexMap;
use serde::{Serialize, Serializer};
use serde_json::Value;

use crate::models::{AccountStatus, CibilReport, CreditAccount, EnquiryDetail};

const MONTHS: [&str; 12] = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

const PL_SCORE_ABSENT: &str = "Not Available (only CreditVision Score reported in this document)";

/// An amount that renders as the literal `"NIL"` when the report has none.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum NilOr {
    Nil,
    Amount(u64),
}

impl Serialize for NilOr {
    fn serialize<S: Serializer>(&self, s: S) -> std::result::Result<S::Ok, S::Error> {
        match self {
            NilOr::Nil => s.serialize_str("NIL"),
            NilOr::Amount(v) => s.serialize_u64(*v),
        }
    }
}

impl From<Option<u64>> for NilOr {
    fn from(v: Option<u64>) -> Self {
        match v {
            Some(v) if v > 0 => NilOr::Amount(v),
            _ => NilOr::Nil,
        }
    }
}

#[derive(Serialize, Debug, Clone)]
pub struct TargetReport {
    #[serde(rename = "CIBIL_Score")]
    pub cibil_score: u16,
    #[serde(rename = "CIBIL_PL_Score")]
    pub cibil_pl_score: Value,
    #[serde(rename = "Write_Off_Details")]
    pub write_off_details: WriteOffDetails,
    #[serde(rename = "Write_Off_Amount")]
    pub write_off_amount: WriteOffAmount,
    #[serde(rename = "DPD")]
    pub dpd: IndexMap<String, DpdEntry>,
    #[serde(rename = "Loan_Enquiry")]
    pub loan_enquiry: LoanEnquiry,
    #[serde(rename = "Currently_Outstanding")]
    pub currently_outstanding: CurrentlyOutstanding,
}

#[derive(Serialize, Debug, Clone, Default)]
pub struct WriteOffDetails {
    #[serde(rename = "PL_Write_Off")]
    pub pl: NilOrDefault,
    #[serde(rename = "Home_Loan_Write_Off")]
    pub home: NilOrDefault,
    #[serde(rename = "Consumer_Loan_Write_Off")]
    pub consumer: NilOrDefault,
    #[serde(rename = "Agri_Loan_Write_Off")]
    pub agri: NilOrDefault,
    #[serde(rename = "MSME_Loan_Write_Off")]
    pub msme: NilOrDefault,
    #[serde(rename = "Auto_Loan_Write_Off")]
    pub auto: NilOrDefault,
    #[serde(rename = "Credit_Card_Write_Off")]
    pub credit_card: NilOrDefault,
}

/// `NilOr` with a `Default` of `Nil`, so the struct can start empty.
pub type NilOrDefault = NilOr;

impl Default for NilOr {
    fn default() -> Self {
        NilOr::Nil
    }
}

#[derive(Serialize, Debug, Clone)]
pub struct WriteOffAmount {
    #[serde(rename = "Total")]
    pub total: NilOr,
    #[serde(rename = "Principal")]
    pub principal: NilOr,
    #[serde(rename = "Source_Account")]
    pub source_account: String,
}

/// DPD history is reported for every account regardless of status; only an
/// account with no history rows at all falls back to `current_dpd: "NA"`.
#[derive(Serialize, Debug, Clone)]
pub struct DpdEntry {
    pub status: String,
    #[serde(flatten)]
    pub years: IndexMap<String, IndexMap<String, Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_dpd: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_payment: Option<String>,
}

#[derive(Serialize, Debug, Clone)]
pub struct LoanEnquiry {
    #[serde(rename = "Total_Enquiries")]
    pub total: usize,
    #[serde(rename = "Most_Recent_Enquiry_Date")]
    pub most_recent: Option<String>,
    #[serde(rename = "Past_30_Days")]
    pub past_30_days: usize,
    #[serde(rename = "Past_12_Months")]
    pub past_12_months: usize,
    #[serde(rename = "Past_24_Months")]
    pub past_24_months: usize,
    #[serde(rename = "Enquiry_List")]
    pub list: Vec<TargetEnquiry>,
}

#[derive(Serialize, Debug, Clone)]
pub struct TargetEnquiry {
    pub date: String,
    pub purpose: String,
    pub amount: u64,
}

#[derive(Serialize, Debug, Clone)]
pub struct CurrentlyOutstanding {
    #[serde(rename = "Total_Current_Balance")]
    pub total_current_balance: u64,
    #[serde(rename = "Total_Overdue")]
    pub total_overdue: u64,
    #[serde(rename = "Breakdown")]
    pub breakdown: IndexMap<String, u64>,
}

/// Loan classes the target schema reports write-offs against.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WriteOffCategory {
    PersonalLoan,
    HomeLoan,
    ConsumerLoan,
    AgriLoan,
    MsmeLoan,
    AutoLoan,
    CreditCard,
    Other,
}

/// Maps a free-text account type onto a write-off bucket. Order matters:
/// "AUTO LOAN (PERSONAL)" is an auto loan, not a personal loan.
pub fn classify_write_off_category(account_type: &str) -> WriteOffCategory {
    let t = account_type.to_uppercase();
    let has = |k: &str| t.contains(k);

    if has("CREDIT CARD") || has("CHARGE CARD") || has("KISAN CREDIT") && has("CARD") {
        return WriteOffCategory::CreditCard;
    }
    if has("AUTO") || has("CAR LOAN") || has("USED CAR") || has("TWO-WHEELER") || has("TWO WHEELER") {
        return WriteOffCategory::AutoLoan;
    }
    if has("HOME LOAN") || has("HOUSING") || has("PROPERTY LOAN") || has("MORTGAGE") {
        return WriteOffCategory::HomeLoan;
    }
    if has("AGRI") || has("KISAN") || has("TRACTOR") || has("CROP") {
        return WriteOffCategory::AgriLoan;
    }
    if has("MSME") || has("BUSINESS") || has("COMMERCIAL") {
        return WriteOffCategory::MsmeLoan;
    }
    if has("CONSUMER LOAN") || has("CONSUMER DURABLE") {
        return WriteOffCategory::ConsumerLoan;
    }
    if has("PERSONAL") {
        return WriteOffCategory::PersonalLoan;
    }
    WriteOffCategory::Other
}

/// Days since 1970-01-01 for a `dd/mm/yyyy` or `dd-mm-yyyy` date.
/// Uses Howard Hinnant's civil-from-days algorithm so no date crate is needed.
fn days_from_civil(date: &str) -> Option<i64> {
    let parts: Vec<&str> = date.split(['/', '-']).collect();
    if parts.len() != 3 {
        return None;
    }
    let d: i64 = parts[0].trim().parse().ok()?;
    let m: i64 = parts[1].trim().parse().ok()?;
    let y: i64 = parts[2].trim().parse().ok()?;
    if !(1..=31).contains(&d) || !(1..=12).contains(&m) {
        return None;
    }

    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let mp = (m + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    Some(era * 146097 + doe - 719468)
}

/// Disjoint enquiry buckets relative to the report date: the target's own
/// counts (4 + 2 + 1) do not sum to its total (8), so these are non-overlapping
/// age bands rather than cumulative windows.
fn enquiry_windows(enquiries: &[EnquiryDetail], reference: &str) -> (usize, usize, usize) {
    let today = match days_from_civil(reference) {
        Some(t) => t,
        None => return (0, 0, 0),
    };
    let (mut d30, mut m12, mut m24) = (0, 0, 0);
    for e in enquiries {
        let age = match days_from_civil(&e.date) {
            Some(d) => today - d,
            None => continue,
        };
        if age < 0 {
            continue;
        }
        if age <= 30 {
            d30 += 1;
        } else if age <= 365 {
            m12 += 1;
        } else if age <= 730 {
            m24 += 1;
        }
    }
    (d30, m12, m24)
}

/// "USED CAR LOAN" -> "Used_Car_Loan"
fn title_key(account_type: &str) -> String {
    let cleaned: String = account_type
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { ' ' })
        .collect();
    let parts: Vec<String> = cleaned
        .split_whitespace()
        .map(|w| {
            let mut cs = w.chars();
            match cs.next() {
                Some(f) => f.to_uppercase().collect::<String>() + &cs.as_str().to_lowercase(),
                None => String::new(),
            }
        })
        .collect();
    if parts.is_empty() {
        "Unknown".to_string()
    } else {
        parts.join("_")
    }
}

fn is_inactive(acc: &CreditAccount) -> bool {
    matches!(acc.status, AccountStatus::Inactive)
}

/// Human-readable status for the DPD block, e.g. "ACTIVE - WRITTEN OFF".
fn dpd_status(acc: &CreditAccount) -> String {
    if is_inactive(acc) {
        return "INACTIVE".to_string();
    }
    let qualifier = acc
        .credit_facility_status
        .as_deref()
        .map(|s| s.trim().to_uppercase())
        .filter(|s| !s.is_empty() && s != "ACTIVE");
    match qualifier {
        Some(q) => format!("ACTIVE - {}", q.replace('-', " ")),
        None => match acc.status {
            AccountStatus::WrittenOff => "ACTIVE - WRITTEN OFF".to_string(),
            AccountStatus::SuitFiled => "ACTIVE - SUIT FILED".to_string(),
            AccountStatus::Repossessed => "ACTIVE - REPOSSESSED".to_string(),
            _ => "ACTIVE".to_string(),
        },
    }
}

fn dpd_years(acc: &CreditAccount) -> IndexMap<String, IndexMap<String, Value>> {
    let mut years: Vec<&String> = acc.payment_history.keys().collect();
    // Most recent year first, matching the target document.
    years.sort_by(|a, b| b.cmp(a));

    let mut out = IndexMap::new();
    for y in years {
        let months = &acc.payment_history[y];
        let mut row = IndexMap::new();
        for m in MONTHS {
            if let Some(Some(v)) = months.get(m) {
                let value = match v.parse::<u64>() {
                    Ok(n) => Value::from(n),
                    Err(_) => Value::from(v.clone()),
                };
                row.insert(m.to_string(), value);
            }
        }
        if !row.is_empty() {
            out.insert(y.clone(), row);
        }
    }
    out
}

impl TargetReport {
    pub fn from_report(report: &CibilReport) -> Self {
        let accounts = &report.accounts;

        // --- Write-off rollups by loan class -----------------------------
        let mut details = WriteOffDetails::default();
        for acc in accounts {
            let amount = acc
                .written_off_amount_total
                .or(acc.written_off_amount_principal)
                .unwrap_or(0);
            if amount == 0 {
                continue;
            }
            let slot = match classify_write_off_category(&acc.account_type) {
                WriteOffCategory::PersonalLoan => &mut details.pl,
                WriteOffCategory::HomeLoan => &mut details.home,
                WriteOffCategory::ConsumerLoan => &mut details.consumer,
                WriteOffCategory::AgriLoan => &mut details.agri,
                WriteOffCategory::MsmeLoan => &mut details.msme,
                WriteOffCategory::AutoLoan => &mut details.auto,
                WriteOffCategory::CreditCard => &mut details.credit_card,
                WriteOffCategory::Other => continue,
            };
            let running = match slot {
                NilOr::Amount(v) => *v,
                NilOr::Nil => 0,
            };
            *slot = NilOr::Amount(running + amount);
        }

        // --- Largest write-off drives the attribution block --------------
        let source = accounts
            .iter()
            .filter(|a| {
                a.written_off_amount_total.unwrap_or(0) > 0
                    || a.written_off_amount_principal.unwrap_or(0) > 0
            })
            .max_by_key(|a| a.written_off_amount_total.unwrap_or(0));

        let write_off_amount = match source {
            Some(acc) => WriteOffAmount {
                total: acc.written_off_amount_total.into(),
                principal: acc.written_off_amount_principal.into(),
                source_account: format!(
                    "{} (Account {}, Opened {}, Status: {}, {})",
                    acc.account_type.trim(),
                    acc.index,
                    acc.date_opened.as_deref().unwrap_or("Unknown"),
                    acc.credit_facility_status
                        .as_deref()
                        .unwrap_or("WRITTEN-OFF")
                        .trim(),
                    if is_inactive(acc) { "Inactive" } else { "Active" },
                ),
            },
            None => WriteOffAmount {
                total: NilOr::Nil,
                principal: NilOr::Nil,
                source_account: "None".to_string(),
            },
        };

        // --- Per-account DPD ---------------------------------------------
        let mut dpd = IndexMap::new();
        for acc in accounts {
            let key = format!("Account_{}_{}", acc.index, title_key(&acc.account_type));
            let years = dpd_years(acc);
            dpd.insert(key, DpdEntry {
                status: dpd_status(acc),
                current_dpd: if years.is_empty() { Some("NA".to_string()) } else { None },
                years,
                start_date: acc.payment_history_start_date.clone(),
                end_date: acc.payment_history_end_date.clone(),
                last_payment: acc.date_of_last_payment.clone(),
            });
        }

        // --- Enquiries ----------------------------------------------------
        let mut sorted: Vec<&EnquiryDetail> = report.enquiries.iter().collect();
        sorted.sort_by_key(|e| std::cmp::Reverse(days_from_civil(&e.date).unwrap_or(i64::MIN)));

        let (past_30, past_12, past_24) =
            enquiry_windows(&report.enquiries, &report.report_metadata.report_date);

        let loan_enquiry = LoanEnquiry {
            total: sorted.len(),
            most_recent: sorted.first().map(|e| e.date.clone()),
            past_30_days: past_30,
            past_12_months: past_12,
            past_24_months: past_24,
            list: sorted
                .iter()
                .map(|e| TargetEnquiry {
                    date: e.date.clone(),
                    purpose: e.purpose.clone(),
                    amount: e.amount,
                })
                .collect(),
        };

        // --- Outstanding balances -----------------------------------------
        let mut breakdown = IndexMap::new();
        for acc in accounts {
            let key = format!("{}_Account_{}", title_key(&acc.account_type), acc.index);
            breakdown.insert(key, acc.current_balance.unwrap_or(0));
        }

        let currently_outstanding = CurrentlyOutstanding {
            total_current_balance: accounts.iter().filter_map(|a| a.current_balance).sum(),
            total_overdue: accounts.iter().filter_map(|a| a.amount_overdue).sum(),
            breakdown,
        };

        TargetReport {
            cibil_score: report.score_info.cibil_score,
            cibil_pl_score: match report.score_info.pl_score {
                Some(v) => Value::from(v),
                None => Value::from(PL_SCORE_ABSENT),
            },
            write_off_details: details,
            write_off_amount,
            dpd,
            loan_enquiry,
            currently_outstanding,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn auto_loan_personal_is_not_a_personal_loan() {
        assert_eq!(
            classify_write_off_category("AUTO LOAN (PERSONAL)"),
            WriteOffCategory::AutoLoan
        );
        assert_eq!(
            classify_write_off_category("PERSONAL LOAN"),
            WriteOffCategory::PersonalLoan
        );
        assert_eq!(
            classify_write_off_category("CREDIT CARD"),
            WriteOffCategory::CreditCard
        );
        assert_eq!(
            classify_write_off_category("USED CAR LOAN"),
            WriteOffCategory::AutoLoan
        );
        assert_eq!(
            classify_write_off_category("PROPERTY LOAN"),
            WriteOffCategory::HomeLoan
        );
    }

    #[test]
    fn nil_renders_as_string_and_amounts_as_numbers() {
        assert_eq!(serde_json::to_string(&NilOr::Nil).unwrap(), "\"NIL\"");
        assert_eq!(serde_json::to_string(&NilOr::Amount(80564)).unwrap(), "80564");
        // A zero write-off is absence, not a reported zero.
        assert_eq!(NilOr::from(Some(0u64)), NilOr::Nil);
        assert_eq!(NilOr::from(Some(5u64)), NilOr::Amount(5));
    }

    #[test]
    fn date_arithmetic_matches_known_offsets() {
        assert_eq!(days_from_civil("01/01/1970"), Some(0));
        assert_eq!(days_from_civil("02/01/1970"), Some(1));
        // Leap-year boundary.
        let a = days_from_civil("28/02/2024").unwrap();
        let b = days_from_civil("01/03/2024").unwrap();
        assert_eq!(b - a, 2);
        assert_eq!(days_from_civil("not a date"), None);
    }

    #[test]
    fn enquiry_windows_are_disjoint_age_bands() {
        let mk = |date: &str| EnquiryDetail {
            member_name: "NOT DISCLOSED".to_string(),
            date: date.to_string(),
            purpose: "CREDIT CARD".to_string(),
            amount: 1,
        };
        let enquiries = vec![
            mk("20/04/2026"), // 3 days
            mk("01/04/2026"), // 22 days
            mk("01/01/2026"), // ~112 days
            mk("01/06/2025"), // ~326 days
            mk("01/06/2024"), // ~691 days
            mk("01/01/2020"), // far older, counted in none
        ];
        let (d30, m12, m24) = enquiry_windows(&enquiries, "23/04/2026");
        assert_eq!((d30, m12, m24), (2, 2, 1));
    }

    #[test]
    fn account_keys_use_the_two_documented_orderings() {
        assert_eq!(title_key("USED CAR LOAN"), "Used_Car_Loan");
        assert_eq!(title_key("AUTO LOAN (PERSONAL)"), "Auto_Loan_Personal");
        assert_eq!(title_key("CREDIT CARD"), "Credit_Card");
    }

    fn account(index: u32, status: AccountStatus) -> CreditAccount {
        let mut history = std::collections::HashMap::new();
        let mut months = std::collections::HashMap::new();
        months.insert("JAN".to_string(), Some("030".to_string()));
        months.insert("FEB".to_string(), Some("STD".to_string()));
        history.insert("2025".to_string(), months);
        CreditAccount {
            index,
            account_type: "USED CAR LOAN".to_string(),
            status,
            date_opened: Some("01/01/2020".to_string()),
            date_closed: None,
            sanctioned_amount: Some(100),
            current_balance: Some(50),
            ownership: None,
            collateral_type: None,
            collateral_value: None,
            credit_facility_status: None,
            written_off_amount_total: None,
            written_off_amount_principal: None,
            settlement_amount: None,
            amount_overdue: None,
            date_of_last_payment: Some("17/11/2025".to_string()),
            payment_history_start_date: Some("01/02/2026".to_string()),
            payment_history_end_date: Some("01/01/2025".to_string()),
            payment_history: history,
            confidence: 0.99,
            source_pages: vec![1],
        }
    }

    #[test]
    fn dpd_is_reported_for_every_account_status() {
        // Bug-1: history used to be emitted only for non-inactive accounts,
        // which in practice meant only written-off ones.
        for status in [
            AccountStatus::Inactive,
            AccountStatus::Active,
            AccountStatus::WrittenOff,
            AccountStatus::SuitFiled,
            AccountStatus::Unknown,
        ] {
            let acc = account(1, status.clone());
            let entry = DpdEntry {
                status: dpd_status(&acc),
                current_dpd: None,
                years: dpd_years(&acc),
                start_date: acc.payment_history_start_date.clone(),
                end_date: acc.payment_history_end_date.clone(),
                last_payment: acc.date_of_last_payment.clone(),
            };
            assert!(!entry.years.is_empty(), "history dropped for {status:?}");
            assert_eq!(entry.years["2025"]["JAN"], Value::from(30));
            assert_eq!(entry.years["2025"]["FEB"], Value::from("STD"));
            assert_eq!(entry.start_date.as_deref(), Some("01/02/2026"));
            assert_eq!(entry.end_date.as_deref(), Some("01/01/2025"));
            assert_eq!(entry.last_payment.as_deref(), Some("17/11/2025"));
        }
    }

    #[test]
    fn account_without_history_still_reports_na() {
        let mut acc = account(2, AccountStatus::Inactive);
        acc.payment_history.clear();
        let years = dpd_years(&acc);
        assert!(years.is_empty());
        let entry = DpdEntry {
            status: dpd_status(&acc),
            current_dpd: Some("NA".to_string()),
            years,
            start_date: None,
            end_date: None,
            last_payment: None,
        };
        let json = serde_json::to_string(&entry).unwrap();
        assert!(json.contains("\"current_dpd\":\"NA\""), "{json}");
    }
}
