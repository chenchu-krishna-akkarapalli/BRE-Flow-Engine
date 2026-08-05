use cibil_core::error::{CibilError, Result};
use cibil_domain::models::{CibilReport, AccountStatus, ConsumerProfile, AccountHistory, EnquiryHistory};
use serde_json::json;

pub struct CibilValidator;

impl CibilValidator {
    /// Validates the CibilReport data structure for consistency.
    pub fn validate(report: &mut CibilReport) -> Result<()> {
        let summary = &report.accounts_summary;
        let accounts = &report.accounts;
        let mut validation_errors = Vec::new();

        // 1. Check if total accounts match
        if summary.total_accounts > 0 && summary.total_accounts != accounts.len() as u32 {
            validation_errors.push(format!(
                "Account count mismatch: Summary shows {}, but parsed {}",
                summary.total_accounts,
                accounts.len()
            ));
        }

        // 2. Check active accounts match
        let parsed_active = accounts.iter().filter(|a| a.status == AccountStatus::Active).count() as u32;
        if summary.active_accounts > 0 && summary.active_accounts != parsed_active {
            validation_errors.push(format!(
                "Active account count mismatch: Summary shows {}, but parsed active {}",
                summary.active_accounts,
                parsed_active
            ));
        }

        // 3. Verify total balance summation
        let parsed_balance: u64 = accounts.iter().map(|a| a.current_balance.unwrap_or(0)).sum();
        if summary.total_balance > 0 && summary.total_balance != parsed_balance {
            validation_errors.push(format!(
                "Total balance summation mismatch: Summary shows {}, but parsed sum {}",
                summary.total_balance,
                parsed_balance
            ));
        }

        // 4. Duplicate Account Detection
        let mut seen = std::collections::HashSet::new();
        for acc in accounts {
            let key = (
                acc.account_type.clone(),
                acc.date_opened.clone().unwrap_or_default(),
                acc.sanctioned_amount.unwrap_or(0),
            );
            if seen.contains(&key) {
                validation_errors.push(format!("Duplicate account detected: {:?}", key));
            }
            seen.insert(key);
        }

        report.validation_errors = validation_errors;

        Ok(())
    }

    /// Validates ConsumerProfile against its formal JSON Schema.
    pub fn validate_consumer_profile(profile: &ConsumerProfile) -> Result<()> {
        let schema_val = json!({
            "type": "object",
            "properties": {
                "consumer_name": { "type": "string", "minLength": 1 },
                "pan": { "type": ["string", "null"], "pattern": "^[A-Z]{5}[0-9]{4}[A-Z]{1}$" },
                "date_of_birth": { "type": ["string", "null"], "pattern": "^\\d{2}[/-]\\d{2}[/-]\\d{4}$" },
                "gender": { "type": ["string", "null"] },
                "phone": { "type": ["string", "null"] },
                "email": { "type": ["string", "null"] }
            },
            "required": ["consumer_name"]
        });

        let compiled = jsonschema::validator_for(&schema_val)
            .map_err(|e| CibilError::ValidationError(format!("Schema compilation error: {}", e)))?;

        let instance = serde_json::to_value(profile)
            .map_err(|e| CibilError::ValidationError(format!("Serialization failure: {}", e)))?;

        if let Err(err) = compiled.validate(&instance) {
            return Err(CibilError::ValidationError(format!(
                "ConsumerProfile validation failed: {}",
                err
            )));
        }

        Ok(())
    }

    /// Validates AccountHistory against its formal JSON Schema.
    pub fn validate_account_history(history: &AccountHistory) -> Result<()> {
        let schema_val = json!({
            "type": "object",
            "properties": {
                "summary": {
                    "type": "object",
                    "properties": {
                        "total_accounts": { "type": "integer", "minimum": 0 },
                        "active_accounts": { "type": "integer", "minimum": 0 },
                        "closed_accounts": { "type": "integer", "minimum": 0 },
                        "total_balance": { "type": "integer", "minimum": 0 },
                        "total_sanctioned_amount": { "type": "integer", "minimum": 0 }
                    },
                    "required": ["total_accounts", "active_accounts", "closed_accounts"]
                },
                "accounts": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "index": { "type": "integer", "minimum": 1 },
                            "account_type": { "type": "string" },
                            "sanctioned_amount": { "type": ["integer", "null"] },
                            "current_balance": { "type": ["integer", "null"] }
                        },
                        "required": ["index", "account_type"]
                    }
                }
            },
            "required": ["summary", "accounts"]
        });

        let compiled = jsonschema::validator_for(&schema_val)
            .map_err(|e| CibilError::ValidationError(format!("Schema compilation error: {}", e)))?;

        let instance = serde_json::to_value(history)
            .map_err(|e| CibilError::ValidationError(format!("Serialization failure: {}", e)))?;

        if let Err(err) = compiled.validate(&instance) {
            return Err(CibilError::ValidationError(format!(
                "AccountHistory validation failed: {}",
                err
            )));
        }

        Ok(())
    }

    /// Validates EnquiryHistory against its formal JSON Schema.
    pub fn validate_enquiry_history(history: &EnquiryHistory) -> Result<()> {
        let schema_val = json!({
            "type": "object",
            "properties": {
                "enquiries": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "member_name": { "type": "string" },
                            "date": { "type": "string", "pattern": "^\\d{2}[/-]\\d{2}[/-]\\d{4}$" },
                            "purpose": { "type": "string" },
                            "amount": { "type": "integer", "minimum": 0 }
                        },
                        "required": ["member_name", "date"]
                    }
                }
            },
            "required": ["enquiries"]
        });

        let compiled = jsonschema::validator_for(&schema_val)
            .map_err(|e| CibilError::ValidationError(format!("Schema compilation error: {}", e)))?;

        let instance = serde_json::to_value(history)
            .map_err(|e| CibilError::ValidationError(format!("Serialization failure: {}", e)))?;

        if let Err(err) = compiled.validate(&instance) {
            return Err(CibilError::ValidationError(format!(
                "EnquiryHistory validation failed: {}",
                err
            )));
        }

        Ok(())
    }
}
