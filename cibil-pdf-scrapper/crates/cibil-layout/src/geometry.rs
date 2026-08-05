pub use cibil_core::traits::{RawTextRun, BoundingBox, LayoutElement};

#[derive(Debug, Clone)]
pub struct LayoutRegion<'a> {
    pub bbox: BoundingBox,
    pub elements: Vec<LayoutElement<'a>>,
}

/// Clusters elements into horizontal rows based on Y coordinate overlap.
pub fn cluster_rows<'a>(mut elements: Vec<LayoutElement<'a>>) -> Vec<Vec<LayoutElement<'a>>> {
    if elements.is_empty() {
        return Vec::new();
    }

    // Sort primarily by Y0
    elements.sort_by(|a, b| {
        a.bbox.y0.partial_cmp(&b.bbox.y0).unwrap_or(std::cmp::Ordering::Equal)
    });

    let mut rows: Vec<Vec<LayoutElement<'a>>> = Vec::new();
    for el in elements {
        if let Some(row) = rows.iter_mut().last() {
            let row_y0 = row[0].bbox.y0;
            let row_y1 = row[0].bbox.y1;
            let h = (row_y1 - row_y0).max(el.bbox.y1 - el.bbox.y0);
            let overlap = row_y1.min(el.bbox.y1) - row_y0.max(el.bbox.y0);

            if overlap > h * 0.4 {
                row.push(el);
                continue;
            }
        }
        rows.push(vec![el]);
    }

    // Sort each row by X coordinate from left to right
    for row in &mut rows {
        row.sort_by(|a, b| {
            a.bbox.x0.partial_cmp(&b.bbox.x0).unwrap_or(std::cmp::Ordering::Equal)
        });
    }

    rows
}

/// Clusters elements into vertical columns based on X coordinate overlap.
pub fn cluster_columns<'a>(mut elements: Vec<LayoutElement<'a>>) -> Vec<Vec<LayoutElement<'a>>> {
    if elements.is_empty() {
        return Vec::new();
    }

    // Sort primarily by X0
    elements.sort_by(|a, b| {
        a.bbox.x0.partial_cmp(&b.bbox.x0).unwrap_or(std::cmp::Ordering::Equal)
    });

    let mut cols: Vec<Vec<LayoutElement<'a>>> = Vec::new();
    for el in elements {
        if let Some(col) = cols.iter_mut().last() {
            let col_x0 = col[0].bbox.x0;
            let col_x1 = col[0].bbox.x1;
            let w = (col_x1 - col_x0).max(el.bbox.x1 - el.bbox.x0);
            let overlap = col_x1.min(el.bbox.x1) - col_x0.max(el.bbox.x0);

            if overlap > w * 0.4 {
                col.push(el);
                continue;
            }
        }
        cols.push(vec![el]);
    }

    // Sort each column by Y coordinate from top to bottom
    for col in &mut cols {
        col.sort_by(|a, b| {
            a.bbox.y0.partial_cmp(&b.bbox.y0).unwrap_or(std::cmp::Ordering::Equal)
        });
    }

    cols
}

