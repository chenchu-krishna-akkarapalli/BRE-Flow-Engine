// Core traits, error matrix and geometry for the Computation of Income pipeline.

pub mod error;
pub mod geometry;
pub mod traits;

pub use error::{CoiError, Result};
pub use geometry::{BoundingBox, TextRun};
pub use traits::{DocumentFormat, DocumentLoader, TextSource};
