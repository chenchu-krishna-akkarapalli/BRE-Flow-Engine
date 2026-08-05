// Spatial reconstruction for computation sheets: runs -> lines -> label/value
// pairs, plus the column grid the figures were printed in.

pub mod lines;
pub mod pairs;
pub mod tables;

pub use lines::{group_lines, Line};
pub use pairs::{detect_columns, label_value_pairs, LabelValue};
pub use tables::{group_rows, Cell, Row, Table};
