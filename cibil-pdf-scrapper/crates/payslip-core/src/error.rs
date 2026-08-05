use thiserror::Error;

// One variant per failure boundary. Nothing in the pipeline returns a default on
// error: a payslip that could not be read must say so rather than report zeros.
#[derive(Error, Debug)]
pub enum PayslipError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("PDF container could not be read: {0}")]
    Pdf(String),

    #[error("PDF library error: {0}")]
    Lopdf(#[from] lopdf::Error),

    #[error("Page {page} could not be decoded: {reason}")]
    PageDecode { page: u32, reason: String },

    #[error("Document is encrypted and no password was supplied")]
    Encrypted,

    #[error("Layout reconstruction failed: {0}")]
    Layout(String),

    #[error("No extractable text (document is likely a scan and needs OCR)")]
    NoTextContent,

    #[error("Field parsing failed for '{field}': {reason}")]
    FieldParse { field: String, reason: String },

    #[error("Unsupported payslip format: {0}")]
    UnknownFormat(String),
}

pub type Result<T> = std::result::Result<T, PayslipError>;
