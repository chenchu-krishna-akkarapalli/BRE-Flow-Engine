use regex::Regex;
use cibil_core::error::Result;
use cibil_layout::geometry::{LayoutElement, find_value_by_key_alignment_with_confidence};
use crate::models::{ReportMetadata, ConsumerInfo, ScoreInfo, AccountsSummary, CreditAccount, AccountStatus, EnquiryDetail, AddressDetail, EmploymentDetail, DocumentConfidence, CibilReport};
use crate::dpd::{DpdStitcher, redact_aadhaar};

pub struct CibilParser;

fn find_val(elements: &[LayoutElement], query: &str, confs: &mut Vec<f32>) -> Option<String> {
    if let Some((val, conf)) = find_value_by_key_alignment_with_confidence(elements, query) {
        confs.push(conf);
        Some(val)
    } else {
        None
    }
}

impl CibilParser {
    pub fn parse_report(elements: &[LayoutElement]) -> Result<CibilReport> {
        let mut layout_confidences = Vec::new();

        let report_metadata = parse_metadata(elements, &mut layout_confidences)?;
        let consumer_info = parse_consumer_info(elements, &mut layout_confidences)?;
        let score_info = parse_score_info(elements, &mut layout_confidences)?;
        let accounts = parse_accounts(elements, &mut layout_confidences)?;
        let accounts_summary = parse_accounts_summary(elements, &accounts, &mut layout_confidences)?;
        let enquiries = parse_enquiries(elements, &mut layout_confidences)?;
        let addresses = parse_addresses(elements, &mut layout_confidences)?;
        let employment = parse_employment(elements, &mut layout_confidences)?;

        // Compute Character Confidence dynamically (detecting replacement/garbled chars)
        let total_chars: usize = elements.iter().map(|el| el.text.len()).sum();
        let garbled_chars: usize = elements.iter()
            .map(|el| el.text.chars().filter(|&c| c == '\u{FFFD}').count())
            .sum();
        let character_confidence = if total_chars > 0 {
            ((total_chars - garbled_chars) as f32) / (total_chars as f32)
        } else {
            1.0
        };

        // Compute Layout Confidence dynamically
        let layout_confidence = if !layout_confidences.is_empty() {
            layout_confidences.iter().sum::<f32>() / layout_confidences.len() as f32
        } else {
            0.97
        };

        // Compute Relationship Confidence dynamically based on relational coherence
        let mut relationship_score: f32 = 1.0;
        if accounts_summary.total_accounts != accounts.len() as u32 {
            relationship_score -= 0.1;
        }
        let sum_balances: u64 = accounts.iter().map(|a| a.current_balance.unwrap_or(0)).sum();
        if sum_balances != accounts_summary.total_balance {
            relationship_score -= 0.1;
        }
        let relationship_confidence = relationship_score.clamp(0.5, 1.0);

        let overall_score = (character_confidence + layout_confidence + relationship_confidence) / 3.0;

        let confidence = DocumentConfidence {
            character_confidence,
            layout_confidence,
            relationship_confidence,
            overall_score,
        };

        Ok(CibilReport {
            report_metadata,
            consumer_info,
            score_info,
            accounts_summary,
            accounts,
            enquiries,
            addresses,
            employment,
            confidence,
            validation_errors: Vec::new(),
        })
    }
}

fn parse_metadata(elements: &[LayoutElement], confs: &mut Vec<f32>) -> Result<ReportMetadata> {
    let mut report_date = String::new();
    let mut control_number = String::new();

    let date_re = Regex::new(r"(\d{2}[/-]\d{2}[/-]\d{4})").unwrap();
    let ctrl_re = Regex::new(r"\b(\d{11}|\d{2},\d{2},\d{2},\d{2},\d{3}|\d{10})\b").unwrap();

    // Search for Date and Control Number
    for el in elements {
        let text_upper = el.text.to_uppercase();
        if (text_upper.contains("REPORT DATE") || text_upper.contains("DATE:") || text_upper.contains("DATE :")) && report_date.is_empty() {
            if let Some(caps) = date_re.captures(&el.text) {
                report_date = caps.get(1).unwrap().as_str().to_string();
            }
        }
        if text_upper.contains("CONTROL NUMBER") && control_number.is_empty() {
            if let Some(caps) = ctrl_re.captures(&el.text) {
                control_number = caps.get(1).unwrap().as_str().replace(",", "");
            }
        }
    }

    // Fallbacks
    if report_date.is_empty() {
        if let Some(val) = find_val(elements, "DATE", confs) {
            if let Some(caps) = date_re.captures(&val) {
                report_date = caps.get(1).unwrap().as_str().to_string();
            }
        }
    }
    if control_number.is_empty() {
        if let Some(val) = find_val(elements, "CONTROL NUMBER", confs) {
            let digits: String = val.chars().filter(|c| c.is_ascii_digit()).collect();
            if !digits.is_empty() {
                control_number = digits;
            }
        }
    }
    if control_number.is_empty() {
        // Scan all elements for any 11-digit or 10-digit number
        for el in elements {
            if let Some(caps) = ctrl_re.captures(&el.text) {
                control_number = caps.get(1).unwrap().as_str().replace(",", "");
                break;
            }
        }
    }

    if report_date.is_empty() {
        report_date = "01/01/2026".to_string();
    }
    if control_number.is_empty() {
        control_number = "00000000000".to_string();
    }

    Ok(ReportMetadata {
        report_date,
        control_number,
        version: "CIBILv3".to_string(),
    })
}

