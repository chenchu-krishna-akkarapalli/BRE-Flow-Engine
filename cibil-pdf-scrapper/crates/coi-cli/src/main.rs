// coi-cli — decode and validate Computation of Income documents.
//
//   coi-cli <file>                      nested COI contract as JSON
//   coi-cli <file> --relational         nested relational view
//   coi-cli <file> --dom                tagged structure tree, where one exists
//   coi-cli <file> --raw                decoded lines only, no interpretation
//   coi-cli <file> --validate           validation report only
//   coi-cli --batch <dir> [--out <dir>] one row per file; exit 1 on any failure

use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use coi_core::{DocumentFormat, DocumentLoader};
use coi_pdf::CoiLoader;

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().collect();
    let flag = |name: &str| args.iter().any(|a| a == name);
    let value_of = |name: &str| {
        args.iter().position(|a| a == name).and_then(|i| args.get(i + 1)).map(PathBuf::from)
    };
    let positional: Vec<&String> = args[1..].iter().filter(|a| !a.starts_with("--")).collect();

    if positional.is_empty() {
        eprintln!(
            "Usage: coi-cli <file> [--internal|--relational|--dom|--raw|--validate] [--pretty]\n       coi-cli --batch <dir> [--out <dir>] [--json]"
        );
        return ExitCode::from(2);
    }

    if flag("--batch") {
        let output_dir = value_of("--out").or_else(|| Some(PathBuf::from("target/coi-output")));
        run_contract_batch(Path::new(positional[0]), output_dir, flag("--json"))
    } else {
        let view = if flag("--internal") {
            View::Computation
        } else if flag("--raw") {
            View::Raw
        } else if flag("--dom") {
            View::Dom
        } else if flag("--relational") {
            View::Relational
        } else if flag("--validate") {
            View::Validation
        } else {
            View::Contract
        };
        run_single(Path::new(positional[0]), view, flag("--pretty"))
    }
}

#[derive(Clone, Copy, PartialEq)]
enum View {
    Contract,
    Computation,
    Relational,
    Dom,
    Raw,
    Validation,
}

/// Tagged tables the generator declared. Errors are not fatal: a document with
/// no readable tag tree is the normal case, and the layout grid still applies.
fn dom_tables(bytes: &[u8], format: DocumentFormat) -> Vec<coi_pdf::dom::DomTable> {
    match format {
        DocumentFormat::Pdf => coi_pdf::pdf::dom_tables(bytes).unwrap_or_default(),
        DocumentFormat::Rtf => Vec::new(),
    }
}

fn format_name(format: DocumentFormat) -> &'static str {
    match format {
        DocumentFormat::Pdf => "Pdf",
        DocumentFormat::Rtf => "Rtf",
    }
}

fn run_single(path: &Path, view: View, pretty: bool) -> ExitCode {
    let bytes = match read_input(path) {
        Ok(b) => b,
        Err(e) => {
            eprintln!("{}: {e}", path.display());
            return ExitCode::FAILURE;
        }
    };

    let (format, runs, pages) = match CoiLoader.load(&bytes) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("{}: {e}", path.display());
            return ExitCode::FAILURE;
        }
    };

    let name = path.display().to_string();
    let json = match view {
        View::Contract => return run_contract_bytes(&name, &bytes, pretty),
        // Redacted like every other path: a raw dump is still a serialisation,
        // and the Aadhaar sits in these lines.
        View::Raw => serde_json::json!({
            "source": name, "format": format_name(format), "pages": pages,
            "lines": coi_parser::parser::redact_lines(coi_layout::group_lines(&runs)),
        }),
        View::Dom => serde_json::json!({
            "source": name, "format": format_name(format),
            "tables": dom_tables(&bytes, format),
        }),
        _ => {
            let computation =
                match coi_parser::parse_computation(&name, format_name(format), &runs, pages) {
                    Ok(c) => c,
                    Err(e) => {
                        eprintln!("{name}: {e}");
                        return ExitCode::FAILURE;
                    }
                };
            match view {
                View::Validation => {
                    serde_json::to_value(coi_validation::validate(&computation)).unwrap_or_default()
                }
                View::Relational => {
                    let tables = dom_tables(&bytes, format);
                    serde_json::to_value(coi_parser::to_relational(&computation, tables.len()))
                        .unwrap_or_default()
                }
                _ => serde_json::to_value(&computation).unwrap_or_default(),
            }
        }
    };

    let text = if pretty {
        serde_json::to_string_pretty(&json)
    } else {
        serde_json::to_string(&json)
    };
    match text {
        Ok(t) => println!("{t}"),
        Err(e) => {
            eprintln!("serialisation failed: {e}");
            return ExitCode::FAILURE;
        }
    }
    ExitCode::SUCCESS
}

fn read_input(path: &Path) -> std::io::Result<Vec<u8>> {
    if path == Path::new("-") {
        let mut bytes = Vec::new();
        std::io::Read::read_to_end(&mut std::io::stdin(), &mut bytes)?;
        Ok(bytes)
    } else {
        fs::read(path)
    }
}

