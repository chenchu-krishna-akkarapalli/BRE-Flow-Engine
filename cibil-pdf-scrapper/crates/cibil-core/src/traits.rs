use std::borrow::Cow;
use serde::{Serialize, Deserialize};
use crate::error::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawTextRun<'a> {
    pub text: Cow<'a, str>,
    pub bbox: [f32; 4], // [x0, y0, x1, y1]
    pub page: u32,
    pub font_name: Option<String>,
    pub font_size: f32,
    pub page_height: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct BoundingBox {
    pub x0: f32,
    pub y0: f32,
    pub x1: f32,
    pub y1: f32,
}

impl BoundingBox {
    pub fn new(x0: f32, y0: f32, x1: f32, y1: f32) -> Self {
        Self { x0, y0, x1, y1 }
    }

    pub fn from_array(bbox: [f32; 4]) -> Self {
        Self {
            x0: bbox[0],
            y0: bbox[1],
            x1: bbox[2],
            y1: bbox[3],
        }
    }

    pub fn to_array(&self) -> [f32; 4] {
        [self.x0, self.y0, self.x1, self.y1]
    }

    pub fn height(&self) -> f32 {
        (self.y1 - self.y0).abs()
    }

    pub fn width(&self) -> f32 {
        (self.x1 - self.x0).abs()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutElement<'a> {
    pub text: Cow<'a, str>,
    pub bbox: BoundingBox,
    pub page: u32,
}

impl<'a> LayoutElement<'a> {
    pub fn from_run(run: &'a RawTextRun<'a>) -> Self {
        Self {
            text: run.text.clone(),
            bbox: BoundingBox::from_array(run.bbox),
            page: run.page,
        }
    }
}

pub trait UnicodeDecoder: Send + Sync {
    /// Decodes a string from PDF raw bytes, using font-specific mapping.
    fn decode(&self, bytes: &[u8], font_name: Option<&str>) -> String;
}

pub trait LayoutEngine: Send + Sync {
    /// Processes text runs to yield unified layout elements.
    fn process_runs<'a>(&self, runs: &'a [RawTextRun<'a>]) -> Result<Vec<LayoutElement<'a>>>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DomainSection {
    ConsumerInfo,
    ScoreInfo,
    AccountsSummary,
    AccountHistory,
    EnquiryHistory,
    AddressHistory,
    EmploymentHistory,
    Unknown,
}

pub trait DomainClassifier: Send + Sync {
    /// Classifies a given text or layout element into a CIBIL domain section.
    fn classify(&self, text: &str) -> DomainSection;
}

pub trait OcrFallback: Send + Sync {
    /// Performs OCR on raw image bytes and returns extracted text runs.
    fn extract_text_runs(&self, image_bytes: &[u8], page_num: u32) -> Result<Vec<RawTextRun<'static>>>;
}

pub trait Parser<T>: Send + Sync {
    /// Parses a complete report (such as CibilReport) from layout elements.
    fn parse(&self, elements: &[LayoutElement]) -> Result<T>;
}
