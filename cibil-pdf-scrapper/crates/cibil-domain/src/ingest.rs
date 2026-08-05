//! Pipeline gating: identifies reports with no usable consumer identity and
//! wraps every outcome in the structured response the batch pipeline emits.

use serde::Serialize;
use serde_json::Value;

use crate::models::CibilReport;

/// Placeholder the parser emits when no name could be recovered.
const UNKNOWN_NAME: &str = "UNKNOWN CONSUMER";
/// Placeholder the parser emits when no control number could be recovered.
const PLACEHOLDER_CONTROL: &str = "00000000000";

#[derive(Serialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum PipelineStatus {
    #[serde(rename = "SUCCESS")]
    Success,
    #[serde(rename = "DUPLICATE_DOCUMENT")]
    DuplicateDocument,
    #[serde(rename = "UNKNOWN_CONSUMER")]
    UnknownConsumer,
}

#[derive(Serialize, Debug, Clone)]
pub struct PipelineResponse {
    pub status: PipelineStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duplicate_of: Option<String>,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

impl PipelineResponse {
    pub fn success(data: Value) -> Self {
        Self {
            status: PipelineStatus::Success,
            duplicate_of: None,
            message: "Report extracted successfully".to_string(),
            data: Some(data),
        }
    }

    pub fn duplicate(original_id: &str, hash: &str, reason: &str) -> Self {
        Self {
            status: PipelineStatus::DuplicateDocument,
            duplicate_of: Some(original_id.to_string()),
            message: format!(
                "Filtered as a duplicate of '{original_id}' — {reason} (hash {}).",
                &hash[..hash.len().min(16)]
            ),
            data: None,
        }
    }

    pub fn unknown_consumer(missing: &[&str]) -> Self {
        Self {
            status: PipelineStatus::UnknownConsumer,
            duplicate_of: None,
            message: format!(
                "No identifiable consumer credentials ({} missing). \
                 The document is likely image-only or a corrupt combined-PNG PDF requiring OCR.",
                missing.join(", ")
            ),
            data: None,
        }
    }
}

/// Which consumer identifiers the report is missing. Empty means identifiable.
///
/// A report is only rejected when *every* identifier is missing: a genuine
/// no-hit report has a name but no accounts, and must not be discarded.
pub fn missing_identifiers(report: &CibilReport) -> Vec<&'static str> {
    let mut missing = Vec::new();

    let name = report.consumer_info.consumer_name.trim();
    if name.is_empty() || name.eq_ignore_ascii_case(UNKNOWN_NAME) {
        missing.push("name");
    }

    let pan_ok = report
        .consumer_info
        .pan
        .as_deref()
        .map(|p| p.trim().len() >= 10)
        .unwrap_or(false);
    if !pan_ok {
        missing.push("PAN");
    }

    let control = report.report_metadata.control_number.trim();
    if control.is_empty() || control == PLACEHOLDER_CONTROL || control.chars().all(|c| c == '0') {
        missing.push("control number");
    }

    if report.score_info.cibil_score == 0 {
        missing.push("CIBIL score");
    }

    missing
}

/// True when no consumer identifier at all could be recovered.
pub fn is_unknown_consumer(report: &CibilReport) -> bool {
    missing_identifiers(report).len() == 4
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::*;
    use std::collections::HashMap;

    fn report(name: &str, pan: Option<&str>, control: &str, score: u16) -> CibilReport {
        CibilReport {
            report_metadata: ReportMetadata {
                report_date: "01/01/2026".to_string(),
                control_number: control.to_string(),
                version: "CIBILv3".to_string(),
            },
            consumer_info: ConsumerInfo {
                consumer_name: name.to_string(),
                pan: pan.map(|s| s.to_string()),
                date_of_birth: None,
                gender: None,
                phone: None,
                email: None,
            },
            score_info: ScoreInfo {
                cibil_score: score,
                score_factors: Vec::new(),
                grameen_score: None,
                pl_score: None,
            },
            accounts_summary: AccountsSummary {
                total_accounts: 0,
                active_accounts: 0,
                closed_accounts: 0,
                total_balance: 0,
                total_sanctioned_amount: 0,
            },
            accounts: Vec::new(),
            enquiries: Vec::new(),
            addresses: Vec::new(),
            employment: Vec::new(),
            confidence: DocumentConfidence {
                character_confidence: 1.0,
                layout_confidence: 1.0,
                relationship_confidence: 1.0,
                overall_score: 1.0,
            },
            validation_errors: Vec::new(),
        }
    }

    #[test]
    fn image_only_pdf_is_flagged_unknown() {
        // What the parser produces from a scan: every field a placeholder.
        let r = report("UNKNOWN CONSUMER", None, "00000000000", 0);
        assert!(is_unknown_consumer(&r));
        assert_eq!(missing_identifiers(&r).len(), 4);
    }

    #[test]
    fn a_single_recovered_identifier_is_enough_to_process() {
        assert!(!is_unknown_consumer(&report("SUNITHA S", None, "00000000000", 0)));
        assert!(!is_unknown_consumer(&report("UNKNOWN CONSUMER", Some("AFXPV8637G"), "00000000000", 0)));
        assert!(!is_unknown_consumer(&report("UNKNOWN CONSUMER", None, "10959222357", 0)));
        assert!(!is_unknown_consumer(&report("UNKNOWN CONSUMER", None, "00000000000", 676)));
    }

    #[test]
    fn no_hit_report_survives_the_filter() {
        // Consumer not in the CIBIL database: named, but no score or accounts.
        let r = report("KAVITHA PANCHAMUKHI", None, "9065794732", 0);
        assert!(!is_unknown_consumer(&r));
    }

    #[test]
    fn response_shapes_match_the_pipeline_contract() {
        let dup = PipelineResponse::duplicate("first.pdf", "abcdef1234567890ff", "identical file bytes");
        let v = serde_json::to_value(&dup).unwrap();
        assert_eq!(v["status"], "DUPLICATE_DOCUMENT");
        assert_eq!(v["duplicate_of"], "first.pdf");
        assert!(v.get("data").is_none(), "duplicates must not carry data");

        let unknown = PipelineResponse::unknown_consumer(&["name", "PAN"]);
        let v = serde_json::to_value(&unknown).unwrap();
        assert_eq!(v["status"], "UNKNOWN_CONSUMER");
        assert!(v.get("data").is_none());

        let ok = PipelineResponse::success(serde_json::json!({"CIBIL_Score": 676}));
        let v = serde_json::to_value(&ok).unwrap();
        assert_eq!(v["status"], "SUCCESS");
        assert_eq!(v["data"]["CIBIL_Score"], 676);
        assert!(v.get("duplicate_of").is_none());
    }

    #[test]
    fn placeholder_control_number_counts_as_missing() {
        let mut r = report("X", None, "0000000", 0);
        r.accounts = vec![];
        assert!(missing_identifiers(&r).contains(&"control number"));
        let _ = HashMap::<String, String>::new();
    }
}
