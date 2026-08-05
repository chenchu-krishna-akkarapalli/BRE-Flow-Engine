//! Document identity: byte-level and content-level fingerprints, plus a
//! persistable cache used to filter duplicates during batch processing.

use std::collections::HashMap;
use std::path::Path;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::error::{CibilError, Result};

/// Below this much normalised text a content hash carries no signal — every
/// image-only PDF would otherwise collide on the same empty digest and be
/// reported as a duplicate of the first one seen.
const MIN_CONTENT_CHARS: usize = 200;

fn io_err(path: &Path, e: std::io::Error) -> CibilError {
    CibilError::IoError(std::io::Error::new(
        e.kind(),
        format!("{}: {e}", path.display()),
    ))
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Default)]
pub struct DocumentFingerprint {
    /// SHA-256 over the raw file bytes: catches exact re-submissions.
    pub sha256: String,
    /// SHA-256 over normalised extracted text: catches the same report
    /// re-exported to a byte-different PDF. `None` when there is too little text.
    pub content_hash: Option<String>,
    /// SHA-256 over the embedded image streams: catches scanned/combined-PNG
    /// reports rewrapped into a new container. `None` when the PDF has no images.
    pub image_hash: Option<String>,
}

impl DocumentFingerprint {
    /// Fingerprints a PDF on disk. Image hashing failures are non-fatal —
    /// a malformed container still yields a usable byte hash.
    pub fn from_path(path: &Path) -> Result<Self> {
        let bytes = std::fs::read(path).map_err(|e| io_err(path, e))?;
        Ok(Self::from_bytes(&bytes))
    }

    /// Fingerprints PDF bytes held in memory — the path used by the service,
    /// which never writes an uploaded document to disk.
    pub fn from_bytes(bytes: &[u8]) -> Self {
        Self {
            sha256: sha256_hex(bytes),
            content_hash: None,
            image_hash: image_stream_hash(bytes),
        }
    }

    pub fn with_text(mut self, text: &str) -> Self {
        self.content_hash = content_hash(text);
        // Text is the stronger identity when present. Every CIBIL report embeds
        // the same letterhead images, so an image digest over a text-bearing PDF
        // matches unrelated consumers — only trust it for image-only documents.
        if self.content_hash.is_some() {
            self.image_hash = None;
        }
        self
    }
}

/// Normalises whitespace and case so cosmetic re-rendering does not change the
/// digest, then hashes. Returns `None` when the text is too thin to identify.
pub fn content_hash(text: &str) -> Option<String> {
    let normalised: String = text
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_uppercase();
    if normalised.chars().filter(|c| c.is_alphanumeric()).count() < MIN_CONTENT_CHARS {
        return None;
    }
    Some(sha256_hex(normalised.as_bytes()))
}

/// Hashes every embedded image stream in document order. This is the signal for
/// combined-PNG PDFs, whose pages are images rather than text.
fn image_stream_hash(bytes: &[u8]) -> Option<String> {
    let doc = lopdf::Document::load_mem(bytes).ok()?;
    let mut hasher = Sha256::new();
    let mut count: usize = 0;

    // BTreeMap iteration is ordered by object id, so the digest is stable.
    for (_id, object) in doc.objects.iter() {
        if let lopdf::Object::Stream(stream) = object {
            let is_image = stream
                .dict
                .get(b"Subtype")
                .and_then(|s| s.as_name())
                .map(|n| n == b"Image")
                .unwrap_or(false);
            if is_image {
                // Prefer decoded bytes so re-compression does not change the
                // digest; JPEG/DCT streams are unsupported by lopdf and fall
                // back to raw content, which is already the encoded image.
                let data = stream
                    .decompressed_content()
                    .unwrap_or_else(|_| stream.content.clone());
                // Every image counts. These scans store page content as many
                // small tiles alongside a shared letterhead, so filtering by
                // size keeps only the boilerplate and collides across reports.
                hasher.update(data.len().to_le_bytes());
                hasher.update(&data);
                count += 1;
            }
        }
    }

    if count == 0 {
        return None;
    }
    // Mix in the image count so documents differing only in page count diverge.
    hasher.update(count.to_le_bytes());
    Some(format!("{:x}", hasher.finalize()))
}

/// Which fingerprint matched an already-seen document.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MatchKind {
    Exact,
    Content,
    Image,
}

impl MatchKind {
    pub fn reason(&self) -> &'static str {
        match self {
            MatchKind::Exact => "identical file bytes (SHA-256)",
            MatchKind::Content => "identical extracted text content",
            MatchKind::Image => "identical embedded page images",
        }
    }
}

#[derive(Debug, Clone)]
pub struct DuplicateMatch {
    pub original_id: String,
    pub hash: String,
    pub kind: MatchKind,
}

/// Hash -> first document id that produced it. Persisted as JSON so a batch run
/// can span multiple process invocations.
#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct DuplicateDetector {
    by_sha256: HashMap<String, String>,
    by_content: HashMap<String, String>,
    by_image: HashMap<String, String>,
}

impl DuplicateDetector {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn load(path: &Path) -> Result<Self> {
        if !path.exists() {
            return Ok(Self::new());
        }
        let raw = std::fs::read_to_string(path).map_err(|e| io_err(path, e))?;
        if raw.trim().is_empty() {
            return Ok(Self::new());
        }
        serde_json::from_str(&raw).map_err(|e| {
            CibilError::ValidationError(format!("duplicate cache {}: {e}", path.display()))
        })
    }

    pub fn save(&self, path: &Path) -> Result<()> {
        let raw = serde_json::to_string_pretty(self)
            .map_err(|e| CibilError::ValidationError(e.to_string()))?;
        std::fs::write(path, raw).map_err(|e| io_err(path, e))
    }

