use regex::Regex;

pub struct ItrPatterns {
    pub pan: Regex,
    pub ack_no: Regex,
    pub date_filing: Regex,
    pub ay: Regex,
    pub ip_address: Regex,
    pub evc: Regex,
}

impl Default for ItrPatterns {
    fn default() -> Self {
        Self {
            pan: Regex::new(r"[A-Z]{5}[0-9]{4}[A-Z]{1}").unwrap(),
            ack_no: Regex::new(r"Acknowledgement\s*Number\s*:\s*([0-9]{15})").unwrap(),
            date_filing: Regex::new(r"Date\s*of\s*filing\s*:\s*([0-9]{2}-[A-Za-z]{3}-[0-9]{4})").unwrap(),
            ay: Regex::new(r"Assessment\s*Year\s*\n?\s*([0-9]{4}\s*-\s*[0-9]{2})").unwrap(),
            ip_address: Regex::new(r"from\s*IP\s*address\s*([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})").unwrap(),
            evc: Regex::new(r"Electronic\s*Verification\s*Code\s*([A-Z0-9]{10})").unwrap(),
        }
    }
}
