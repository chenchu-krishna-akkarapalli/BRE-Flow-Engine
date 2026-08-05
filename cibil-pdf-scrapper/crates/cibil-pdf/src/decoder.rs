use cibil_core::traits::{RawTextRun, UnicodeDecoder, OcrFallback};
use cibil_core::error::{CibilError, Result};
use std::borrow::Cow;
use std::collections::HashMap;
use regex::Regex;
use lopdf::{Document, Object};
use md5::{Md5, Digest};

// Self-contained RC4 implementation to support dynamic key lengths without generic/type-inference issues
struct SimpleRc4 {
    s: [u8; 256],
    i: u8,
    j: u8,
}

impl SimpleRc4 {
    fn new(key: &[u8]) -> Self {
        let mut s = [0u8; 256];
        for i in 0..256 {
            s[i] = i as u8;
        }
        let mut j: u8 = 0;
        for i in 0..256 {
            j = j.wrapping_add(s[i]).wrapping_add(key[i % key.len()]);
            s.swap(i, j as usize);
        }
        Self { s, i: 0, j: 0 }
    }

    fn apply_keystream(&mut self, data: &mut [u8]) {
        for byte in data.iter_mut() {
            self.i = self.i.wrapping_add(1);
            self.j = self.j.wrapping_add(self.s[self.i as usize]);
            self.s.swap(self.i as usize, self.j as usize);
            let k = self.s[(self.s[self.i as usize].wrapping_add(self.s[self.j as usize])) as usize];
            *byte ^= k;
        }
    }
}

pub struct CMap {
    pub mappings: HashMap<u32, String>,
}

impl CMap {
    /// Parse a /ToUnicode CMap.
    ///
    /// Token-oriented, not line-oriented: generators routinely emit a whole
    /// `beginbfchar` block on one line, and reading a pair per line then maps
    /// only the first entry and leaves the rest of the page as mojibake.
    pub fn parse(data: &[u8]) -> Self {
        let mut mappings = HashMap::new();
        let text = String::from_utf8_lossy(data);

        let bfchar_re = Regex::new(r"(?s)beginbfchar(.*?)endbfchar").unwrap();
        let bfrange_re = Regex::new(r"(?s)beginbfrange(.*?)endbfrange").unwrap();

        for cap in bfchar_re.captures_iter(&text) {
            let tokens = tokenize(&cap[1]);
            for pair in tokens.chunks(2) {
                let [Token::Hex(src), Token::Hex(dst)] = pair else { continue };
                if let (Some(code), Some(text)) = (parse_hex(src), parse_hex_str(dst)) {
                    mappings.insert(code, text);
                }
            }
        }

        for cap in bfrange_re.captures_iter(&text) {
            let tokens = tokenize(&cap[1]);
            let mut index = 0usize;
            while index + 2 < tokens.len() + 1 {
                let (Some(Token::Hex(lo)), Some(Token::Hex(hi))) =
                    (tokens.get(index), tokens.get(index + 1))
                else {
                    break;
                };
                let (Some(start), Some(end)) = (parse_hex(lo), parse_hex(hi)) else { break };

                match tokens.get(index + 2) {
                    // <lo> <hi> <dstStart>: consecutive code points.
                    Some(Token::Hex(dst)) => {
                        if let Some(base) = parse_hex(dst) {
                            // A malformed range must not materialise millions of entries.
                            if end >= start && end - start < 65_536 {
                                for code in start..=end {
                                    if let Some(c) = char::from_u32(base + (code - start)) {
                                        mappings.insert(code, c.to_string());
                                    }
                                }
                            }
                        }
                        index += 3;
                    }
                    // <lo> <hi> [<d1> <d2> ...]: one destination per code.
                    Some(Token::Array(items)) => {
                        for (offset, item) in items.iter().enumerate() {
                            if let Some(text) = parse_hex_str(item) {
                                mappings.insert(start + offset as u32, text);
                            }
                        }
                        index += 3;
                    }
                    None => break,
                }
            }
        }

        Self { mappings }
    }

    pub fn decode(&self, bytes: &[u8]) -> String {
        if self.mappings.is_empty() {
            return String::from_utf8_lossy(bytes).into_owned();
        }
        let mut result = String::new();
        let mut i = 0;
        while i < bytes.len() {
            if i + 1 < bytes.len() {
                let glyph = ((bytes[i] as u32) << 8) | (bytes[i + 1] as u32);
                if let Some(s) = self.mappings.get(&glyph) {
                    result.push_str(s);
                    i += 2;
                    continue;
                }
            }
            let glyph = bytes[i] as u32;
            if let Some(s) = self.mappings.get(&glyph) {
                result.push_str(s);
            } else {
                result.push(bytes[i] as char);
            }
            i += 1;
        }
        result
    }
}

