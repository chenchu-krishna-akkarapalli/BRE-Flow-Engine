use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use regex::Regex;
use cibil_core::error::Result;
use cibil_layout::geometry::{LayoutElement, find_value_by_key_alignment};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub enum AccountStatus {
    Active,
    Inactive,
    WrittenOff,
    SuitFiled,
    Unknown,
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

    /// Coordinate-aware DPD Stitcher using bounding box mappings
    pub fn stitch_dpd_matrix_coordinates(elements: &[LayoutElement]) -> HashMap<String, HashMap<String, Option<String>>> {
        let mut history = HashMap::new();
        let months = vec!["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

        // Find header row containing "YEAR" and at least "JAN" or "FEB"
        let header_idx = elements.iter().position(|el| {
            let text = el.text.to_uppercase();
            text.contains("YEAR") && (text.contains("JAN") || text.contains("FEB") || text.contains("MAR"))
        });

        let mut month_x_ranges = HashMap::new();
        if let Some(h_idx) = header_idx {
            let header_el = &elements[h_idx];
            // Get all elements sharing Y-coordinates with header_el
            let mut header_row: Vec<&LayoutElement> = elements.iter()
                .filter(|el| {
                    el.bbox.y0 < header_el.bbox.y1 && el.bbox.y1 > header_el.bbox.y0
                })
                .collect();
            header_row.sort_by(|a, b| a.bbox.x0.partial_cmp(&b.bbox.x0).unwrap());

            // Map each header element to the closest month name
            for el in header_row {
                let text_upper = el.text.to_uppercase();
                for &m in &months {
                    if text_upper.contains(m) {
                        month_x_ranges.insert(m.to_string(), (el.bbox.x0, el.bbox.x1));
                    }
                }
            }
        }

        let year_re = Regex::new(r"\b(20\d{2})\b").unwrap();
        for el in elements {
            if let Some(caps) = year_re.captures(&el.text) {
                let year = caps.get(1).unwrap().as_str().to_string();
                
                // Find all elements sharing Y-coordinates with this year, situated to its right
                let mut row_elements: Vec<&LayoutElement> = elements.iter()
                    .filter(|other| {
                        other.bbox.y0 < el.bbox.y1 && other.bbox.y1 > el.bbox.y0 &&
                        other.bbox.x0 > el.bbox.x1
                    })
                    .collect();

                // Sort by X coordinate
                row_elements.sort_by(|a, b| a.bbox.x0.partial_cmp(&b.bbox.x0).unwrap());

                let mut month_map = HashMap::new();
                for &m in &months {
                    month_map.insert(m.to_string(), None);
                }

                if !month_x_ranges.is_empty() {
                    // Match each element to the closest month column horizontally
                    for val_el in row_elements {
                        let val_center = (val_el.bbox.x0 + val_el.bbox.x1) / 2.0;
                        let mut closest_month = None;
                        let mut min_dist = f32::MAX;

                        for (m_name, &(mx0, mx1)) in &month_x_ranges {
                            let m_center = (mx0 + mx1) / 2.0;
                            let dist = (val_center - m_center).abs();
                            if dist < min_dist {
                                min_dist = dist;
                                closest_month = Some(m_name.clone());
                            }
                        }

                        if let Some(m_name) = closest_month {
                            let clean = sanitize_dpd_value(&val_el.text);
                            month_map.insert(m_name, clean);
                        }
                    }
                } else {
                    // Fallback to simple chronological order zipping
                    for (idx, val_el) in row_elements.iter().enumerate() {
                        if idx < months.len() {
                            let clean = sanitize_dpd_value(&val_el.text);
                            month_map.insert(months[idx].to_string(), clean);
                        }
                    }
                }

                history.insert(year, month_map);
            }
        }

        history
    }
}

fn sanitize_dpd_value(val: &str) -> Option<String> {
    let trimmed = val.trim();
    match trimmed {
        "000" | "STD" | "XXX" => Some(trimmed.to_string()),
        v if v.chars().all(char::is_numeric) && !v.is_empty() => Some(trimmed.to_string()),
        _ => None,
    }
}

/// Redact 12-digit Indian Aadhaar numbers from strings.
pub fn redact_aadhaar(input: &str) -> String {
    let re = Regex::new(r"\b\d{4}[ -]?\d{4}[ -]?\d{4}\b").unwrap();
    re.replace_all(input, "[Aadhaar Redacted]").into_owned()
}

impl CreditAccount {
    pub fn parse_accounts(elements: &[LayoutElement]) -> Result<Vec<Self>> {
        let mut accounts = Vec::new();
        let account_header_re = Regex::new(r"^\b(\d+)\.\s*ACCOUNT\b").unwrap();

        // Step 1: Find all account headers and their positions
        let mut account_headers = Vec::new();
        for (idx, el) in elements.iter().enumerate() {
            if account_header_re.is_match(&el.text.to_uppercase()) {
                account_headers.push((idx, el));
            }
        }

        if account_headers.is_empty() {
            return Ok(accounts);
        }

        // Sort headers by Y coordinate
        account_headers.sort_by(|a, b| a.1.bbox.y0.partial_cmp(&b.1.bbox.y0).unwrap());

        // Step 2: Segment elements into groups per account card
        for (i, &(_header_idx, header_el)) in account_headers.iter().enumerate() {
            // Get index of the account
            let text_upper = header_el.text.to_uppercase();
            let caps = account_header_re.captures(&text_upper).unwrap();
            let index: u32 = caps.get(1).unwrap().as_str().parse().unwrap_or(i as u32 + 1);

            let y_start = header_el.bbox.y0;
            // The card extends until the next account header starts
            let y_end = if i + 1 < account_headers.len() {
                account_headers[i + 1].1.bbox.y0
            } else {
                f32::MAX
            };

            // Gather all elements in this vertical card slice
            let card_elements: Vec<LayoutElement> = elements.iter()
                .filter(|el| el.bbox.y0 >= y_start && el.bbox.y0 < y_end)
                .cloned()
                .collect();

            // Parse individual card details
            let account_type = find_value_by_key_alignment(&card_elements, "TYPE")
                .map(|s| redact_aadhaar(&s))
                .unwrap_or_else(|| "UNKNOWN".to_string());

            // Status resolution
            let mut status = AccountStatus::Unknown;
            let card_text_upper = card_elements.iter().map(|el| el.text.to_uppercase()).collect::<Vec<_>>().join(" ");
            if card_text_upper.contains("INACTIVE") {
                status = AccountStatus::Inactive;
            } else if card_text_upper.contains("ACTIVE") {
                status = AccountStatus::Active;
            } else if card_text_upper.contains("WRITTEN OFF") {
                status = AccountStatus::WrittenOff;
            } else if card_text_upper.contains("SUIT FILED") {
                status = AccountStatus::SuitFiled;
            } else if let Some(status_str) = find_value_by_key_alignment(&card_elements, "STATUS") {
                if status_str.to_uppercase().contains("ACTIVE") {
                    status = AccountStatus::Active;
                } else if status_str.to_uppercase().contains("INACTIVE") {
                    status = AccountStatus::Inactive;
                }
            }

            let date_opened = find_value_by_key_alignment(&card_elements, "DATE OPENED");

            // Amounts
            let sanctioned_amount = find_value_by_key_alignment(&card_elements, "SANCTIONED")
                .and_then(|s| parse_amount(&s));

            let current_balance = find_value_by_key_alignment(&card_elements, "CURRENT")
                .and_then(|s| parse_amount(&s));

            let collateral_type = find_value_by_key_alignment(&card_elements, "COLLATERAL TYPE")
                .map(|s| redact_aadhaar(&s));

            let collateral_value = find_value_by_key_alignment(&card_elements, "COLLATERAL VALUE")
                .and_then(|s| parse_amount(&s));

            // DPD history
            let payment_history = DpdStitcher::stitch_dpd_matrix_coordinates(&card_elements);

            accounts.push(CreditAccount {
                index,
                account_type,
                status,
                date_opened,
                sanctioned_amount,
                current_balance,
                collateral_type,
                collateral_value,
                payment_history,
            });
        }

        Ok(accounts)
    }
}

fn parse_amount(val: &str) -> Option<u64> {
    // Keep only numeric characters
    let num_str: String = val.chars().filter(|c| c.is_ascii_digit()).collect();
    num_str.parse().ok()
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

    #[test]
    fn test_aadhaar_redactor() {
        let test_str = "Consumer Aadhaar is 1234 5678 9012 and voter id is XUL0115121";
        let redacted = redact_aadhaar(test_str);
        assert_eq!(redacted, "Consumer Aadhaar is [Aadhaar Redacted] and voter id is XUL0115121");
    }
}