fn parse_consumer_info(elements: &[LayoutElement], confs: &mut Vec<f32>) -> Result<ConsumerInfo> {
    let mut consumer_name = String::new();
    let mut pan = None;
    let mut date_of_birth = None;
    let mut gender = None;

    // Standard labels
    let name_labels = ["CONSUMER NAME", "CONSUMER:", "CONSUMER :", "NAME:"];
    for label in &name_labels {
        if let Some(val) = find_val(elements, label, confs) {
            let cleaned = val.trim().to_string();
            // Ensure the value isn't a long instruction or header block
            if !cleaned.is_empty() && cleaned.len() < 80 && !cleaned.contains("ACCOUNT") {
                consumer_name = redact_aadhaar(&cleaned);
                break;
            }
        }
    }

    if consumer_name.is_empty() {
        // Fallback: search raw text runs
        for el in elements {
            let text_upper = el.text.to_uppercase();
            if text_upper.contains("CONSUMER:") {
                let parts: Vec<&str> = el.text.split(':').collect();
                if parts.len() > 1 {
                    let name = parts[1].trim().to_string();
                    if !name.is_empty() && name.len() < 80 {
                        consumer_name = redact_aadhaar(&name);
                        break;
                    }
                }
            }
        }
    }

    if let Some(val) = find_val(elements, "PAN", confs) {
        let p: String = val.chars().filter(|c| c.is_ascii_alphanumeric()).collect();
        if p.len() >= 10 {
            pan = Some(p.to_uppercase());
        }
    }
    if let Some(val) = find_val(elements, "DOB", confs) {
        date_of_birth = Some(val);
    } else if let Some(val) = find_val(elements, "DATE OF BIRTH", confs) {
        date_of_birth = Some(val);
    }
    if let Some(val) = find_val(elements, "GENDER", confs) {
        gender = Some(val);
    }

    if consumer_name.is_empty() {
        consumer_name = "UNKNOWN CONSUMER".to_string();
    }

    Ok(ConsumerInfo {
        consumer_name,
        pan,
        date_of_birth,
        gender,
        phone: None,
        email: None,
    })
}

fn parse_score_info(elements: &[LayoutElement], _confs: &mut Vec<f32>) -> Result<ScoreInfo> {
    let mut cibil_score = 0;
    let mut grameen_score = None;
    let score_re = Regex::new(r"\b(3\d{2}|[4-8]\d{2}|900)\b").unwrap();

    // First pass: check if any run contains both a score header and a 3-digit score
    for el in elements {
        let text_upper = el.text.to_uppercase();
        if (text_upper.contains("SCORE") || text_upper.contains("CREDITVISION")) && score_re.is_match(&el.text) {
            if let Some(caps) = score_re.captures(&el.text) {
                let val: u16 = caps.get(1).unwrap().as_str().parse().unwrap_or(0);
                // Exclude limits "300" and "900" if we find them in range limits text
                if val > 0 && !(val == 300 && text_upper.contains("300 (HIGH RISK)")) && !(val == 900 && text_upper.contains("900 (LOW RISK)")) {
                    cibil_score = val;
                    break;
                }
            }
        }
    }

    // Look for "CREDITVISION Score" or similar if first pass didn't find it
    let score_headers = ["CREDITVISION", "SCORE", "CIBIL SCORE"];
    for header in &score_headers {
        if cibil_score > 0 {
            break;
        }
        if let Some(idx) = elements.iter().position(|el| el.text.to_uppercase().contains(header)) {
            let score_el = &elements[idx];
            // Find closest 3-digit candidate
            let mut candidates = Vec::new();
            for el in elements {
                if let Some(caps) = score_re.captures(&el.text) {
                    let val: u16 = caps.get(1).unwrap().as_str().parse().unwrap();
                    let dx = el.bbox.x0 - score_el.bbox.x0;
                    let dy = el.bbox.y0 - score_el.bbox.y0;
                    let dist = (dx*dx + dy*dy).sqrt();
                    candidates.push((val, dist));
                }
            }
            candidates.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
            if let Some((score_val, _)) = candidates.first() {
                cibil_score = *score_val;
                break;
            }
        }
    }

    if cibil_score == 0 {
        // General search for any 3-digit score
        for el in elements {
            if let Some(caps) = score_re.captures(&el.text) {
                cibil_score = caps.get(1).unwrap().as_str().parse().unwrap();
                break;
            }
        }
    }

    // Check for grameen score
    for el in elements {
        if el.text.to_uppercase().contains("GRAMEEN") {
            // Check for negative score in same run or neighbor
            if el.text.contains("-2") {
                grameen_score = Some(-2);
            }
        }
    }

    // Personal-loan score is a separate, explicitly labelled score; many reports
    // carry only a CreditVision score and omit it entirely.
    let mut pl_score = None;
    let pl_re = Regex::new(r"(?i)(?:PERSONAL\s*LOAN|PL)\s*SCORE\s*:?\s*(-?\d{1,4})").unwrap();
    for el in elements {
        if let Some(caps) = pl_re.captures(&el.text) {
            if let Ok(v) = caps.get(1).unwrap().as_str().parse::<i16>() {
                pl_score = Some(v);
                break;
            }
        }
    }
    if pl_score.is_none() {
        // Label and value can land in separate elements on the same row.
        if let Some(label) = elements.iter().find(|el| {
            let t = el.text.to_uppercase();
            t.contains("PERSONAL LOAN SCORE")
        }) {
            let num_re = Regex::new(r"^-?\d{1,4}$").unwrap();
            pl_score = elements.iter()
                .filter(|el| el.bbox.y0 < label.bbox.y1 + 6.0 && el.bbox.y1 > label.bbox.y0 - 6.0)
                .filter(|el| el.bbox.x0 > label.bbox.x1)
                .find(|el| num_re.is_match(el.text.trim()))
                .and_then(|el| el.text.trim().parse::<i16>().ok());
        }
    }

    Ok(ScoreInfo {
        cibil_score,
        score_factors: Vec::new(),
        grameen_score,
        pl_score,
    })
}

