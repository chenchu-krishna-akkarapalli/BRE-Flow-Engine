use itr_core::parse_amount;
use itr_domain::*;
use regex::Regex;

pub fn extract_assessee_info(text: &str, info: &mut AssesseeInfo) {
    if let Some(caps) = Regex::new(r"(?i)PAN\s*[:\n]?\s*([A-Z]{5}[0-9]{4}[A-Z]{1})").unwrap().captures(text) {
        info.pan = Some(caps[1].to_string());
    }

    if let Some(caps) = Regex::new(r"(?i)Status\s*[:\n]?\s*([A-Za-z]+)").unwrap().captures(text) {
        info.status = Some(caps[1].to_string());
    }

    if let Some(caps) = Regex::new(r"(?i)Assessment\s*\n?\s*Year\s*[:\n]?\s*([0-9]{4}\s*-\s*[0-9]{2})").unwrap().captures(text) {
        let ay = caps[1].replace(' ', "");
        info.assessment_year = Some(ay.clone());
        if let Ok(start_yr) = ay[..4].parse::<i32>() {
            let fy_start = start_yr - 1;
            let fy_end = (start_yr % 100).to_string();
            info.financial_year = Some(format!("{}-{}", fy_start, fy_end));
        }
    }

    if let Some(name_start) = find_keyword_pos(text, "Name") {
        let after_name = &text[name_start..];
        let end_pos = find_first_keyword_pos(after_name, &["Address", "Status", "Form Number", "Assessment"])
            .unwrap_or(after_name.len());
        let name_block = &after_name[..end_pos];
        let lines: Vec<&str> = name_block.lines().map(|l| l.trim()).filter(|l| !l.is_empty()).collect();
        if !lines.is_empty() {
            info.name = Some(lines.join(" "));
        }
    } else if let Some(caps) = Regex::new(r"(?i)Name\s*[:\n]?\s*([^\n]+)").unwrap().captures(text) {
        info.name = Some(caps[1].trim().to_string());
    }

    if let Some(addr_start) = find_keyword_pos(text, "Address") {
        let after_addr = &text[addr_start..];
        let end_pos = find_first_keyword_pos(after_addr, &["Status", "Form Number", "Filed u/s", "e-Filing", "Assessment", "Taxable", "Current"])
            .unwrap_or(after_addr.len());
        let addr_block = &after_addr[..end_pos];
        let lines: Vec<&str> = addr_block.lines().map(|l| l.trim()).filter(|l| !l.is_empty()).collect();
        let mut result_parts: Vec<String> = Vec::new();
        let mut i = 0;
        while i < lines.len() {
            let cur = lines[i];
            if i + 1 < lines.len() && cur.ends_with('-') && lines[i + 1].chars().next().map_or(false, |c| c.is_alphabetic()) {
                let prefix = &cur[..cur.len() - 1];
                let joined = format!("{}{}", prefix, lines[i + 1]);
                result_parts.push(joined);
                i += 2;
            } else {
                result_parts.push(cur.to_string());
                i += 1;
            }
        }
        let addr = result_parts.join(" ");
        if !addr.is_empty() {
            info.address = Some(addr.trim().to_string());
        }
    } else if let Some(caps) = Regex::new(r"(?i)Address\s*[:\n]?\s*([^\n]+)").unwrap().captures(text) {
        info.address = Some(caps[1].trim().to_string());
    }
}

pub fn extract_return_details(text: &str, ret: &mut ReturnDetails) {
    if let Some(caps) = Regex::new(r"(?i)Form\s*Number\s*[:\n]?\s*(ITR-[0-9A-Z()]+)").unwrap().captures(text) {
        ret.form_number = Some(caps[1].to_string());
    }

    if let Some(caps) = Regex::new(r"(?i)Filed\s*u/s\s*[:\n]?\s*([^\n]+)").unwrap().captures(text) {
        let raw = caps[1].trim();
        if let Some(end_idx) = raw.find("e-Filing") {
            ret.filed_u_s = Some(raw[..end_idx].trim().to_string());
        } else {
            ret.filed_u_s = Some(raw.to_string());
        }
    }

    if let Some(caps) = Regex::new(r"(?i)e-Filing\s*Acknowledgement\s*Number\s*[:\n]?\s*([0-9]{15})").unwrap().captures(text) {
        ret.acknowledgement_number = Some(caps[1].to_string());
    } else if let Some(caps) = Regex::new(r"(?i)Acknowledgement\s*Number\s*[:\n]?\s*([0-9]{15})").unwrap().captures(text) {
        ret.acknowledgement_number = Some(caps[1].to_string());
    }

    if let Some(caps) = Regex::new(r"(?i)Date\s*of\s*filing\s*[:\n]?\s*([0-9]{2}-[A-Za-z]{3}-[0-9]{4})").unwrap().captures(text) {
        ret.date_of_filing = Some(caps[1].to_string());
    }
}

