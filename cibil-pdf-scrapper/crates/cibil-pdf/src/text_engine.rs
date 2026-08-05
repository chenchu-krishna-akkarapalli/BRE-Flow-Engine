// Content-stream text extraction: real glyph widths, full CTM, line assembly.
//
// The earlier decode_page approximated every advance as len * size * 0.6 and
// ignored the CTM, so bboxes drifted and the layout engine matched the wrong
// table cells. Geometry is the whole product here — the parser locates values
// spatially — so widths come from the font's own metrics and positions are
// carried through the text and transform matrices.

use cibil_core::error::{CibilError, Result};
use cibil_core::traits::RawTextRun;
use lopdf::{Document, Object};
use std::borrow::Cow;
use std::collections::HashMap;

use crate::decoder::{cmaps_for_page, decode_string_with, get_object_dict_pub, to_f32_pub, to_name_string_pub, CMap};

// Glyph advances are expressed in 1/1000 of the text-space unit.
const GLYPH_UNITS: f32 = 1000.0;

// Runs whose baselines sit within this fraction of the font size belong to the
// same visual line. The downstream parser was tuned on line granularity.
const LINE_TOLERANCE: f32 = 0.5;

// Horizontal gap, in multiples of font size, that forces a new line segment.
const COLUMN_GAP: f32 = 1.0;

// Largest font-size ratio two fragments may span and still share a line.
const SIZE_RATIO_LIMIT: f32 = 1.6;

#[derive(Clone, Copy, Default)]
struct Matrix {
    a: f32,
    b: f32,
    c: f32,
    d: f32,
    e: f32,
    f: f32,
}

impl Matrix {
    fn identity() -> Self {
        Matrix { a: 1.0, b: 0.0, c: 0.0, d: 1.0, e: 0.0, f: 0.0 }
    }

    // self applied first, then other.
    fn multiply(&self, other: &Matrix) -> Matrix {
        Matrix {
            a: self.a * other.a + self.b * other.c,
            b: self.a * other.b + self.b * other.d,
            c: self.c * other.a + self.d * other.c,
            d: self.c * other.b + self.d * other.d,
            e: self.e * other.a + self.f * other.c + other.e,
            f: self.e * other.b + self.f * other.d + other.f,
        }
    }

    fn apply(&self, x: f32, y: f32) -> (f32, f32) {
        (self.a * x + self.c * y + self.e, self.b * x + self.d * y + self.f)
    }

    fn from_operands(ops: &[Object]) -> Option<Matrix> {
        if ops.len() < 6 {
            return None;
        }
        Some(Matrix {
            a: to_f32_pub(&ops[0])?,
            b: to_f32_pub(&ops[1])?,
            c: to_f32_pub(&ops[2])?,
            d: to_f32_pub(&ops[3])?,
            e: to_f32_pub(&ops[4])?,
            f: to_f32_pub(&ops[5])?,
        })
    }

    // Vertical scale, used to size glyphs after the full transform.
    fn y_scale(&self) -> f32 {
        (self.b * self.b + self.d * self.d).sqrt()
    }
}

/// Per-font advance metrics, normalised to 1/1000 text-space units.
struct FontMetrics {
    widths: HashMap<u32, f32>,
    default_width: f32,
    // Type0 fonts address glyphs with two-byte CIDs; simple fonts use one byte.
    two_byte: bool,
    // Type3 glyph space is arbitrary and mapped by /FontMatrix, not /1000.
    type3_scale: Option<f32>,
}

impl FontMetrics {
    // Helvetica's average advance. Used only where a font ships no metrics at
    // all, which for the standard 14 means no /Widths array is required of it.
    fn fallback() -> Self {
        FontMetrics {
            widths: HashMap::new(),
            default_width: 500.0,
            two_byte: false,
            type3_scale: None,
        }
    }

    fn advance(&self, code: u32) -> f32 {
        let raw = *self.widths.get(&code).unwrap_or(&self.default_width);
        match self.type3_scale {
            Some(scale) => raw * scale * GLYPH_UNITS,
            None => raw,
        }
    }

    fn codes(&self, bytes: &[u8]) -> Vec<u32> {
        if self.two_byte {
            bytes
                .chunks(2)
                .map(|c| if c.len() == 2 { ((c[0] as u32) << 8) | c[1] as u32 } else { c[0] as u32 })
                .collect()
        } else {
            bytes.iter().map(|b| *b as u32).collect()
        }
    }
}

