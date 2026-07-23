# Onboarding JSON Schema Architecture & Validation Guide
## FlowBRE Multi-Channel Payload Specification

This document presents the complete JSON schema architecture, mock validation payloads, and field constraint matrix for the **FlowBRE Onboarding Platform**, bridging frontend input forms (`flow.html`) with the FastAPI / Zen-Engine backend.

---

## 📄 1. Schema Files Reference
- **JSON Schema (Draft-07)**: [.myrepograph-agent/workflows/onboarding_json_schema.json](file:///c:/Projects/onboarding-bre-engine/.myrepograph-agent/workflows/onboarding_json_schema.json)

---

## 🧪 2. Production Mock Payload Examples

### Case A: Ideal Salaried Individual (Eligible / PASS)

```json
{
  "entityType": "Individual",
  "selectedBank": "HDFC",
  "applicantName": "Aarav Sharma",
  "dob": "1994-06-15",
  "gender": "MALE",
  "pan": "ABCDE1234F",
  "maritalStatus": "MARRIED",
  "citizenshipStatus": "RESIDENT_INDIAN",
  "phone": "9876543210",
  "email": "aarav.sharma@example.com",
  "pincode": "560001",
  "cityName": "Bengaluru",
  "stateName": "Karnataka",
  "residenceStatus": "Owned House",
  "guarantorStatus": "Not Provided",
  "occupation": "Salaried",
  "employerType": "Employment-Pvt Ltd",
  "tenureBand": "2y+",
  "grossSalaryBand": "gt25000",
  "salaryMode": "Salary payment mode- Bank Credit",
  "form16Status": "Form 16",
  "rentalIncomeTypeSalaried": "None",
  "bureauCibilScore": 765,
  "bureauDpd": 0,
  "bureauWriteOffAmount": 0,
  "bureauFlagPL": false,
  "bureauFlagHome": false,
  "bureauFlagConsumer": false,
  "coApplicantRelation": "None"
}
```

---

### Case B: Corporate Entity with Business ITR (Eligible / PASS)

```json
{
  "entityType": "Company",
  "selectedBank": "BOB",
  "companyType": "Private Limited",
  "companyPan": "AAABC1234D",
  "udyamRegNoCompany": "UDYAM-KR-03-0012345",
  "companyLocation": "Indiranagar, Bengaluru",
  "contactPersonName": "Rajesh V. Patel",
  "contactPersonDesignation": "Managing Director",
  "companyMobile": "9812345678",
  "companyEmail": "contact@acmetech.com",
  "companyEstablishmentDate": "2017-03-12",
  "companyItrFilingStatus": "Filed",
  "companyCurrentITRAmount": 1850000,
  "companyPrevITRAmount": 1420000,
  "companyGstin": "29AAABC1234D1Z5",
  "pincode": "560038",
  "cityName": "Bengaluru",
  "stateName": "Karnataka",
  "residenceStatus": "Resi - Cum Office - One Owned",
  "bureauCibilScore": 745,
  "bureauDpd": 0,
  "bureauWriteOffAmount": 0,
  "bureauFlagPL": false,
  "bureauFlagHome": false,
  "bureauFlagConsumer": false,
  "coApplicantRelation": "None"
}
```

---

### Case C: HUF with Rented Premise and Guarantor (Eligible / PASS)

```json
{
  "entityType": "HUF",
  "selectedBank": "BOI",
  "hufName": "Ramesh Chandra HUF",
  "hufPan": "AAAAH1234K",
  "udyamRegNoHUF": "UDYAM-KR-03-0098765",
  "hufLocation": "Jayanagar, Bengaluru",
  "hufFormationDate": "2015-08-20",
  "kartaName": "Ramesh Chandra",
  "kartaPan": "ABCDE5678G",
  "kartaMobile": "9740012345",
  "pincode": "560041",
  "cityName": "Bengaluru",
  "stateName": "Karnataka",
  "residenceStatus": "Resi - Cum Office -Both Rented",
  "guarantorStatus": "Provided",
  "occupation": "Self-Employed",
  "businessEntityType": "HUF",
  "businessEstablishmentDate": "2015-08-20",
  "itrFilingStatus": "Self employed ITR Filled",
  "currentITRAmount": 620000,
  "prevITRAmount": 510000,
  "rentalIncomeTypeSelfEmployed": "None",
  "businessProof": "GSTIN: 29AAAAH1234K1Z2",
  "bureauCibilScore": 735,
  "bureauDpd": 0,
  "bureauWriteOffAmount": 0,
  "bureauFlagPL": false,
  "bureauFlagHome": false,
  "bureauFlagConsumer": false,
  "coApplicantRelation": "Brother",
  "coApplicantAge": 32,
  "coApplicantIncome": 45000
}
```

---

## 📊 3. Field Constraint Reference Matrix

| Parameter / Field Name | Field Type | Nullable / Required | Enum Values / Format | Regex Pattern / Validation Rule |
|---|---|---|---|---|
| `entityType` | `string` | **Required** | `["Individual", "Company", "HUF"]` | Primary channel branching discriminant |
| `selectedBank` | `string` | **Required** | `["BOI", "INDIAN_BANK", "IOB", "BOB", "BOM", "HDFC", "AXIS", "KOTAK"]` | Target bank policy filter key |
| `applicantName` | `string` | Conditional (Individual) | Free text | `min: 2, max: 100` |
| `dob` | `string` | Conditional (Individual) | `YYYY-MM-DD` | Valid date; evaluates age $\ge 21$ |
| `pan` | `string` | Conditional (Individual) | 10 chars | `^[A-Z]{5}[0-9]{4}[A-Z]{1}$` |
| `companyPan` | `string` | Conditional (Company) | 10 chars | `^[A-Z]{5}[0-9]{4}[A-Z]{1}$` |
| `hufPan` | `string` | Conditional (HUF) | 10 chars (H in 4th) | `^[A-Z]{4}H[0-9]{4}[A-Z]{1}$` |
| `pincode` | `string` | **Required** | 6-digit Indian PIN | `^[1-9][0-9]{5}$` |
| `phone` / `companyMobile` / `kartaMobile` | `string` | Conditional | 10-digit mobile | `^[6-9][0-9]{9}$` |
| `email` / `companyEmail` | `string` | Conditional | Email format | Standard email RFC 5322 |
| `residenceStatus` | `string` | **Required** | `["Owned House", "Rented House", "Resi - Cum Office - One Owned", "Resi - Cum Office -Both Rented", "Resi-Office-Separate-Both Rented"]` | Premises setup |
| `guarantorStatus` | `string` | Conditional (Both Rented) | `["Provided", "Not Provided"]` | Mandatory if both residence & office rented |
| `occupation` | `string` | Conditional (Ind/HUF) | `["Salaried", "Self-Employed"]` | Work profile branch |
| `tenureBand` | `string` | Conditional (Salaried) | `["0-6m", "6m-1y", "1y-2y", "2y+"]` | `< 2y` mandates `prevCompanyName` |
| `itrFilingStatus` | `string` | Conditional (Self-Emp) | `["Self employed ITR Filled", "ITR Not Filed"]` | `Filled` mandates `currentITRAmount` ($\ge \text{₹3L}$) |
| `bureauCibilScore` | `integer` | **Required** | Range $300\text{--}900$ | Evaluated against bank CIBIL floor |
| `bureauDpd` | `integer` | **Required** | $\ge 0$ | Evaluated against bank DPD limits |
| `bureauWriteOffAmount` | `number` | **Required** | $\ge 0$ | Evaluated against bank write-off tolerance |
| `companyGstin` | `string` | Optional (Company) | 15-char GSTIN | `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$` |

---

## ✅ Verification
- JSON Schema Draft-07 syntax validated using Python `jsonschema` library.
- All three mock payloads (Individual, Company, HUF) pass 100% schema validation.
