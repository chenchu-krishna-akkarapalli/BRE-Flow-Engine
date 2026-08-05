use thiserror::Error;

// One variant per failure boundary. A computation that could not be read must
// say so; nothing in the pipeline substitutes a zero for a figure it never saw,
// because a zero here silently changes an assessee's tax position.
#[derive(Error, Debug)]
pub enum CoiError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Unrecognised document format (expected PDF or RTF)")]
    UnknownFormat,

    #[error("PDF container could not be read: {0}")]
    Pdf(String),

    #[error("PDF library error: {0}")]
    Lopdf(#[from] lopdf::Error),

    #[error("RTF could not be parsed: {0}")]
    Rtf(String),

    #[error("Page {page} could not be decoded: {reason}")]
    PageDecode { page: u32, reason: String },

    #[error("Document is encrypted and no password was supplied")]
    Encrypted,

    #[error("No extractable text (document is likely a scan and needs OCR)")]
    NoTextContent,

    #[error("Layout reconstruction failed: {0}")]
    Layout(String),

    #[error("Could not parse '{field}': {reason}")]
    FieldParse { field: String, reason: String },

    #[error("Schema validation failed: {0}")]
    Schema(String),
}

pub type Result<T> = std::result::Result<T, CoiError>;
