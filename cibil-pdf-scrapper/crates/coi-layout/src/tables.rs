use crate::lines::Line;
use crate::pairs::{detect_columns, COLUMN_TOLERANCE};
use coi_core::BoundingBox;
use serde::{Deserialize, Serialize};

/// One cell, with the column band it sits in.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cell {
    pub text: String,
    pub bbox: BoundingBox,
    /// Index into the parent table's `columns`, or None when it aligns to none.
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
        self.cells.iter().find(|c| c.column == Some(index)).map(|c| c.text.as_str())
    }
}

/// The sheet as a grid: x-bands plus every row's cells mapped onto them.
///
/// Computation sheets are laid out as columns of figures with no ruling lines,
/// so the grid is recovered from where the generator consistently starts each
/// column. Retained alongside the flat lines because a consumer reconciling
/// figures needs to know which column a number was printed in.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Table {
    pub columns: Vec<(f32, f32)>,
    pub rows: Vec<Row>,
}

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
                    // Nearest left edge, not first overlap: a wide cell can span
                    // two bands, and first-match would then mis-column every
                    // cell beneath it.
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
    use super::group_rows;
    use crate::lines::group_lines;
    use coi_core::{BoundingBox, TextRun};

    fn sample() -> Vec<crate::lines::Line> {
        let runs: Vec<TextRun<'static>> = [
            ("Income from Business or Profession", 48.0, 100.0),
            ("14,15,039", 480.0, 100.0),
            ("Income from Other Sources", 48.0, 120.0),
            ("1,130", 480.0, 120.0),
        ]
        .iter()
        .map(|(t, x, y)| TextRun::new(t.to_string(), BoundingBox::new(*x, *y, 60.0, 10.0), 1))
        .collect();
        group_lines(&runs)
    }

    #[test]
    fn a_two_column_sheet_yields_two_bands() {
        let table = group_rows(&sample());
        assert_eq!(table.columns.len(), 2, "bands {:?}", table.columns);
        assert_eq!(table.rows.len(), 2);
    }

    #[test]
    fn figures_land_in_the_amount_column() {
        let table = group_rows(&sample());

        assert_eq!(table.rows[0].column(1), Some("14,15,039"));
        assert_eq!(table.rows[1].column(1), Some("1,130"));
        assert_eq!(table.rows[1].column(0), Some("Income from Other Sources"));
    }
}