fn parse_simple_widths(doc: &Document, dict: &lopdf::Dictionary, metrics: &mut FontMetrics) {
    let first = dict
        .get(b"FirstChar")
        .ok()
        .and_then(to_f32_pub)
        .unwrap_or(0.0) as u32;

    let widths = match dict.get(b"Widths") {
        Ok(obj) => match resolve(doc, obj).and_then(|o| o.as_array().ok().cloned()) {
            Some(array) => array,
            None => return,
        },
        Err(_) => return,
    };

    for (index, entry) in widths.iter().enumerate() {
        if let Some(width) = to_f32_pub(entry) {
            metrics.widths.insert(first + index as u32, width);
        }
    }
}

/// Type0 /W: `[ c [w1 w2 ...] cFirst cLast w ]`, both forms interleaved.
fn parse_cid_widths(doc: &Document, descendant: &lopdf::Dictionary, metrics: &mut FontMetrics) {
    metrics.default_width = descendant
        .get(b"DW")
        .ok()
        .and_then(to_f32_pub)
        .unwrap_or(GLYPH_UNITS);

    let array = match descendant.get(b"W") {
        Ok(obj) => match resolve(doc, obj).and_then(|o| o.as_array().ok().cloned()) {
            Some(array) => array,
            None => return,
        },
        Err(_) => return,
    };

    let mut index = 0usize;
    while index < array.len() {
        let start = match to_f32_pub(&array[index]) {
            Some(value) => value as u32,
            None => break,
        };
        index += 1;
        if index >= array.len() {
            break;
        }

        match resolve(doc, &array[index]).and_then(|o| o.as_array().ok().cloned()) {
            Some(list) => {
                for (offset, entry) in list.iter().enumerate() {
                    if let Some(width) = to_f32_pub(entry) {
                        metrics.widths.insert(start + offset as u32, width);
                    }
                }
                index += 1;
            }
            None => {
                let end = match to_f32_pub(&array[index]) {
                    Some(value) => value as u32,
                    None => break,
                };
                index += 1;
                if index >= array.len() {
                    break;
                }
                if let Some(width) = to_f32_pub(&array[index]) {
                    // A run this long is a malformed /W; refuse to materialise it.
                    if end >= start && end - start < 65_536 {
                        for code in start..=end {
                            metrics.widths.insert(code, width);
                        }
                    }
                }
                index += 1;
            }
        }
    }
}

fn resolve<'a>(doc: &'a Document, obj: &'a Object) -> Option<&'a Object> {
    match obj {
        Object::Reference(id) => doc.get_object(*id).ok(),
        other => Some(other),
    }
}

fn load_font_metrics(doc: &Document, font_dict: &lopdf::Dictionary) -> FontMetrics {
    let mut metrics = FontMetrics::fallback();
    let subtype = font_dict
        .get(b"Subtype")
        .ok()
        .and_then(to_name_string_pub)
        .unwrap_or_default();

    match subtype.as_str() {
        "Type0" => {
            metrics.two_byte = true;
            metrics.default_width = GLYPH_UNITS;
            if let Ok(descendants) = font_dict.get(b"DescendantFonts") {
                if let Some(list) = resolve(doc, descendants).and_then(|o| o.as_array().ok()) {
                    if let Some(first) = list.first() {
                        if let Some(dict) = get_object_dict_pub(doc, first) {
                            parse_cid_widths(doc, dict, &mut metrics);
                        }
                    }
                }
            }
        }
        "Type3" => {
            // /FontMatrix maps glyph space to text space; without it the
            // /Widths values are meaningless numbers.
            let scale = font_dict
                .get(b"FontMatrix")
                .ok()
                .and_then(|o| resolve(doc, o))
                .and_then(|o| o.as_array().ok())
                .and_then(|m| m.first().and_then(to_f32_pub))
                .unwrap_or(0.001);
            metrics.type3_scale = Some(scale);
            metrics.default_width = 0.0;
            parse_simple_widths(doc, font_dict, &mut metrics);
        }
        _ => {
            parse_simple_widths(doc, font_dict, &mut metrics);
        }
    }

    metrics
}

