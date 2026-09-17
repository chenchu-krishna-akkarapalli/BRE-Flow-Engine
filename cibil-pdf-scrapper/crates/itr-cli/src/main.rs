use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use itr_pdf::extract_text_from_pdf_bytes;
use itr_parser::parse_itr_document;
use itr_validation::validate_itr_document;

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().collect();
    let flag = |name: &str| args.iter().any(|a| a == name);
    let value_of = |name: &str| {
        args.iter().position(|a| a == name).and_then(|i| args.get(i + 1)).map(PathBuf::from)
    };
    let positional: Vec<&String> = args[1..].iter().filter(|a| !a.starts_with("--")).collect();

    if positional.is_empty() {
        eprintln!(
            "Usage: itr-cli <file.pdf> [--pretty]\n       itr-cli --batch <dir> [--out <out_dir>] [--json]"
        );
        return ExitCode::from(2);
    }

    if flag("--batch") {
        let output_dir = value_of("--out").unwrap_or_else(|| PathBuf::from("cibil-pdf-scrapper/itr-output"));
        run_batch(Path::new(positional[0]), &output_dir, flag("--json"))
    } else {
        run_single(Path::new(positional[0]), flag("--pretty"))
    }
}

fn read_input(path: &Path) -> std::io::Result<Vec<u8>> {
    if path == Path::new("-") {
        let mut buf = Vec::new();
        std::io::stdin().read_to_end(&mut buf)?;
        
        // Handle IPC framing header: [8-byte little endian header length][json config][raw pdf bytes]
        if buf.len() >= 8 {
            let header_len = u64::from_le_bytes(buf[..8].try_into().unwrap()) as usize;
            if buf.len() >= 8 + header_len {
                return Ok(buf[8 + header_len..].to_vec());
            }
        }
        Ok(buf)
    } else {
        fs::read(path)
    }
}

fn run_single(path: &Path, pretty: bool) -> ExitCode {
    let bytes = match read_input(path) {
        Ok(b) => b,
        Err(e) => {
            eprintln!("Error reading input: {e}");
            return ExitCode::FAILURE;
        }
    };

    let text = match extract_text_from_pdf_bytes(&bytes) {
        Ok(t) => t,
        Err(e) => {
            eprintln!("Error extracting text: {e}");
            return ExitCode::FAILURE;
        }
    };

    let mut doc = match parse_itr_document(&text) {
        Ok(d) => d,
        Err(e) => {
            eprintln!("Error parsing document: {e}");
            return ExitCode::FAILURE;
        }
    };

    if let Err(e) = validate_itr_document(&doc) {
        eprintln!("Validation warning: {e}");
    }

    let json_str = if pretty {
        serde_json::to_string_pretty(&doc).unwrap()
    } else {
        serde_json::to_string(&doc).unwrap()
    };

    println!("{json_str}");
    ExitCode::SUCCESS
}

fn run_batch(input_dir: &Path, output_dir: &Path, json_only: bool) -> ExitCode {
    if let Err(e) = fs::create_dir_all(output_dir) {
        eprintln!("Failed to create output dir: {e}");
        return ExitCode::FAILURE;
    }

    let entries = match fs::read_dir(input_dir) {
        Ok(e) => e,
        Err(e) => {
            eprintln!("Failed to read input dir: {e}");
            return ExitCode::FAILURE;
        }
    };

    let mut count = 0;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()).map(|ext| ext.eq_ignore_ascii_case("pdf")).unwrap_or(false) {
            if let Ok(bytes) = fs::read(&path) {
                if let Ok(text) = extract_text_from_pdf_bytes(&bytes) {
                    if let Ok(doc) = parse_itr_document(&text) {
                        let out_path = output_dir.join(format!("{}.json", path.file_stem().unwrap().to_str().unwrap()));
                        if let Ok(json_bytes) = serde_json::to_vec_pretty(&doc) {
                            let _ = fs::write(&out_path, json_bytes);
                            count += 1;
                        }
                    }
                }
            }
        }
    }

    if !json_only {
        println!("Batch processing completed for {count} PDF files.");
    }
    ExitCode::SUCCESS
}