fn parse_hex(s: &str) -> Option<u32> {
    let cleaned = s.trim_matches('<').trim_matches('>');
    u32::from_str_radix(cleaned, 16).ok()
}

fn parse_hex_str(s: &str) -> Option<String> {
    let cleaned = s.trim_matches('<').trim_matches('>');
    if cleaned.len() == 4 {
        let val = u32::from_str_radix(cleaned, 16).ok()?;
        char::from_u32(val).map(|c| c.to_string())
    } else {
        let mut result = String::new();
        for chunk in cleaned.as_bytes().chunks(4) {
            if let Ok(chunk_str) = std::str::from_utf8(chunk) {
                if let Ok(val) = u32::from_str_radix(chunk_str, 16) {
                    if let Some(c) = char::from_u32(val) {
                        result.push(c);
                    }
                }
            }
        }
        if !result.is_empty() { Some(result) } else { None }
    }
}

fn get_object_dict<'a>(doc: &'a Document, obj: &'a Object) -> Option<&'a lopdf::Dictionary> {
    match obj {
        Object::Reference(id) => doc.get_dictionary(*id).ok(),
        Object::Dictionary(ref dict) => Some(dict),
        _ => None,
    }
}

fn get_stream_data(doc: &Document, obj: &Object) -> Option<Vec<u8>> {
    match obj {
        Object::Reference(id) => {
            if let Ok(stream) = doc.get_object(*id).and_then(|o| o.as_stream()) {
                stream.decompressed_content().ok()
            } else {
                None
            }
        }
        Object::Stream(ref stream) => stream.decompressed_content().ok(),
        _ => None,
    }
}

pub struct CMapDecoder {
    pub cmaps: HashMap<String, CMap>,
}

impl UnicodeDecoder for CMapDecoder {
    fn decode(&self, bytes: &[u8], font_name: Option<&str>) -> String {
        if let Some(f_name) = font_name {
            if let Some(cmap) = self.cmaps.get(f_name) {
                return cmap.decode(bytes);
            }
        }
        String::from_utf8_lossy(bytes).into_owned()
    }
}

pub struct OcrEngine;

impl OcrFallback for OcrEngine {
    fn extract_text_runs(&self, _image_bytes: &[u8], _page_num: u32) -> Result<Vec<RawTextRun<'static>>> {
        // Fallback OCR placeholder
        Ok(Vec::new())
    }
}

pub struct PdfDecoder;

impl PdfDecoder {
    /// Loads a PDF from memory and automatically decrypts standard /V 4-5 security handlers,
    /// or falls back to manual RC4 key derivation and object decryption for legacy /V 1-2 (/R 2-3) exports.
    pub fn load_and_decrypt(data: &[u8], password: Option<&str>) -> Result<Document> {
        let mut doc = Document::load_mem(data)
            .map_err(|e| CibilError::PdfError(format!("Failed to load PDF bytes: {}", e)))?;

        if doc.is_encrypted() && doc.encryption_state.is_none() {
            let pwd = password.unwrap_or("");
            if doc.authenticate_user_password(pwd).is_ok() {
                // Decrypted by lopdf built-in handler
            } else if doc.authenticate_owner_password(pwd).is_ok() {
                // Decrypted by lopdf built-in handler
            } else {
                // Try manual legacy RC4 decryption
                decrypt_legacy_rc4(&mut doc, pwd)?;
            }
        }

        Ok(doc)
    }

    /// Decodes document properties and internal metadata streams.
    pub fn extract_pdf_metadata(doc: &Document) -> Result<HashMap<String, String>> {
        let mut meta = HashMap::new();
        meta.insert("pdf_version".to_string(), doc.version.clone());

        // Scrap info dictionary
        if let Ok(info_obj) = doc.trailer.get(b"Info") {
            if let Some(info_dict) = get_object_dict(doc, info_obj) {
                for (key, val) in info_dict.iter() {
                    let key_str = String::from_utf8_lossy(key).into_owned();
                    let val_str = match val {
                        Object::String(bytes, _) => String::from_utf8_lossy(bytes).into_owned(),
                        Object::Name(name) => String::from_utf8_lossy(name).into_owned(),
                        _ => format!("{:?}", val),
                    };
                    meta.insert(key_str, val_str);
                }
            }
        }

        // Scrap XMP Metadata stream from Catalog
        if let Ok(root_dict) = doc.catalog() {
            if let Ok(metadata_obj) = root_dict.get(b"Metadata") {
                if let Some(data) = get_stream_data(doc, metadata_obj) {
                    meta.insert("xmp_metadata".to_string(), String::from_utf8_lossy(&data).into_owned());
                }
            }
        }

        Ok(meta)
    }