fn parse_accounts_summary(elements: &[LayoutElement], accounts: &[CreditAccount], confs: &mut Vec<f32>) -> Result<AccountsSummary> {
    let mut total_accounts = accounts.len() as u32;
    let mut active_accounts = accounts.iter().filter(|a| a.status == AccountStatus::Active).count() as u32;
    let closed_accounts = accounts.iter().filter(|a| a.status == AccountStatus::Inactive).count() as u32;
    
    let total_balance = accounts.iter().map(|a| a.current_balance.unwrap_or(0)).sum();
    let total_sanctioned_amount = accounts.iter().map(|a| a.sanctioned_amount.unwrap_or(0)).sum();

    // Check if summary details exist in text
    if let Some(val) = find_val(elements, "Total", confs) {
        if let Ok(val_int) = val.parse::<u32>() {
            total_accounts = val_int;
        }
    }
    if let Some(val) = find_val(elements, "Active", confs) {
        if let Ok(val_int) = val.parse::<u32>() {
            active_accounts = val_int;
        }
    }

    Ok(AccountsSummary {
        total_accounts,
        active_accounts,
        closed_accounts,
        total_balance,
        total_sanctioned_amount,
    })
}

fn parse_accounts(elements: &[LayoutElement], confs: &mut Vec<f32>) -> Result<Vec<CreditAccount>> {
    let mut accounts = Vec::new();
    let numeric_header_re = Regex::new(r"^\b(\d+)\.\s*ACCOUNT\b").unwrap();
    
    // Step 1: Detect account start points
    let mut start_indices = Vec::new();
    for (idx, el) in elements.iter().enumerate() {
        let text_upper = el.text.to_uppercase();
        if numeric_header_re.is_match(&text_upper) || text_upper == "ACCOUNT NUMBER:" || text_upper == "ACCOUNT NUMBER: NOT" || text_upper.starts_with("MEMBER NAME:") {
            start_indices.push((idx, el));
        }
    }

    if start_indices.is_empty() {
        return Ok(accounts);
    }

    // Sort starts by page number first, then Y coordinate
    start_indices.sort_by(|a, b| {
        a.1.page.cmp(&b.1.page)
            .then_with(|| a.1.bbox.y0.partial_cmp(&b.1.bbox.y0).unwrap())
    });

    // Deduplicate starts: same-page within 100px (global Y), or cross-page
    // continuation where two markers are on adjacent pages and close in the
    // element array (within 20 elements — typical for a page-break continuation).
    let mut dedup_starts: Vec<(usize, &LayoutElement)> = Vec::new();
    for item in start_indices.iter() {
        if let Some(prev_item) = dedup_starts.last() {
            let same_page = item.1.page == prev_item.1.page;
            if same_page && (item.1.bbox.y0 - prev_item.1.bbox.y0) < 100.0 {
                continue;
            }
            // Cross-page continuation: adjacent pages and close element indices
            if !same_page && item.1.page == prev_item.1.page + 1
                && item.0.abs_diff(prev_item.0) < 20 {
                continue;
            }
        }
        dedup_starts.push(*item);
    }
    start_indices = dedup_starts;

    // Step 2: Segment into regions
    for (i, &(_header_idx, header_el)) in start_indices.iter().enumerate() {
        let mut index = (i + 1) as u32;
        let text_upper = header_el.text.to_uppercase();
        if let Some(caps) = numeric_header_re.captures(&text_upper) {
            index = caps.get(1).unwrap().as_str().parse().unwrap_or(index);
        }

        let y_start = header_el.bbox.y0;
        let y_end = if i + 1 < start_indices.len() {
            start_indices[i + 1].1.bbox.y0
        } else {
            f32::MAX
        };

        let card_elements: Vec<LayoutElement> = elements.iter()
            .filter(|el| el.bbox.y0 >= y_start && el.bbox.y0 < y_end)
            .cloned()
            .collect();

        // Account local layout confidence collector
        let mut acc_confs = Vec::new();

        // Segment into column-specific slices to prevent cross-column coordinate leakage
        let card_elements_col1: Vec<LayoutElement> = card_elements.iter()
            .filter(|el| el.bbox.x0 < 250.0)
            .cloned()
            .collect();

        let card_elements_col2: Vec<LayoutElement> = card_elements.iter()
            .filter(|el| el.bbox.x0 >= 250.0 && el.bbox.x0 < 450.0)
            .cloned()
            .collect();

        let card_elements_col3: Vec<LayoutElement> = card_elements.iter()
            .filter(|el| el.bbox.x0 >= 400.0 && el.bbox.x0 < 580.0)
            .cloned()
            .collect();

        let card_elements_col4: Vec<LayoutElement> = card_elements.iter()
            .filter(|el| el.bbox.x0 >= 550.0)
            .cloned()
            .collect();

        // Extract fields
        let account_type = find_val(&card_elements_col1, "TYPE", &mut acc_confs)
            .map(|s| redact_aadhaar(&s))
            .unwrap_or_else(|| "UNKNOWN TYPE".to_string());

        // Specific dispositions are tested before the generic ACTIVE/INACTIVE
        // substrings: a written-off account is usually also flagged ACTIVE.
        let mut status = AccountStatus::Unknown;
        let card_text_upper = card_elements.iter().map(|el| el.text.to_uppercase()).collect::<Vec<_>>().join(" ");
        let written_off_re = Regex::new(r"WRITTEN[\s-]?OFF").unwrap();
        let suit_filed_re = Regex::new(r"SUIT[\s-]?FILED").unwrap();
        if written_off_re.is_match(&card_text_upper) {
            status = AccountStatus::WrittenOff;
        } else if suit_filed_re.is_match(&card_text_upper) {
            status = AccountStatus::SuitFiled;
        } else if card_text_upper.contains("REPOSSESSED") {
            status = AccountStatus::Repossessed;
        } else if card_text_upper.contains("INACTIVE") || card_text_upper.contains("CLOSED") {
            status = AccountStatus::Inactive;
        } else if card_text_upper.contains("ACTIVE") {
            status = AccountStatus::Active;
        }

        let card_text = card_elements.iter().map(|el| el.text.as_ref()).collect::<Vec<_>>().join("\n");
        // The "CONSUMER CIR" layout writes these as inline "OPENED : dd-mm-yyyy"
        // without the "DATE" prefix that the tabular layout uses.
        let opened_re = Regex::new(r"(?i)(?:DATE\s*)?OPENED\s*:\s*(\d{2}[/-]\d{2}[/-]\d{4})").unwrap();
        let closed_re = Regex::new(r"(?i)(?:DATE\s*)?CLOSED\s*:\s*(\d{2}[/-]\d{2}[/-]\d{4})").unwrap();

        let date_opened = opened_re.captures(&card_text)
            .map(|c| c.get(1).unwrap().as_str().to_string())
            .or_else(|| {
                find_val(&card_elements_col1, "DATE OPENED", &mut acc_confs)
                    .or_else(|| find_val(&card_elements_col1, "DATE", &mut acc_confs))
            });

        let date_closed = closed_re.captures(&card_text)
            .map(|c| c.get(1).unwrap().as_str().to_string())
            .or_else(|| {
                find_val(&card_elements_col1, "DATE CLOSED", &mut acc_confs)
            });

        // Each candidate must survive parse_amount before the chain stops: a
        // non-numeric hit from an earlier lookup must not mask a later one.
        let sanctioned_amount = find_val(&card_elements_col2, "SANCTIONED", &mut acc_confs)
            .and_then(|s| parse_amount(&s))
            .or_else(|| find_val(&card_elements_col2, "SANCTIONED AMOUNT", &mut acc_confs).and_then(|s| parse_amount(&s)))
            .or_else(|| find_val(&card_elements_col2, "HIGH CREDIT AMOUNT", &mut acc_confs).and_then(|s| parse_amount(&s)))
            .or_else(|| find_val(&card_elements_col2, "CREDIT LIMIT", &mut acc_confs).and_then(|s| parse_amount(&s)))
            .or_else(|| find_inline(&card_text, "SANCTIONED").and_then(|s| parse_amount(&s)))
            .or_else(|| find_inline(&card_text, "HIGH CREDIT").and_then(|s| parse_amount(&s)))
            .or_else(|| find_inline(&card_text, "CREDIT LIMIT").and_then(|s| parse_amount(&s)));

        let current_balance = find_val(&card_elements_col2, "CURRENT", &mut acc_confs)
            .and_then(|s| parse_amount(&s))
            .or_else(|| find_val(&card_elements_col2, "CURRENT BALANCE", &mut acc_confs).and_then(|s| parse_amount(&s)))
            .or_else(|| find_inline(&card_text, "CURRENT BALANCE").and_then(|s| parse_amount(&s)));

        let ownership = find_val(&card_elements_col1, "OWNERSHIP", &mut acc_confs)
            .or_else(|| find_inline(&card_text, "OWNERSHIP"));

        let collateral_type = find_val(&card_elements_col3, "COLLATERAL TYPE", &mut acc_confs)
            .map(|s| redact_aadhaar(&s));

        let collateral_value = find_val(&card_elements_col2, "COLLATERAL VALUE", &mut acc_confs)
            .and_then(|s| parse_amount(&s));

        // This label frequently sits on its own line with the value wrapped
        // beneath it, so the newline is optional.
        let cfs_re = Regex::new(r"(?i)CREDIT\s*FACILITY\s*STATUS\s*:\s*\n?\s*([A-Z][A-Z0-9 \-/()]{1,40})").unwrap();
        let credit_facility_status = find_val(&card_elements_col4, "CREDIT FACILITY STATUS", &mut acc_confs)
            .or_else(|| find_val(&card_elements_col4, "CREDIT FACILITY", &mut acc_confs))
            .or_else(|| {
                cfs_re.captures(&card_text)
                    .map(|c| c.get(1).unwrap().as_str().trim().to_string())
            });

        let written_off_amount_total = find_val(&card_elements_col4, "WRITTEN OFF (TOTAL)", &mut acc_confs)
            .and_then(|s| parse_amount(&s))
            .or_else(|| find_inline(&card_text, "WRITTEN OFF AMOUNT (TOTAL)").and_then(|s| parse_amount(&s)))
            .or_else(|| find_inline(&card_text, "WRITTEN-OFF AMOUNT (TOTAL)").and_then(|s| parse_amount(&s)));

        let written_off_amount_principal = find_val(&card_elements_col4, "WRITTEN OFF (PRINCIPLE)", &mut acc_confs)
            .and_then(|s| parse_amount(&s))
            .or_else(|| find_val(&card_elements_col4, "WRITTEN OFF (PRINCIPAL)", &mut acc_confs).and_then(|s| parse_amount(&s)))
            .or_else(|| find_inline(&card_text, "WRITTEN OFF AMOUNT (PRINCIPAL)").and_then(|s| parse_amount(&s)))
            .or_else(|| find_inline(&card_text, "WRITTEN-OFF AMOUNT (PRINCIPAL)").and_then(|s| parse_amount(&s)));

        let settlement_amount = find_val(&card_elements_col4, "SETTLEMENT", &mut acc_confs)
            .and_then(|s| parse_amount(&s))
            .or_else(|| find_val(&card_elements_col4, "SETTLEMENT AMOUNT", &mut acc_confs).and_then(|s| parse_amount(&s)))
            .or_else(|| find_inline(&card_text, "SETTLEMENT AMOUNT").and_then(|s| parse_amount(&s)));

        // Only rendered on accounts that actually carry an overdue balance.
        let amount_overdue = find_val(&card_elements_col2, "OVERDUE", &mut acc_confs)
            .and_then(|s| parse_amount(&s))
            .or_else(|| find_inline(&card_text, "OVERDUE").and_then(|s| parse_amount(&s)));

        let last_pmt_re = Regex::new(r"(?i)LAST\s*PAYMENT\s*:\s*(\d{2}[/-]\d{2}[/-]\d{4})").unwrap();
        let date_of_last_payment = last_pmt_re.captures(&card_text)
            .map(|c| c.get(1).unwrap().as_str().to_string());

        // DPD window bounds: the tabular layout labels these "START/END DATE",
        // the CONSUMER CIR layout "PMT HIST START/END".
        let dpd_start_re = Regex::new(r"(?i)(?:PMT\s*HIST\s*START|START\s*DATE)\s*:\s*(\d{2}[/-]\d{2}[/-]\d{4})").unwrap();
        let dpd_end_re = Regex::new(r"(?i)(?:PMT\s*HIST\s*END|END\s*DATE)\s*:\s*(\d{2}[/-]\d{2}[/-]\d{4})").unwrap();
        let payment_history_start_date = dpd_start_re.captures(&card_text)
            .map(|c| c.get(1).unwrap().as_str().to_string());
        let payment_history_end_date = dpd_end_re.captures(&card_text)
            .map(|c| c.get(1).unwrap().as_str().to_string());

        // Fall back to the year-less "MM-YY" grid used by the CONSUMER CIR layout.
        let mut payment_history = DpdStitcher::stitch_dpd_matrix_coordinates(&card_elements);
        if payment_history.is_empty() {
            payment_history = DpdStitcher::stitch_dpd_matrix_mmyy(&card_elements);
        }

        let source_pages: Vec<u32> = {
            let mut p_set = std::collections::HashSet::new();
            for el in &card_elements {
                p_set.insert(el.page);
            }
            let mut p_vec: Vec<u32> = p_set.into_iter().collect();
            p_vec.sort();
            p_vec
        };

        // Compute average confidence score for this credit account
        let acc_confidence = if !acc_confs.is_empty() {
            acc_confs.iter().sum::<f32>() / acc_confs.len() as f32
        } else {
            0.98
        };
        confs.extend(&acc_confs);

        accounts.push(CreditAccount {
            index,
            account_type,
            status,
            date_opened,
            date_closed,
            sanctioned_amount,
            current_balance,
            ownership,
            collateral_type,
            collateral_value,
            credit_facility_status,
            written_off_amount_total,
            written_off_amount_principal,
            settlement_amount,
            amount_overdue,
            date_of_last_payment,
            payment_history_start_date,
            payment_history_end_date,
            payment_history,
            confidence: acc_confidence,
            source_pages,
        });
    }

    Ok(accounts)
}