/// Segment page elements into horizontal layout blocks (e.g. cards) based on vertical spacing.
pub fn segment_horizontal_bands<'a>(mut elements: Vec<LayoutElement<'a>>, gap_threshold: f32) -> Vec<LayoutRegion<'a>> {
    if elements.is_empty() {
        return Vec::new();
    }

    elements.sort_by(|a, b| {
        a.bbox.y0.partial_cmp(&b.bbox.y0).unwrap_or(std::cmp::Ordering::Equal)
    });

    let mut regions: Vec<LayoutRegion<'a>> = Vec::new();
    let mut current_elements: Vec<LayoutElement<'a>> = Vec::new();
    let mut current_y1 = elements[0].bbox.y1;
    let mut current_y0 = elements[0].bbox.y0;

    for el in elements {
        if el.bbox.y0 > current_y1 + gap_threshold {
            let x0 = current_elements.iter().map(|e| e.bbox.x0).fold(f32::INFINITY, |a, b| a.min(b));
            let y0 = current_y0;
            let x1 = current_elements.iter().map(|e| e.bbox.x1).fold(f32::NEG_INFINITY, |a, b| a.max(b));
            let y1 = current_y1;
            regions.push(LayoutRegion {
                bbox: BoundingBox::new(x0, y0, x1, y1),
                elements: current_elements,
            });
            current_elements = Vec::new();
            current_y0 = el.bbox.y0;
        }
        current_y1 = current_y1.max(el.bbox.y1);
        current_elements.push(el);
    }

    if !current_elements.is_empty() {
        let x0 = current_elements.iter().map(|e| e.bbox.x0).fold(f32::INFINITY, |a, b| a.min(b));
        let y0 = current_y0;
        let x1 = current_elements.iter().map(|e| e.bbox.x1).fold(f32::NEG_INFINITY, |a, b| a.max(b));
        let y1 = current_y1;
        regions.push(LayoutRegion {
            bbox: BoundingBox::new(x0, y0, x1, y1),
            elements: current_elements,
        });
    }

    regions
}

/// Finds the value element corresponding to a key query using spatial alignment.
/// Filters out large blocks (like tables) by verifying candidate height stays under 2.2x the key's height.
pub fn find_value_by_key_alignment<'a>(
    elements: &[LayoutElement<'a>],
    key_query: &str,
) -> Option<String> {
    find_value_by_key_alignment_with_confidence(elements, key_query).map(|(val, _)| val)
}

