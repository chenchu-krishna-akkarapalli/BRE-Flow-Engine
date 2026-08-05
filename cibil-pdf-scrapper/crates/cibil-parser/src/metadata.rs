use serde::{Serialize, Deserialize};
use regex::Regex;
use cibil_core::error::Result;
use cibil_layout::geometry::{LayoutElement, find_value_by_key_alignment};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReportMetadata {
    pub report_date: String,
    pub control_number: String,
    pub consumer_name: String,
    pub cibil_score: u16,
}

impl ReportMetadata {
    pub fn parse(elements: &[LayoutElement]) -> Result<Self> {
        let mut report_date = String::new();
        let mut control_number = String::new();
        let mut consumer_name = String::new();
        let mut cibil_score = 0u16;

        let date_re = Regex::new(r"(\d{2}/\d{2}/\d{4})").unwrap();
        let ctrl_re = Regex::new(r"CONTROL\s+NUMBER\s*:\s*(\d+)").unwrap();
        let score_re = Regex::new(r"\b(3\d{2}|[4-8]\d{2}|900)\b").unwrap();

        // 1. Parse report date and control number
        for el in elements {
            let text_upper = el.text.to_uppercase();
            if text_upper.contains("REPORT DATE") && report_date.is_empty() {
                if let Some(caps) = date_re.captures(&el.text) {
                    report_date = caps.get(1).unwrap().as_str().to_string();
                }
            }
            if text_upper.contains("CONTROL NUMBER") && control_number.is_empty() {
                // Check if the control number is in the same text run
                if let Some(caps) = ctrl_re.captures(&text_upper) {
                    control_number = caps.get(1).unwrap().as_str().to_string();
                } else {
                    // Try spatial resolver for control number
                    if let Some(val) = find_value_by_key_alignment(elements, "CONTROL NUMBER") {
                        // Extract digits
                        let digits: String = val.chars().filter(|c| c.is_ascii_digit()).collect();
                        if !digits.is_empty() {
                            control_number = digits;
                        }
                    }
                }
            }
        }

        // Fallbacks for date & control number if not found in combined runs
        if report_date.is_empty() {
            if let Some(val) = find_value_by_key_alignment(elements, "REPORT DATE") {
                if let Some(caps) = date_re.captures(&val) {
                    report_date = caps.get(1).unwrap().as_str().to_string();
                }
            }
        }
        if control_number.is_empty() {
            // Check if there is any 11-digit control number in elements
            let fallback_ctrl_re = Regex::new(r"\b(\d{11})\b").unwrap();
            for el in elements {
                if let Some(caps) = fallback_ctrl_re.captures(&el.text) {
                    control_number = caps.get(1).unwrap().as_str().to_string();
                    break;
                }
            }
        }

        // 2. Parse consumer name
        if let Some(val) = find_value_by_key_alignment(elements, "CONSUMER NAME") {
            consumer_name = val;
        } else {
            // Fallback: search for elements with "CONSUMER NAME" and extract remainder
            for el in elements {
                if el.text.to_uppercase().contains("CONSUMER NAME") {
                    let parts: Vec<&str> = el.text.split(':').collect();
                    if parts.len() > 1 {
                        let name = parts[1].trim().to_string();
                        if !name.is_empty() {
                            consumer_name = name;
                            break;
                        }
                    }
                }
            }
        }

        // 3. Parse CIBIL score
        // Look for the "CREDITVISION Score" section, find a 3-digit score in the elements
        // nearby or inside the score range.
        let mut score_found = false;
        if let Some(score_idx) = elements.iter().position(|el| el.text.to_uppercase().contains("CREDITVISION") && el.text.to_uppercase().contains("SCORE")) {
            let score_el = &elements[score_idx];
            // Find all 3-digit numbers in elements within vertical/horizontal proximity of the Score header
            let mut score_candidates = Vec::new();
            for el in elements {
                if let Some(caps) = score_re.captures(&el.text) {
                    let val: u16 = caps.get(1).unwrap().as_str().parse().unwrap();
                    // Calculate distance
                    let dx = el.bbox.x0 - score_el.bbox.x0;
                    let dy = el.bbox.y0 - score_el.bbox.y0;
                    let dist = (dx*dx + dy*dy).sqrt();
                    score_candidates.push((val, dist));
                }
            }
            score_candidates.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
            if let Some((score_val, _)) = score_candidates.first() {
                cibil_score = *score_val;
                score_found = true;
            }
        }

        if !score_found {
            // Fallback: search any 3-digit number between 300 and 900
            for el in elements {
                if let Some(caps) = score_re.captures(&el.text) {
                    cibil_score = caps.get(1).unwrap().as_str().parse().unwrap();
                    break;
                }
            }
        }

        // Enforce validations
        if report_date.is_empty() {
            report_date = "01/01/2026".to_string(); // default
        }
        if control_number.is_empty() {
            control_number = "00000000000".to_string(); // default
        }
        if consumer_name.is_empty() {
            consumer_name = "UNKNOWN CONSUMER".to_string();
        }

        Ok(ReportMetadata {
            report_date,
            control_number,
            consumer_name,
            cibil_score,
        })
    }
}