    /// Decodes a page's content stream using `/ToUnicode` font mapping matrices.
    pub fn decode_page(doc: &Document, page_num: u32) -> Result<Vec<RawTextRun<'static>>> {
        let page_id = doc.page_iter().nth((page_num - 1) as usize)
            .ok_or_else(|| CibilError::PdfError(format!("Page {} not found", page_num)))?;

        let content_data = doc.get_page_content(page_id)
            .map_err(|e| CibilError::PdfError(e.to_string()))?;

        let content = lopdf::content::Content::decode(&content_data)
            .map_err(|e| CibilError::PdfError(e.to_string()))?;

        // Build CMap dictionary for fonts on this page
        let mut page_height = 842.0; // default A4
        if let Ok(page_dict) = doc.get_dictionary(page_id) {
            if let Ok(media_box) = page_dict.get(b"MediaBox").and_then(|o| o.as_array()) {
                if media_box.len() >= 4 {
                    let y0 = to_f32(&media_box[1]).unwrap_or(0.0);
                    let y1 = to_f32(&media_box[3]).unwrap_or(842.0);
                    page_height = (y1 - y0).abs();
                }
            }
        }

        let mut cmaps: HashMap<String, CMap> = HashMap::new();
        let resources_opt = doc.get_page_resources(page_id).ok().and_then(|(r, _)| r);
        if let Some(resources) = resources_opt {
            if let Ok(fonts_obj) = resources.get(b"Font") {
                if let Some(fonts_dict) = get_object_dict(doc, fonts_obj) {
                    for (font_key, font_obj) in fonts_dict.iter() {
                        let font_ref_name = String::from_utf8_lossy(font_key).into_owned();
                        if let Some(font_dict) = get_object_dict(doc, font_obj) {
                            if let Ok(to_unicode_obj) = font_dict.get(b"ToUnicode") {
                                if let Some(data) = get_stream_data(doc, to_unicode_obj) {
                                    cmaps.insert(font_ref_name, CMap::parse(&data));
                                }
                            }
                        }
                    }
                }
            }
        }

        let mut runs = Vec::new();
        let mut font_name = None;
        let mut font_size = 12.0;
        let mut tx = 0.0;
        let mut ty = 0.0;

        for operation in content.operations {
            let operator = operation.operator.as_str();
            match operator {
                "Tf" => {
                    if operation.operands.len() >= 2 {
                        if let Some(name) = to_name_string(&operation.operands[0]) {
                            font_name = Some(name);
                        }
                        if let Some(size) = to_f32(&operation.operands[1]) {
                            font_size = size;
                        }
                    }
                }
                "Tm" => {
                    if operation.operands.len() >= 6 {
                        if let Some(e) = to_f32(&operation.operands[4]) {
                            tx = e;
                        }
                        if let Some(f) = to_f32(&operation.operands[5]) {
                            ty = f;
                        }
                    }
                }
                "Td" | "TD" => {
                    if operation.operands.len() >= 2 {
                        if let Some(dx) = to_f32(&operation.operands[0]) {
                            tx += dx;
                        }
                        if let Some(dy) = to_f32(&operation.operands[1]) {
                            ty += dy;
                        }
                    }
                }
                "Tj" => {
                    if let Some(obj) = operation.operands.first() {
                        if let Some(text) = decode_obj_string(obj, font_name.as_deref(), &cmaps) {
                            let width = text.len() as f32 * font_size * 0.6;
                            let height = font_size;
                             runs.push(RawTextRun {
                                text: Cow::Owned(text),
                                bbox: [tx, ty, tx + width, ty + height],
                                page: page_num,
                                font_name: font_name.clone(),
                                font_size,
                                page_height,
                             });
                            tx += width;
                        }
                    }
                }
                "TJ" => {
                    if let Some(Object::Array(arr)) = operation.operands.first() {
                        let mut combined_text = String::new();
                        let mut local_width = 0.0;
                        for item in arr {
                            match item {
                                Object::String(bytes, _) => {
                                    let s = if let Some(ref f_name) = font_name {
                                        if let Some(cmap) = cmaps.get(f_name) {
                                            cmap.decode(bytes)
                                        } else {
                                            String::from_utf8_lossy(bytes).into_owned()
                                        }
                                    } else {
                                        String::from_utf8_lossy(bytes).into_owned()
                                    };
                                    local_width += s.len() as f32 * font_size * 0.6;
                                    combined_text.push_str(&s);
                                }
                                _ => {
                                    if let Some(val) = to_f32(item) {
                                        let adj = -val / 1000.0 * font_size;
                                        local_width += adj;
                                    }
                                }
                            }
                        }
                        if !combined_text.is_empty() {
                             runs.push(RawTextRun {
                                text: Cow::Owned(combined_text),
                                bbox: [tx, ty, tx + local_width, ty + font_size],
                                page: page_num,
                                font_name: font_name.clone(),
                                font_size,
                                page_height,
                             });
                            tx += local_width;
                        }
                    }
                }
                _ => {}
            }
        }