fn page_fonts(doc: &Document, page_id: (u32, u16)) -> HashMap<String, FontMetrics> {
    let mut fonts = HashMap::new();
    let resources = match doc.get_page_resources(page_id) {
        Ok((Some(resources), _)) => resources,
        _ => return fonts,
    };

    if let Ok(font_obj) = resources.get(b"Font") {
        if let Some(font_dict) = get_object_dict_pub(doc, font_obj) {
            for (key, value) in font_dict.iter() {
                let name = String::from_utf8_lossy(key).into_owned();
                if let Some(dict) = get_object_dict_pub(doc, value) {
                    fonts.insert(name, load_font_metrics(doc, dict));
                }
            }
        }
    }
    fonts
}

fn page_height_of(doc: &Document, page_id: (u32, u16)) -> f32 {
    doc.get_dictionary(page_id)
        .ok()
        .and_then(|d| d.get(b"MediaBox").ok())
        .and_then(|o| resolve(doc, o))
        .and_then(|o| o.as_array().ok())
        .and_then(|b| {
            if b.len() >= 4 {
                let y0 = to_f32_pub(&b[1])?;
                let y1 = to_f32_pub(&b[3])?;
                Some((y1 - y0).abs())
            } else {
                None
            }
        })
        .unwrap_or(842.0)
}

#[derive(Clone)]
struct Fragment {
    text: String,
    x0: f32,
    x1: f32,
    baseline: f32,
    size: f32,
    font: Option<String>,
}

#[derive(Clone, Copy)]
struct TextState {
    font: Option<usize>,
    size: f32,
    char_spacing: f32,
    word_spacing: f32,
    horizontal_scale: f32,
    leading: f32,
    rise: f32,
}

impl Default for TextState {
    fn default() -> Self {
        TextState {
            font: None,
            size: 12.0,
            char_spacing: 0.0,
            word_spacing: 0.0,
            horizontal_scale: 1.0,
            leading: 0.0,
            rise: 0.0,
        }
    }
}