pub fn extract_taxable_income_and_tax_details(text: &str, tax: &mut TaxableIncomeAndTaxDetails) {
    if let Some(val) = extract_row_amount(text, &[r"Current\s*Year\s*business\s*loss", r"business\s*loss"], &["1"]) {
        tax.current_year_business_loss = Some(val);
    } else {
        tax.current_year_business_loss = Some(0);
    }

    if let Some(val) = extract_row_amount(text, &[r"Total\s*Income"], &["1A", "2"]) {
        tax.total_income = Some(val);
    } else if let Some(caps) = Regex::new(r"(?i)Total\s*Income\s*\n?\s*(?:1A|2)?\s*\n?\s*([(-]*\s*[0-9,]+(?:\s*\)?)?)").unwrap().captures(text) {
        tax.total_income = parse_amount(&caps[1]);
    }

    if let Some(val) = extract_row_amount(text, &[r"Book\s*Profit\s*under\s*MAT"], &["2", "3"]) {
        tax.book_profit_under_mat = Some(val);
    } else {
        tax.book_profit_under_mat = Some(0);
    }

    if let Some(val) = extract_row_amount(text, &[r"Adjusted\s*Total\s*Income\s*under\s*AMT"], &["3", "4"]) {
        tax.adjusted_total_income_under_amt = Some(val);
    } else {
        tax.adjusted_total_income_under_amt = Some(0);
    }

    if let Some(val) = extract_row_amount(text, &[r"Net\s*tax\s*payable"], &["4", "5"]) {
        tax.net_tax_payable = Some(val);
    } else {
        tax.net_tax_payable = Some(0);
    }

    if let Some(val) = extract_row_amount(text, &[r"Interest\s*and\s*Fee\s*Payable"], &["5", "6"]) {
        tax.interest_and_fee_payable = Some(val);
    } else {
        tax.interest_and_fee_payable = Some(0);
    }

    if let Some(val) = extract_row_amount(text, &[r"Total\s*tax,?\s*interest\s*and\s*Fee\s*payable"], &["6", "7"]) {
        tax.total_tax_interest_and_fee_payable = Some(val);
    } else {
        tax.total_tax_interest_and_fee_payable = Some(0);
    }

    if let Some(val) = extract_row_amount(text, &[r"Taxes\s*Paid"], &["7", "8"]) {
        tax.taxes_paid = Some(val);
    } else {
        tax.taxes_paid = Some(0);
    }

    if let Some(val) = extract_row_amount(text, &[r"(?:\(?\+\)?)\s*Tax\s*Payable\s*/\s*\(?[-–—\u{2212}\u{2013}\u{2014}]?\)?\s*Refundable[^\n]*", r"Tax\s*Payable\s*/\s*Refundable"], &["8", "9"]) {
        tax.tax_payable_or_refundable = Some(val);
    } else {
        tax.tax_payable_or_refundable = Some(0);
    }
}

pub fn extract_verification_details(text: &str, ver: &mut VerificationDetails) {
    if let Some(caps) = Regex::new(r"(?i)(?:submitted\s*electronically|transmitted)\s*on\s*\n?\s*([0-9]{2}-[A-Za-z]{3}-[0-9]{4}\s+[0-9]{2}:[0-9]{2}:[0-9]{2})").unwrap().captures(text) {
        ver.electronically_transmitted_on = Some(caps[1].to_string());
    }

    if let Some(caps) = Regex::new(r"(?i)from\s*IP\s*address\s*\n?\s*([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})").unwrap().captures(text) {
        ver.ip_address = Some(caps[1].to_string());
    }

    if let Some(caps) = Regex::new(r"(?i)and\s*veri[a-z\u{fb01}]*ed\s*by\s*[\r\n]*\s*([A-Za-z\s]+)").unwrap().captures(text) {
        let raw = &caps[1];
        let end_idx = find_first_keyword_pos(raw, &["having", "on", "using", "paper"]).unwrap_or(raw.len());
        let name = raw[..end_idx].trim().replace('\n', " ");
        let name_clean: Vec<&str> = name.split_whitespace().collect();
        if !name_clean.is_empty() {
            ver.verified_by = Some(name_clean.join(" "));
        }
    }

    if let Some(caps) = Regex::new(r"(?i)having\s*PAN\s*\n?\s*([A-Z]{5}[0-9]{4}[A-Z]{1})").unwrap().captures(text) {
        ver.verifier_pan = Some(caps[1].to_string());
    }

    if let Some(caps) = Regex::new(r"(?i)(?:o\s*n|on)\s*\n?\s*([0-9]{2}-[A-Za-z]{3}-[0-9]{4})").unwrap().captures(text) {
        ver.verification_date = Some(caps[1].to_string());
    }

    if let Some(caps) = Regex::new(r"(?i)Veri[a-z\u{fb01}]*cation\s*Code\s*\n?\s*([A-Z0-9]{10})").unwrap().captures(text) {
        ver.evc_code = Some(caps[1].to_string());
    }

    if let Some(caps) = Regex::new(r"(?i)generated\s*through\s*\n?\s*([^\n]+?)(?:\s*mode|\n|$)").unwrap().captures(text) {
        let mode = caps[1].trim();
        if !mode.is_empty() {
            ver.verification_mode = Some(mode.to_string());
        }
    }

    if let Some(caps) = Regex::new(r"(?i)Barcode/QR\s*Code\s*\n?\s*([A-Z0-9]{60,})").unwrap().captures(text) {
        ver.barcode_hash = Some(caps[1].to_string());
    }
}

