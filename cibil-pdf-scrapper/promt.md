### System Meta-Prompt Architecture

```text
========================================================================================================================
SYSTEM ROLE: Senior Google AI Prompt Engineer & Document Intelligence Architect
TASK: Direct a state-of-the-art LLM to act as a Principal Rust Software Architect to design and generate an 
      enterprise-grade, production-ready CIBIL PDF Data Extraction Engine in Rust.
DESIGN METRIC: 100% relational integrity, zero-copy optimization, complete adherence to the 5-Stage Lifecycle.
========================================================================================================================

```

---

## The Master Meta-Prompt

Copy and paste the absolute blueprint block below into your terminal execution layer to drive the context generation:

```text
You are a Principal Rust Software Architect, Google AI Research Engineer, and Financial Document Intelligence Specialist. Your task is to architect and generate a production-ready, enterprise-grade Rust workspace designed to parse, extract, structuralize, and serialize multi-page Indian CIBIL Credit Reports (PDF) into a highly relational JSON graph. 

The system must guarantee absolute parent-child relationship integrity between parsed credit accounts, metadata descriptors, and multi-year chronological Days Past Due (DPD) data matrix sub-tables without flattening structural hierarchies.

CRITICAL SECURITY AND REACTION CONSTRAINT:
This engine processes sensitive personal data. If any live data stream or test string contains a 12-digit Indian Aadhaar number, the engine MUST redact or substitute the digits with a generic mask or token (e.g., `[Aadhaar Redacted]` or `0000-0000-0000`) before data serialization. You must strictly enforce this masking protocol within your validation and serialization structures.

Execute your architectural definition systematically across the following 5 processing execution layers:

========================================================================================================================
STAGE 1: PROTOTYPE (FOUNDATIONAL ARCHITECTURE & MODULE MATRIX)
========================================================================================================================
Deconstruct the processing runtime into a decoupled Layered Architecture layout. Provide the complete `Cargo.toml` workspace and project layout graph adhering to this blueprint:
- `cibil-core`: Document state machine execution, traits, errors.
- `cibil-layout`: Coordinate extraction geometry (`BoundingBox`, `Point`), XY-Cut segmentation, text-run reading recovery.
- `cibil-parser`: Highly specialized lexical extractors for Consumer Info, Scores, Account Registries, and Enquiries.
- `cibil-graph`: Contextual DAG mapping parents, attributes, and child objects via node-index references.

Define the strict data domain memory maps using standard Rust primitives, avoiding unnecessary allocations. Explicitly map out the structures for:
1. `ReportMetadata`
2. `CreditAccount` (containing indices, types, ownership, balances, collateral, and a multi-tiered payment timeline map).
3. `PaymentHistory` (Year -> Month -> Status tracking mapping).

========================================================================================================================
STAGE 2: BUILDER (TRAIT CONTRACTS & TRACEABLE STRUCTS)
========================================================================================================================
Generate the complete production code contracts using clean idiom-compliant Rust. Implement:
1. An explicit `Result<T, E>` driven Error Matrix using a comprehensive custom error enum covering PDF reading errors, layout rendering failures, parsing anomalies, and graph cycle errors.
2. The foundational Trait abstractions for interchangeable PDF loading and OCR engines via flexible Adapter structural design patterns.
3. The concrete implementation for the DPD Matrix Stitching logic. Write a processing loop that accepts messy extracted lines, maps out row column indices, processes row entries starting with explicit year headers, and chronologically merges month tokens ("JAN" to "DEC") using standard vector tokenization or zipping.

========================================================================================================================
STAGE 3: SWEEPER (MEMORY LAYER, PERFORMANCE & GEOMETRICAL SAFETY)
========================================================================================================================
Enforce memory efficiency and strict reference performance boundaries:
1. Avoid arbitrary string allocations. Rely heavily on zero-copy parsing techniques using `std::borrow::Cow` or lifetime slices (`&'a str`) pinned directly to the loaded document buffer where possible.
2. Outline the safety requirements for multi-threaded parsing execution using standard data parallel primitives (`Send`, `Sync`, or `Rayon` thread pooling).
3. Mitigate multi-page layout anomalies: detailed edge-case mitigation logic for columns shifting horizontally across page breaks, text wrapping boundaries inside tight cells, and visual headers repeating dynamically over long account loops.