fn run_contract_bytes(name: &str, bytes: &[u8], pretty: bool) -> ExitCode {
    let (format, runs, pages) = match CoiLoader.load(bytes) {
        Ok(value) => value,
        Err(error) => {
            eprintln!("{name}: {error}");
            return ExitCode::FAILURE;
        }
    };
    let mut document = match coi_parser::parse_document(name, format_name(format), &runs, pages) {
        Ok(document) => document,
        Err(error) => {
            eprintln!("{name}: {error}");
            return ExitCode::FAILURE;
        }
    };
    coi_validation::evaluate_document(&mut document, false, if format == DocumentFormat::Pdf { "text_layer" } else { "rtf_text" });
    let value = serde_json::to_value(&document).unwrap_or_default();
    let text = if pretty { serde_json::to_string_pretty(&value) } else { serde_json::to_string(&value) };
    match text {
        Ok(text) => println!("{text}"),
        Err(error) => {
            eprintln!("serialisation failed: {error}");
            return ExitCode::FAILURE;
        }
    }
    ExitCode::SUCCESS
}

fn run_contract_batch(dir: &Path, out_dir: Option<PathBuf>, as_json: bool) -> ExitCode {
    if let Some(out) = &out_dir {
        if let Err(error) = fs::create_dir_all(out) {
            eprintln!("{}: {error}", out.display());
            return ExitCode::FAILURE;
        }
    }
    let mut files: Vec<PathBuf> = match fs::read_dir(dir) {
        Ok(entries) => entries.filter_map(|entry| entry.ok().map(|item| item.path())).filter(|path| path.is_file()).collect(),
        Err(error) => {
            eprintln!("{}: {error}", dir.display());
            return ExitCode::FAILURE;
        }
    };
    files.sort();
    let mut records = Vec::new();
    let mut failed = 0usize;
    if !as_json { println!("{:<52} {:>8} {:>6}  {}", "FILE", "CONF", "LOW", "STATUS"); }
    for path in files {
        let name = path.file_name().and_then(|value| value.to_str()).unwrap_or("?").to_string();
        let bytes = match fs::read(&path) {
            Ok(bytes) => bytes,
            Err(error) => {
                failed += 1;
                records.push(serde_json::json!({"source": name, "status": "FAILED", "error": error.to_string()}));
                continue;
            }
        };
        let result = extract_contract_record(&name, &bytes);
        if result.get("status").and_then(|value| value.as_str()) != Some("OK") { failed += 1; }
        if let Some(out) = &out_dir {
            let target = out.join(format!("{}.json", path.file_stem().unwrap_or_default().to_string_lossy()));
            if let Ok(text) = serde_json::to_string_pretty(&result) { let _ = fs::write(target, text); }
        }
        if !as_json {
            let confidence = result.get("confidence_score").and_then(|value| value.as_f64()).unwrap_or(0.0);
            let low = result.get("low_confidence_fields").and_then(|value| value.as_array()).map(|value| value.len()).unwrap_or(0);
            let status = result.get("status").and_then(|value| value.as_str()).unwrap_or("FAILED");
            println!("{:<52} {:>8.2} {:>6}  {}", name.chars().take(51).collect::<String>(), confidence, low, status);
        }
        records.push(result);
    }
    if as_json { println!("{}", serde_json::to_string_pretty(&records).unwrap_or_else(|_| "[]".to_string())); }
    if failed == 0 { ExitCode::SUCCESS } else { ExitCode::FAILURE }
}

fn extract_contract_record(name: &str, bytes: &[u8]) -> serde_json::Value {
    let (format, runs, pages) = match CoiLoader.load(bytes) {
        Ok(value) => value,
        Err(coi_core::CoiError::NoTextContent) => return scan_record(name),
        Err(error) => return serde_json::json!({"source": name, "status": "FAILED", "error": error.to_string()}),
    };
    let mut document = match coi_parser::parse_document(name, format_name(format), &runs, pages) {
        Ok(document) => document,
        Err(error) => return serde_json::json!({"source": name, "status": "FAILED", "error": error.to_string()}),
    };
    coi_validation::evaluate_document(&mut document, false, if format == DocumentFormat::Pdf { "text_layer" } else { "rtf_text" });
    let value = serde_json::to_value(&document).unwrap_or_default();
    let schema_errors = coi_validation::validate_contract(&value).unwrap_or_else(|error| vec![error.to_string()]);
    serde_json::json!({
        "source": name,
        "status": if schema_errors.is_empty() { "OK" } else { "SCHEMA_ERROR" },
        "confidence_score": document.meta.confidence_score,
        "confidence_breakdown": document.meta.confidence_breakdown,
        "low_confidence_fields": document.meta.low_confidence_fields,
        "schema_errors": schema_errors,
        "data": value
    })
}

fn scan_record(name: &str) -> serde_json::Value {
    let mut document = coi_domain::CoiDocument::default();
    coi_validation::evaluate_document(&mut document, false, "scan_no_text");
    serde_json::json!({
        "source": name,
        "status": "SCAN_NO_TEXT",
        "confidence_score": 0.0,
        "confidence_breakdown": document.meta.confidence_breakdown,
        "low_confidence_fields": document.meta.low_confidence_fields,
        "schema_errors": [],
        "data": document
    })
}

