use itr_core::{ItrError, Result};
use itr_domain::ItrDocument;

pub fn validate_itr_document(doc: &ItrDocument) -> Result<()> {
    if let (Some(pan), Some(v_pan)) = (&doc.assessee_info.pan, &doc.verification_details.verifier_pan) {
        if pan != v_pan {
            return Err(ItrError::ValidationError(format!(
                "Assessee PAN ({pan}) does not match verifier PAN ({v_pan})"
            )));
        }
    }
    Ok(())
}
