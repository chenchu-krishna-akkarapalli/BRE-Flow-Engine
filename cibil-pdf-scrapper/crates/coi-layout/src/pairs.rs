use crate::lines::Line;
use serde::{Deserialize, Serialize};

// Left edges within this many points belong to the same column.
pub(crate) const COLUMN_TOLERANCE: f32 = 6.0;

/// A label with the value that belongs to it, and where the value came from.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LabelValue {
    pub label: String,
    pub value: String,
    /// The whole source line, so a wrong pairing stays traceable.
    pub raw_line: String,
    pub page: u32,
}

/// Column bands, clustered on left edges.
///
/// Clustering on the edge rather than growing a band by its own width matters:
/// width-based growth is self-reinforcing and collapses the sheet to one column.
pub fn detect_columns(lines: &[Line]) -> Vec<(f32, f32)> {
    let mut spans: Vec<(f32, f32)> = lines
        .iter()
        .flat_map(|l| l.segment_boxes.iter())
        .map(|b| (b.x, b.right()))
        .collect();

    if spans.is_empty() {
        return Vec::new();
    }
    spans.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));

    let mut bands: Vec<(f32, f32)> = vec![spans[0]];
    for (start, end) in spans.into_iter().skip(1) {
        let last = bands.last_mut().expect("seeded above");
        if (start - last.0).abs() <= COLUMN_TOLERANCE {
            last.1 = last.1.max(end);
        } else {
            bands.push((start, end));
        }
    }
    bands
}

/// Pair every label with its value across the two layouts the corpus uses.
///
/// Side-by-side ("Gross Total Income    14,16,169") is one line with two or more
/// segments. Stacked (label on one row, value beneath) appears where the
/// generator emits a header row; there the value is the cell below whose x range
/// overlaps the label's.
pub fn label_value_pairs(lines: &[Line]) -> Vec<LabelValue> {
    let mut pairs = Vec::new();

    for (index, line) in lines.iter().enumerate() {
        // These sheets pack several label/value pairs onto one row — a header
        // block reads "PAN | <value> | Date of Birth | <value>". Taking the last
        // segment as the value gives every label on the row the same answer,
        // and it is the wrong one for all but the last.
        if line.segments.len() >= 2 {
            // Vendors print "LABEL | : VALUE"; the colon belongs to neither.
            let cells: Vec<&str> = line
                .segments
                .iter()
                .map(|s| s.trim().trim_start_matches(':').trim())
                .collect();
            let mut emitted = false;

            for pair in cells.chunks(2) {
                let [label, value] = pair else { continue };
                if label.is_empty() || value.is_empty() {
                    continue;
                }
                pairs.push(LabelValue {
                    label: label.to_string(),
                    value: value.to_string(),
                    raw_line: line.text(),
                    page: line.page,
                });
                emitted = true;
            }
            if emitted {
                continue;
            }
        }

        // Stacked layout: a lone label with its value on the next row.
        if line.segments.len() == 1 {
            let Some(next) = lines.get(index + 1) else { continue };
            if next.page != line.page || next.segments.len() != 1 {
                continue;
            }
            let anchor = line.segment_boxes[0];
            if !anchor.horizontally_overlaps(&next.segment_boxes[0]) {
                continue;
            }
            let label = line.segments[0].trim();
            let value = next.segments[0].trim();
            if label.is_empty() || value.is_empty() {
                continue;
            }
            pairs.push(LabelValue {
                label: label.to_string(),
                value: value.to_string(),
                raw_line: format!("{label} / {value}"),
                page: line.page,
            });
        }
    }
    pairs
}

#[cfg(test)]
mod tests {
    use super::{detect_columns, label_value_pairs};
    use crate::lines::group_lines;
    use coi_core::{BoundingBox, TextRun};

    fn run(text: &str, x: f32, y: f32) -> TextRun<'static> {
        TextRun::new(text.to_string(), BoundingBox::new(x, y, 60.0, 10.0), 1)
    }

    #[test]
    fn side_by_side_label_and_amount_pair_up() {
        let lines = group_lines(&[run("Gross Total Income", 48.0, 300.0), run("14,16,169", 480.0, 300.0)]);
        let pairs = label_value_pairs(&lines);

        assert_eq!(pairs.len(), 1);
        assert_eq!(pairs[0].label, "Gross Total Income");
        assert_eq!(pairs[0].value, "14,16,169");
    }

    #[test]
    fn stacked_label_takes_the_value_beneath_it() {
        let lines = group_lines(&[run("PAN", 48.0, 100.0), run("ABCDE1234F", 48.0, 120.0)]);
        let pairs = label_value_pairs(&lines);

        assert_eq!(pairs.len(), 1);
        assert_eq!(pairs[0].label, "PAN");
        assert_eq!(pairs[0].value, "ABCDE1234F");
    }

    #[test]
    fn columns_cluster_on_left_edges() {
        let lines = group_lines(&[
            run("A", 48.0, 100.0),
            run("1", 480.0, 100.0),
            run("B", 48.0, 120.0),
            run("2", 480.0, 120.0),
        ]);
        assert_eq!(detect_columns(&lines).len(), 2);
    }
}

#[cfg(test)]
mod multi_pair_tests {
    use super::label_value_pairs;
    use crate::lines::group_lines;
    use coi_core::{BoundingBox, TextRun};

    #[test]
    fn a_row_carrying_two_pairs_yields_both() {
        // "PAN | <value> | Date of Birth | <value>" is one row, two facts.
        let runs: Vec<TextRun<'static>> = [
            ("PAN", 48.0), ("ABCPE1234F", 140.0), ("Date of Birth", 300.0), ("12/07/1997", 420.0),
        ]
        .iter()
        .map(|(t, x)| TextRun::new(t.to_string(), BoundingBox::new(*x, 100.0, 60.0, 10.0), 1))
        .collect();

        let pairs = label_value_pairs(&group_lines(&runs));
        assert_eq!(pairs.len(), 2);
        assert_eq!((pairs[0].label.as_str(), pairs[0].value.as_str()), ("PAN", "ABCPE1234F"));
        assert_eq!((pairs[1].label.as_str(), pairs[1].value.as_str()), ("Date of Birth", "12/07/1997"));
    }
}
