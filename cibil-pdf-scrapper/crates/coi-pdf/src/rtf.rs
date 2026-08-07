use coi_core::{BoundingBox, CoiError, Result, TextRun};

// RTF carries no coordinates, so geometry is synthesised: rows step down, cells
// step across. Reading order and cell boundaries are what the layout crate
// needs, and both survive this projection.
const LINE_HEIGHT: f32 = 12.0;
const CELL_WIDTH: f32 = 90.0;
const TOP_MARGIN: f32 = 40.0;
const LEFT_MARGIN: f32 = 40.0;

// Control groups whose contents are metadata, not document text. Skipping them
// is what separates a font table from the assessee's actual figures.
const SKIP_DESTINATIONS: &[&str] = &[
    "fonttbl", "colortbl", "stylesheet", "info", "pict", "object", "themedata",
    "colorschememapping", "latentstyles", "datastore", "rsidtbl", "generator",
    "listtable", "listoverridetable", "xmlnstbl", "filetbl", "revtbl", "upr",
    "mmathPr", "wgrffmtfilter", "panose", "falt", "listtext", "nonshppict",
];

#[derive(Clone, Copy)]
struct GroupState {
    skipping: bool,
}

/// Extract text from an RTF document as line- and cell-separated runs.
///
/// Hand-written rather than pulled from a crate: the corpus needs `\cell`,
/// `\row`, `\par`, `\'xx` and `\uN` handling and nothing else, and a parser we
/// own can keep table cells separate — which the field extraction depends on.
pub fn extract_runs(data: &[u8]) -> Result<Vec<TextRun<'static>>> {
    // RTF is 7-bit ASCII with escapes; latin-1 keeps byte values intact for \'xx.
    let text: String = data.iter().map(|&b| b as char).collect();
    let chars: Vec<char> = text.chars().collect();

    let mut stack: Vec<GroupState> = vec![GroupState { skipping: false }];
    let mut cells: Vec<String> = Vec::new();
    let mut current = String::new();
    let mut rows: Vec<Vec<String>> = Vec::new();
    let mut index = 0usize;

    // `\uc N` sets how many fallback bytes follow each \uN; it is per-group.
    let mut unicode_skip = 1u32;

    while index < chars.len() {
        let ch = chars[index];
        let state = *stack.last().expect("root group is never popped");

        match ch {
            '{' => {
                stack.push(state);
                index += 1;
            }
            '}' => {
                if stack.len() > 1 {
                    stack.pop();
                }
                index += 1;
            }
            '\\' => {
                let (word, param, star, next) = read_control(&chars, index);
                index = next;

                if star {
                    // \* marks an optional destination the reader may ignore.
                    if let Some(top) = stack.last_mut() {
                        top.skipping = true;
                    }
                    continue;
                }

                match word.as_str() {
                    "" => {}
                    // Literal escapes.
                    "\\" | "{" | "}" => {
                        if !state.skipping {
                            current.push(word.chars().next().unwrap_or('\\'));
                        }
                    }
                    "par" | "line" | "row" | "sect" => {
                        if !state.skipping {
                            cells.push(std::mem::take(&mut current));
                            rows.push(std::mem::take(&mut cells));
                        }
                    }
                    "cell" | "nestcell" => {
                        if !state.skipping {
                            cells.push(std::mem::take(&mut current));
                        }
                    }
                    "tab" => {
                        if !state.skipping {
                            cells.push(std::mem::take(&mut current));
                        }
                    }
                    "uc" => unicode_skip = param.unwrap_or(1).max(0) as u32,
                    "u" => {
                        if !state.skipping {
                            if let Some(code) = param {
                                // Negative values are the signed 16-bit form.
                                let scalar = if code < 0 { (code + 65536) as u32 } else { code as u32 };
                                if let Some(c) = char::from_u32(scalar) {
                                    current.push(c);
                                }
                            }
                        }
                        index = skip_fallback(&chars, index, unicode_skip);
                    }
                    "'" => {
                        // \'xx is a raw byte in the document code page.
                        if index + 1 < chars.len() {
                            let hex: String = chars[index..(index + 2).min(chars.len())].iter().collect();
                            if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                                if !state.skipping {
                                    current.push(byte as char);
                                }
                                index += 2;
                            }
                        }
                    }
                    other if SKIP_DESTINATIONS.contains(&other) => {
                        if let Some(top) = stack.last_mut() {
                            top.skipping = true;
                        }
                    }
                    _ => {}
                }
            }
            '\r' | '\n' => index += 1,
            _ => {
                if !state.skipping {
                    current.push(ch);
                }
                index += 1;
            }
        }
    }

    if !current.trim().is_empty() {
        cells.push(current);
    }
    if !cells.is_empty() {
        rows.push(cells);
    }

    let runs = to_runs(rows);
    if runs.is_empty() {
        return Err(CoiError::Rtf("document contained no text".into()));
    }
    Ok(runs)
}

/// Read a control word or symbol at `index`, returning (word, param, is_star, next).
fn read_control(chars: &[char], index: usize) -> (String, Option<i32>, bool, usize) {
    let mut cursor = index + 1;
    if cursor >= chars.len() {
        return (String::new(), None, false, cursor);
    }

    let first = chars[cursor];
    if first == '*' {
        return (String::new(), None, true, cursor + 1);
    }
    if !first.is_ascii_alphabetic() {
        // A control symbol such as \\ or \{ or \'
        return (first.to_string(), None, false, cursor + 1);
    }

    let mut word = String::new();
    while cursor < chars.len() && chars[cursor].is_ascii_alphabetic() {
        word.push(chars[cursor]);
        cursor += 1;
    }

    let mut digits = String::new();
    if cursor < chars.len() && (chars[cursor] == '-' || chars[cursor].is_ascii_digit()) {
        if chars[cursor] == '-' {
            digits.push('-');
            cursor += 1;
        }
        while cursor < chars.len() && chars[cursor].is_ascii_digit() {
            digits.push(chars[cursor]);
            cursor += 1;
        }
    }
    // A single space after a control word is a delimiter, not content.
    if cursor < chars.len() && chars[cursor] == ' ' {
        cursor += 1;
    }

    (word, digits.parse().ok(), false, cursor)
}

/// Skip the ANSI fallback characters that follow a \uN escape.
fn skip_fallback(chars: &[char], mut index: usize, count: u32) -> usize {
    let mut remaining = count;
    while remaining > 0 && index < chars.len() {
        if chars[index] == '\\' {
            let (_, _, _, next) = read_control(chars, index);
            index = next;
        } else {
            index += 1;
        }
        remaining -= 1;
    }
    index
}

fn to_runs(rows: Vec<Vec<String>>) -> Vec<TextRun<'static>> {
    let mut runs = Vec::new();
    let mut y = TOP_MARGIN;

    for row in rows {
        let mut emitted = false;
        for (column, cell) in row.into_iter().enumerate() {
            let text = cell.trim().to_string();
            if text.is_empty() {
                continue;
            }
            let bbox = BoundingBox::new(
                LEFT_MARGIN + column as f32 * CELL_WIDTH,
                y,
                (text.chars().count() as f32 * 5.0).max(8.0),
                LINE_HEIGHT,
            );
            runs.push(TextRun::new(text, bbox, 1));
            emitted = true;
        }
        if emitted {
            y += LINE_HEIGHT + 2.0;
        }
    }
    runs
}
