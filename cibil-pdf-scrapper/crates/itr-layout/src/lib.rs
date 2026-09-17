#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LayoutLine {
    pub line_number: usize,
    pub text: String,
}

pub fn build_layout_lines(raw_text: &str) -> Vec<LayoutLine> {
    raw_text
        .lines()
        .enumerate()
        .map(|(idx, line)| LayoutLine {
            line_number: idx + 1,
            text: line.trim().to_string(),
        })
        .filter(|l| !l.text.is_empty())
        .collect()
}
