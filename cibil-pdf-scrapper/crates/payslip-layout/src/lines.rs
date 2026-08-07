use payslip_core::{BoundingBox, TextRun};
use serde::{Deserialize, Serialize};

// Baselines within this fraction of the smaller glyph height are one line.
const LINE_TOLERANCE: f32 = 0.6;

/// One visual line, with its parts kept separate so table columns survive.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Line {
    pub page: u32,
    pub bbox: BoundingBox,
    /// Verbatim segments in left-to-right order — never merged or normalised.
    pub segments: Vec<String>,
    /// Per-segment geometry, index-aligned with `segments`.
    pub segment_boxes: Vec<BoundingBox>,
}

impl Line {
    /// Segments joined with single spaces. The segments themselves stay intact,
    /// so a caller needing the original column split still has it.
    pub fn text(&self) -> String {
        self.segments.join(" ")
    }

    pub fn contains_ignore_case(&self, needle: &str) -> bool {
        self.text().to_ascii_uppercase().contains(&needle.to_ascii_uppercase())
    }
}

/// Group runs into lines by page and vertical position.
///
/// Tolerance follows the SMALLER glyph: a heading beside body text would
/// otherwise carry a window wide enough to swallow the lines around it.
pub fn group_lines(runs: &[TextRun<'_>]) -> Vec<Line> {
    let mut ordered: Vec<&TextRun<'_>> = runs.iter().filter(|r| !r.is_blank()).collect();
    ordered.sort_by(|a, b| {
        a.page
            .cmp(&b.page)
            .then(a.bbox.center_y().partial_cmp(&b.bbox.center_y()).unwrap_or(std::cmp::Ordering::Equal))
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
                lines.push(flush(&current));
            }
            current = vec![run];
        }
    }
    if !current.is_empty() {
        lines.push(flush(&current));
    }
    lines
}

fn flush(group: &[&TextRun<'_>]) -> Line {
    let mut sorted: Vec<&&TextRun<'_>> = group.iter().collect();
    sorted.sort_by(|a, b| a.bbox.x.partial_cmp(&b.bbox.x).unwrap_or(std::cmp::Ordering::Equal));

    let bbox = sorted
        .iter()
        .skip(1)
        .fold(sorted[0].bbox, |acc, run| acc.union(&run.bbox));

    Line {
        page: sorted[0].page,
        bbox,
        segments: sorted.iter().map(|r| r.as_str().trim().to_string()).collect(),
        segment_boxes: sorted.iter().map(|r| r.bbox).collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::group_lines;
    use payslip_core::{BoundingBox, TextRun};

    fn run(text: &str, x: f32, y: f32, page: u32) -> TextRun<'static> {
        TextRun::new(text.to_string(), BoundingBox::new(x, y, 40.0, 10.0), page)
    }

    #[test]
    fn segments_on_one_baseline_form_one_line_and_stay_separate() {
        let lines = group_lines(&[run("Basic", 10.0, 100.0, 1), run("50,000", 200.0, 100.0, 1)]);

        assert_eq!(lines.len(), 1);
        // Columns must survive: a merged string loses the cell boundary the
        // parser needs to tell a label from its amount.
        assert_eq!(lines[0].segments, vec!["Basic", "50,000"]);
        assert_eq!(lines[0].text(), "Basic 50,000");
    }

    #[test]
    fn different_baselines_are_different_lines() {
        let lines = group_lines(&[run("Basic", 10.0, 100.0, 1), run("HRA", 10.0, 130.0, 1)]);
        assert_eq!(lines.len(), 2);
    }

    #[test]
    fn pages_never_merge() {
        let lines = group_lines(&[run("Basic", 10.0, 100.0, 1), run("Basic", 10.0, 100.0, 2)]);
        assert_eq!(lines.len(), 2);
    }

    #[test]
    fn segments_are_ordered_left_to_right_regardless_of_input_order() {
        let lines = group_lines(&[run("50,000", 200.0, 100.0, 1), run("Basic", 10.0, 100.0, 1)]);
        assert_eq!(lines[0].segments, vec!["Basic", "50,000"]);
    }
}