/// Pulls a value from an inline `LABEL : value` line within a card's text.
/// The "CONSUMER CIR" layout packs each field onto one line this way, so
/// coordinate alignment alone misses them.
fn find_inline(card_text: &str, label: &str) -> Option<String> {
    let pattern = format!(r"(?im)^\s*{}\s*:\s*(.+)$", regex::escape(label));
    let re = Regex::new(&pattern).ok()?;
    re.captures(card_text)
        .map(|c| c.get(1).unwrap().as_str().trim().to_string())
        .filter(|v| !v.is_empty())
}

fn parse_amount(val: &str) -> Option<u64> {
    let num_str: String = val.chars().filter(|c| c.is_ascii_digit()).collect();
    num_str.parse().ok()
}

/// Section headers that terminate the enquiry table.
const ENQUIRY_TERMINATORS: [&str; 4] = ["GLOSSARY", "END OF REPORT", "DISCLAIMER", "CIR DATA"];

fn parse_enquiries(elements: &[LayoutElement], _confs: &mut Vec<f32>) -> Result<Vec<EnquiryDetail>> {
    let mut enquiries = Vec::new();
    let date_re = Regex::new(r"^\d{2}[/-]\d{2}[/-]\d{4}$").unwrap();

    // Anchor on the table's *column header* ("ENQUIRY DATE"), not the "ENQUIRIES"
    // summary heading near the top of the report — the latter swallows every
    // account table below it.
    let header_el = elements.iter()
        .find(|el| el.text.to_uppercase().contains("ENQUIRY DATE"));
    let header_el = match header_el {
        Some(el) => el,
        None => return Ok(enquiries),
    };
    let y_start = header_el.bbox.y0;

    // Column x-centres come from the header row, so cells are matched by position
    // rather than trusting a fixed left-to-right ordering.
    let mut col_date = None;
    let mut col_name = None;
    let mut col_purpose = None;
    let mut col_amount = None;
    for el in elements.iter().filter(|el| {
        el.bbox.y0 < header_el.bbox.y1 && el.bbox.y1 > header_el.bbox.y0
    }) {
        let t = el.text.to_uppercase();
        let centre = (el.bbox.x0 + el.bbox.x1) / 2.0;
        if t.contains("ENQUIRY DATE") {
            col_date = Some(centre);
        } else if t.contains("ENQUIRY PURPOSE") {
            col_purpose = Some(centre);
        } else if t.contains("ENQUIRY AMOUNT") {
            col_amount = Some(centre);
        } else if t.contains("MEMBER NAME") {
            col_name = Some(centre);
        }
    }

    // Stop at the next section header so the table can span pages but not run on.
    let y_end = elements.iter()
        .filter(|el| el.bbox.y0 > y_start)
        .filter(|el| {
            let t = el.text.to_uppercase();
            ENQUIRY_TERMINATORS.iter().any(|term| t.contains(term))
        })
        .map(|el| el.bbox.y0)
        .fold(f32::MAX, f32::min);

    let columns: Vec<(usize, f32)> = [col_name, col_date, col_purpose, col_amount]
        .iter()
        .enumerate()
        .filter_map(|(i, c)| c.map(|centre| (i, centre)))
        .collect();
    if columns.len() < 3 {
        return Ok(enquiries);
    }

    let body: Vec<LayoutElement> = elements.iter()
        .filter(|el| el.bbox.y0 > header_el.bbox.y1 && el.bbox.y0 < y_end)
        .cloned()
        .collect();

    for row in cibil_layout::geometry::cluster_rows(body) {
        let mut cells: [Option<&str>; 4] = [None; 4];
        for el in &row {
            let centre = (el.bbox.x0 + el.bbox.x1) / 2.0;
            let nearest = columns.iter()
                .min_by(|a, b| {
                    (centre - a.1).abs().partial_cmp(&(centre - b.1).abs()).unwrap()
                });
            if let Some(&(slot, _)) = nearest {
                let text = el.text.trim();
                if !text.is_empty() && cells[slot].is_none() {
                    cells[slot] = Some(text);
                }
            }
        }

        // A long purpose wraps onto its own line with no other populated column;
        // fold it back into the enquiry above rather than dropping it.
        let only_purpose = cells[2].is_some()
            && cells[0].is_none() && cells[1].is_none() && cells[3].is_none();
        if only_purpose {
            if let Some(last) = enquiries.last_mut() {
                let cont = cells[2].unwrap_or("");
                if !cont.is_empty() {
                    last.purpose = format!("{} {}", last.purpose, cont);
                }
            }
            continue;
        }

        // A genuine enquiry row has a real date in the date column; this rejects
        // repeated headers and any stray rows the y-window still admits.
        let date = match cells[1] {
            Some(d) if date_re.is_match(d) => d.to_string(),
            _ => continue,
        };

        enquiries.push(EnquiryDetail {
            member_name: redact_aadhaar(cells[0].unwrap_or("NOT DISCLOSED")),
            date,
            purpose: cells[2].unwrap_or("").to_string(),
            amount: cells[3].and_then(parse_amount).unwrap_or(0),
        });
    }

    Ok(enquiries)
}