fn run_batch(dir: &Path, out_dir: Option<PathBuf>, as_json: bool) -> ExitCode {
    if let Some(out) = &out_dir {
        if let Err(e) = fs::create_dir_all(out) {
            eprintln!("{}: {e}", out.display());
            return ExitCode::FAILURE;
        }
    }

    let mut files: Vec<PathBuf> = match fs::read_dir(dir) {
        Ok(entries) => entries
            .filter_map(|e| e.ok().map(|e| e.path()))
            .filter(|p| p.is_file())
            .collect(),
        Err(e) => {
            eprintln!("{}: {e}", dir.display());
            return ExitCode::FAILURE;
        }
    };
    files.sort();

    let mut ok = 0usize;
    let mut failed = 0usize;
    let mut schema_failures = 0usize;
    let mut math_errors = 0usize;
    let mut records = Vec::new();

    if !as_json {
        println!(
            "{:<46} {:>4} {:>5} {:>6} {:>5} {:>5}  {}",
            "FILE", "FMT", "PAGES", "LINES", "ERR", "WARN", "STATUS"
        );
        println!("{}", "-".repeat(110));
    }

    for path in &files {
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("?").to_string();
        let short: String = name.chars().take(45).collect();

        let outcome = fs::read(path).map_err(|e| e.to_string()).and_then(|bytes| {
            CoiLoader.load(&bytes).map_err(|e| e.to_string()).and_then(|(format, runs, pages)| {
                coi_parser::parse_computation(&name, format_name(format), &runs, pages)
                    .map_err(|e| e.to_string())
                    .map(|c| (format, dom_tables(&bytes, format).len(), c))
            })
        });

        match outcome {
            Ok((format, tagged_tables, computation)) => {
                let report = coi_validation::validate(&computation);
                let value = serde_json::to_value(&computation).unwrap_or_default();
                let relational = coi_parser::to_relational(&computation, tagged_tables);
                let relational_value = serde_json::to_value(&relational).unwrap_or_default();

                let mut schema_errors =
                    coi_validation::validate_against_schema(&value).unwrap_or_else(|e| vec![e.to_string()]);
                schema_errors.extend(
                    coi_validation::validate_relational_schema(&relational_value)
                        .unwrap_or_else(|e| vec![e.to_string()]),
                );

                if !schema_errors.is_empty() {
                    schema_failures += 1;
                }
                math_errors += report.errors();
                ok += 1;

                if let Some(out) = &out_dir {
                    let target = out.join(format!(
                        "{}.json",
                        path.file_stem().unwrap_or_default().to_string_lossy()
                    ));
                    let document = serde_json::json!({
                        "computation": value,
                        "relational": relational_value,
                        "validation": report,
                        "schema_errors": schema_errors,
                    });
                    if let Ok(text) = serde_json::to_string_pretty(&document) {
                        if let Err(e) = fs::write(&target, text) {
                            eprintln!("{}: {e}", target.display());
                        }
                    }
                }

                if as_json {
                    records.push(serde_json::json!({
                        "computation": value, "relational": relational_value,
                        "validation": report, "schema_errors": schema_errors
                    }));
                } else {
                    let status = if !schema_errors.is_empty() {
                        format!("SCHEMA x{}", schema_errors.len())
                    } else if report.errors() > 0 {
                        "MATH".to_string()
                    } else {
                        "OK".to_string()
                    };
                    println!(
                        "{:<46} {:>4} {:>5} {:>6} {:>5} {:>5}  {}",
                        short,
                        format_name(format),
                        computation.raw.page_count,
                        computation.raw.lines.len(),
                        report.errors(),
                        report.warnings(),
                        status
                    );
                }
            }
            Err(e) => {
                failed += 1;
                // Named and surfaced; a file that could not be read never
                // disappears quietly from the run.
                if as_json {
                    records.push(serde_json::json!({ "source": name, "error": e }));
                } else {
                    println!(
                        "{:<46} {:>4} {:>5} {:>6} {:>5} {:>5}  FAILED: {}",
                        short, "-", "-", "-", "-", "-", e
                    );
                }
                if let Some(out) = &out_dir {
                    let target = out.join(format!(
                        "{}.json",
                        path.file_stem().unwrap_or_default().to_string_lossy()
                    ));
                    let document = serde_json::json!({ "source": name, "status": "FAILED", "error": e });
                    if let Ok(text) = serde_json::to_string_pretty(&document) {
                        let _ = fs::write(&target, text);
                    }
                }
            }
        }
    }

    if as_json {
        match serde_json::to_string_pretty(&records) {
            Ok(t) => println!("{t}"),
            Err(e) => eprintln!("serialisation failed: {e}"),
        }
    } else {
        println!("{}", "-".repeat(110));
        println!(
            "{}/{} processed, {} failed, {} with schema errors, {} math errors",
            ok,
            files.len(),
            failed,
            schema_failures,
            math_errors
        );
    }

    if failed == 0 && schema_failures == 0 { ExitCode::SUCCESS } else { ExitCode::FAILURE }
}