========================================================================================================================
STAGE 4: GROWER (PROVIDER AGNOSTIC EXPANSION ARCHITECTURE)
========================================================================================================================
Demonstrate provider independence by decoupling CIBIL parsing logic from core document intelligence layers. Design an abstraction layout that allows swapping internal parser components for alternative global bureaus (Experian, Equifax, CRIF High Mark) or generic banking streams without altering downstream relational graph builders.

========================================================================================================================
STAGE 5: MAINTAINER (VALIDATION, SCHEMA DEFINITIONS & VERIFICATION)
========================================================================================================================
Deliver the completion artifacts for operational long-term use:
1. A valid, mock serialization function output sample showing exactly how a complex structural JSON output must look once processed through the validation layer.
2. A declarative step-by-step pipeline execution design summary describing exactly how data should transition deterministically from a raw input stream down to the serialized relational database schema output.

```

---

## 🛠️ Complete Structural Reference Implementation

The blueprint architecture, trait maps, and data stitching core engines generated by this architectural profile match enterprise requirements:

### Project Architecture & Folder Layout

```text
cibil-intelligence-workspace/
├── Cargo.toml
├── crates/
│   ├── cibil-core/
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── error.rs
│   │       └── traits.rs
│   ├── cibil-layout/
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       └── geometry.rs
│   ├── cibil-parser/
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── account.rs
│   │       └── metadata.rs
│   └── cibil-graph/
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs
│           └── relational.rs

```

### Complete Workspace Manifest (`/Cargo.toml`)

```toml
[workspace]
members = [
    "crates/cibil-core",
    "crates/cibil-layout",
    "crates/cibil-parser",
    "crates/cibil-graph"
]
resolver = "2"

