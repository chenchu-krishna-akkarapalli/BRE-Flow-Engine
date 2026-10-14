// CIBIL HTML (CIR) reports -> positioned text runs, so the HTML export goes
// through the same layout, parser and validator as the PDF.
//
// Each table row becomes one line of runs, one per cell at a fixed column
// pitch; text outside tables becomes a full-width line. This is the layout the
// table reader was tuned on (the blocks run_tests.py fed the engine).
//
// Only html5ever's tokenizer runs: no tree building, nothing executed, and
// <script>/<style> contents are switched to raw text and never read.

use std::borrow::Cow;

use cibil_core::traits::RawTextRun;
use html5ever::tendril::StrTendril;
use html5ever::tokenizer::states::RawKind;
use html5ever::tokenizer::{
    BufferQueue, TagKind, Token, TokenSink, TokenSinkResult, Tokenizer, TokenizerOpts,
};

const COLUMN_PITCH: f32 = 120.0;
const COLUMN_GUTTER: f32 = 10.0;
const ROW_PITCH: f32 = 20.0;
const LINE_HEIGHT: f32 = 15.0;
const FREE_TEXT_WIDTH: f32 = 500.0;
const MIN_PAGE_HEIGHT: f32 = 10_000.0;

const SKIPPED: &[&str] = &["script", "style", "noscript", "template"];
const BREAKS: &[&str] = &["div", "p", "table", "h1", "h2", "h3", "h4", "h5", "h6", "br"];

/// Decode by the bytes, not the declaration: CIR exports declare
/// encoding="utf-16" in their XML prolog while actually being single-byte.
pub fn decode(data: &[u8]) -> String {
    let utf16 = |bytes: &[u8], big_endian: bool| {
        let units: Vec<u16> = bytes
            .chunks_exact(2)
            .map(|c| if big_endian { u16::from_be_bytes([c[0], c[1]]) } else { u16::from_le_bytes([c[0], c[1]]) })
            .collect();
        String::from_utf16_lossy(&units)
    };
    match data {
        [0xFF, 0xFE, rest @ ..] => utf16(rest, false),
        [0xFE, 0xFF, rest @ ..] => utf16(rest, true),
        [0xEF, 0xBB, 0xBF, rest @ ..] => String::from_utf8_lossy(rest).into_owned(),
        _ => {
            let head = &data[..data.len().min(1024)];
            let nuls = head.iter().filter(|&&b| b == 0).count();
            if !head.is_empty() && nuls > head.len() / 4 {
                return utf16(data, head[0] == 0);
            }
            match std::str::from_utf8(data) {
                Ok(text) => text.to_owned(),
                // Latin-1: every byte is the code point of the same value.
                Err(_) => data.iter().map(|&b| b as char).collect(),
            }
        }
    }
}

#[derive(Default)]
struct Layout {
    runs: Vec<(String, [f32; 4])>,
    y: f32,
    in_row: bool,
    in_cell: bool,
    cells: Vec<String>,
    cell: String,
    skip_depth: u32,
    // Text between two tags, delivered as one chunk like a DOM text node.
    pending: String,
}

impl Layout {
    fn line(&mut self, text: &str, x0: f32, x1: f32) {
        self.runs.push((text.to_owned(), [x0, self.y, x1, self.y + LINE_HEIGHT]));
    }

    fn flush_text(&mut self) {
        let text = std::mem::take(&mut self.pending);
        if self.skip_depth > 0 || text.trim().is_empty() {
            return;
        }
        if self.in_cell {
            self.cell.push_str(&text);
        } else if !self.in_row {
            self.line(text.trim(), 0.0, FREE_TEXT_WIDTH);
            self.y += ROW_PITCH;
        }
    }

    fn start(&mut self, name: &str) {
        if SKIPPED.contains(&name) {
            self.skip_depth += 1;
        } else if name == "tr" {
            self.in_row = true;
            self.cells.clear();
        } else if name == "td" || name == "th" {
            self.in_cell = true;
            self.cell.clear();
        } else if BREAKS.contains(&name) {
            self.y += ROW_PITCH;
        }
    }

    fn end(&mut self, name: &str) {
        if SKIPPED.contains(&name) {
            self.skip_depth = self.skip_depth.saturating_sub(1);
        } else if name == "tr" {
            self.in_row = false;
            if !self.cells.is_empty() {
                let cells = std::mem::take(&mut self.cells);
                for (index, text) in cells.iter().enumerate() {
                    let text = text.trim();
                    if !text.is_empty() {
                        let x0 = index as f32 * COLUMN_PITCH;
                        self.line(text, x0, x0 + COLUMN_PITCH - COLUMN_GUTTER);
                    }
                }
                self.y += ROW_PITCH;
            }
        } else if name == "td" || name == "th" {
            self.in_cell = false;
            let cell = std::mem::take(&mut self.cell);
            self.cells.push(cell);
        }
    }
}

