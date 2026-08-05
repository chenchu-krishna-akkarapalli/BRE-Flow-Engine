use crate::lines::Line;
use payslip_core::BoundingBox;
use serde::{Deserialize, Serialize};

// Left edges within this many points are the same column. Payslip generators
// align a column to a fixed x, so clustering the starts recovers the real grid.
const COLUMN_TOLERANCE: f32 = 6.0;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cell {
    pub text: String,
    pub bbox: BoundingBox,
    /// Index into the parent table's column bands, or None when the cell spans none.
    pub column: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Row {
    pub page: u32,
    pub cells: Vec<Cell>,
}

impl Row {
    pub fn text(&self) -> String {
        self.cells.iter().map(|c| c.text.as_str()).collect::<Vec<_>>().join(" ")
    }

    /// Cell text at a column band, if this row reaches that far.
    pub fn column(&self, index: usize) -> Option<&str> {
        self.cells
            .iter()
            .find(|c| c.column == Some(index))
            .map(|c| c.text.as_str())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Table {
    /// x-bands, left to right. Cells reference these by index.
    pub columns: Vec<(f32, f32)>,
    pub rows: Vec<Row>,
}

/// Infer column bands from where segments actually start across all lines.
///
/// Payslips rarely draw ruling lines, so the columns are recovered from the
/// consistent left edges the generator used, not from graphics operators.
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

    // Cluster on the LEFT EDGE only. Growing a band by its own accumulated width
    // is self-reinforcing: each merge widens the band, which widens the merge
    // threshold, until one band swallows the page and every cell reports column 0.
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

/// Assign every line segment to a column band, preserving text verbatim.
pub fn group_rows(lines: &[Line]) -> Table {
    let columns = detect_columns(lines);

    let rows = lines
        .iter()
        .map(|line| Row {
            page: line.page,
            cells: line
                .segments
                .iter()
                .zip(line.segment_boxes.iter())
                .map(|(text, bbox)| Cell {
                    text: text.clone(),
                    bbox: *bbox,
                    // Nearest left edge, not first overlap: bands can overlap
                    // where a wide cell spans two, and first-match would then
                    // report the wrong column for every cell beneath it.
                    column: columns
                        .iter()
                        .enumerate()
                        .filter(|(_, (start, _))| (start - bbox.x).abs() <= COLUMN_TOLERANCE)
                        .min_by(|(_, (a, _)), (_, (b, _))| {
                            (a - bbox.x)
                                .abs()
                                .partial_cmp(&(b - bbox.x).abs())
                                .unwrap_or(std::cmp::Ordering::Equal)
                        })
                        .map(|(index, _)| index),
                })
                .collect(),
        })
        .collect();

    Table { columns, rows }
}

#[cfg(test)]
mod tests {
    use super::{detect_columns, group_rows};
    use crate::lines::{group_lines, Line};
    use payslip_core::{BoundingBox, TextRun};

    fn run(text: &str, x: f32, y: f32) -> TextRun<'static> {
        TextRun::new(text.to_string(), BoundingBox::new(x, y, 50.0, 10.0), 1)
    }

    fn sample() -> Vec<Line> {
        group_lines(&[
            run("Basic", 48.0, 100.0),
            run("1,28,000.00", 200.0, 100.0),
            run("Employee PF", 300.0, 100.0),
            run("15,360.00", 450.0, 100.0),
            run("HRA", 48.0, 120.0),
            run("64,000.00", 200.0, 120.0),
            run("Prof. Tax", 300.0, 120.0),
            run("200.00", 450.0, 120.0),
        ])
    }

    #[test]
    fn a_four_column_payslip_yields_four_bands() {
        // Widening a band by its own accumulated width was self-reinforcing and
        // collapsed every layout to one column, making cell->column meaningless.
        let columns = detect_columns(&sample());
        assert_eq!(columns.len(), 4, "got bands {columns:?}");
    }

    #[test]
    fn cells_map_to_the_band_under_their_left_edge() {
        let table = group_rows(&sample());
        assert_eq!(table.rows.len(), 2);

        for row in &table.rows {
            assert_eq!(row.cells.len(), 4);
            let assigned: Vec<Option<usize>> = row.cells.iter().map(|c| c.column).collect();
            assert_eq!(assigned, vec![Some(0), Some(1), Some(2), Some(3)]);
        }
        assert_eq!(table.rows[0].column(1), Some("1,28,000.00"));
        assert_eq!(table.rows[1].column(3), Some("200.00"));
    }
}
