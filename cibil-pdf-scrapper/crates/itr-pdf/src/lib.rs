use itr_core::{ItrError, Result};
use lopdf::Document;

pub fn extract_text_from_pdf_bytes(pdf_bytes: &[u8]) -> Result<String> {
    let doc = Document::load_mem(pdf_bytes)
        .map_err(|e| ItrError::PdfError(format!("Failed to load PDF bytes: {e}")))?;
    
    let mut full_text = String::new();
    let pages = doc.get_pages();
    for (page_num, _) in pages {
        if let Ok(text) = doc.extract_text(&[page_num]) {
            full_text.push_str(&text);
            full_text.push('\n');
        }
    }
    
    if full_text.trim().is_empty() {
        // Fallback using cibil-pdf text extractor
        let mut lines = Vec::new();
        let page_count = doc.page_iter().count() as u32;
        for page in 1..=page_count {
            if let Ok(runs) = cibil_pdf::text_engine::decode_page_lines(&doc, page) {
                for run in runs {
                    if !run.text.trim().is_empty() {
                        lines.push(run.text.to_string());
                    }
                }
            }
        }
        if !lines.is_empty() {
            return Ok(lines.join("\n"));
        }
    }

    Ok(full_text)
}
