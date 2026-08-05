// Core traits, error domain and geometry primitives for the payslip pipeline.

pub mod error;
pub mod geometry;
pub mod traits;

pub use error::{PayslipError, Result};
pub use geometry::{BoundingBox, TextRun};
pub use traits::{LayoutGrouper, PayslipFormat, TextSource};
