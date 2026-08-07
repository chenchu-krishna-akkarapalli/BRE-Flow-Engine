use regex::Regex;
use std::sync::OnceLock;

fn pan_shape() -> &'static Regex {
    static CELL: OnceLock<Regex> = OnceLock::new();
    CELL.get_or_init(|| Regex::new(r"^[A-Z]{5}[0-9]{4}[A-Z]$").expect("literal"))
}

/// Fourth-character entity codes defined by the Income Tax Department.
const ENTITY_CODES: &[char] = &[
    'A', // Association of Persons
    'B', // Body of Individuals
    'C', // Company
    'F', // Firm
    'G', // Government
    'H', // Hindu Undivided Family
    'J', // Artificial Juridical Person
    'L', // Local Authority
    'P', // Individual
    'T', // Trust
    'K', // Krish (Trust under Wealth Tax)
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PanVerdict {
    Valid { entity: char },
    BadShape,
    UnknownEntityCode(char),
}

/// Validate a PAN's structure and entity code.
///
/// There is no public checksum algorithm for PAN — the last character is a
/// department-assigned alphabetic check, not a computable digit — so structure
/// and the entity code are what can honestly be verified. Aadhaar, which does
/// have a published Verhoeff checksum, is verified arithmetically below.
pub fn validate_pan(pan: &str) -> PanVerdict {
    let upper = pan.trim().to_ascii_uppercase();
    if !pan_shape().is_match(&upper) {
        return PanVerdict::BadShape;
    }
    let entity = upper.chars().nth(3).expect("shape checked above");
    if !ENTITY_CODES.contains(&entity) {
        return PanVerdict::UnknownEntityCode(entity);
    }
    PanVerdict::Valid { entity }
}

// Verhoeff dihedral group D5 tables — the checksum UIDAI specifies for Aadhaar.
const D: [[u8; 10]; 10] = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const P: [[u8; 10]; 8] = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/// Verhoeff checksum, as UIDAI specifies for the 12-digit Aadhaar number.
///
/// Takes digits, never a formatted string, so no caller is tempted to keep the
/// number around in order to validate it later.
pub fn aadhaar_checksum_valid(digits: &str) -> bool {
    let cleaned: Vec<u8> = digits
        .chars()
        .filter(|c| c.is_ascii_digit())
        .map(|c| c as u8 - b'0')
        .collect();

    if cleaned.len() != 12 || cleaned[0] < 2 {
        // Aadhaar numbers never begin with 0 or 1.
        return false;
    }

    let mut check = 0u8;
    for (index, digit) in cleaned.iter().rev().enumerate() {
        check = D[check as usize][P[index % 8][*digit as usize] as usize];
    }
    check == 0
}

#[cfg(test)]
mod tests {
    use super::{aadhaar_checksum_valid, validate_pan, PanVerdict};

    #[test]
    fn pan_shape_and_entity_code() {
        assert_eq!(validate_pan("ABCPE1234F"), PanVerdict::Valid { entity: 'P' });
        assert_eq!(validate_pan("ABCDE1234F"), PanVerdict::UnknownEntityCode('D'));
        assert_eq!(validate_pan("ABC1234F"), PanVerdict::BadShape);
        assert_eq!(validate_pan("abcpe1234f"), PanVerdict::Valid { entity: 'P' });
    }

    #[test]
    fn verhoeff_rejects_a_transposition() {
        // A valid number stays valid; swapping two digits must fail, which is
        // the whole point of a Verhoeff check over a simple modulus.
        let valid = "999999990019";
        assert!(aadhaar_checksum_valid(valid));

        let transposed = "999999999019";
        assert!(!aadhaar_checksum_valid(transposed));
    }

    #[test]
    fn length_and_leading_digit_are_enforced() {
        assert!(!aadhaar_checksum_valid("12345"));
        assert!(!aadhaar_checksum_valid("099999990019"));
    }
}
