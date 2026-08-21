// Lexical parsers for the Computation of Income sheet.

pub mod assessee;
pub mod heads;
pub mod parser;
pub mod patterns;
pub mod relational;

pub use parser::parse_computation;
pub use relational::to_relational;
