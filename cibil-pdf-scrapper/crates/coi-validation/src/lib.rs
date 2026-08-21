// Output validation: cross-field arithmetic, identifier checks, schema compliance.

pub mod identifiers;
pub mod confidence;
pub mod rules;
pub mod schema;

pub use identifiers::{aadhaar_checksum_valid, validate_pan, PanVerdict};
pub use confidence::{evaluate_document, EvaluationReport};
pub use rules::{validate, Finding, Severity, ValidationReport};
pub use schema::{
    count_aadhaar_like, validate_against_schema, validate_contract, validate_relational_schema,
    CONTRACT_SCHEMA_JSON, RELATIONAL_SCHEMA_JSON, SCHEMA_JSON,
};
