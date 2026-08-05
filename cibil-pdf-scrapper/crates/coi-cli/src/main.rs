// coi-cli — decode and validate Computation of Income documents.
//
//   coi-cli <file>                      parsed computation as JSON
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
            "Usage: coi-cli <file> [--raw] [--validate] [--pretty]\n       coi-cli --batch <dir> [--out <dir>] [--json]"
        );
        return ExitCode::from(2);
    }

    if flag("--batch") {
        run_batch(Path::new(positional[0]), value_of("--out"), flag("--json"))
    } else {
        run_single(Path::new(positional[0]), flag("--raw"), flag("--validate"), flag("--pretty"))
    }
}

fn format_name(format: DocumentFormat) -> &'static str {
    match format {
        DocumentFormat::Pdf => "Pdf",
        DocumentFormat::Rtf => "Rtf",
    }
}

fn run_single(path: &Path, raw_only: bool, validate_only: bool, pretty: bool) -> ExitCode {
    let bytes = match fs::read(path) {
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
    let json = if raw_only {
        serde_json::json!({
            "source": name, "format": format_name(format), "pages": pages,
            "lines": coi_layout::group_lines(&runs),
        })
    } else {
        let computation =
            match coi_parser::parse_computation(&name, format_name(format), &runs, pages) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("{name}: {e}");
                    return ExitCode::FAILURE;
                }
            };
        if validate_only {
            serde_json::to_value(coi_validation::validate(&computation)).unwrap_or_default()
        } else {
            serde_json::to_value(&computation).unwrap_or_default()
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
                    .map(|c| (format, c))
            })
        });

        match outcome {
            Ok((format, computation)) => {
                let report = coi_validation::validate(&computation);
                let value = serde_json::to_value(&computation).unwrap_or_default();
                let schema_errors =
                    coi_validation::validate_against_schema(&value).unwrap_or_else(|e| vec![e.to_string()]);

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
                        "computation": value, "validation": report, "schema_errors": schema_errors
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
