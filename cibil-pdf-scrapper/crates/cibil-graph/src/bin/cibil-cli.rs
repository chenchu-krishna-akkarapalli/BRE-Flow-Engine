use std::env;
use std::fs::File;
use std::io::{BufReader, Read};
use std::borrow::Cow;
use std::path::Path;
use serde::Deserialize;
use cibil_core::traits::RawTextRun;
use cibil_layout::geometry::preprocess_runs;
use cibil_domain::parser::CibilParser;
use cibil_domain::aggregate::TargetReport;
use cibil_validation::validator::CibilValidator;
use cibil_core::fingerprint::{DocumentFingerprint, DuplicateDetector};
use cibil_pdf::decoder::PdfDecoder;
use cibil_pdf::text_engine::decode_page_lines;
use cibil_domain::ingest::{is_unknown_consumer, missing_identifiers, PipelineResponse};

#[derive(Deserialize)]
struct TestInputBlock {
    raw_text: String,
    bounding_box: [f32; 4],
    page_number: u32,
    page_height: Option<f32>,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    let positional: Vec<&String> = args[1..].iter().filter(|a| !a.starts_with("--")).collect();
    if positional.is_empty() {
        eprintln!("Usage: cibil-cli <blocks.json> [--schema internal|target] \
                 [--pipeline] [--source <original.pdf>] [--seen <state.json>] [--doc-id <id>]
                 Use '-' as the blocks path to read a framed stdin request.");
        std::process::exit(1);
    }

    // `target` emits the delivery schema; `internal` keeps the full parse tree.
    let schema = args.iter()
        .position(|a| a == "--schema")
        .and_then(|i| args.get(i + 1))
        .map(|s| s.as_str())
        .unwrap_or("internal")
        .to_string();
    if schema != "internal" && schema != "target" {
        eprintln!("Unknown --schema '{schema}' (expected 'internal' or 'target')");
        std::process::exit(2);
    }

    // Pipeline mode gates the document before emitting it: duplicates and
    // unidentifiable reports are filtered out with a structured reason.
    let pipeline = args.iter().any(|a| a == "--pipeline");
    let opt = |name: &str| {
        args.iter()
            .position(|a| a == name)
            .and_then(|i| args.get(i + 1))
            .cloned()
    };
    let source = opt("--source");
    let seen_path = opt("--seen");
    // Stable identity for the dedupe cache; the service supplies --doc-id
    // because a stdin request has no filename.
    let doc_id = opt("--doc-id")
        .or_else(|| {
            source
                .as_deref()
                .and_then(|s| Path::new(s).file_name())
                .map(|s| s.to_string_lossy().to_string())
        })
        .unwrap_or_else(|| positional[0].clone());

    // "-" reads a framed request from stdin so the service never writes an
    // uploaded PDF to disk: [8-byte LE blocks length][blocks JSON][raw PDF bytes].
    let file_path = positional[0];
    let (test_blocks, stdin_pdf): (Vec<TestInputBlock>, Option<Vec<u8>>) = if file_path == "-" {
        let mut buf = Vec::new();
        std::io::stdin().read_to_end(&mut buf)?;
        if buf.len() < 8 {
            return Err("stdin frame truncated".into());
        }
        let len = u64::from_le_bytes(buf[..8].try_into()?) as usize;
        let end = 8usize.checked_add(len).ok_or("stdin frame length overflow")?;
        if end > buf.len() {
            return Err("stdin frame declares more blocks than were sent".into());
        }
        let blocks: Vec<TestInputBlock> = serde_json::from_slice(&buf[8..end])?;
        let pdf = if end < buf.len() { Some(buf[end..].to_vec()) } else { None };
        (blocks, pdf)
    } else {
        let reader = BufReader::new(File::open(file_path)?);
        (serde_json::from_reader(reader)?, None)
    };

    // --from-pdf runs the whole scrape in Rust: the caller ships PDF bytes and
    // no longer needs a Python PDF library to pre-extract positioned text.
    let pdf_runs: Option<Vec<RawTextRun>> = if args.iter().any(|a| a == "--from-pdf") {
        let bytes = match (&stdin_pdf, source.as_deref()) {
            (Some(b), _) => b.clone(),
            (None, Some(src)) => std::fs::read(src)?,
            (None, None) => return Err("--from-pdf needs PDF bytes on stdin or --source".into()),
        };
        let doc = PdfDecoder::load_and_decrypt(&bytes, None)?;
        let pages = doc.page_iter().count() as u32;
        let mut runs = Vec::new();
        for page in 1..=pages {
            // One unreadable page must not lose the other ninety.
            match decode_page_lines(&doc, page) {
                Ok(page_runs) => runs.extend(page_runs),
                Err(e) => eprintln!("page {page}: {e}"),
            }
        }
        Some(runs)
    } else {
        None
    };

    // Map test blocks to RawTextRun
    let raw_runs: Vec<RawTextRun> = pdf_runs.unwrap_or_else(|| test_blocks.iter()
        .map(|b| RawTextRun {
            text: Cow::Owned(b.raw_text.clone()),
            bbox: b.bounding_box,
            page: b.page_number,
            font_name: None,
            font_size: 10.0,
            page_height: b.page_height.unwrap_or(842.0),
        })
        .collect());

    if args.iter().any(|a| a == "--dump-runs") {
        for r in &raw_runs {
            println!("p{} y={:.1} x0={:.1} x1={:.1} sz={:.1} {:?}",
                     r.page, r.bbox[1], r.bbox[0], r.bbox[2], r.font_size, r.text);
        }
        return Ok(());
    }

    // Preprocess runs to filter out header/footer noise and unify coordinate space
    let layout_elements = preprocess_runs(&raw_runs);

    // Parse report details
    let mut report = CibilParser::parse_report(&layout_elements)?;

    // Run structural cross-validation
    CibilValidator::validate(&mut report)?;

    let payload = if schema == "target" {
        serde_json::to_value(TargetReport::from_report(&report))?
    } else {
        serde_json::to_value(&report)?
    };

    if !pipeline {
        println!("{}", serde_json::to_string_pretty(&payload)?);
        return Ok(());
    }

    // Duplicate check first: a duplicate needs no further interpretation.
    let base_fingerprint = match (&stdin_pdf, source.as_deref()) {
        (Some(bytes), _) => Some(DocumentFingerprint::from_bytes(bytes)),
        (None, Some(src)) => Some(DocumentFingerprint::from_path(Path::new(src))?),
        (None, None) => None,
    };
    if let Some(base) = base_fingerprint {
        let text: String = raw_runs.iter().map(|r| r.text.as_ref()).collect::<Vec<_>>().join(" ");
        let fingerprint = base.with_text(&text);

        let state = seen_path.as_deref().map(Path::new);
        let mut detector = match state {
            Some(p) => DuplicateDetector::load(p)?,
            None => DuplicateDetector::new(),
        };

        if let Some(hit) = detector.check_and_register(&doc_id, &fingerprint) {
            let response = PipelineResponse::duplicate(&hit.original_id, &hit.hash, hit.kind.reason());
            println!("{}", serde_json::to_string_pretty(&response)?);
            return Ok(());
        }
        if let Some(p) = state {
            detector.save(p)?;
        }
    }

    let response = if is_unknown_consumer(&report) {
        let missing = missing_identifiers(&report);
        PipelineResponse::unknown_consumer(&missing)
    } else {
        PipelineResponse::success(payload)
    };
    println!("{}", serde_json::to_string_pretty(&response)?);

    Ok(())
}