        Ok(runs)
    }
}

fn to_f32(obj: &Object) -> Option<f32> {
    match *obj {
        Object::Real(r) => Some(r as f32),
        Object::Integer(i) => Some(i as f32),
        _ => None,
    }
}

fn to_name_string(obj: &Object) -> Option<String> {
    match obj {
        Object::Name(ref name_bytes) => Some(String::from_utf8_lossy(name_bytes).into_owned()),
        _ => None,
    }
}

fn decode_obj_string(obj: &Object, font_name: Option<&str>, cmaps: &HashMap<String, CMap>) -> Option<String> {
    match obj {
        Object::String(bytes, _) => {
            if let Some(f_name) = font_name {
                if let Some(cmap) = cmaps.get(f_name) {
                    return Some(cmap.decode(bytes));
                }
            }
            if let Ok(s) = String::from_utf8(bytes.clone()) {
                Some(s)
            } else {
                Some(bytes.iter().map(|&b| b as char).collect())
            }
        }
        _ => None,
    }
}

fn decrypt_legacy_rc4(doc: &mut Document, password: &str) -> Result<()> {
    let encrypt_obj_ref = doc.trailer.get(b"Encrypt")
        .map_err(|_| CibilError::PdfError("No Encrypt entry in trailer".to_string()))?;
        
    let encrypt_dict = match encrypt_obj_ref {
        Object::Reference(id) => doc.get_dictionary(*id)
            .map_err(|e| CibilError::PdfError(format!("Failed to get encrypt dict: {}", e)))?,
        Object::Dictionary(ref dict) => dict,
        _ => return Err(CibilError::PdfError("Invalid Encrypt entry type".to_string())),
    };

    let filter = match encrypt_dict.get(b"Filter")? {
        Object::Name(ref name) => name,
        _ => return Err(CibilError::PdfError("Missing or invalid /Filter in Encrypt dictionary".to_string())),
    };
    
    if filter != b"Standard" {
        return Err(CibilError::PdfError(format!("Unsupported security filter: {:?}", String::from_utf8_lossy(filter))));
    }

    let r = match encrypt_dict.get(b"R")? {
        Object::Integer(i) => *i,
        _ => 0,
    };

    if !(r == 2 || r == 3) {
        return Err(CibilError::PdfError(format!("Manual decryption only supports revision 2 or 3, found revision {}", r)));
    }

    let o_bytes = match encrypt_dict.get(b"O")? {
        Object::String(ref bytes, _) => bytes,
        _ => return Err(CibilError::PdfError("Missing or invalid /O key".to_string())),
    };

    let p = match encrypt_dict.get(b"P")? {
        Object::Integer(i) => *i as i32,
        _ => return Err(CibilError::PdfError("Missing or invalid /P key".to_string())),
    };

    let length = match encrypt_dict.get(b"Length") {
        Ok(Object::Integer(i)) => *i as usize,
        _ => 40,
    };
        
    let key_len_bytes = length / 8;

    let doc_id = if let Ok(Object::Array(ref id_arr)) = doc.trailer.get(b"ID") {
        if let Some(Object::String(ref id_str, _)) = id_arr.first() {
            id_str.clone()
        } else {
            Vec::new()
        }
    } else {
        Vec::new()
    };

    let fek = derive_key_r2_r3(password, o_bytes, p, &doc_id, key_len_bytes, r == 3)?;

    let encrypt_obj_id = match encrypt_obj_ref {
        Object::Reference(id) => Some(*id),
        _ => None,
    };

    let mut decrypted_objects = std::collections::BTreeMap::new();
    for (&obj_id, obj) in &doc.objects {
        if Some(obj_id) == encrypt_obj_id {
            decrypted_objects.insert(obj_id, obj.clone());
            continue;
        }

        let mut decrypted_obj = obj.clone();
        decrypt_object(&mut decrypted_obj, obj_id.0, obj_id.1, &fek)?;
        decrypted_objects.insert(obj_id, decrypted_obj);
    }
    doc.objects = decrypted_objects;

    Ok(())
}

