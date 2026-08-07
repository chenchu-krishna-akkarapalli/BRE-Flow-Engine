use cibil_pdf::decoder::PdfDecoder;
use cibil_pdf::text_engine::decode_page_lines;
use coi_core::{BoundingBox, CoiError, Result, TextRun};

fn load(data: &[u8]) -> Result<lopdf::Document> {
    if data.is_empty() {
        return Err(CoiError::Pdf("empty document".into()));
    }
    PdfDecoder::load_and_decrypt(data, None).map_err(|e| CoiError::Pdf(format!("{e}")))
}

pub fn page_count(data: &[u8]) -> Result<u32> {
    Ok(load(data)?.page_iter().count() as u32)
}

/// Tagged tables, empty when the generator wrote no structure tree.
pub fn dom_tables(data: &[u8]) -> Result<Vec<crate::dom::DomTable>> {
    Ok(crate::dom::extract(&load(data)?)?.map(|root| crate::dom::tables(&root)).unwrap_or_default())
}

/// Decode every page into positioned runs, verbatim.
///
/// A page that fails is recorded and skipped so one damaged page cannot lose a
/// multi-page computation; a document that yields nothing at all is an error,
/// because silence there means a scan and the caller has to know.
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
            CoiError::NoTextContent
        } else {
            CoiError::PageDecode { page: 1, reason: failures.join("; ") }
        });
    }
    Ok(runs)
}

fn convert(run: cibil_core::traits::RawTextRun<'_>) -> Option<TextRun<'static>> {
    if run.text.trim().is_empty() {
        return None;
    }
    let [x0, y0, x1, y1] = run.bbox;
    Some(TextRun {
        text: std::borrow::Cow::Owned(run.text.into_owned()),
        bbox: BoundingBox::new(x0, y0, (x1 - x0).abs(), (y1 - y0).abs().max(run.font_size)),
        page: run.page,
        font_size: run.font_size,
    })
}
