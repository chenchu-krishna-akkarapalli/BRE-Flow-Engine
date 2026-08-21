use coi_domain::{CoiDocument, ConfidenceBreakdown};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvaluationReport {
    pub confidence_score: f64,
    pub confidence_breakdown: ConfidenceBreakdown,
    pub low_confidence_fields: Vec<String>,
}

pub fn evaluate_document(document: &mut CoiDocument, ocr_used: bool, source: &str) -> EvaluationReport {
    let assessee = score(&[
        document.assessee_info.name.is_some(),
        document.assessee_info.pan.is_some(),
        document.assessee_info.father_name.is_some(),
        document.assessee_info.residential_address.is_some(),
        document.assessee_info.status.is_some(),
        document.assessee_info.assessment_year.is_some(),
        document.assessee_info.ward_no.is_some(),
        document.assessee_info.financial_year.is_some(),
        document.assessee_info.gender.is_some(),
        document.assessee_info.date_of_birth.is_some(),
        document.assessee_info.email.is_some(),
        document.assessee_info.residential_status.is_some(),
    ]);
    let bank = optional_score(&[
        document.bank_details.bank_name.is_some(),
        document.bank_details.ifsc_code.is_some(),
        document.bank_details.account_no.is_some(),
        document.bank_details.branch_address.is_some(),
    ]);
    let return_details = optional_score(&[
        document.return_details.form_type.is_some(),
        document.return_details.filing_status.is_some(),
        document.return_details.filing_date.is_some(),
        document.return_details.acknowledgement_no.is_some(),
    ]);
    let computation = score(&[
        document.computation_of_total_income.gross_total_income.is_some(),
        document.computation_of_total_income.total_income.is_some(),
        document.computation_of_total_income.income_from_business_or_profession.is_some(),
        document.computation_of_total_income.tax_calculation.is_some(),
        document.computation_of_total_income.normal_income_tax_calculation.is_some(),
    ]);
    let tax_computation = optional_score(&[
        !document.tax_computation.slabs.is_empty(),
        document.tax_computation.rebate_87a.is_some(),
        !document.tax_computation.tds.is_empty(),
        document.tax_computation.refundable.is_some(),
    ]);
    let breakdown = ConfidenceBreakdown { assessee_info: assessee, bank_details: bank, return_details, computation, tax_computation };
    let mut low_confidence_fields = Vec::new();
    if document.assessee_info.name.is_none() { low_confidence_fields.push("assessee_info.name".to_string()); }
    if document.assessee_info.pan.is_none() { low_confidence_fields.push("assessee_info.pan".to_string()); }
    if document.assessee_info.assessment_year.is_none() { low_confidence_fields.push("assessee_info.assessment_year".to_string()); }
    if document.computation_of_total_income.total_income.is_none() { low_confidence_fields.push("computation_of_total_income.total_income".to_string()); }
    if assessee < 0.8 { low_confidence_fields.push("assessee_info".to_string()); }
    if bank < 0.8 { low_confidence_fields.push("bank_details".to_string()); }
    if return_details < 0.8 { low_confidence_fields.push("return_details".to_string()); }
    if computation < 0.8 { low_confidence_fields.push("computation_of_total_income".to_string()); }
    if tax_computation < 0.8 { low_confidence_fields.push("tax_computation".to_string()); }
    let average = (assessee + bank + return_details + computation + tax_computation) / 5.0;
    let mandatory_missing = document.assessee_info.name.is_none()
        || document.assessee_info.pan.is_none()
        || document.assessee_info.assessment_year.is_none()
        || document.computation_of_total_income.total_income.is_none();
    let confidence_score = round(if mandatory_missing { average.min(0.79) } else { average });
    document.meta.ocr_used = ocr_used;
    document.meta.source = source.to_string();
    document.meta.confidence_score = confidence_score;
    document.meta.confidence_breakdown = breakdown.clone();
    document.meta.low_confidence_fields = low_confidence_fields.clone();
    EvaluationReport { confidence_score, confidence_breakdown: breakdown, low_confidence_fields }
}

fn score(values: &[bool]) -> f64 {
    if values.is_empty() { return 0.0; }
    values.iter().filter(|value| **value).count() as f64 / values.len() as f64
}

fn optional_score(values: &[bool]) -> f64 {
    0.85 + score(values) * 0.15
}

fn round(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

#[cfg(test)]
mod tests {
    use super::evaluate_document;
    use coi_domain::CoiDocument;

    #[test]
    fn missing_mandatory_fields_caps_confidence() {
        let mut document = CoiDocument::default();
        let report = evaluate_document(&mut document, false, "text_layer");
        assert!(report.confidence_score < 0.8);
        assert!(report.low_confidence_fields.iter().any(|field| field == "assessee_info.pan"));
    }
}