fn derive_key_r2_r3(
    password: &str,
    o_bytes: &[u8],
    p: i32,
    doc_id: &[u8],
    key_len_bytes: usize,
    is_revision_3: bool,
) -> Result<Vec<u8>> {
    let padding: [u8; 32] = [
        0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41,
        0x64, 0x00, 0x4E, 0x56, 0xFF, 0xFA, 0x01, 0x08,
        0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80,
        0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A,
    ];

    let mut passwd = [0u8; 32];
    let pwd_bytes = password.as_bytes();
    if pwd_bytes.len() >= 32 {
        passwd.copy_from_slice(&pwd_bytes[..32]);
    } else {
        passwd[..pwd_bytes.len()].copy_from_slice(pwd_bytes);
        passwd[pwd_bytes.len()..].copy_from_slice(&padding[..(32 - pwd_bytes.len())]);
    }

    let mut hasher = Md5::new();
    hasher.update(&passwd);
    hasher.update(o_bytes);

    let p_u32 = p as u32;
    let p_bytes = [
        (p_u32 & 0xFF) as u8,
        ((p_u32 >> 8) & 0xFF) as u8,
        ((p_u32 >> 16) & 0xFF) as u8,
        ((p_u32 >> 24) & 0xFF) as u8,
    ];
    hasher.update(&p_bytes);
    hasher.update(doc_id);

    let mut hash = hasher.finalize();

    if is_revision_3 {
        for _ in 0..50 {
            let mut h2 = Md5::new();
            h2.update(&hash[..key_len_bytes]);
            hash = h2.finalize();
        }
    }

    Ok(hash[..key_len_bytes].to_vec())
}

fn decrypt_object(obj: &mut Object, obj_id: u32, gen_id: u16, fek: &[u8]) -> Result<()> {
    match obj {
        Object::String(ref mut bytes, _) => {
            let decrypted = decrypt_bytes(bytes, obj_id, gen_id, fek)?;
            *bytes = decrypted;
        }
        Object::Stream(ref mut stream) => {
            let decrypted = decrypt_bytes(&stream.content, obj_id, gen_id, fek)?;
            stream.content = decrypted;
        }
        Object::Array(ref mut arr) => {
            for item in arr {
                decrypt_object(item, obj_id, gen_id, fek)?;
            }
        }
        Object::Dictionary(ref mut dict) => {
            for (_, val) in dict.iter_mut() {
                decrypt_object(val, obj_id, gen_id, fek)?;
            }
        }
        _ => {}
    }
    Ok(())
}

fn decrypt_bytes(bytes: &[u8], obj_id: u32, gen_id: u16, fek: &[u8]) -> Result<Vec<u8>> {
    if bytes.is_empty() {
        return Ok(Vec::new());
    }

    let mut key_buf = fek.to_vec();
    key_buf.push((obj_id & 0xFF) as u8);
    key_buf.push(((obj_id >> 8) & 0xFF) as u8);
    key_buf.push(((obj_id >> 16) & 0xFF) as u8);
    key_buf.push((gen_id & 0xFF) as u8);
    key_buf.push(((gen_id >> 8) & 0xFF) as u8);

    let mut hasher = Md5::new();
    hasher.update(&key_buf);
    let hash = hasher.finalize();
    
    let key_len = std::cmp::min(fek.len() + 5, 16);
    let obj_key = &hash[..key_len];

    let mut rc4 = SimpleRc4::new(obj_key);
    let mut decrypted = bytes.to_vec();
    rc4.apply_keystream(&mut decrypted);
    
    Ok(decrypted)
}

// --- Shared with text_engine ---------------------------------------------- //
// The text engine is a separate module but needs the same object resolution and
// /ToUnicode handling; re-exporting beats a second copy that can drift.

pub fn get_object_dict_pub<'a>(doc: &'a Document, obj: &'a Object) -> Option<&'a lopdf::Dictionary> {
    get_object_dict(doc, obj)
}

