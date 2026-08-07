// Document decoding for Computation of Income files: bytes in, text runs out.
//
// Two backends behind one loader. PDF reuses cibil-pdf's content-stream decoder
// (real glyph metrics, CTM tracking, form XObject recursion); RTF is parsed here
// because the corpus ships RTF documents named `.doc`.

pub mod dom;
pub mod pdf;
pub mod rtf;

use coi_core::{CoiError, DocumentFormat, DocumentLoader, Result, TextRun, TextSource};

pub struct CoiLoader;

impl DocumentLoader for CoiLoader {
    fn load(&self, data: &[u8]) -> Result<(DocumentFormat, Vec<TextRun<'static>>, u32)> {
        // Magic bytes, not the extension: `x.rtf (1).doc` is an RTF document.
        match DocumentFormat::detect(data).ok_or(CoiError::UnknownFormat)? {
            DocumentFormat::Pdf => {
                let runs = pdf::extract_runs(data)?;
                let pages = pdf::page_count(data)?;
                Ok((DocumentFormat::Pdf, runs, pages))
            }
            DocumentFormat::Rtf => {
                let runs = rtf::extract_runs(data)?;
                Ok((DocumentFormat::Rtf, runs, 1))
            }
        }
    }
}

pub struct PdfTextSource;

impl TextSource for PdfTextSource {
    fn extract_runs(&self, data: &[u8]) -> Result<Vec<TextRun<'static>>> {
        pdf::extract_runs(data)
    }

    fn page_count(&self, data: &[u8]) -> Result<u32> {
        pdf::page_count(data)
    }
}
