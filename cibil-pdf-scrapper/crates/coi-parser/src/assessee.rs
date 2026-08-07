use crate::patterns;
use coi_domain::{aadhaar, AssesseeDetails, AADHAAR_REDACTED};
use coi_layout::LabelValue;

// Label -> field. Longest match wins so "Father's Name" is not taken by "Name".
const LABELS: &[(&str, &str)] = &[
    ("NAME OF ASSESSEE", "name"),
    ("ASSESSEE NAME", "name"),
    ("FATHER'S NAME", "fathers_name"),
    ("FATHERS NAME", "fathers_name"),
    ("ADDRESS", "address"),
    ("E-MAIL", "email"),
    ("EMAIL", "email"),
    ("STATUS", "status"),
    ("PAN", "pan"),
    ("DATE OF BIRTH", "date_of_birth"),
    ("RESIDENTIAL STATUS", "residential_status"),
    ("GENDER", "gender"),
    ("WARD", "ward"),
    ("NATURE OF BUSINESS", "nature_of_business"),
    ("FILING STATUS", "filing_status"),
    ("BANK NAME", "bank"),
];

/// Build the assessee block, redacting Aadhaar at the point of extraction.
///
/// Redacting here rather than at serialisation means no later code path — a log
/// line, a debug dump, an intermediate file — can leak the number by omission.
pub fn extract(pairs: &[LabelValue], source_text: &str) -> AssesseeDetails {
    let mut details = AssesseeDetails::default();

    let mut ordered: Vec<&(&str, &str)> = LABELS.iter().collect();
    ordered.sort_by_key(|(label, _)| std::cmp::Reverse(label.len()));

    for pair in pairs {
        let label = pair.label.trim().trim_end_matches(':').trim().to_ascii_uppercase();
        for (candidate, field) in &ordered {
            // Exact or prefix on the whole cell: "Bank Name" must not match "NAME".
            if label != **candidate && !label.starts_with(*candidate) {
                continue;
            }
            let value = pair.value.trim();
            if value.is_empty() {
                continue;
            }
            let slot = match *field {
                "name" => &mut details.name,
                "fathers_name" => &mut details.fathers_name,
                "address" => &mut details.address,
                "email" => &mut details.email,
                "status" => &mut details.status,
                "pan" => &mut details.pan,
                "date_of_birth" => &mut details.date_of_birth,
                "residential_status" => &mut details.residential_status,
                "gender" => &mut details.gender,
                "ward" => &mut details.ward,
                "nature_of_business" => &mut details.nature_of_business,
                "filing_status" => &mut details.filing_status,
                "bank" => &mut details.bank,
                _ => continue,
            };
            if slot.is_none() {
                *slot = Some(value.to_string());
            }
            break;
        }
    }

    // A bare PAN anywhere beats a missing one; normalise to upper case.
    if details.pan.is_none() {
        if let Some(caps) = patterns::pan().captures(&source_text.to_ascii_uppercase()) {
            details.pan = Some(caps[1].to_string());
        }
    }
    // Validate the shape of whatever the label gave us; a stray value is dropped
    // rather than carried forward as a PAN.
    if let Some(pan) = &details.pan {
        let upper = pan.to_ascii_uppercase();
        details.pan = patterns::pan().captures(&upper).map(|c| c[1].to_string());
    }

    // Presence only. The digits are never stored, so they cannot be serialised.
    if aadhaar::contains(source_text) {
        details.aadhaar = Some(AADHAAR_REDACTED.to_string());
    }

    details
}

/// Replace every Aadhaar-shaped run in a string with the redaction marker.
pub fn redact_aadhaar(text: &str) -> String {
    aadhaar::redact(text)
}

#[cfg(test)]
mod tests {
    use super::redact_aadhaar;
    use coi_domain::AADHAAR_REDACTED;

    #[test]
    fn aadhaar_is_redacted_in_every_written_form() {
        for input in ["Aadhaar No: 975490473406", "9754 9047 3406", "9754-9047-3406"] {
            let out = redact_aadhaar(input);
            assert!(out.contains(AADHAAR_REDACTED), "{input} -> {out}");
            assert!(!out.contains("9047"), "digits survived: {out}");
        }
    }

    #[test]
    fn shorter_and_longer_digit_runs_are_untouched() {
        // A 12-digit run is an Aadhaar; an acknowledgement number is not.
        assert_eq!(redact_aadhaar("A/C NO:4688000103410401"), "A/C NO:4688000103410401");
        assert_eq!(redact_aadhaar("PIN 226021"), "PIN 226021");
    }
}
