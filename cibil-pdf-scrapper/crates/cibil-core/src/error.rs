use thiserror::Error;

#[derive(Error, Debug)]
pub enum CibilError {
    #[error("I/O error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("PDF parsing failed: {0}")]
    PdfError(String),

    #[error("PDF library error: {0}")]
    LopdfError(#[from] lopdf::Error),
    
    #[error("Invalid font encoding or glyph mapping on page {0}")]
    FontDecodingError(u32),
    
    #[error("Layout reconstruction failure: {0}")]
    LayoutError(String),

    #[error("Table structure anomaly at page {page}: {reason}")]
    TableStructureError { page: u32, reason: String },

    #[error("Cross-validation anomaly: {0}")]
    ValidationError(String),
    
    #[error("Relational graph mapping error: {0}")]
    GraphError(String),

    #[error("Unknown error: {0}")]
    Unknown(String),
}

pub type Result<T> = std::result::Result<T, CibilError>;