/// Extract one page as line-level runs with true glyph-metric geometry.
pub fn decode_page_lines(doc: &Document, page_num: u32) -> Result<Vec<RawTextRun<'static>>> {
    let page_id = doc
        .page_iter()
        .nth((page_num - 1) as usize)
        .ok_or_else(|| CibilError::PdfError(format!("Page {} not found", page_num)))?;

    let content_data = doc
        .get_page_content(page_id)
        .map_err(|e| CibilError::PdfError(e.to_string()))?;
    let content = lopdf::content::Content::decode(&content_data)
        .map_err(|e| CibilError::PdfError(e.to_string()))?;

    let fonts = page_fonts(doc, page_id);
    let cmaps: HashMap<String, CMap> = cmaps_for_page(doc, page_id);
    let page_height = page_height_of(doc, page_id);

    let font_names: Vec<String> = fonts.keys().cloned().collect();
    let index_of = |name: &str| font_names.iter().position(|candidate| candidate == name);

    let mut ctm = Matrix::identity();
    let mut stack: Vec<Matrix> = Vec::new();
    let mut text_matrix = Matrix::identity();
    let mut line_matrix = Matrix::identity();
    let mut state = TextState::default();
    let mut fragments: Vec<Fragment> = Vec::new();

    for operation in content.operations {
        let ops = &operation.operands;
        match operation.operator.as_str() {
            "q" => stack.push(ctm),
            "Q" => ctm = stack.pop().unwrap_or_else(Matrix::identity),
            "cm" => {
                if let Some(m) = Matrix::from_operands(ops) {
                    ctm = m.multiply(&ctm);
                }
            }
            "BT" => {
                text_matrix = Matrix::identity();
                line_matrix = Matrix::identity();
            }
            "Tf" => {
                if ops.len() >= 2 {
                    state.font = to_name_string_pub(&ops[0]).and_then(|n| index_of(&n));
                    if let Some(size) = to_f32_pub(&ops[1]) {
                        state.size = size;
                    }
                }
            }
            "Tc" => state.char_spacing = ops.first().and_then(to_f32_pub).unwrap_or(0.0),
            "Tw" => state.word_spacing = ops.first().and_then(to_f32_pub).unwrap_or(0.0),
            "Tz" => {
                state.horizontal_scale =
                    ops.first().and_then(to_f32_pub).unwrap_or(100.0) / 100.0
            }
            "TL" => state.leading = ops.first().and_then(to_f32_pub).unwrap_or(0.0),
            "Ts" => state.rise = ops.first().and_then(to_f32_pub).unwrap_or(0.0),
            "Tm" => {
                if let Some(m) = Matrix::from_operands(ops) {
                    text_matrix = m;
                    line_matrix = m;
                }
            }
            "Td" => {
                if ops.len() >= 2 {
                    let tx = to_f32_pub(&ops[0]).unwrap_or(0.0);
                    let ty = to_f32_pub(&ops[1]).unwrap_or(0.0);
                    let m = Matrix { a: 1.0, b: 0.0, c: 0.0, d: 1.0, e: tx, f: ty };
                    line_matrix = m.multiply(&line_matrix);
                    text_matrix = line_matrix;
                }
            }
            "TD" => {
                if ops.len() >= 2 {
                    let tx = to_f32_pub(&ops[0]).unwrap_or(0.0);
                    let ty = to_f32_pub(&ops[1]).unwrap_or(0.0);
                    state.leading = -ty;
                    let m = Matrix { a: 1.0, b: 0.0, c: 0.0, d: 1.0, e: tx, f: ty };
                    line_matrix = m.multiply(&line_matrix);
                    text_matrix = line_matrix;
                }
            }
            "T*" => {
                let m = Matrix { a: 1.0, b: 0.0, c: 0.0, d: 1.0, e: 0.0, f: -state.leading };
                line_matrix = m.multiply(&line_matrix);
                text_matrix = line_matrix;
            }
            "Tj" | "'" | "\"" => {
                // ' and " advance to the next line before showing their text.
                if operation.operator != "Tj" {
                    if operation.operator == "\"" && ops.len() >= 3 {
                        state.word_spacing = to_f32_pub(&ops[0]).unwrap_or(state.word_spacing);
                        state.char_spacing = to_f32_pub(&ops[1]).unwrap_or(state.char_spacing);
                    }
                    let m = Matrix { a: 1.0, b: 0.0, c: 0.0, d: 1.0, e: 0.0, f: -state.leading };
                    line_matrix = m.multiply(&line_matrix);
                    text_matrix = line_matrix;
                }
                if let Some(Object::String(bytes, _)) = ops.last() {
                    show_text(
                        bytes, &state, &font_names, &fonts, &cmaps, &ctm, &mut text_matrix,
                        &mut fragments,
                    );
                }
            }
            "TJ" => {
                if let Some(Object::Array(items)) = ops.first() {
                    for item in items {
                        match item {
                            Object::String(bytes, _) => show_text(
                                bytes, &state, &font_names, &fonts, &cmaps, &ctm,
                                &mut text_matrix, &mut fragments,
                            ),
                            other => {
                                if let Some(adjust) = to_f32_pub(other) {
                                    let shift = -adjust / GLYPH_UNITS
                                        * state.size
                                        * state.horizontal_scale;
                                    let m = Matrix {
                                        a: 1.0, b: 0.0, c: 0.0, d: 1.0, e: shift, f: 0.0,
                                    };
                                    text_matrix = m.multiply(&text_matrix);
                                }
                            }
                        }
                    }
                }
            }
            _ => {}
        }
    }

    Ok(assemble_lines(fragments, page_num, page_height))
}

#[allow(clippy::too_many_arguments)]
fn show_text(
    bytes: &[u8],
    state: &TextState,
    font_names: &[String],
    fonts: &HashMap<String, FontMetrics>,
    cmaps: &HashMap<String, CMap>,
    ctm: &Matrix,
    text_matrix: &mut Matrix,
    out: &mut Vec<Fragment>,
) {
    let font_name = state.font.and_then(|i| font_names.get(i)).cloned();
    let fallback = FontMetrics::fallback();
    let metrics = font_name
        .as_ref()
        .and_then(|n| fonts.get(n))
        .unwrap_or(&fallback);

    let text = decode_string_with(bytes, font_name.as_deref(), cmaps);

    let render = text_matrix.multiply(ctm);
    let (x0, y0) = render.apply(0.0, state.rise);

    let mut advance = 0.0f32;
    for code in metrics.codes(bytes) {
        let glyph = metrics.advance(code) / GLYPH_UNITS * state.size;
        let word = if !metrics.two_byte && code == 32 { state.word_spacing } else { 0.0 };
        advance += (glyph + state.char_spacing + word) * state.horizontal_scale;
    }

    let shift = Matrix { a: 1.0, b: 0.0, c: 0.0, d: 1.0, e: advance, f: 0.0 };
    *text_matrix = shift.multiply(text_matrix);

    let (x1, _) = text_matrix.multiply(ctm).apply(0.0, state.rise);

    if !text.trim().is_empty() {
        out.push(Fragment {
            text,
            x0,
            x1: if x1 > x0 { x1 } else { x0 + advance.abs() },
            baseline: y0,
            size: state.size * render.y_scale().max(0.01),
            font: font_name,
        });
    }
}

