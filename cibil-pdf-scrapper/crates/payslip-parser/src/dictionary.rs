use serde::Deserialize;
use std::collections::HashMap;
use std::sync::OnceLock;

#[derive(Debug, Deserialize, Clone)]
pub struct CategoryAliases {
    pub employee: HashMap<String, Vec<String>>,
    pub earnings: HashMap<String, Vec<String>>,
    pub deductions: HashMap<String, Vec<String>>,
    pub summary: HashMap<String, Vec<String>>,
}

static DICTIONARY: OnceLock<CategoryAliases> = OnceLock::new();

pub fn get_dictionary() -> &'static CategoryAliases {
    DICTIONARY.get_or_init(|| {
        let json_str = include_str!("label-alias-dictionary.json");
        serde_json::from_str(json_str).expect("label-alias-dictionary.json must be valid JSON")
    })
}

/// Normalize a raw label string (lowercase, trimmed, stripped of punctuation).
pub fn normalize_label(label: &str) -> String {
    label
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' { c } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Find canonical category for an earning or deduction raw label.
pub fn match_category(label: &str, is_deduction: bool) -> (String, &'static str, f64) {
    let dict = get_dictionary();
    let norm = normalize_label(label);
    let categories = if is_deduction { &dict.deductions } else { &dict.earnings };

    // 1. Exact match on normalized alias
    for (category, aliases) in categories {
        for alias in aliases {
            let norm_alias = normalize_label(alias);
            if norm == norm_alias {
                return (category.clone(), "exact_alias", 1.0);
            }
        }
    }

    // 2. Fuzzy / substring match
    for (category, aliases) in categories {
        for alias in aliases {
            let norm_alias = normalize_label(alias);
            if !norm_alias.is_empty() && (norm.contains(&norm_alias) || norm_alias.contains(&norm)) {
                return (category.clone(), "fuzzy_alias", 0.85);
            }
        }
    }

    // 3. Fallback
    let fallback = if is_deduction { "other_deduction" } else { "other_earning" };
    (fallback.to_string(), "positional_heuristic", 0.6)
}