impl TokenSink for Layout {
    type Handle = ();

    fn process_token(&mut self, token: Token, _line: u64) -> TokenSinkResult<()> {
        match token {
            Token::CharacterTokens(text) => self.pending.push_str(&text),
            Token::TagToken(tag) => {
                self.flush_text();
                let name: String = tag.name.as_ref().to_ascii_lowercase();
                match tag.kind {
                    TagKind::StartTag => {
                        self.start(&name);
                        // Without a tree builder the tokenizer must be told that
                        // script/style bodies are raw text, or a "</td>" inside a
                        // script string would read as markup.
                        if !tag.self_closing && name == "script" {
                            return TokenSinkResult::RawData(RawKind::ScriptData);
                        }
                        if !tag.self_closing && (name == "style" || name == "noscript" || name == "template") {
                            return TokenSinkResult::RawData(RawKind::Rawtext);
                        }
                        if tag.self_closing {
                            self.end(&name);
                        }
                    }
                    TagKind::EndTag => self.end(&name),
                }
            }
            Token::EOFToken => self.flush_text(),
            _ => {}
        }
        TokenSinkResult::Continue
    }
}

/// HTML report bytes -> runs on one tall page (page 0), as the engine expects
/// from HTML blocks. Empty when the document holds no visible text.
pub fn html_to_runs(data: &[u8]) -> Vec<RawTextRun<'static>> {
    let text = decode(data);
    let mut tokenizer = Tokenizer::new(Layout::default(), TokenizerOpts::default());
    let mut input = BufferQueue::default();
    input.push_back(StrTendril::from(text));
    let _ = tokenizer.feed(&mut input);
    tokenizer.end();
    let layout = tokenizer.sink;

    let page_height = MIN_PAGE_HEIGHT.max(layout.y + 1000.0);
    layout
        .runs
        .into_iter()
        .map(|(text, bbox)| RawTextRun {
            text: Cow::Owned(text),
            bbox,
            page: 0,
            font_name: None,
            font_size: 10.0,
            page_height,
        })
        .collect()
}

/// True when the bytes look like an HTML document rather than a PDF or other file.
pub fn looks_like_html(data: &[u8]) -> bool {
    let text = decode(&data[..data.len().min(4096)]);
    text.to_ascii_lowercase().contains("<html")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn texts(html: &str) -> Vec<(String, [f32; 4])> {
        html_to_runs(html.as_bytes()).into_iter().map(|r| (r.text.into_owned(), r.bbox)).collect()
    }

    #[test]
    fn table_rows_become_cells_at_column_pitch() {
        let runs = texts("<html><table><tr><td>CREDITVISION Score</td><td>795</td></tr></table></html>");
        assert_eq!(runs[0].0, "CREDITVISION Score");
        assert_eq!(runs[1].0, "795");
        assert_eq!(runs[1].1[0], COLUMN_PITCH);
        assert_eq!(runs[0].1[1], runs[1].1[1], "cells of one row share a line");
    }

    #[test]
    fn script_and_style_text_is_never_read() {
        let runs = texts("<html><script>var s = '</td><tr><td>FAKE</td>';</script><style>td{}</style><p>Real</p></html>");
        assert_eq!(runs.iter().map(|r| r.0.as_str()).collect::<Vec<_>>(), vec!["Real"]);
    }

    #[test]
    fn entities_are_decoded_and_split_text_is_rejoined() {
        let runs = texts("<html><table><tr><td>A &amp; B&nbsp;Ltd</td></tr></table></html>");
        assert_eq!(runs[0].0, "A & B\u{a0}Ltd");
    }

    #[test]
    fn declared_utf16_that_is_really_single_byte_decodes_as_utf8() {
        let doc = br#"<?xml version="1.0" encoding="utf-16"?><html><p>Score 795</p></html>"#;
        assert_eq!(html_to_runs(doc)[0].text, "Score 795");
        let mut bom16: Vec<u8> = vec![0xFF, 0xFE];
        bom16.extend("<html><p>Hi</p></html>".encode_utf16().flat_map(|u| u.to_le_bytes()));
        assert_eq!(html_to_runs(&bom16)[0].text, "Hi");
    }

    #[test]
    fn a_pdf_is_not_html() {
        assert!(!looks_like_html(b"%PDF-1.7\n1 0 obj"));
        assert!(looks_like_html(b"<?xml version=\"1.0\"?><html>"));
    }
}
