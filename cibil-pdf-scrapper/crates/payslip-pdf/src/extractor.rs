use cibil_pdf::decoder::PdfDecoder;
use cibil_pdf::text_engine::decode_page_lines;
use payslip_core::{BoundingBox, PayslipError, Result, TextRun, TextSource};

pub struct PdfTextSource;

impl TextSource for PdfTextSource {
    fn extract_runs(&self, data: &[u8]) -> Result<Vec<TextRun<'static>>> {
        extract_runs(data)
    }

    fn page_count(&self, data: &[u8]) -> Result<u32> {
        page_count(data)
    }
}

fn load(data: &[u8]) -> Result<lopdf::Document> {
    if data.is_empty() {
        return Err(PayslipError::Pdf("empty document".into()));
    }
    PdfDecoder::load_and_decrypt(data, None)
        .map_err(|e| PayslipError::Pdf(format!("{e}")))
}

pub fn page_count(data: &[u8]) -> Result<u32> {
    Ok(load(data)?.page_iter().count() as u32)
}

/// Decode every page into positioned text runs, verbatim.
///
/// A page that fails to decode is reported and skipped rather than aborting the
/// document: one damaged page in a multi-month payslip must not lose the rest.
/// A document that yields nothing at all is an error, not an empty success —
/// silence there means a scan that needs OCR, and callers have to know.
pub fn extract_runs(data: &[u8]) -> Result<Vec<TextRun<'static>>> {
    let doc = load(data)?;
    let pages = doc.page_iter().count() as u32;

    let mut runs: Vec<TextRun<'static>> = Vec::new();
    let mut failures: Vec<String> = Vec::new();

    for page in 1..=pages {
        match decode_page_lines(&doc, page) {
            Ok(page_runs) => runs.extend(page_runs.into_iter().filter_map(convert)),
            Err(e) => failures.push(format!("page {page}: {e}")),
        }
    }

    if runs.is_empty() {
        return Err(if failures.is_empty() {
            PayslipError::NoTextContent
        } else {
            PayslipError::PageDecode { page: 1, reason: failures.join("; ") }
        });
    }
    Ok(runs)
}

// cibil-pdf hands back [x0, y0, x1, y1] already flipped to a top-left origin;
// this is the width/height projection the payslip crates work in.
fn convert(run: cibil_core::traits::RawTextRun<'_>) -> Option<TextRun<'static>> {
    if run.text.trim().is_empty() {
        return None;
    }
    let [x0, y0, x1, y1] = run.bbox;
    Some(TextRun {
        text: std::borrow::Cow::Owned(run.text.into_owned()),
        bbox: BoundingBox::new(x0, y0, (x1 - x0).abs(), (y1 - y0).abs().max(run.font_size)),
        page: run.page,
        font_name: run.font_name,
        font_size: run.font_size,
    })
}
