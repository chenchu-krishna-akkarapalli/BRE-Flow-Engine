use thiserror::Error;

#[derive(Error, Debug)]
pub enum ItrError {
    #[error("PDF processing error: {0}")]
    PdfError(String),
    #[error("Parsing error: {0}")]
    ParseError(String),
    #[error("Validation error: {0}")]
    ValidationError(String),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

pub type Result<T> = std::result::Result<T, ItrError>;

/// Cleans amount strings (stripping commas, currency symbols, and whitespace).
pub fn parse_amount(raw: &str) -> Option<i64> {
    let mut cleaned = raw.trim().replace(',', "").replace("Rs.", "").replace('₹', "")
        .replace('\u{2212}', "-").replace('\u{2013}', "-").replace('\u{2014}', "-");
    if cleaned.is_empty() || cleaned == "Nil" || cleaned == "-" {
        return Some(0);
    }
    let is_negative = cleaned.contains("(-)") || (cleaned.starts_with('(') && cleaned.ends_with(')')) || cleaned.contains('-');
    if cleaned.contains("(-)") || (cleaned.starts_with('(') && cleaned.ends_with(')')) {
        cleaned = cleaned.replace("(-)", "").replace('(', "").replace(')', "");
    }
    let val_str = cleaned.replace(' ', "");
    let val = val_str.parse::<i64>().ok().or_else(|| {
        val_str.parse::<f64>().ok().map(|f| f as i64)
    })?;
    Some(if is_negative && val > 0 { -val } else { val })
}
