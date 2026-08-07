// Tagged-PDF structure tree reader: /StructTreeRoot -> Document/Sect/Table/TR/TD.
//
// Only some generators emit it. Word and Office write a real tag tree; the
// "Microsoft: Print To PDF" driver that produced most of this corpus writes
// none, so this is a corroborating source, never the only one.

use cibil_pdf::decoder::{cmaps_for_page, decode_string_with, CMap};
use coi_core::Result;
use lopdf::{Dictionary, Document, Object};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// A tag tree can be self-referential through a malformed /K; bound the walk.
const MAX_DEPTH: usize = 64;

// TJ kerning more negative than this is a word gap, not letter tightening.
const WORD_GAP: f64 = -100.0;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomNode {
    /// Structure type after /RoleMap resolution, e.g. "Table", "TR", "TD", "P".
    pub tag: String,
    pub page: Option<u32>,
    pub text: String,
    pub children: Vec<DomNode>,
}

impl DomNode {
    /// Own text plus every descendant's, in reading order.
    pub fn full_text(&self) -> String {
        let mut parts: Vec<String> = Vec::new();
        if !self.text.trim().is_empty() {
            parts.push(self.text.trim().to_string());
        }
        for child in &self.children {
            let text = child.full_text();
            if !text.is_empty() {
                parts.push(text);
            }
        }
        parts.join(" ")
    }

    fn collect<'a>(&'a self, tag: &str, out: &mut Vec<&'a DomNode>) {
        if self.tag == tag {
            out.push(self);
        }
        for child in &self.children {
            child.collect(tag, out);
        }
    }

    pub fn descendants(&self, tag: &str) -> Vec<&DomNode> {
        let mut out = Vec::new();
        self.collect(tag, &mut out);
        out
    }

    /// TD and TH in document order.
    ///
    /// Collecting the two tags separately and concatenating reorders the row:
    /// a header cell printed mid-row would land after the data cells, and the
    /// label would then be paired with the wrong figure.
    fn cells<'a>(&'a self, out: &mut Vec<&'a DomNode>) {
        for child in &self.children {
            if child.tag == "TD" || child.tag == "TH" {
                out.push(child);
            } else {
                child.cells(out);
            }
        }
    }

    /// The page this node was drawn on, falling back to the first descendant
    /// that names one — a /Table carries no /Pg, only its leaves do.
    fn effective_page(&self) -> Option<u32> {
        self.page.or_else(|| self.children.iter().find_map(|child| child.effective_page()))
    }
}

/// A tagged table flattened to rows of cell text — the DOM equivalent of the
/// spatial column grid, with the cell boundaries the generator itself declared.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomTable {
    pub page: Option<u32>,
    pub rows: Vec<Vec<String>>,
}

/// Every /Table in the tag tree, as rows of cells.
pub fn tables(root: &DomNode) -> Vec<DomTable> {
    root.descendants("Table")
        .into_iter()
        .map(|table| DomTable {
            page: table.effective_page(),
            rows: table
                .descendants("TR")
                .into_iter()
                .map(|row| {
                    let mut cells: Vec<&DomNode> = Vec::new();
                    row.cells(&mut cells);
                    cells.into_iter().map(|c| c.full_text()).collect()
                })
                .filter(|cells: &Vec<String>| !cells.is_empty())
                .collect(),
        })
        .collect()
}

/// The structure tree, or None when the document carries no tags.
pub fn extract(doc: &Document) -> Result<Option<DomNode>> {
    let Some(root_ref) = doc
        .catalog()
        .ok()
        .and_then(|catalog| catalog.get(b"StructTreeRoot").ok())
        .map(|obj| obj.to_owned())
    else {
        return Ok(None);
    };

    let Some(root) = dict_of(doc, &root_ref) else { return Ok(None) };
    let role_map = role_map(doc, root);
    let pages = page_numbers(doc);
    let mut text_cache: HashMap<(u32, u16), HashMap<i64, String>> = HashMap::new();

    let mut children = Vec::new();
    if let Ok(kids) = root.get(b"K") {
        walk(doc, kids, None, &role_map, &pages, &mut text_cache, 0, &mut children);
    }

    Ok(Some(DomNode {
        tag: "StructTreeRoot".to_string(),
        page: None,
        text: String::new(),
        children,
    }))
}

fn role_map(doc: &Document, root: &Dictionary) -> HashMap<String, String> {
    root.get(b"RoleMap")
        .ok()
        .and_then(|obj| dict_of(doc, obj))
        .map(|map| {
            map.iter()
                .filter_map(|(key, value)| {
                    let name = value.as_name().ok()?;
                    Some((
                        String::from_utf8_lossy(key).into_owned(),
                        String::from_utf8_lossy(name).into_owned(),
                    ))
                })
                .collect()
        })
        .unwrap_or_default()
}

fn page_numbers(doc: &Document) -> HashMap<(u32, u16), u32> {
    doc.page_iter().enumerate().map(|(index, id)| (id, index as u32 + 1)).collect()
}

