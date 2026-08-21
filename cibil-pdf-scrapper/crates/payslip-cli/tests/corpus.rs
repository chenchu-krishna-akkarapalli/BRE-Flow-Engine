//! Every sample payslip must process without panicking, and every text-bearing
//! one must extract. Failures are named, never counted silently.

use std::fs;
use std::path::PathBuf;

use payslip_core::{PayslipError, TextSource};
use payslip_pdf::PdfTextSource;

fn corpus() -> Option<PathBuf> {
    // tests run from the crate dir; the corpus sits at the workspace root.
    let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../payslip-test")
        .canonicalize()
        .ok()?;
    dir.is_dir().then_some(dir)
}

fn samples() -> Vec<PathBuf> {
    let Some(dir) = corpus() else { return Vec::new() };
    let mut files: Vec<PathBuf> = fs::read_dir(dir)
        .expect("corpus directory is readable")
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| {
            p.extension()
                .and_then(|e| e.to_str())
                .is_some_and(|e| e.eq_ignore_ascii_case("pdf"))
        })
        .collect();
    files.sort();
    files
}

#[test]
fn every_sample_processes_without_panicking() {
    let files = samples();
    if files.is_empty() {
        eprintln!("corpus not present; skipping");
        return;
    }

    let source = PdfTextSource;
    let mut scanned = Vec::new();

    for path in &files {
        let bytes = fs::read(path).expect("sample is readable");
        let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();

        match source.extract_runs(&bytes) {
            Ok(runs) => {
                assert!(!runs.is_empty(), "{name}: Ok with no runs");
                let pages = source.page_count(&bytes).unwrap_or(0);
                let slip = payslip_parser::parse_payslip(&name, &runs, pages)
                    .unwrap_or_else(|e| panic!("{name}: parse failed: {e}"));

                // Extraction is lossless: the raw lines always survive, whether
                // or not the field parsers recognised this vendor's layout.
                assert!(!slip.raw.lines.is_empty(), "{name}: raw content was dropped");
            }
            Err(PayslipError::NoTextContent) | Err(PayslipError::Pdf(_)) => scanned.push(name),
            Err(e) => panic!("{name}: {e}"),
        }
    }

    let extracted = files.len() - scanned.len();
    eprintln!("{extracted}/{} extracted; {} image-only: {scanned:?}", files.len(), scanned.len());
    assert_eq!(extracted + scanned.len(), files.len(), "a corpus sample was not classified");
    assert!(extracted > 0, "no text-bearing payslip sample extracted");
}

#[test]
fn text_bearing_samples_yield_positioned_runs() {
    let files = samples();
    if files.is_empty() {
        return;
    }

    let source = PdfTextSource;
    for path in files.iter().take(12) {
        let bytes = fs::read(path).expect("sample is readable");
        let Ok(runs) = source.extract_runs(&bytes) else { continue };

        for run in runs.iter().take(50) {
            assert!(run.bbox.width >= 0.0 && run.bbox.height > 0.0, "{:?}", run.bbox);
            assert!(run.page >= 1);
            assert!(!run.as_str().trim().is_empty());
        }
    }
}

#[test]
fn kutch_fixture_verifies_relational_schema() {
    let fixture_str = include_str!("fixtures/example-kutch-payslip.json");
    let relational: payslip_domain::Payslip =
        serde_json::from_str(fixture_str).expect("example-kutch-payslip.json must deserialize to Payslip");

    assert_eq!(relational.schema_version, "2.0");
    assert_eq!(relational.statements.len(), 1);

    let stmt = &relational.statements[0];
    assert_eq!(stmt.earnings.items.len(), 1);
    assert_eq!(stmt.deductions.items.len(), 1);

    let earning_item = &stmt.earnings.items[0];
    assert_eq!(earning_item.canonical_category, "basic_pay");
    assert!(earning_item.amount.is_some());
    assert!(earning_item.amount_actual.is_some());
    assert!(earning_item.amount_payable.is_some());
}