fn find_keyword_pos(text: &str, keyword: &str) -> Option<usize> {
    let re = Regex::new(&format!(r"(?i)\b{}\b\s*[:\n]?", regex::escape(keyword))).ok()?;
    re.find(text).map(|m| m.end())
}

fn find_first_keyword_pos(text: &str, keywords: &[&str]) -> Option<usize> {
    let mut min_pos = None;
    for kw in keywords {
        if let Ok(re) = Regex::new(&format!(r"(?i)\b{}\b", regex::escape(kw))) {
            if let Some(m) = re.find(text) {
                if min_pos.map_or(true, |p| m.start() < p) {
                    min_pos = Some(m.start());
                }
            }
        }
    }
    min_pos
}

fn extract_row_amount(text: &str, label_patterns: &[&str], expected_row_nums: &[&str]) -> Option<i64> {
    let num_pat = r"([(-–—\u{2212}\u{2013}\u{2014}]*\s*[0-9,]+(?:\s*\)?)?)";
    let row_spec = if expected_row_nums.is_empty() {
        r"(?:[0-9]{1,2}[A-Z]?)"
    } else {
        &format!(r"(?:{})", expected_row_nums.join("|"))
    };

    for label_pat in label_patterns {
        // 1. Stacked with row number: Label \n row_num \n amount
        let pat1 = format!(
            r"(?i){}[^\r\n]*[\r\n]+\s*{}\s*[\r\n]+\s*{}",
            label_pat, row_spec, num_pat
        );
        if let Ok(re) = Regex::new(&pat1) {
            if let Some(caps) = re.captures(text) {
                if let Some(val) = parse_amount(&caps[1]) {
                    return Some(val);
                }
            }
        }

        // 2. Inline with row number: Label row_num amount
        let pat2 = format!(
            r"(?i){}\s+{}\s+{}",
            label_pat, row_spec, num_pat
        );
        if let Ok(re) = Regex::new(&pat2) {
            if let Some(caps) = re.captures(text) {
                if let Some(val) = parse_amount(&caps[1]) {
                    return Some(val);
                }
            }
        }

        // 3. Stacked without row number: Label \n amount
        let pat3 = format!(
            r"(?i){}[^\r\n]*[\r\n]+\s*{}",
            label_pat, num_pat
        );
        if let Ok(re) = Regex::new(&pat3) {
            if let Some(caps) = re.captures(text) {
                let captured_str = caps[1].trim();
                if !is_row_code(captured_str, expected_row_nums) {
                    if let Some(val) = parse_amount(captured_str) {
                        return Some(val);
                    }
                }
            }
        }

        // 4. Inline without row number: Label amount
        let pat4 = format!(
            r"(?i){}\s+{}",
            label_pat, num_pat
        );
        if let Ok(re) = Regex::new(&pat4) {
            if let Some(caps) = re.captures(text) {
                let captured_str = caps[1].trim();
                if !is_row_code(captured_str, expected_row_nums) {
                    if let Some(val) = parse_amount(captured_str) {
                        return Some(val);
                    }
                }
            }
        }
    }
    None
}

fn is_row_code(s: &str, expected_row_nums: &[&str]) -> bool {
    if expected_row_nums.iter().any(|&r| r == s) {
        return true;
    }
    s.len() <= 3 && s.chars().all(|c| c.is_ascii_alphanumeric()) && s.chars().any(|c| c.is_ascii_digit()) && !s.contains(',')
}
