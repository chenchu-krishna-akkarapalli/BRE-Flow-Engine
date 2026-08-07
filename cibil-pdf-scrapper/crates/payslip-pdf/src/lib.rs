// PDF decoding for payslips: bytes in, positioned text runs out.
//
// The content-stream decoder is cibil-pdf's text engine — real /Widths and /W
// glyph metrics, full CTM tracking, and line assembly in emission order. It was
// built and validated against 38 production documents, so this crate adapts its
// output rather than carrying a second implementation of the same PDF spec.

pub mod extractor;

pub use extractor::{page_count, extract_runs, PdfTextSource};