[workspace.dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
regex = "1.10"
thiserror = "1.0"
log = "0.4"

```

---

### Core Data Domain Models & Parsing Implementation

This implementation models the structural domains using zero-copy tracking concepts, generic trait abstraction layer patterns, and type-safe data transformations.

#### 1. Core Error Domain Contract (`crates/cibil-core/src/error.rs`)

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum CibilError {
    #[error("I/O error encountered while reading document stream: {0}")]
    IoError(#[from] std::io::Error),

    #[error("PDF layout engine failure: {0}")]
    PdfPdfError(String),

    #[error("Lexical token extraction fault at page {page}, block {block}: {reason}")]
    ExtractionFault {
        page: usize,
        block: usize,
        reason: String,
    },

    #[error("Relational schema violation: parent reference index {0} missing in execution graph")]
    OrphanedNodeError(u32),

    #[error("Serialization constraint failure: {0}")]
    SerializationError(String),

    #[error("Unknown parsing failure: {0}")]
    Unknown(String),
}

pub type Result<T> = std::result::Result<T, CibilError>;

```

#### 2. Layout Trait Interfaces (`crates/cibil-core/src/traits.rs`)

```rust
use crate::error::Result;
use std::borrow::Cow;

#[derive(Debug, Clone)]
pub struct ExtractedBlock<'a> {
    pub raw_text: Cow<'a, str>,
    pub bounding_box: [f32; 4], // [x0, y0, x1, y1]
    pub page_number: usize,
}

pub trait PdfDocumentLoader: Send + Sync {
    fn load_bytes(&self, bytes: &[u8]) -> Result<()>;
    fn extract_page_blocks(&self, page_idx: usize) -> Result<Vec<ExtractedBlock>>;
    fn total_pages(&self) -> usize;
}

pub trait OcrEngineAdapter: Send + Sync {
    fn process_image_block(&self, image_raw: &[u8]) -> Result<ExtractedBlock<'static>>;
}

```

#### 3. Domain Model Registry (`crates/cibil-parser/src/account.rs`)

```rust
use serde::{Serialize, Deserialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub enum AccountStatus {
    Active,
    Inactive,
    WrittenOff,
    SuitFiled,
    Unknown,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReportMetadata {
    pub report_date: String,
    pub control_number: String,
    pub consumer_name: String,
    pub cibil_score: u16,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CreditAccount {
    pub index: u32,
    pub account_type: String,
    pub status: AccountStatus,
    pub date_opened: Option<String>,
    pub sanctioned_amount: Option<u64>,
    pub current_balance: Option<u64>,
    pub collateral_type: Option<String>,
    pub collateral_value: Option<u64>,
    pub payment_history: HashMap<String, HashMap<String, Option<String>>>, // Year -> (Month -> DPD/Status)
}

```

#### 4. Type-Safe DPD Matrix Stitching Implementation

This logic handles layout-wrapped textual anomalies where rows span cross-page text limits:

```rust
use regex::Regex;
use std::collections::HashMap;

pub struct DpdStitcher;

impl DpdStitcher {
    /// Compiles spatial segment metrics and zips rows with chronological headers
    pub fn stitch_dpd_matrix(raw_block: &str) -> HashMap<String, HashMap<String, Option<String>>> {
        let mut history: HashMap<String, HashMap<String, Option<String>>> = HashMap::new();
        let months = vec!["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        
        let year_regex = Regex::new(r"^(20\d{2})").unwrap();
        let token_regex = Regex::new(r"[\s|]+").unwrap();

        let lines: Vec<&str> = raw_block.lines().map(|l| l.trim()).collect();

        for line in lines {
            if let Some(captures) = year_regex.captures(line) {
                let year = captures.get(1).unwrap().as_str().to_string();
                
                // Segment remainder elements filtering out noise metrics
                let remaining_tokens: Vec<&str> = token_regex.split(line)
                    .filter(|s| !s.is_empty() && *s != &year)
                    .collect();

                let mut month_map = HashMap::new();
                for (idx, month) in months.iter().enumerate() {
                    if idx < remaining_tokens.len() {
                        let token_val = remaining_tokens[idx];
                        // Clean values containing OCR artifacts
                        let clean_val = match token_val {
                            "000" | "STD" | "XXX" => Some(token_val.to_string()),
                            val if val.chars().all(char::is_numeric) => Some(val.to_string()),
                            _ => None
                        };
                        month_map.insert(month.to_string(), clean_val);
                    } else {
                        month_map.insert(month.to_string(), None);
                    }
                }
                history.insert(year, month_map);
            }
        }
        history
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dpd_matrix_stitching() {
        let mock_raw_block = "2026 000 000 000 XXX\n2025 STD STD 015 000 000";
        let history_map = DpdStitcher::stitch_dpd_matrix(mock_raw_block);

        assert!(history_map.contains_key("2026"));
        assert_eq!(history_map.get("2026").unwrap().get("JAN").unwrap(), &Some("000".to_string()));
        assert_eq!(history_map.get("2026").unwrap().get("APR").unwrap(), &Some("XXX".to_string()));
    }
}

```

---

### Verification Schema Block Definition

The structured execution pipeline yields deterministic relational outputs aligned to this JSON production schema specification:

```json
{
  "report_metadata": {
    "report_date": "06/05/2026",
    "control_number": "10948002903",
    "consumer_name": "CB Vanajakshi",
    "cibil_score": 779
  },
  "accounts": [
    {
      "index": 1,
      "account_type": "GOLD LOAN",
      "status": "ACTIVE",
      "date_opened": "23/03/2026",
      "sanctioned_amount": 27550,
      "current_balance": 27550,
      "collateral_type": "GOLD",
      "collateral_value": 41200,
      "payment_history": {
        "2026": {
          "JAN": "000",
          "FEB": "000",
          "MAR": null,
          "APR": null,
          "MAY": null,
          "JUN": null,
          "JUL": null,
          "AUG": null,
          "SEP": null,
          "OCT": null,
          "NOV": null,
          "DEC": null
        }
      }
    }
  ]
}

```