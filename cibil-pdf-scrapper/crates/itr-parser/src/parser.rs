use crate::fields::*;
use itr_core::Result;
use itr_domain::*;

pub fn parse_itr_document(text: &str) -> Result<ItrDocument> {
    let mut doc = ItrDocument::default();
    doc._meta.ocr_used = false;
    doc._meta.source = "text_layer".to_string();

    extract_assessee_info(text, &mut doc.assessee_info);
    extract_return_details(text, &mut doc.return_details);
    extract_taxable_income_and_tax_details(text, &mut doc.taxable_income_and_tax_details);

    doc.accreted_income_and_tax_details.accreted_income_u_s_115td = Some(0);
    doc.accreted_income_and_tax_details.additional_tax_payable_u_s_115td = Some(0);
    doc.accreted_income_and_tax_details.interest_payable_u_s_115te = Some(0);
    doc.accreted_income_and_tax_details.additional_tax_and_interest_payable = Some(0);
    doc.accreted_income_and_tax_details.tax_and_interest_paid = Some(0);
    doc.accreted_income_and_tax_details.accreted_tax_payable_or_refundable = Some(0);

    extract_verification_details(text, &mut doc.verification_details);

    Ok(doc)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_ack246782990300724() {
        let pdf_bytes = std::fs::read("../../itr-test/ACK246782990300724 (3).pdf").expect("read pdf");
        let text = itr_pdf::extract_text_from_pdf_bytes(&pdf_bytes).expect("extract text");
        let doc = parse_itr_document(&text).unwrap();

        // Assessee Info
        assert_eq!(doc.assessee_info.pan.as_deref(), Some("ANJPG6405B"));
        assert_eq!(doc.assessee_info.name.as_deref(), Some("ASHISH GUPTA"));
        assert_eq!(
            doc.assessee_info.address.as_deref(),
            Some("NO 03 22ND MAIN ROAD, 17TH CROSS, NEAR TO BUS STOP, J P NAGAR 5TH PHASE , Banagalore , 15Karnataka, 91- INDIA, 560078")
        );
        assert_eq!(doc.assessee_info.status.as_deref(), Some("Individual"));
        assert_eq!(doc.assessee_info.assessment_year.as_deref(), Some("2024-25"));
        assert_eq!(doc.assessee_info.financial_year.as_deref(), Some("2023-24"));

        // Return Details
        assert_eq!(doc.return_details.form_number.as_deref(), Some("ITR-4"));
        assert_eq!(doc.return_details.filed_u_s.as_deref(), Some("139(1)-On or before due date"));
        assert_eq!(doc.return_details.acknowledgement_number.as_deref(), Some("246782990300724"));
        assert_eq!(doc.return_details.date_of_filing.as_deref(), Some("30-Jul-2024"));

        // Taxable Income and Tax Details
        assert_eq!(doc.taxable_income_and_tax_details.current_year_business_loss, Some(0));
        assert_eq!(doc.taxable_income_and_tax_details.total_income, Some(997950));
        assert_eq!(doc.taxable_income_and_tax_details.book_profit_under_mat, Some(0));
        assert_eq!(doc.taxable_income_and_tax_details.adjusted_total_income_under_amt, Some(0));
        assert_eq!(doc.taxable_income_and_tax_details.net_tax_payable, Some(62081));
        assert_eq!(doc.taxable_income_and_tax_details.interest_and_fee_payable, Some(0));
        assert_eq!(doc.taxable_income_and_tax_details.total_tax_interest_and_fee_payable, Some(62081));
        assert_eq!(doc.taxable_income_and_tax_details.taxes_paid, Some(107562));
        assert_eq!(doc.taxable_income_and_tax_details.tax_payable_or_refundable, Some(-45480));

        // Verification Details
        assert_eq!(doc.verification_details.electronically_transmitted_on.as_deref(), Some("30-Jul-2024 19:46:10"));
        assert_eq!(doc.verification_details.ip_address.as_deref(), Some("115.99.112.176"));
        assert_eq!(doc.verification_details.verified_by.as_deref(), Some("ASHISH GUPTA"));
        assert_eq!(doc.verification_details.verifier_pan.as_deref(), Some("ANJPG6405B"));
        assert_eq!(doc.verification_details.verification_date.as_deref(), Some("30-Jul-2024"));
        assert_eq!(doc.verification_details.evc_code.as_deref(), Some("TUK9X6A2EI"));
        assert_eq!(doc.verification_details.verification_mode.as_deref(), Some("Aadhaar OTP"));
        assert_eq!(
            doc.verification_details.barcode_hash.as_deref(),
            Some("ANJPG6405B0424678299030072417c7dbf979b0f30c6803609bb5847ebfce22e90d")
        );
    }

    #[test]
    fn test_parse_ack437565850140925() {
        let pdf_bytes = std::fs::read("../../itr-test/ACK437565850140925 (3).pdf").expect("read pdf");
        let text = itr_pdf::extract_text_from_pdf_bytes(&pdf_bytes).expect("extract text");
        let doc = parse_itr_document(&text).unwrap();

        // Assessee Info
        assert_eq!(doc.assessee_info.pan.as_deref(), Some("ANJPG6405B"));
        assert_eq!(doc.assessee_info.name.as_deref(), Some("ASHISH GUPTA"));
        assert_eq!(
            doc.assessee_info.address.as_deref(),
            Some("No 03 22Nd Main Road, 17Th Cross, Near To Bus Stop, J P Nagar 5Th Phase , Banagalore , 15-Karnataka, 91INDIA, 560078")
        );
        assert_eq!(doc.assessee_info.status.as_deref(), Some("Individual"));
        assert_eq!(doc.assessee_info.assessment_year.as_deref(), Some("2025-26"));
        assert_eq!(doc.assessee_info.financial_year.as_deref(), Some("2024-25"));

        // Return Details
        assert_eq!(doc.return_details.form_number.as_deref(), Some("ITR-4"));
        assert_eq!(doc.return_details.filed_u_s.as_deref(), Some("139(1)-On or before due date"));
        assert_eq!(doc.return_details.acknowledgement_number.as_deref(), Some("437565850140925"));
        assert_eq!(doc.return_details.date_of_filing.as_deref(), Some("14-Sep-2025"));

        // Taxable Income and Tax Details
        assert_eq!(doc.taxable_income_and_tax_details.current_year_business_loss, Some(0));
        assert_eq!(doc.taxable_income_and_tax_details.total_income, Some(1702810));
        assert_eq!(doc.taxable_income_and_tax_details.book_profit_under_mat, Some(0));
        assert_eq!(doc.taxable_income_and_tax_details.adjusted_total_income_under_amt, Some(0));
        assert_eq!(doc.taxable_income_and_tax_details.net_tax_payable, Some(208877));
        assert_eq!(doc.taxable_income_and_tax_details.interest_and_fee_payable, Some(7283));
        assert_eq!(doc.taxable_income_and_tax_details.total_tax_interest_and_fee_payable, Some(216160));
        assert_eq!(doc.taxable_income_and_tax_details.taxes_paid, Some(216158));
        assert_eq!(doc.taxable_income_and_tax_details.tax_payable_or_refundable, Some(0));

        // Verification Details
        assert_eq!(doc.verification_details.electronically_transmitted_on.as_deref(), Some("14-Sep-2025 22:20:39"));
        assert_eq!(doc.verification_details.ip_address.as_deref(), Some("49.15.132.218"));
        assert_eq!(doc.verification_details.verified_by.as_deref(), Some("ASHISH GUPTA"));
        assert_eq!(doc.verification_details.verifier_pan.as_deref(), Some("ANJPG6405B"));
        assert_eq!(doc.verification_details.verification_date.as_deref(), Some("14-Sep-2025"));
        assert_eq!(doc.verification_details.evc_code.as_deref(), Some("EBR1AE6Q9I"));
        assert_eq!(doc.verification_details.verification_mode.as_deref(), Some("Aadhaar OTP"));
        assert_eq!(
            doc.verification_details.barcode_hash.as_deref(),
            Some("ANJPG6405B0443756585014092506bfb81e8371cdc28ce8f37f3974adb0f39818c1")
        );
    }

    #[test]
    fn test_parse_itrv() {
        let pdf_bytes = std::fs::read("../../itr-test/ITRV.pdf").expect("read pdf");
        let text = itr_pdf::extract_text_from_pdf_bytes(&pdf_bytes).expect("extract text");
        let doc = parse_itr_document(&text).unwrap();

        // Assessee Info
        assert_eq!(doc.assessee_info.pan.as_deref(), Some("CHVPP2403E"));
        assert_eq!(doc.assessee_info.name.as_deref(), Some("MAYANK PATEL"));
        assert_eq!(doc.assessee_info.status.as_deref(), Some("Individual"));
        assert_eq!(doc.assessee_info.assessment_year.as_deref(), Some("2023-24"));
        assert_eq!(doc.assessee_info.financial_year.as_deref(), Some("2022-23"));

        // Return Details
        assert_eq!(doc.return_details.form_number.as_deref(), Some("ITR-3"));
        assert_eq!(doc.return_details.acknowledgement_number.as_deref(), Some("815006290290723"));
        assert_eq!(doc.return_details.date_of_filing.as_deref(), Some("29-Jul-2023"));

        // Taxable Income and Tax Details
        assert_eq!(doc.taxable_income_and_tax_details.current_year_business_loss, Some(0));
        assert_eq!(doc.taxable_income_and_tax_details.total_income, Some(558210));
        assert_eq!(doc.taxable_income_and_tax_details.book_profit_under_mat, Some(0));
        assert_eq!(doc.taxable_income_and_tax_details.adjusted_total_income_under_amt, Some(558210));
        assert_eq!(doc.taxable_income_and_tax_details.net_tax_payable, Some(25108));
        assert_eq!(doc.taxable_income_and_tax_details.interest_and_fee_payable, Some(0));
        assert_eq!(doc.taxable_income_and_tax_details.total_tax_interest_and_fee_payable, Some(25108));
        assert_eq!(doc.taxable_income_and_tax_details.taxes_paid, Some(44089));
        assert_eq!(doc.taxable_income_and_tax_details.tax_payable_or_refundable, Some(-18980));

        // Verification Details
        assert_eq!(doc.verification_details.electronically_transmitted_on.as_deref(), Some("29-Jul-2023 15:59:12"));
        assert_eq!(doc.verification_details.ip_address.as_deref(), Some("182.69.93.253"));
        assert_eq!(doc.verification_details.verified_by.as_deref(), Some("MAYANK PATEL"));
        assert_eq!(doc.verification_details.verifier_pan.as_deref(), Some("CHVPP2403E"));
        assert_eq!(doc.verification_details.verification_date.as_deref(), Some("29-Jul-2023"));
        assert_eq!(doc.verification_details.evc_code.as_deref(), Some("7U98BUWZ9I"));
        assert_eq!(doc.verification_details.verification_mode.as_deref(), Some("Aadhaar OTP"));
        assert_eq!(
            doc.verification_details.barcode_hash.as_deref(),
            Some("CHVPP2403E038150062902907234ba30e5ab0b80a449a88d4ffb90a427252bf5332")
        );
    }
}