pub fn find_value_by_key_alignment_with_confidence<'a>(
    elements: &[LayoutElement<'a>],
    key_query: &str,
) -> Option<(String, f32)> {
    // 1. Normalize the query tokens (replace hyphens and colons with spaces)
    let query_clean = key_query.to_uppercase().replace("-", " ").replace(":", " ");
    let query_tokens: Vec<&str> = query_clean.split_whitespace().collect();
    if query_tokens.is_empty() {
        return None;
    }

    // 2. We want to find the best matching group of elements in the same column
    let mut best_group = Vec::new();
    let mut best_score = f32::MIN;

    for start_el in elements {
        // Normalize text by replacing newlines, hyphens, and colons with spaces
        let text_clean = start_el.text.to_uppercase()
            .replace("\n", " ")
            .replace("\r", " ")
            .replace("-", " ")
            .replace(":", " ");

        // Check if start_el contains at least one of the query tokens
        if !query_tokens.iter().any(|t| text_clean.contains(t)) {
            continue;
        }

        // Special case: prevent matching wrong sections for DATE
        if key_query == "DATE" && (text_clean.contains("DATE OPENED") || text_clean.contains("DATE CLOSED") || text_clean.contains("REPORT DATE")) {
            continue;
        }

        // Special case: prevent matching account details, sections, headers, and metadata for consumer name/info queries
        let is_consumer_query = key_query.contains("CONSUMER") || key_query.contains("NAME");
        if is_consumer_query {
            let skip_words = [
                "LOAN", "ACCOUNT", "REPORT", "DETAILS", "ENQUIRY", "SUMMARY",
                "HISTORY", "FACTOR", "INFORMATION", "TYPE", "BALANCE", "AMOUNT",
                "DATE", "STATUS"
            ];
            if skip_words.iter().any(|&w| text_clean.contains(w)) {
                continue;
            }
        }

        // Form a candidate group of elements in the same column that are vertically close (only downwards)
        let col_x0 = start_el.bbox.x0;
        let mut candidate_group = vec![start_el];

        // Gather all other elements in the same column downwards
        for el in elements {
            if std::ptr::eq(el, start_el) {
                continue;
            }
            // Only look downwards
            if el.bbox.y0 < start_el.bbox.y0 - 2.0 {
                continue;
            }
            let x_diff = (el.bbox.x0 - col_x0).abs();
            if x_diff < 15.0 {
                // If it is vertically close to the group, add it
                let y_min = candidate_group.iter().map(|k| k.bbox.y0).fold(f32::MAX, f32::min);
                let y_max = candidate_group.iter().map(|k| k.bbox.y1).fold(f32::MIN, f32::max);
                if el.bbox.y1 >= y_min - 25.0 && el.bbox.y0 <= y_max + 25.0 {
                    let el_text = el.text.to_uppercase()
                        .replace("\n", " ")
                        .replace("\r", " ")
                        .replace("-", " ")
                        .replace(":", " ");
                    if query_tokens.iter().any(|t| el_text.contains(t)) {
                        candidate_group.push(el);
                    }
                }
            }
        }

        // Filter candidate_group to keep only elements that contribute new query tokens
        let mut group = Vec::new();
        let mut matched_tokens = std::collections::HashSet::new();
        
        // Sort elements by Y coordinate
        candidate_group.sort_by(|a, b| a.bbox.y0.partial_cmp(&b.bbox.y0).unwrap_or(std::cmp::Ordering::Equal));

        for el in candidate_group {
            let el_text = el.text.to_uppercase()
                .replace("\n", " ")
                .replace("\r", " ")
                .replace("-", " ")
                .replace(":", " ");
            let mut contributes = false;
            for t in &query_tokens {
                if el_text.contains(t) && !matched_tokens.contains(t) {
                    contributes = true;
                    matched_tokens.insert(*t);
                }
            }
            if contributes || group.is_empty() {
                group.push(el);
            }
        }

        // Score this group
        let num_matched = matched_tokens.len() as f32;
        let y_min = group.iter().map(|k| k.bbox.y0).fold(f32::MAX, f32::min);
        let y_max = group.iter().map(|k| k.bbox.y1).fold(f32::MIN, f32::max);
        let height_span = y_max - y_min;

        // Penalize extra characters in the label block to prioritize clean/concise key matches
        let total_char_len: usize = group.iter().map(|el| el.text.len()).sum();
        let query_char_len = query_clean.len();
        let unmatched_len = if total_char_len > query_char_len {
            (total_char_len - query_char_len) as f32
        } else {
            0.0
        };

        // Score: number of matched tokens * 100.0 - height span * 0.1 - unmatched length * 0.5
        let score = num_matched * 100.0 - height_span * 0.1 - unmatched_len * 0.5;

        if score > best_score {
            best_score = score;
            best_group = group;
        }
    }

    if best_group.is_empty() || best_score < 50.0 {
        return None;
    }

    let key_el = best_group[0];

    // Check if the key element itself contains a colon followed by actual value text
    if let Some(colon_pos) = key_el.text.find(':') {
        let value_part = key_el.text[colon_pos + 1..].trim();
        if !value_part.is_empty() && value_part.len() < 80 && !value_part.to_uppercase().contains("ACCOUNT") {
            return Some((value_part.to_string(), 0.98));
        }
    }

    let col_x1 = best_group.iter().map(|k| k.bbox.x1).fold(f32::MIN, f32::max);
    let y_start = best_group.iter().map(|k| k.bbox.y0).fold(f32::MAX, f32::min);
    let y_end = best_group.iter().map(|k| k.bbox.y1).fold(f32::MIN, f32::max);

    // 5. Find value elements to the right of the key column
    // whose Y coordinates overlap with the key group's Y-range
    let mut value_elements: Vec<&LayoutElement<'a>> = elements.iter()
        .filter(|el| {
            // Must be to the right of key column
            if el.bbox.x0 < col_x1 - 5.0 {
                return false;
            }
            // Exclude elements in the key group itself
            if best_group.iter().any(|k| std::ptr::eq(*k, *el)) {
                return false;
            }
            // Exclude standalone separators
            let trimmed = el.text.trim();
            if trimmed == ":" || trimmed == "|" {
                return false;
            }
            // Y overlap check with the combined key range
            let overlap = el.bbox.y1.min(y_end) - el.bbox.y0.max(y_start);
            overlap > 0.0 || (el.bbox.y0 >= y_start && el.bbox.y1 <= y_end)
        })
        .collect();

    // Sort values by X first
    value_elements.sort_by(|a, b| {
        a.bbox.x0.partial_cmp(&b.bbox.x0).unwrap_or(std::cmp::Ordering::Equal)
    });

    if !value_elements.is_empty() {
        let first_x0 = value_elements[0].bbox.x0;
        value_elements.retain(|el| (el.bbox.x0 - first_x0).abs() < 30.0);
    }

    // Sort the retained value elements by Y to ensure correct text reading order
    value_elements.sort_by(|a, b| {
        a.bbox.y0.partial_cmp(&b.bbox.y0).unwrap_or(std::cmp::Ordering::Equal)
    });

    let mut matched_val = None;
    let mut matched_conf = 0.5;

    if !value_elements.is_empty() {
        let mut value_str = String::new();
        for (i, val_el) in value_elements.iter().enumerate() {
            let trimmed = val_el.text.trim();
            if i == 0 {
                if trimmed == ":" {
                    continue;
                } else if trimmed.starts_with(':') {
                    value_str.push_str(trimmed.trim_start_matches(':').trim());
                    continue;
                }
            }
            if !value_str.is_empty() {
                value_str.push(' ');
            }
            value_str.push_str(trimmed);
        }
        let cleaned = value_str.trim().to_string();
        if !cleaned.is_empty() {
            matched_val = Some(cleaned);
            // Normalize layout match score to confidence
            let max_score = query_tokens.len() as f32 * 100.0;
            matched_conf = (best_score / max_score).clamp(0.5, 0.99);
        }
    }

    if let Some(val) = matched_val {
        return Some((val, matched_conf));
    }

    // Fallback 2: search for elements directly below it within a small vertical offset
    let col_candidates: Vec<&LayoutElement<'a>> = elements.iter()
        .filter(|el| {
            el.bbox.y0 >= key_el.bbox.y1 && el.bbox.y0 <= key_el.bbox.y1 + 15.0 &&
            el.bbox.x0 < key_el.bbox.x1 && el.bbox.x1 > key_el.bbox.x0 &&
            el.bbox.height() < key_el.bbox.height() * 2.2
        })
        .collect();

    if let Some(below_el) = col_candidates.first() {
        let trimmed = below_el.text.trim().trim_start_matches(':').trim().to_string();
        if !trimmed.is_empty() {
            return Some((trimmed, 0.85));
        }
    }

    None
}

