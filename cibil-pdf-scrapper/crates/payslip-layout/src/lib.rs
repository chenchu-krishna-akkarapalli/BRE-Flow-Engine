// Spatial reconstruction: runs -> lines -> column-aligned table cells.

pub mod lines;
pub mod tables;

pub use lines::{group_lines, Line};
pub use tables::{detect_columns, group_rows, Cell, Row, Table};