pub fn get_stream_data_pub(doc: &Document, obj: &Object) -> Option<Vec<u8>> {
    get_stream_data(doc, obj)
}

pub fn to_f32_pub(obj: &Object) -> Option<f32> {
    to_f32(obj)
}

pub fn to_name_string_pub(obj: &Object) -> Option<String> {
    to_name_string(obj)
}

pub fn decode_string_with(bytes: &[u8], font_name: Option<&str>, cmaps: &HashMap<String, CMap>) -> String {
    decode_obj_string(&Object::String(bytes.to_vec(), lopdf::StringFormat::Literal), font_name, cmaps)
        .unwrap_or_default()
}

/// Build the /ToUnicode CMap table for every font on a page.
pub fn cmaps_for_page(doc: &Document, page_id: (u32, u16)) -> HashMap<String, CMap> {
    let mut cmaps = HashMap::new();
    let resources = match doc.get_page_resources(page_id) {
        Ok((Some(resources), _)) => resources,
        _ => return cmaps,
    };
    if let Ok(fonts_obj) = resources.get(b"Font") {
        if let Some(fonts_dict) = get_object_dict(doc, fonts_obj) {
            for (key, font_obj) in fonts_dict.iter() {
                let name = String::from_utf8_lossy(key).into_owned();
                if let Some(font_dict) = get_object_dict(doc, font_obj) {
                    if let Ok(to_unicode) = font_dict.get(b"ToUnicode") {
                        if let Some(data) = get_stream_data(doc, to_unicode) {
                            cmaps.insert(name, CMap::parse(&data));
                        }
                    }
                }
            }
        }
    }
    cmaps
}

#[derive(Debug)]
enum Token {
    Hex(String),
    Array(Vec<String>),
}

/// Split a CMap block into `<hex>` tokens and `[ ... ]` groups, ignoring newlines.
fn tokenize(block: &str) -> Vec<Token> {
    let mut tokens = Vec::new();
    let chars: Vec<char> = block.chars().collect();
    let mut index = 0usize;

    while index < chars.len() {
        match chars[index] {
            '<' => {
                let start = index + 1;
                let mut end = start;
                while end < chars.len() && chars[end] != '>' {
                    end += 1;
                }
                tokens.push(Token::Hex(chars[start..end].iter().collect()));
                index = end + 1;
            }
            '[' => {
                let mut items = Vec::new();
                index += 1;
                while index < chars.len() && chars[index] != ']' {
                    if chars[index] == '<' {
                        let start = index + 1;
                        let mut end = start;
                        while end < chars.len() && chars[end] != '>' {
                            end += 1;
                        }
                        items.push(chars[start..end].iter().collect::<String>());
                        index = end + 1;
                    } else {
                        index += 1;
                    }
                }
                tokens.push(Token::Array(items));
                index += 1;
            }
            _ => index += 1,
        }
    }
    tokens
}

#[cfg(test)]
mod cmap_tests {
    use super::CMap;

    #[test]
    fn a_whole_bfchar_block_on_one_line_maps_every_entry() {
        // Real generators emit exactly this shape; a line-oriented parser reads
        // only the first pair and the rest of the document decodes to mojibake.
        let cmap = b"begincmap 3 beginbfchar <0003> <0020> <0004> <0041> <0011> <0042> endbfchar endcmap";
        let parsed = CMap::parse(cmap);

        assert_eq!(parsed.decode(&[0x00, 0x04]), "A");
        assert_eq!(parsed.decode(&[0x00, 0x11]), "B");
        assert_eq!(parsed.decode(&[0x00, 0x03]), " ");
    }

    #[test]
    fn bfrange_maps_consecutive_code_points() {
        let cmap = b"beginbfrange <0004> <0006> <0041> endbfrange";
        let parsed = CMap::parse(cmap);

        assert_eq!(parsed.decode(&[0x00, 0x04]), "A");
        assert_eq!(parsed.decode(&[0x00, 0x05]), "B");
        assert_eq!(parsed.decode(&[0x00, 0x06]), "C");
    }

    #[test]
    fn bfrange_array_form_maps_each_destination() {
        let cmap = b"beginbfrange <0004> <0006> [<0041> <0058> <0059>] endbfrange";
        let parsed = CMap::parse(cmap);

        assert_eq!(parsed.decode(&[0x00, 0x04]), "A");
        assert_eq!(parsed.decode(&[0x00, 0x05]), "X");
        assert_eq!(parsed.decode(&[0x00, 0x06]), "Y");
    }
}
