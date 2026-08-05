use crate::error::Result;
use crate::geometry::TextRun;

/// Detected by magic bytes, never by file extension — the corpus ships RTF
/// documents named `.doc`, and trusting the name mis-routes them to a PDF parser.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DocumentFormat {
    Pdf,
    Rtf,
}

impl DocumentFormat {
    pub fn detect(data: &[u8]) -> Option<DocumentFormat> {
        let head = &data[..data.len().min(1024)];
        let trimmed = head.iter().position(|b| !b.is_ascii_whitespace()).unwrap_or(0);
        let head = &head[trimmed..];

        if head.starts_with(b"%PDF-") {
            Some(DocumentFormat::Pdf)
        } else if head.starts_with(br"{\rtf") {
            Some(DocumentFormat::Rtf)
        } else {
            None
        }
    }
}

pub trait TextSource {
    fn extract_runs(&self, data: &[u8]) -> Result<Vec<TextRun<'static>>>;

    fn page_count(&self, data: &[u8]) -> Result<u32>;
}

/// Format-dispatching front door, so parser and CLI never branch on file type.
pub trait DocumentLoader {
    fn load(&self, data: &[u8]) -> Result<(DocumentFormat, Vec<TextRun<'static>>, u32)>;
}