fn dict_of<'a>(doc: &'a Document, obj: &'a Object) -> Option<&'a Dictionary> {
    match obj {
        Object::Dictionary(dict) => Some(dict),
        Object::Reference(id) => doc.get_object(*id).ok().and_then(|o| o.as_dict().ok()),
        _ => None,
    }
}

#[allow(clippy::too_many_arguments)]
fn walk(
    doc: &Document,
    node: &Object,
    inherited_page: Option<(u32, u16)>,
    role_map: &HashMap<String, String>,
    pages: &HashMap<(u32, u16), u32>,
    cache: &mut HashMap<(u32, u16), HashMap<i64, String>>,
    depth: usize,
    out: &mut Vec<DomNode>,
) {
    if depth > MAX_DEPTH {
        return;
    }

    match node {
        Object::Array(items) => {
            for item in items {
                walk(doc, item, inherited_page, role_map, pages, cache, depth + 1, out);
            }
        }
        // A bare integer kid is a marked-content id on the inherited page.
        Object::Integer(mcid) => {
            if let Some(page_id) = inherited_page {
                let text = mcid_text(doc, page_id, cache).get(mcid).cloned().unwrap_or_default();
                if !text.trim().is_empty() {
                    out.push(DomNode {
                        tag: "MC".to_string(),
                        page: pages.get(&page_id).copied(),
                        text,
                        children: Vec::new(),
                    });
                }
            }
        }
        Object::Reference(_) | Object::Dictionary(_) => {
            let Some(dict) = dict_of(doc, node) else { return };

            // /MCR and /OBJR are content references, not structure elements.
            let raw_tag = dict
                .get(b"S")
                .ok()
                .and_then(|o| o.as_name().ok())
                .map(|n| String::from_utf8_lossy(n).into_owned());

            let page_id = dict
                .get(b"Pg")
                .ok()
                .and_then(|o| match o {
                    Object::Reference(id) => Some(*id),
                    _ => None,
                })
                .or(inherited_page);

            let Some(raw_tag) = raw_tag else {
                // An /MCR wrapper: descend into its MCID without inventing a node.
                if let Ok(Object::Integer(mcid)) = dict.get(b"MCID") {
                    walk(
                        doc,
                        &Object::Integer(*mcid),
                        page_id,
                        role_map,
                        pages,
                        cache,
                        depth + 1,
                        out,
                    );
                }
                return;
            };

            let tag = role_map.get(&raw_tag).cloned().unwrap_or(raw_tag);
            let mut children = Vec::new();
            if let Ok(kids) = dict.get(b"K") {
                walk(doc, kids, page_id, role_map, pages, cache, depth + 1, &mut children);
            }

            // /ActualText overrides the glyphs, which is the point of it.
            let text = dict
                .get(b"ActualText")
                .ok()
                .and_then(|o| o.as_str().ok())
                .map(|b| decode_text_string(b))
                .unwrap_or_default();

            out.push(DomNode { tag, page: page_id.and_then(|id| pages.get(&id).copied()), text, children });
        }
        _ => {}
    }
}

/// PDF text strings are UTF-16BE when they carry the BOM, PDFDocEncoding otherwise.
fn decode_text_string(bytes: &[u8]) -> String {
    if bytes.starts_with(&[0xFE, 0xFF]) {
        let units: Vec<u16> = bytes[2..]
            .chunks_exact(2)
            .map(|pair| u16::from_be_bytes([pair[0], pair[1]]))
            .collect();
        String::from_utf16_lossy(&units)
    } else {
        bytes.iter().map(|b| *b as char).collect()
    }
}

fn mcid_text<'a>(
    doc: &Document,
    page_id: (u32, u16),
    cache: &'a mut HashMap<(u32, u16), HashMap<i64, String>>,
) -> &'a HashMap<i64, String> {
    cache.entry(page_id).or_insert_with(|| scan_marked_content(doc, page_id).unwrap_or_default())
}