/// Preprocesses raw text runs by:
/// 1. Detecting and filtering out recurring headers and footers across pages.
/// 2. Constructing LayoutElements with a unified global coordinate system.
pub fn preprocess_runs<'a>(runs: &'a [RawTextRun<'a>]) -> Vec<LayoutElement<'a>> {
    if runs.is_empty() {
        return Vec::new();
    }

    let num_re = regex::Regex::new(r"\d+").unwrap();

    // 1. Group runs by page to identify header/footer patterns
    let mut page_groups: std::collections::HashMap<u32, Vec<&RawTextRun<'a>>> = std::collections::HashMap::new();
    for run in runs {
        page_groups.entry(run.page).or_default().push(run);
    }

    let multiple_pages = page_groups.len() > 1;

    let is_common_header_footer = |normalized: &str| -> bool {
        let lower = normalized.to_uppercase();
        lower.contains("PAGE X OF X") || 
        lower.contains("PAGE X") ||
        lower.contains("CREDIT INFORMATION BUREAU") ||
        lower.contains("ALL RIGHTS RESERVED") ||
        lower.contains("CONFIDENTIAL") ||
        lower.contains("CONSUMER CREDIT INFORMATION")
    };

    // 2. Identify candidate headers and footers
    let mut header_footer_occurrences: std::collections::HashMap<String, u32> = std::collections::HashMap::new();
    if multiple_pages {
        for (_page, page_runs) in &page_groups {
            for run in page_runs {
                let y0 = run.bbox[1];
                let ph = run.page_height;
                if y0 < 60.0 || y0 > ph - 60.0 {
                    let cleaned = run.text.trim().to_uppercase();
                    let normalized = num_re.replace_all(&cleaned, "X").into_owned();
                    if normalized.len() > 3 {
                        *header_footer_occurrences.entry(normalized).or_default() += 1;
                    }
                }
            }
        }
    }

    // 3. Map page numbers -> height and compute cumulative page offsets dynamically
    let mut page_heights = std::collections::HashMap::new();
    for run in runs {
        page_heights.insert(run.page, run.page_height);
    }

    let mut page_offsets = std::collections::HashMap::new();
    let mut current_offset = 0.0;
    let mut pages_sorted: Vec<u32> = page_heights.keys().cloned().collect();
    pages_sorted.sort();
    for p in pages_sorted {
        page_offsets.insert(p, current_offset);
        let height = page_heights.get(&p).cloned().unwrap_or(842.0);
        current_offset += height + 100.0;
    }

    // Filter runs
    let mut layout_elements = Vec::new();
    for run in runs {
        let cleaned = run.text.trim().to_uppercase();
        let normalized = num_re.replace_all(&cleaned, "X").into_owned();
        let y0 = run.bbox[1];
        let ph = run.page_height;
        
        // Suppress recurring header/footer noise or common terms globally in header/footer regions
        if y0 < 60.0 || y0 > ph - 60.0 {
            let t_upper = run.text.to_uppercase();
            let is_critical_content = t_upper.contains("ACCOUNT") ||
                t_upper.contains("DATE OPENED") ||
                t_upper.contains("DATE CLOSED") ||
                t_upper.contains("SANCTIONED") ||
                t_upper.contains("CURRENT BALANCE") ||
                t_upper.contains("WRITTEN OFF") ||
                t_upper.contains("DAYS PAST DUE") ||
                t_upper.contains("YEAR");

            if !is_critical_content {
                if is_common_header_footer(&normalized) {
                    continue;
                }
                if multiple_pages && normalized.len() > 3 {
                    if let Some(&count) = header_footer_occurrences.get(&normalized) {
                        if count > 1 {
                            continue;
                        }
                    }
                }
            }
        }

        // Apply unified global coordinate system:
        let page_offset = *page_offsets.get(&run.page).unwrap_or(&0.0);
        let mut bbox = BoundingBox::from_array(run.bbox);
        bbox.y0 += page_offset;
        bbox.y1 += page_offset;

        layout_elements.push(LayoutElement {
            text: run.text.clone(),
            bbox,
            page: run.page,
        });
    }

    layout_elements
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::borrow::Cow;

    #[test]
    fn test_written_off_alignment() {
        let elements = vec![
            LayoutElement {
                text: Cow::Borrowed("WRITTEN OFF (TOTAL)"),
                bbox: BoundingBox::new(583.6, 188.2, 633.0, 205.9),
                page: 1,
            },
            LayoutElement {
                text: Cow::Borrowed(": Rs. 80,404"),
                bbox: BoundingBox::new(641.2, 185.5, 685.9, 196.5),
                page: 1,
            },
            LayoutElement {
                text: Cow::Borrowed("WRITTEN OFF"),
                bbox: BoundingBox::new(583.6, 218.2, 633.0, 225.4),
                page: 1,
            },
            LayoutElement {
                text: Cow::Borrowed("(PRINCIPLE)"),
                bbox: BoundingBox::new(583.6, 229.4, 629.7, 236.6),
                page: 1,
            },
            LayoutElement {
                text: Cow::Borrowed(": Rs. 80,404"),
                bbox: BoundingBox::new(641.2, 215.5, 685.9, 226.5),
                page: 1,
            },
        ];

        let total = find_value_by_key_alignment(&elements, "WRITTEN OFF (TOTAL)");
        let principal = find_value_by_key_alignment(&elements, "WRITTEN OFF (PRINCIPLE)");
        
        println!("TOTAL: {:?}", total);
        println!("PRINCIPAL: {:?}", principal);
        
        assert_eq!(total, Some("Rs. 80,404".to_string()));
        assert_eq!(principal, Some("Rs. 80,404".to_string()));
    }
}