/// Group fragments into visual lines, the granularity the parser expects.
fn assemble_lines(
    mut fragments: Vec<Fragment>,
    page_num: u32,
    page_height: f32,
) -> Vec<RawTextRun<'static>> {
    if fragments.is_empty() {
        return Vec::new();
    }

    // Merge in EMISSION order, not sorted order. A generator draws each line's
    // pieces consecutively, so adjacency in the content stream is the strongest
    // signal that two fragments belong together. Sorting first lets a left
    // column chain into a right one whenever their baselines happen to align,
    // which moves the merged x0 to the far column and breaks any consumer that
    // locates values by position.
    let mut runs: Vec<RawTextRun<'static>> = Vec::new();
    let mut group: Vec<Fragment> = vec![fragments[0].clone()];

    for fragment in fragments.into_iter().skip(1) {
        let reference = &group[0];
        // Tolerance follows the SMALLER glyph: a 20pt score sitting beside 8pt
        // body text would otherwise carry a 10pt window and swallow the lines
        // above and below it, welding the score onto a neighbouring sentence.
        let tolerance = reference.size.min(fragment.size) * LINE_TOLERANCE;
        let same_line = (reference.baseline - fragment.baseline).abs() <= tolerance;

        // Text set at very different sizes is a different element even when the
        // baselines nearly agree — a headline figure is not part of its caption.
        let ratio = reference.size.max(fragment.size) / reference.size.min(fragment.size).max(0.01);
        let comparable = ratio <= SIZE_RATIO_LIMIT;

        // A wide horizontal gap is a separate table cell, not the same phrase —
        // merging across it would weld neighbouring columns into one string.
        // Measured against the group's rightmost edge, and a fragment starting
        // left of where the group began is a new line however close it looks.
        let right = group.iter().fold(f32::MIN, |acc, f| acc.max(f.x1));
        let gap = fragment.x0 - right;
        let far = gap > fragment.size.max(1.0) * COLUMN_GAP
            || fragment.x0 < group[0].x0 - fragment.size;

        if same_line && comparable && !far {
            group.push(fragment);
        } else {
            runs.push(flush(&group, page_num, page_height));
            group = vec![fragment];
        }
    }
    runs.push(flush(&group, page_num, page_height));

    // Emission order is right for merging but not for consumption; hand back
    // reading order (top-down, then left-to-right) as PyMuPDF does.
    runs.sort_by(|a, b| {
        a.bbox[1]
            .partial_cmp(&b.bbox[1])
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(a.bbox[0].partial_cmp(&b.bbox[0]).unwrap_or(std::cmp::Ordering::Equal))
    });
    runs
}

fn flush(group: &[Fragment], page_num: u32, page_height: f32) -> RawTextRun<'static> {
    let mut text = String::new();
    let mut x0 = f32::MAX;
    let mut x1 = f32::MIN;
    let mut baseline = 0.0f32;
    let mut size = 0.0f32;

    for (index, fragment) in group.iter().enumerate() {
        // A gap wider than a space is a real separator in the source layout.
        if index > 0 {
            let gap = fragment.x0 - group[index - 1].x1;
            if gap > fragment.size * 0.22 && !text.ends_with(' ') {
                text.push(' ');
            }
        }
        text.push_str(&fragment.text);
        x0 = x0.min(fragment.x0);
        x1 = x1.max(fragment.x1);
        baseline = fragment.baseline;
        size = size.max(fragment.size);
    }

    RawTextRun {
        text: Cow::Owned(text.trim().to_string()),
        // PDF space is bottom-up; the layout engine works top-down like PyMuPDF.
        bbox: [x0, page_height - baseline - size, x1, page_height - baseline],
        page: page_num,
        font_name: group.first().and_then(|f| f.font.clone()),
        font_size: size,
        page_height,
    }
}
