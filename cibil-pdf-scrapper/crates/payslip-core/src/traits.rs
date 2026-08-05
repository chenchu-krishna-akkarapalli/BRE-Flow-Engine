use crate::error::Result;
use crate::geometry::TextRun;

// Adapter boundary for the decoding backend, so a scanned-document OCR path can
// be added later without touching layout, domain or parser code.
pub trait TextSource {
    fn extract_runs(&self, data: &[u8]) -> Result<Vec<TextRun<'static>>>;

    fn page_count(&self, data: &[u8]) -> Result<u32>;
}

// Layout grouping is pluggable because payslip vendors differ in how much
// whitespace they leave between table columns.
pub trait LayoutGrouper {
    type Output;

    fn group(&self, runs: &[TextRun<'_>]) -> Result<Self::Output>;
}

// Implemented once per payslip vendor layout. `confidence` lets the registry
// pick a winner instead of the first pattern that happens to match.
pub trait PayslipFormat {
    fn name(&self) -> &'static str;

    fn confidence(&self, text: &str) -> f32;
}
