use std::collections::HashMap;
use regex::Regex;
use cibil_layout::geometry::LayoutElement;

pub struct DpdStitcher;

const MONTH_NAMES: [&str; 12] = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

impl DpdStitcher {
    /// Stitches the "CONSUMER CIR" DPD grid, which has no year column: values
    /// sit on one row and their `MM-YY` labels on the row directly beneath,
    /// paired by x position.
    pub fn stitch_dpd_matrix_mmyy(elements: &[LayoutElement]) -> HashMap<String, HashMap<String, Option<String>>> {
        let mmyy = Regex::new(r"^(\d{2})-(\d{2})$").unwrap();
        let rows = cibil_layout::geometry::cluster_rows(elements.to_vec());
        let is_label_row = |row: &Vec<LayoutElement>| {
            row.iter().filter(|e| mmyy.is_match(e.text.trim())).count() >= 3
        };

        let mut history: HashMap<String, HashMap<String, Option<String>>> = HashMap::new();
        for (i, row) in rows.iter().enumerate() {
            if !is_label_row(row) {
                continue;
            }
            // The value row is the one immediately above; skip if that is
            // itself a label row (two stacked label rows carry no values).
            let value_row = match rows[..i].iter().rev().find(|r| !r.is_empty()) {
                Some(r) if !is_label_row(r) => r,
                _ => continue,
            };

            for label in row.iter().filter(|e| mmyy.is_match(e.text.trim())) {
                let caps = match mmyy.captures(label.text.trim()) {
                    Some(c) => c,
                    None => continue,
                };
                let month: usize = caps[1].parse().unwrap_or(0);
                let yy: u32 = caps[2].parse().unwrap_or(0);
                if !(1..=12).contains(&month) {
                    continue;
                }

                let label_centre = (label.bbox.x0 + label.bbox.x1) / 2.0;
                let nearest = value_row.iter().min_by(|a, b| {
                    let da = ((a.bbox.x0 + a.bbox.x1) / 2.0 - label_centre).abs();
                    let db = ((b.bbox.x0 + b.bbox.x1) / 2.0 - label_centre).abs();
                    da.partial_cmp(&db).unwrap_or(std::cmp::Ordering::Equal)
                });

                if let Some(cell) = nearest {
                    let centre = (cell.bbox.x0 + cell.bbox.x1) / 2.0;
                    // Guard against pairing with a distant cell when a column is blank.
                    if (centre - label_centre).abs() > 20.0 {
                        continue;
                    }
                    history
                        .entry(format!("{}", 2000 + yy))
                        .or_default()
                        .insert(MONTH_NAMES[month - 1].to_string(), sanitize_dpd_value(&cell.text));
                }
            }
        }
        history
    }

