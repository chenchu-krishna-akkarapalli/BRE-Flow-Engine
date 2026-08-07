// payslip-cli — decode one payslip or a whole directory.
//
//   payslip-cli <file.pdf>              parsed payslip as JSON
//   payslip-cli <file.pdf> --raw        raw runs + lines only, no interpretation
//   payslip-cli --batch <dir>           one summary row per file, exit 1 on any failure
//   payslip-cli --batch <dir> --out <d> plus one JSON document per payslip

use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use payslip_core::TextSource;
use payslip_pdf::PdfTextSource;

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().collect();
    let flag = |name: &str| args.iter().any(|a| a == name);
    let positional: Vec<&String> = args[1..].iter().filter(|a| !a.starts_with("--")).collect();

    if positional.is_empty() {
        eprintln!(
            "Usage: payslip-cli <file.pdf> [--raw] [--pretty]\n       payslip-cli --batch <dir> [--json]"
        );
        return ExitCode::from(2);
    }

    if flag("--batch") {
        let out_dir = args
            .iter()
            .position(|a| a == "--out")
            .and_then(|i| args.get(i + 1))
            .map(PathBuf::from);
        run_batch(Path::new(positional[0]), flag("--json"), out_dir)
    } else {
        run_single(Path::new(positional[0]), flag("--raw"), flag("--pretty"))
    }
}

fn run_single(path: &Path, raw_only: bool, pretty: bool) -> ExitCode {
    let bytes = match fs::read(path) {
        Ok(b) => b,
        Err(e) => {
            eprintln!("{}: {e}", path.display());
            return ExitCode::FAILURE;
        }
    };

    let source = PdfTextSource;
    let runs = match source.extract_runs(&bytes) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("{}: {e}", path.display());
            return ExitCode::FAILURE;
        }
    };
    let pages = source.page_count(&bytes).unwrap_or(0);

    let json = if raw_only {
        let lines = payslip_layout::group_lines(&runs);
        serde_json::json!({ "source": path.display().to_string(), "pages": pages, "runs": runs, "lines": lines })
    } else {
        match payslip_parser::parse_payslip(&path.display().to_string(), &runs, pages) {
            Ok(p) => serde_json::to_value(&p).unwrap_or_else(|e| serde_json::json!({ "error": e.to_string() })),
            Err(e) => {
                eprintln!("{}: {e}", path.display());
                return ExitCode::FAILURE;
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

fn run_batch(dir: &Path, as_json: bool, out_dir: Option<PathBuf>) -> ExitCode {
    if let Some(out) = &out_dir {
        if let Err(e) = fs::create_dir_all(out) {
            eprintln!("{}: {e}", out.display());
            return ExitCode::FAILURE;
        }
    }
    let mut files: Vec<PathBuf> = match fs::read_dir(dir) {
        Ok(entries) => entries
            .filter_map(|e| e.ok().map(|e| e.path()))
            .filter(|p| {
                p.extension()
                    .and_then(|e| e.to_str())
                    .is_some_and(|e| e.eq_ignore_ascii_case("pdf"))
            })
            .collect(),
        Err(e) => {
            eprintln!("{}: {e}", dir.display());
            return ExitCode::FAILURE;
        }
    };
    files.sort();

    let source = PdfTextSource;
    let mut ok = 0usize;
    let mut failed = 0usize;
    let mut records = Vec::new();

    if !as_json {
        println!("{:<44} {:>5} {:>6} {:>4} {:>4} {:>14}  {}", "FILE", "PAGES", "LINES", "ERN", "DED", "NET", "STATUS");
        println!("{}", "-".repeat(104));
    }

    for path in &files {
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("?");
        let short: String = name.chars().take(43).collect();

        let outcome = fs::read(path)
            .map_err(|e| e.to_string())
            .and_then(|bytes| {
                let pages = source.page_count(&bytes).unwrap_or(0);
                source
                    .extract_runs(&bytes)
                    .map_err(|e| e.to_string())
                    .and_then(|runs| {
                        payslip_parser::parse_payslip(name, &runs, pages).map_err(|e| e.to_string())
                    })
            });

        // A per-document file is written for successes AND failures: a payslip
        // missing from the output directory would otherwise be indistinguishable
        // from one that was never submitted.
        if let Some(out) = &out_dir {
            let target = out.join(format!("{}.json", path.file_stem().unwrap_or_default().to_string_lossy()));
            let document = match &outcome {
                Ok(slip) => serde_json::to_value(slip).unwrap_or_else(|e| {
                    serde_json::json!({ "source": name, "error": e.to_string() })
                }),
                Err(e) => serde_json::json!({ "source": name, "status": "FAILED", "error": e }),
            };
            match serde_json::to_string_pretty(&document) {
                Ok(text) => {
                    if let Err(e) = fs::write(&target, text) {
                        eprintln!("{}: {e}", target.display());
                    }
                }
                Err(e) => eprintln!("{}: {e}", target.display()),
            }
        }

        match outcome {
            Ok(slip) => {
                ok += 1;
                if as_json {
                    records.push(serde_json::to_value(&slip).unwrap_or_default());
                } else {
                    println!(
                        "{:<44} {:>5} {:>6} {:>4} {:>4} {:>14}  OK ({})",
                        short,
                        slip.raw.page_count,
                        slip.raw.lines.len(),
                        slip.earnings.len(),
                        slip.deductions.len(),
                        slip.net_pay.as_ref().map(|m| m.raw.clone()).unwrap_or_else(|| "-".into()),
                        slip.format,
                    );
                }
            }
            Err(e) => {
                failed += 1;
                // Surfaced, never swallowed: a file that could not be read is
                // reported by name with its reason and fails the run.
                if as_json {
                    records.push(serde_json::json!({ "source": name, "error": e }));
                } else {
                    println!("{:<44} {:>5} {:>6} {:>4} {:>4} {:>14}  FAILED: {}", short, "-", "-", "-", "-", "-", e);
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
        println!("{}", "-".repeat(104));
        println!("{}/{} processed, {} failed", ok, files.len(), failed);
    }

    if failed == 0 { ExitCode::SUCCESS } else { ExitCode::FAILURE }
}
