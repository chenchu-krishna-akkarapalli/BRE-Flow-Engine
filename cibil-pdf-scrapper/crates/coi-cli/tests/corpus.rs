//! Every sample computation must decode, validate against the schema, and leak
//! no Aadhaar. Failures are named, never counted silently.

use std::fs;
use std::path::PathBuf;

use coi_core::{CoiError, DocumentFormat, DocumentLoader};
use coi_pdf::CoiLoader;
use coi_validation::{count_aadhaar_like, validate, validate_against_schema, Severity};

fn corpus() -> Option<PathBuf> {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../computation-of-income-copies-test")
        .canonicalize()
        .ok()
        .filter(|p| p.is_dir())
}

fn samples() -> Vec<PathBuf> {
    let Some(dir) = corpus() else { return Vec::new() };
    let mut files: Vec<PathBuf> = fs::read_dir(dir)
        .expect("corpus is readable")
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.is_file())
        .collect();
    files.sort();
    files
}

fn name_of(path: &PathBuf) -> String {
    path.file_name().unwrap_or_default().to_string_lossy().to_string()
}

#[test]
fn every_sample_decodes_validates_and_redacts() {
    let files = samples();
    if files.is_empty() {
        eprintln!("corpus not present; skipping");
        return;
    }

    let mut scanned = Vec::new();
    let mut decoded = 0usize;
    let mut rtf = 0usize;

    for path in &files {
        let name = name_of(path);
        let bytes = fs::read(path).expect("sample is readable");

        let loaded = match CoiLoader.load(&bytes) {
            Ok(v) => v,
            // A scan carries no text: a documented outcome, not a crash.
            Err(CoiError::NoTextContent) => {
                scanned.push(name);
                continue;
            }
            Err(e) => panic!("{name}: {e}"),
        };
        let (format, runs, pages) = loaded;
        if format == DocumentFormat::Rtf {
            rtf += 1;
        }

        let computation =
            coi_parser::parse_computation(&name, &format!("{format:?}"), &runs, pages)
                .unwrap_or_else(|e| panic!("{name}: {e}"));

        // Extraction is lossless apart from redaction: raw lines always survive.
        assert!(!computation.raw.lines.is_empty(), "{name}: raw content dropped");

        let value = serde_json::to_value(&computation).expect("serialises");
        let schema_errors = validate_against_schema(&value).expect("validator runs");
        assert!(schema_errors.is_empty(), "{name}: schema errors {schema_errors:?}");

        // The strongest guarantee in this pipeline: no Aadhaar digit reaches the
        // output, including the retained raw lines.
        let serialised = serde_json::to_string(&value).expect("serialises");
        assert_eq!(count_aadhaar_like(&serialised), 0, "{name}: Aadhaar leaked into output");

        let report = validate(&computation);
        let errors: Vec<&str> = report
            .findings
            .iter()
            .filter(|f| f.severity == Severity::Error)
            .map(|f| f.rule.as_str())
            .collect();
        assert!(errors.is_empty(), "{name}: validation errors {errors:?}");

        decoded += 1;
    }

    eprintln!(
        "{decoded}/{} decoded ({rtf} RTF); {} image-only: {scanned:?}",
        files.len(),
        scanned.len()
    );
    assert!(decoded >= 18, "extraction regressed: only {decoded} of {}", files.len());
    assert!(rtf >= 2, "the RTF path stopped running");
}

#[test]
fn assessment_year_always_leads_its_financial_year() {
    for path in samples() {
        let name = name_of(&path);
        let bytes = fs::read(&path).expect("readable");
        let Ok((format, runs, pages)) = CoiLoader.load(&bytes) else { continue };
        let Ok(c) = coi_parser::parse_computation(&name, &format!("{format:?}"), &runs, pages)
        else {
            continue;
        };

        if let (Some(ay), Some(fy)) = (c.assessment_year, c.financial_year) {
            assert_eq!(ay.start, fy.start + 1, "{name}: AY {ay:?} vs FY {fy:?}");
        }
    }
}