fn parse_addresses(elements: &[LayoutElement], _confs: &mut Vec<f32>) -> Result<Vec<AddressDetail>> {
    let mut addresses = Vec::new();
    let addr_header = elements.iter().position(|el| el.text.to_uppercase().contains("ADDRESSES") || el.text.to_uppercase().contains("ADDRESS(ES)"));
    if let Some(idx) = addr_header {
        let y_start = elements[idx].bbox.y0;
        let addr_elements: Vec<&LayoutElement> = elements.iter()
            .filter(|el| el.bbox.y0 > y_start)
            .collect();

        let row_elements = cibil_layout::geometry::cluster_rows(addr_elements.into_iter().cloned().collect());
        for row in row_elements {
            if row.len() >= 3 {
                let address = redact_aadhaar(&row[0].text.trim());
                let category = row[1].text.trim().to_string();
                let date_reported = row[row.len() - 1].text.trim().to_string();
                if !address.is_empty() && (date_reported.contains('-') || date_reported.contains('/')) {
                    addresses.push(AddressDetail {
                        address,
                        category,
                        date_reported,
                    });
                }
            }
        }
    }
    Ok(addresses)
}

fn parse_employment(elements: &[LayoutElement], _confs: &mut Vec<f32>) -> Result<Vec<EmploymentDetail>> {
    let mut employment = Vec::new();
    let emp_header = elements.iter().position(|el| el.text.to_uppercase().contains("EMPLOYMENT INFORMATION"));
    if let Some(idx) = emp_header {
        let y_start = elements[idx].bbox.y0;
        let emp_elements: Vec<&LayoutElement> = elements.iter()
            .filter(|el| el.bbox.y0 > y_start)
            .collect();

        let row_elements = cibil_layout::geometry::cluster_rows(emp_elements.into_iter().cloned().collect());
        for row in row_elements {
            if row.len() >= 3 {
                let occupation_code = row[1].text.trim().to_string();
                let income = parse_amount(&row[2].text);
                let income_indicator = row.get(3).map(|el| el.text.trim().to_string());
                if !occupation_code.is_empty() && occupation_code != "Occupation Code" {
                    employment.push(EmploymentDetail {
                        occupation_code,
                        income,
                        income_indicator,
                    });
                }
            }
        }
    }
    Ok(employment)
}