    /// Text-based stitching using line splitting and token matching.
    pub fn stitch_dpd_matrix(raw_block: &str) -> HashMap<String, HashMap<String, Option<String>>> {
        let mut history: HashMap<String, HashMap<String, Option<String>>> = HashMap::new();
        let months = vec!["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        
        let year_regex = Regex::new(r"^(20\d{2})").unwrap();
        let token_regex = Regex::new(r"[\s|]+").unwrap();

        let lines: Vec<&str> = raw_block.lines().map(|l| l.trim()).collect();

        for line in lines {
            if let Some(captures) = year_regex.captures(line) {
                let year = captures.get(1).unwrap().as_str().to_string();
                
                let remaining_tokens: Vec<&str> = token_regex.split(line)
                    .filter(|s| !s.is_empty() && *s != &year)
                    .collect();

                let mut month_map = HashMap::new();
                for (idx, month) in months.iter().enumerate() {
                    if idx < remaining_tokens.len() {
                        month_map.insert(month.to_string(), sanitize_dpd_value(remaining_tokens[idx]));
                    } else {
                        month_map.insert(month.to_string(), None);
                    }
                }
                history.insert(year, month_map);
            }
        }
        history
    }

    /// Coordinate-aware month column zipping.
    pub fn stitch_dpd_matrix_coordinates(elements: &[LayoutElement]) -> HashMap<String, HashMap<String, Option<String>>> {
        let mut history = HashMap::new();
        let months = vec!["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

        let header_idx = elements.iter().position(|el| {
            let text = el.text.to_uppercase();
            text.contains("YEAR") && (text.contains("JAN") || text.contains("FEB") || text.contains("MAR"))
        });

        let mut month_x_ranges = HashMap::new();
        if let Some(h_idx) = header_idx {
            let header_el = &elements[h_idx];
            let mut header_row: Vec<&LayoutElement> = elements.iter()
                .filter(|el| {
                    el.bbox.y0 < header_el.bbox.y1 && el.bbox.y1 > header_el.bbox.y0
                })
                .collect();
            header_row.sort_by(|a, b| a.bbox.x0.partial_cmp(&b.bbox.x0).unwrap());

            for el in header_row {
                let text_upper = el.text.to_uppercase();
                for &m in &months {
                    if text_upper.contains(m) {
                        month_x_ranges.insert(m.to_string(), (el.bbox.x0, el.bbox.x1));
                    }
                }
            }
        }

        // Year rows are anchored on cells holding *only* a year and sitting left of
        // the month columns, so embedded dates (e.g. "24/04/2023") can't fabricate rows.
        let year_re = Regex::new(r"^(20\d{2})$").unwrap();
        let month_col_start = month_x_ranges.values()
            .map(|&(mx0, _)| mx0)
            .fold(f32::MAX, f32::min);

        for el in elements {
            if let Some(caps) = year_re.captures(el.text.trim()) {
                if month_col_start < f32::MAX && el.bbox.x0 >= month_col_start {
                    continue;
                }
                let year = caps.get(1).unwrap().as_str().to_string();

                let mut row_elements: Vec<&LayoutElement> = elements.iter()
                    .filter(|other| {
                        other.bbox.y0 < el.bbox.y1 && other.bbox.y1 > el.bbox.y0 &&
                        other.bbox.x0 > el.bbox.x1
                    })
                    .collect();

                row_elements.sort_by(|a, b| a.bbox.x0.partial_cmp(&b.bbox.x0).unwrap());

                let mut month_map = HashMap::new();
                for &m in &months {
                    month_map.insert(m.to_string(), None);
                }

                if !month_x_ranges.is_empty() {
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

/// Asset-classification codes CIBIL reports in place of a numeric DPD count.
const DPD_STATUS_CODES: [&str; 8] = ["STD", "SUB", "DBT", "LSS", "SMA", "XXX", "NA", "*"];

fn sanitize_dpd_value(val: &str) -> Option<String> {
    let trimmed = val.trim();
    if trimmed.is_empty() {
        return None;
    }
    let upper = trimmed.to_uppercase();
    if DPD_STATUS_CODES.contains(&upper.as_str()) {
        return Some(upper);
    }
    if trimmed.chars().all(|c| c.is_ascii_digit()) {
        return Some(trimmed.to_string());
    }
    None
}

/// Redacts 12-digit Indian Aadhaar numbers.
pub fn redact_aadhaar(input: &str) -> String {
    let re = Regex::new(r"\b\d{4}[ -]?\d{4}[ -]?\d{4}\b").unwrap();
    re.replace_all(input, "[Aadhaar Redacted]").into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use cibil_core::traits::BoundingBox;
    use std::borrow::Cow;

    fn el(text: &str, x0: f32, y0: f32) -> LayoutElement<'static> {
        LayoutElement {
            text: Cow::Owned(text.to_string()),
            bbox: BoundingBox::new(x0, y0, x0 + 20.0, y0 + 10.0),
            page: 1,
        }
    }

    #[test]
    fn asset_classification_codes_are_retained() {
        for code in ["SUB", "DBT", "LSS", "SMA", "STD", "XXX"] {
            assert_eq!(sanitize_dpd_value(code), Some(code.to_string()), "{code} dropped");
        }
        assert_eq!(sanitize_dpd_value("sub"), Some("SUB".to_string()));
        assert_eq!(sanitize_dpd_value(" 090 "), Some("090".to_string()));
        assert_eq!(sanitize_dpd_value(""), None);
        assert_eq!(sanitize_dpd_value("MEMBER NAME"), None);
    }

    #[test]
    fn embedded_dates_do_not_fabricate_year_rows() {
        // Header establishes month columns starting at x=100.
        let mut elements = vec![el("YEAR JAN FEB MAR", 10.0, 0.0)];
        for (i, m) in ["JAN", "FEB", "MAR"].iter().enumerate() {
            elements.push(el(m, 100.0 + (i as f32) * 30.0, 0.0));
        }
        // A real year row, plus a date living in the month-column band.
        elements.push(el("2025", 10.0, 20.0));
        elements.push(el("030", 100.0, 20.0));
        elements.push(el("Opened: 24/04/2023", 100.0, 40.0));

        let history = DpdStitcher::stitch_dpd_matrix_coordinates(&elements);

        assert!(history.contains_key("2025"));
        assert!(!history.contains_key("2023"), "date text fabricated a year row");
        assert_eq!(history["2025"]["JAN"], Some("030".to_string()));
    }

    #[test]
    fn mmyy_grid_pairs_values_with_the_labels_beneath_them() {
        // CONSUMER CIR layout: values row, then its MM-YY labels underneath.
        let mut elements = Vec::new();
        let values = ["DBT", "516", "485"];
        let labels = ["09-18", "08-18", "07-18"];
        for (i, v) in values.iter().enumerate() {
            elements.push(el(v, 28.0 + (i as f32) * 29.0, 458.0));
        }
        for (i, l) in labels.iter().enumerate() {
            elements.push(el(l, 28.0 + (i as f32) * 29.0, 470.0));
        }

        let h = DpdStitcher::stitch_dpd_matrix_mmyy(&elements);
        assert_eq!(h["2018"]["SEP"], Some("DBT".to_string()));
        assert_eq!(h["2018"]["AUG"], Some("516".to_string()));
        assert_eq!(h["2018"]["JUL"], Some("485".to_string()));
    }
}
