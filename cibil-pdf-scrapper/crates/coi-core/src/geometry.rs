use serde::{Deserialize, Serialize};
use std::borrow::Cow;

// Top-left origin, y growing downward, so reading order is a sort on (y, x) and
// callers never have to know PDF space is bottom-up.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct BoundingBox {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

impl BoundingBox {
    pub fn new(x: f32, y: f32, width: f32, height: f32) -> Self {
        Self { x, y, width, height }
    }

    pub fn right(&self) -> f32 {
        self.x + self.width
    }

    pub fn center_y(&self) -> f32 {
        self.y + self.height / 2.0
    }

    pub fn union(&self, other: &BoundingBox) -> BoundingBox {
        let x = self.x.min(other.x);
        let y = self.y.min(other.y);
        BoundingBox {
            x,
            y,
            width: self.right().max(other.right()) - x,
            height: (self.y + self.height).max(other.y + other.height) - y,
        }
    }

    pub fn horizontally_overlaps(&self, other: &BoundingBox) -> bool {
        self.x < other.right() && other.x < self.right()
    }
}

/// A decoded text run. RTF carries no geometry, so `bbox` is synthesised there
/// from line and cell order — position is still monotonic in reading order.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextRun<'a> {
    pub text: Cow<'a, str>,
    pub bbox: BoundingBox,
    pub page: u32,
    pub font_size: f32,
}

impl<'a> TextRun<'a> {
    pub fn new(text: impl Into<Cow<'a, str>>, bbox: BoundingBox, page: u32) -> Self {
        Self { text: text.into(), bbox, page, font_size: bbox.height }
    }

    pub fn as_str(&self) -> &str {
        self.text.as_ref()
    }

    pub fn is_blank(&self) -> bool {
        self.text.trim().is_empty()
    }

    pub fn into_owned(self) -> TextRun<'static> {
        TextRun {
            text: Cow::Owned(self.text.into_owned()),
            bbox: self.bbox,
            page: self.page,
            font_size: self.font_size,
        }
    }
}