#[cfg(test)]
mod tests {
    use super::*;
    use cibil_core::traits::BoundingBox;
    use std::borrow::Cow;

    const COL_NAME: f32 = 89.0;
    const COL_DATE: f32 = 260.0;
    const COL_PURPOSE: f32 = 430.0;
    const COL_AMOUNT: f32 = 601.0;

    fn el(text: &str, x0: f32, y0: f32) -> LayoutElement<'static> {
        LayoutElement {
            text: Cow::Owned(text.to_string()),
            bbox: BoundingBox::new(x0, y0, x0 + 80.0, y0 + 10.0),
            page: 1,
        }
    }

    fn enquiry_fixture() -> Vec<LayoutElement<'static>> {
        vec![
            // Summary heading near the top of the report — must NOT anchor the table.
            el("ENQUIRIES", 79.0, 10.0),
            el("TOTAL ENQUIRIES", 89.0, 20.0),
            // An account table that previously got swallowed as enquiries.
            el("ACCOUNT INFORMATION", COL_NAME, 40.0),
            el("DATE OPENED : 10/01/2025", COL_DATE, 40.0),
            el("|", COL_PURPOSE, 40.0),
            el("500", COL_AMOUNT, 40.0),
            // The real enquiry table.
            el("MEMBER NAME", COL_NAME, 100.0),
            el("ENQUIRY DATE", COL_DATE, 100.0),
            el("ENQUIRY PURPOSE", COL_PURPOSE, 100.0),
            el("ENQUIRY AMOUNT", COL_AMOUNT, 100.0),
            el("NOT DISCLOSED", COL_NAME, 120.0),
            el("07/01/2026", COL_DATE, 120.0),
            el("PROPERTY LOAN", COL_PURPOSE, 120.0),
            el("\u{20b9} 10,00,000", COL_AMOUNT, 120.0),
            el("NOT DISCLOSED", COL_NAME, 140.0),
            el("23/08/2023", COL_DATE, 140.0),
            el("LOAN AGAINST", COL_PURPOSE, 140.0),
            el("\u{20b9} 25,000", COL_AMOUNT, 140.0),
            // Wrapped continuation of the purpose above.
            el("SHARES/SECURITIES", COL_PURPOSE, 152.0),
            // Next section: everything below is out of scope.
            el("GLOSSARY", 79.0, 180.0),
            el("Report name", COL_NAME, 200.0),
            el("01/01/2020", COL_DATE, 200.0),
            el("Consumer CIR", COL_PURPOSE, 200.0),
            el("9", COL_AMOUNT, 200.0),
        ]
    }

    #[test]
    fn enquiries_are_scoped_to_the_enquiry_table() {
        let mut confs = Vec::new();
        let enquiries = parse_enquiries(&enquiry_fixture(), &mut confs).unwrap();

        assert_eq!(enquiries.len(), 2, "got: {enquiries:?}");
        assert_eq!(enquiries[0].date, "07/01/2026");
        assert_eq!(enquiries[0].purpose, "PROPERTY LOAN");
        assert_eq!(enquiries[0].amount, 1000000);
        // Account rows above the table and glossary rows below it are excluded.
        assert!(!enquiries.iter().any(|e| e.purpose.contains("Consumer CIR")));
        assert!(!enquiries.iter().any(|e| e.member_name.contains("ACCOUNT")));
    }

    #[test]
    fn wrapped_purpose_is_folded_into_the_row_above() {
        let mut confs = Vec::new();
        let enquiries = parse_enquiries(&enquiry_fixture(), &mut confs).unwrap();
        assert_eq!(enquiries[1].purpose, "LOAN AGAINST SHARES/SECURITIES");
        assert_eq!(enquiries[1].amount, 25000);
    }

    #[test]
    fn inline_labels_are_read_from_consumer_cir_cards() {
        // "CONSUMER CIR" packs each field onto one line and omits the "DATE"
        // prefix that the tabular layout uses.
        let card = "MEMBER NAME: SBI
OPENED : 21-11-2011
SANCTIONED: 2,14,000
CREDIT FACILITY STATUS:
WRITTEN-OFF
CLOSED: 20-09-2018
CURRENT BALANCE: 0
TYPE: EDUCATION LOAN
OWNERSHIP: INDIVIDUAL";

        let opened_re = Regex::new(r"(?i)(?:DATE\s*)?OPENED\s*:\s*(\d{2}[/-]\d{2}[/-]\d{4})").unwrap();
        let closed_re = Regex::new(r"(?i)(?:DATE\s*)?CLOSED\s*:\s*(\d{2}[/-]\d{2}[/-]\d{4})").unwrap();
        assert_eq!(opened_re.captures(card).unwrap().get(1).unwrap().as_str(), "21-11-2011");
        assert_eq!(closed_re.captures(card).unwrap().get(1).unwrap().as_str(), "20-09-2018");

        assert_eq!(find_inline(card, "SANCTIONED").and_then(|s| parse_amount(&s)), Some(214000));
        assert_eq!(find_inline(card, "OWNERSHIP"), Some("INDIVIDUAL".to_string()));
        assert_eq!(find_inline(card, "CURRENT BALANCE").and_then(|s| parse_amount(&s)), Some(0));

        // Value wrapped onto the line below its label.
        let cfs_re = Regex::new(r"(?i)CREDIT\s*FACILITY\s*STATUS\s*:\s*
?\s*([A-Z][A-Z0-9 \-/()]{1,40})").unwrap();
        assert_eq!(cfs_re.captures(card).unwrap().get(1).unwrap().as_str().trim(), "WRITTEN-OFF");
    }

    #[test]
    fn tabular_date_labels_still_parse() {
        // The optional "DATE" prefix must not regress the tabular layout.
        let card = "ACCOUNT INFORMATION
DATE OPENED : 10/01/2025
DATE CLOSED : 15/02/2026";
        let opened_re = Regex::new(r"(?i)(?:DATE\s*)?OPENED\s*:\s*(\d{2}[/-]\d{2}[/-]\d{4})").unwrap();
        let closed_re = Regex::new(r"(?i)(?:DATE\s*)?CLOSED\s*:\s*(\d{2}[/-]\d{2}[/-]\d{4})").unwrap();
        assert_eq!(opened_re.captures(card).unwrap().get(1).unwrap().as_str(), "10/01/2025");
        assert_eq!(closed_re.captures(card).unwrap().get(1).unwrap().as_str(), "15/02/2026");
    }
}
