// Lexical parsers for the Computation of Income sheet.

pub mod assessee;
pub mod heads;
pub mod parser;
pub mod patterns;

pub use parser::parse_computation;
