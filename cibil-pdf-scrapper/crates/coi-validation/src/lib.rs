// Output validation: cross-field arithmetic, identifier checks, schema compliance.

pub mod identifiers;
pub mod rules;
pub mod schema;

pub use identifiers::{aadhaar_checksum_valid, validate_pan, PanVerdict};
pub use rules::{validate, Finding, Severity, ValidationReport};
pub use schema::{
    count_aadhaar_like, validate_against_schema, validate_relational_schema,
    RELATIONAL_SCHEMA_JSON, SCHEMA_JSON,
};
