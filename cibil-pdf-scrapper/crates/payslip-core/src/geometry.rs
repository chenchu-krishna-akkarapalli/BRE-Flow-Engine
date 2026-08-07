use serde::{Deserialize, Serialize};
use std::borrow::Cow;

// Top-left origin, y growing downward — reading order falls out of a plain sort
// on (y, x) and callers never have to know PDF space is bottom-up.
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

    // PDF space is bottom-up; page_height flips a baseline into this space.
    pub fn from_pdf_baseline(x0: f32, baseline: f32, x1: f32, size: f32, page_height: f32) -> Self {
        Self { x: x0, y: page_height - baseline - size, width: (x1 - x0).abs(), height: size }
    }

    pub fn right(&self) -> f32 {
        self.x + self.width
    }

    pub fn bottom(&self) -> f32 {
        self.y + self.height
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
            height: self.bottom().max(other.bottom()) - y,
        }
    }

    // Overlap on the x axis alone: two cells share a column even when their rows differ.
    pub fn horizontally_overlaps(&self, other: &BoundingBox) -> bool {
        self.x < other.right() && other.x < self.right()
    }
}

// Borrowed from the decoded page where possible; Cow keeps the copy out of the
// hot path without forcing every consumer to carry a lifetime.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextRun<'a> {
    pub text: Cow<'a, str>,
    pub bbox: BoundingBox,
    pub page: u32,
    pub font_name: Option<String>,
    pub font_size: f32,
}

impl<'a> TextRun<'a> {
    pub fn new(text: impl Into<Cow<'a, str>>, bbox: BoundingBox, page: u32) -> Self {
        Self { text: text.into(), bbox, page, font_name: None, font_size: bbox.height }
    }

    pub fn as_str(&self) -> &str {
        self.text.as_ref()
    }

    pub fn is_blank(&self) -> bool {
        self.text.trim().is_empty()
    }

    // Detaches from the source buffer so runs can outlive the decoded page.
    pub fn into_owned(self) -> TextRun<'static> {
        TextRun {
            text: Cow::Owned(self.text.into_owned()),
            bbox: self.bbox,
            page: self.page,
            font_name: self.font_name,
            font_size: self.font_size,
        }
    }
}
