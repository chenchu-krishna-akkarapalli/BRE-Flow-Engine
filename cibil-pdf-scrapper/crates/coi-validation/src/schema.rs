use coi_core::{CoiError, Result};
use serde_json::Value;

/// The schema is compiled into the binary so validation cannot silently skip
/// because a file was missing at run time.
pub const SCHEMA_JSON: &str = include_str!("../coi_output.schema.json");

/// Count Aadhaar-shaped values in arbitrary text.
///
/// Delegates to coi-domain so the leak detector and the redactor can never
/// disagree about what counts as an Aadhaar number.
pub fn count_aadhaar_like(text: &str) -> usize {
    coi_domain::aadhaar::count(text)
}

pub fn schema() -> Result<Value> {
    serde_json::from_str(SCHEMA_JSON).map_err(|e| CoiError::Schema(format!("schema is invalid: {e}")))
}

/// Validate a serialised computation against `coi_output.schema.json`.
///
/// Every error is collected, not just the first: a caller fixing output shape
/// wants the whole list, and a partial one invites a fix-recheck loop.
pub fn validate_against_schema(instance: &Value) -> Result<Vec<String>> {
    let schema = schema()?;
    let validator = jsonschema::validator_for(&schema)
        .map_err(|e| CoiError::Schema(format!("schema failed to compile: {e}")))?;

    Ok(validator
        .iter_errors(instance)
        .map(|error| format!("{}: {}", error.instance_path, error))
        .collect())
}

#[cfg(test)]
mod tests {
    use super::{count_aadhaar_like, schema, validate_against_schema};
    use serde_json::json;

    #[test]
    fn the_bundled_schema_compiles() {
        let value = schema().expect("schema parses");
        assert!(jsonschema::validator_for(&value).is_ok());
    }

    #[test]
    fn a_document_carrying_raw_aadhaar_digits_fails_the_schema() {
        // The enum on `aadhaar` is the structural guarantee behind the redaction
        // rule: an output that kept the digits cannot validate.
        let instance = json!({
            "source": "x.pdf", "format": "Pdf",
            "assessee": { "aadhaar": "975490473406" },
            "heads": {}, "deductions": { "items": [] },
            "tax": {}, "credits": {},
            "raw": { "page_count": 1, "lines": [], "table": { "columns": [], "rows": [] } }
        });
        let errors = validate_against_schema(&instance).expect("validator runs");
        assert!(!errors.is_empty(), "raw Aadhaar was accepted by the schema");
    }

    #[test]
    fn a_minimal_well_formed_document_validates() {
        let instance = json!({
            "source": "x.pdf", "format": "Pdf",
            "assessee": { "aadhaar": "[Aadhaar Redacted]", "pan": "ABCPE1234F" },
            "heads": { "salary": { "paise": 100, "raw": "1" } },
            "deductions": { "items": [] },
            "tax": {}, "credits": {},
            "raw": {
                "page_count": 1, "lines": [],
                "table": {
                    "columns": [[48.0, 120.0]],
                    "rows": [{ "page": 1, "cells": [
                        { "text": "Gross Total Income",
                          "bbox": { "x": 48.0, "y": 10.0, "width": 72.0, "height": 10.0 },
                          "column": 0 }
                    ]}]
                }
            }
        });
        assert_eq!(validate_against_schema(&instance).expect("runs"), Vec::<String>::new());
    }

    #[test]
    fn a_document_without_its_table_is_rejected() {
        // The column grid is part of the contract: an output carrying only flat
        // lines has lost which column each figure was printed in.
        let instance = json!({
            "source": "x.pdf", "format": "Pdf",
            "assessee": {}, "heads": {}, "deductions": { "items": [] },
            "tax": {}, "credits": {},
            "raw": { "page_count": 1, "lines": [] }
        });
        assert!(!validate_against_schema(&instance).expect("runs").is_empty());
    }

    #[test]
    fn only_twelve_digit_runs_count_as_aadhaar() {
        assert_eq!(count_aadhaar_like("975490473406"), 1);
        assert_eq!(count_aadhaar_like("9754 9047 3406"), 1);
        // Bank account and acknowledgement numbers must not raise a false leak.
        assert_eq!(count_aadhaar_like("4688000103410401"), 0);
        assert_eq!(count_aadhaar_like("367933300311025"), 0);
    }
}
