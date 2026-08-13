use coi_core::{BoundingBox, TextRun};
use serde::{Deserialize, Serialize};

// Baselines within this fraction of the SMALLER glyph height are one line. Using
// the larger one lets a heading swallow the rows above and below it.
const LINE_TOLERANCE: f32 = 0.6;

/// One visual line with its cells kept separate, so a label and the amount in
/// the far-right column stay distinguishable.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Line {
    pub page: u32,
    pub bbox: BoundingBox,
    pub segments: Vec<String>,
    pub segment_boxes: Vec<BoundingBox>,
}

impl Line {
    pub fn text(&self) -> String {
        self.segments.join(" ")
    }

    pub fn upper(&self) -> String {
        self.text().to_ascii_uppercase()
    }

    pub fn contains_ignore_case(&self, needle: &str) -> bool {
        self.upper().contains(&needle.to_ascii_uppercase())
    }
}

pub fn group_lines(runs: &[TextRun<'_>]) -> Vec<Line> {
    let mut ordered: Vec<&TextRun<'_>> = runs.iter().filter(|r| !r.is_blank()).collect();
    ordered.sort_by(|a, b| {
        a.page
            .cmp(&b.page)
            .then(
                a.bbox
                    .center_y()
                    .partial_cmp(&b.bbox.center_y())
                    .unwrap_or(std::cmp::Ordering::Equal),
            )
            .then(a.bbox.x.partial_cmp(&b.bbox.x).unwrap_or(std::cmp::Ordering::Equal))
    });

    let mut lines: Vec<Line> = Vec::new();
    let mut current: Vec<&TextRun<'_>> = Vec::new();

    for run in ordered {
        let same_line = current.first().is_some_and(|first| {
            let tolerance = first.bbox.height.min(run.bbox.height).max(1.0) * LINE_TOLERANCE;
            first.page == run.page
                && (first.bbox.center_y() - run.bbox.center_y()).abs() <= tolerance
        });

        if same_line {
            current.push(run);
        } else {
            if !current.is_empty() {
                lines.extend(flush(&current));
            }
            current = vec![run];
        }
    }
    if !current.is_empty() {
        lines.extend(flush(&current));
    }
    lines
}

// Split horizontal run group if multi-column table gap follows an amount
fn flush(group: &[&TextRun<'_>]) -> Vec<Line> {
    let mut sorted: Vec<&&TextRun<'_>> = group.iter().collect();
    sorted.sort_by(|a, b| a.bbox.x.partial_cmp(&b.bbox.x).unwrap_or(std::cmp::Ordering::Equal));

    if sorted.is_empty() {
        return Vec::new();
    }

    let mut sub_groups: Vec<Vec<&&TextRun<'_>>> = Vec::new();
    let mut current_sub: Vec<&&TextRun<'_>> = vec![sorted[0]];

    for i in 0..sorted.len() - 1 {
        let curr_run = sorted[i];
        let next_run = sorted[i + 1];
        let gap = next_run.bbox.x - curr_run.bbox.right();
        let curr_text = curr_run.as_str().trim();

        let is_curr_amount = is_numeric_amount(curr_text);

        if gap >= 15.0 && is_curr_amount {
            sub_groups.push(current_sub);
            current_sub = vec![next_run];
        } else {
            current_sub.push(next_run);
        }
    }
    sub_groups.push(current_sub);

    sub_groups.into_iter().map(|sub| flush_single(&sub)).collect()
}

// Check if string represents a numeric amount or currency cell
fn is_numeric_amount(text: &str) -> bool {
    let t = text.trim();
    if t.is_empty() {
        return false;
    }
    if t.eq_ignore_ascii_case("NIL") || t == "-" || t.eq_ignore_ascii_case("Amount") {
        return true;
    }
    let digits_count = t.chars().filter(|c| c.is_ascii_digit()).count();
    let is_valid_chars = t.chars().all(|c| c.is_ascii_digit() || matches!(c, ',' | '.' | '(' | ')' | '-'));
    digits_count > 0 && is_valid_chars
}

// Build a single Line from sorted text runs
fn flush_single(group: &[&&TextRun<'_>]) -> Line {
    let bbox = group.iter().skip(1).fold(group[0].bbox, |acc, run| acc.union(&run.bbox));
    Line {
        page: group[0].page,
        bbox,
        segments: group.iter().map(|r| r.as_str().trim().to_string()).collect(),
        segment_boxes: group.iter().map(|r| r.bbox).collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::group_lines;
    use coi_core::{BoundingBox, TextRun};

    fn run(text: &str, x: f32, y: f32) -> TextRun<'static> {
        TextRun::new(text.to_string(), BoundingBox::new(x, y, 60.0, 10.0), 1)
    }

    #[test]
    fn a_label_and_its_right_aligned_amount_form_one_line() {
        let lines = group_lines(&[run("Gross Total Income", 48.0, 300.0), run("14,16,169", 480.0, 300.0)]);

        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].segments, vec!["Gross Total Income", "14,16,169"]);
    }

    #[test]
    fn separate_rows_stay_separate() {
        let lines = group_lines(&[run("Gross Total Income", 48.0, 300.0), run("Total Income", 48.0, 330.0)]);
        assert_eq!(lines.len(), 2);
    }
}
