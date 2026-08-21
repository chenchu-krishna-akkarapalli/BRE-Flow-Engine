// Lexical extraction over reconstructed lines. Label-driven rather than
// coordinate-driven: payslip vendors move boxes around but keep their wording.

pub mod fields;
pub mod parser;
pub mod patterns;

pub use parser::parse_payslip;