    /// Returns the prior document if this fingerprint was already seen.
    /// Checked strongest-first so an exact match is reported over a weaker one.
    pub fn check(&self, fp: &DocumentFingerprint) -> Option<DuplicateMatch> {
        if let Some(id) = self.by_sha256.get(&fp.sha256) {
            return Some(DuplicateMatch {
                original_id: id.clone(),
                hash: fp.sha256.clone(),
                kind: MatchKind::Exact,
            });
        }
        if let Some(h) = &fp.content_hash {
            if let Some(id) = self.by_content.get(h) {
                return Some(DuplicateMatch {
                    original_id: id.clone(),
                    hash: h.clone(),
                    kind: MatchKind::Content,
                });
            }
        }
        if let Some(h) = &fp.image_hash {
            if let Some(id) = self.by_image.get(h) {
                return Some(DuplicateMatch {
                    original_id: id.clone(),
                    hash: h.clone(),
                    kind: MatchKind::Image,
                });
            }
        }
        None
    }

    pub fn register(&mut self, doc_id: &str, fp: &DocumentFingerprint) {
        self.by_sha256
            .entry(fp.sha256.clone())
            .or_insert_with(|| doc_id.to_string());
        if let Some(h) = &fp.content_hash {
            self.by_content
                .entry(h.clone())
                .or_insert_with(|| doc_id.to_string());
        }
        if let Some(h) = &fp.image_hash {
            self.by_image
                .entry(h.clone())
                .or_insert_with(|| doc_id.to_string());
        }
    }

    /// Convenience for pipeline use: report a duplicate, otherwise register.
    pub fn check_and_register(
        &mut self,
        doc_id: &str,
        fp: &DocumentFingerprint,
    ) -> Option<DuplicateMatch> {
        match self.check(fp) {
            Some(m) => Some(m),
            None => {
                self.register(doc_id, fp);
                None
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fp(sha: &str, content: Option<&str>, image: Option<&str>) -> DocumentFingerprint {
        DocumentFingerprint {
            sha256: sha.to_string(),
            content_hash: content.map(|s| s.to_string()),
            image_hash: image.map(|s| s.to_string()),
        }
    }

    #[test]
    fn sha256_matches_known_vector() {
        assert_eq!(
            sha256_hex(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn exact_duplicate_is_detected_and_first_wins() {
        let mut d = DuplicateDetector::new();
        let a = fp("aaa", None, None);
        assert!(d.check_and_register("first.pdf", &a).is_none());

        let m = d.check_and_register("second.pdf", &a).expect("duplicate");
        assert_eq!(m.original_id, "first.pdf");
        assert_eq!(m.kind, MatchKind::Exact);
    }

    #[test]
    fn content_and_image_hashes_catch_rewrapped_documents() {
        let mut d = DuplicateDetector::new();
        d.check_and_register("orig.pdf", &fp("aaa", Some("ctext"), Some("cimg")));

        // Different bytes, same extracted text.
        let m = d.check_and_register("reexport.pdf", &fp("bbb", Some("ctext"), None));
        assert_eq!(m.expect("content dup").kind, MatchKind::Content);

        // Different bytes and no text, same embedded scans.
        let m = d.check_and_register("rescan.pdf", &fp("ccc", None, Some("cimg")));
        assert_eq!(m.expect("image dup").kind, MatchKind::Image);
    }

    #[test]
    fn thin_text_yields_no_content_hash() {
        // Image-only PDFs extract almost nothing; they must not all collide.
        assert!(content_hash("").is_none());
        assert!(content_hash("CONSUMER CIR").is_none());
        assert!(content_hash(&"A".repeat(MIN_CONTENT_CHARS)).is_some());
    }

    #[test]
    fn content_hash_ignores_whitespace_and_case() {
        let a = content_hash(&format!("{} consumer name", "x ".repeat(MIN_CONTENT_CHARS)));
        let b = content_hash(&format!("{}\n\nCONSUMER   NAME", "X ".repeat(MIN_CONTENT_CHARS)));
        assert_eq!(a, b);
        assert!(a.is_some());
    }

    #[test]
    fn text_pdfs_ignore_image_hash_so_shared_letterheads_do_not_collide() {
        // Two different consumers' text reports embed the same CIBIL logo.
        let shared_logo = Some("same-logo-digest");
        let a = fp("aaa", None, shared_logo).with_text(&"x ".repeat(MIN_CONTENT_CHARS));
        let b = fp("bbb", None, shared_logo).with_text(&"y ".repeat(MIN_CONTENT_CHARS));
        assert!(a.image_hash.is_none(), "text PDF must not carry an image hash");
        assert!(a.content_hash.is_some());

        let mut d = DuplicateDetector::new();
        d.check_and_register("consumer_a.pdf", &a);
        assert!(d.check_and_register("consumer_b.pdf", &b).is_none(), "false positive");
    }

    #[test]
    fn image_only_pdf_keeps_its_image_hash() {
        let scan = fp("aaa", None, Some("page-scans")).with_text("CONSUMER CIR");
        assert!(scan.content_hash.is_none());
        assert_eq!(scan.image_hash.as_deref(), Some("page-scans"));
    }

    #[test]
    fn distinct_documents_are_not_flagged() {
        let mut d = DuplicateDetector::new();
        d.check_and_register("a.pdf", &fp("aaa", Some("t1"), Some("i1")));
        assert!(d.check_and_register("b.pdf", &fp("bbb", Some("t2"), Some("i2"))).is_none());
    }
}