/// Pair every /MCID with the text shown inside its BDC…EMC span.
///
/// Independent of the spatial text engine on purpose: that engine merges and
/// reorders runs for layout, which would destroy the content-stream nesting the
/// marked-content ids are defined against.
fn scan_marked_content(doc: &Document, page_id: (u32, u16)) -> Option<HashMap<i64, String>> {
    let content = doc.get_page_content(page_id).ok()?;
    let operations = lopdf::content::Content::decode(&content).ok()?.operations;
    let cmaps: HashMap<String, CMap> = cmaps_for_page(doc, page_id);
    let properties = doc
        .get_page_resources(page_id)
        .ok()
        .and_then(|(resources, _)| resources)
        .and_then(|resources| resources.get(b"Properties").ok())
        .and_then(|obj| dict_of(doc, obj))
        .cloned()
        .unwrap_or_default();

    let mut out: HashMap<i64, String> = HashMap::new();
    // A stack, because BDC spans nest and text belongs to the innermost one.
    let mut open: Vec<Option<i64>> = Vec::new();
    let mut font: Option<String> = None;

    fn push(open: &[Option<i64>], out: &mut HashMap<i64, String>, text: &str) {
        if text.is_empty() {
            return;
        }
        if let Some(Some(mcid)) = open.iter().rev().find(|slot| slot.is_some()) {
            out.entry(*mcid).or_default().push_str(text);
        }
    }

    for operation in &operations {
        match operation.operator.as_str() {
            "BDC" => {
                let mcid = operation.operands.get(1).and_then(|operand| match operand {
                    Object::Dictionary(dict) => dict.get(b"MCID").ok()?.as_i64().ok(),
                    Object::Name(name) => properties
                        .get(name)
                        .ok()
                        .and_then(|o| dict_of(doc, o))
                        .and_then(|dict| dict.get(b"MCID").ok()?.as_i64().ok()),
                    _ => None,
                });
                open.push(mcid);
            }
            "BMC" => open.push(None),
            "EMC" => {
                open.pop();
            }
            "Tf" => {
                font = operation
                    .operands
                    .first()
                    .and_then(|o| o.as_name().ok())
                    .map(|n| String::from_utf8_lossy(n).into_owned());
            }
            "Tj" | "'" | "\"" => {
                if let Some(bytes) = operation.operands.last().and_then(|o| o.as_str().ok()) {
                    let text = decode_string_with(bytes, font.as_deref(), &cmaps);
                    push(&open, &mut out, &text);
                }
            }
            "TJ" => {
                let Some(Object::Array(items)) = operation.operands.first() else { continue };
                let mut text = String::new();
                for item in items {
                    match item {
                        Object::String(bytes, _) => {
                            text.push_str(&decode_string_with(bytes, font.as_deref(), &cmaps));
                        }
                        other => {
                            let adjustment = match other {
                                Object::Real(value) => *value as f64,
                                Object::Integer(value) => *value as f64,
                                _ => 0.0,
                            };
                            if adjustment < WORD_GAP
                                && !text.ends_with(' ')
                                && !text.is_empty()
                            {
                                text.push(' ');
                            }
                        }
                    }
                }
                push(&open, &mut out, &text);
            }
            // Text object boundaries end a visual line inside one MCID span.
            "ET" => push(&open, &mut out, " "),
            _ => {}
        }
    }

    Some(out)
}

#[cfg(test)]
mod tests {
    use super::{decode_text_string, tables, DomNode};

    fn node(tag: &str, text: &str, children: Vec<DomNode>) -> DomNode {
        DomNode { tag: tag.to_string(), page: Some(1), text: text.to_string(), children }
    }

    #[test]
    fn a_tagged_table_flattens_to_rows_of_cells() {
        let tree = node(
            "Table",
            "",
            vec![
                node("TR", "", vec![node("TD", "Gross Total Income", vec![]), node("TD", "4,98,263", vec![])]),
                node("TR", "", vec![node("TD", "Total Income", vec![]), node("TD", "4,97,640", vec![])]),
            ],
        );

        let flat = tables(&node("Document", "", vec![tree]));
        assert_eq!(flat.len(), 1);
        assert_eq!(flat[0].rows, vec![
            vec!["Gross Total Income".to_string(), "4,98,263".to_string()],
            vec!["Total Income".to_string(), "4,97,640".to_string()],
        ]);
    }

    #[test]
    fn a_header_cell_keeps_its_place_in_the_row() {
        // Word emits "Date of Birth" as a TH between two TDs. Collecting TD then
        // TH would move it to the end and pair the date with the wrong label.
        let table = node(
            "Table",
            "",
            vec![node(
                "TR",
                "",
                vec![
                    node("TD", "09/11/1989", vec![]),
                    node("TH", "Date of Birth", vec![]),
                    node("TD", "Resident", vec![]),
                ],
            )],
        );

        let flat = tables(&node("Document", "", vec![table]));
        assert_eq!(flat[0].rows[0], vec!["09/11/1989", "Date of Birth", "Resident"]);
    }

    #[test]
    fn a_table_reports_the_page_of_its_leaves() {
        // A /Table element carries no /Pg; only the marked content beneath it does.
        let table = DomNode {
            tag: "Table".to_string(),
            page: None,
            text: String::new(),
            children: vec![node("TR", "", vec![node("TD", "x", vec![])])],
        };
        assert_eq!(tables(&node("Document", "", vec![table]))[0].page, Some(1));
    }

    #[test]
    fn cell_text_gathers_nested_spans() {
        // Word wraps every cell's text in a /P and often a /Span beneath it;
        // reading only the TD's own text yields empty cells.
        let cell = node("TD", "", vec![node("P", "", vec![node("Span", "80TTA", vec![])])]);
        assert_eq!(cell.full_text(), "80TTA");
    }

    #[test]
    fn utf16_text_strings_are_decoded() {
        let bytes = [0xFE, 0xFF, 0x00, 0x50, 0x00, 0x41, 0x00, 0x4E];
        assert_eq!(decode_text_string(&bytes), "PAN");
    }
}
