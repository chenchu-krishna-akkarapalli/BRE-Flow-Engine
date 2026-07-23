# 📜 Rules.md — Business Rule Engine Policy Specification

Canonical, human-readable specification of every decision rule executed by
the Zen-Engine for the FlowBRE onboarding flow. Each rule ID here maps
1:1 to a condition inside `zen_rules/*.json`. **If you change one, change
both**, and update `CLAUDE.md §3` review notes if the change affects the
latency budget.

All 64 BRE-sheet parameters are covered across 9 modules. Partner banks:
**BOI, Indian Bank, IOB, BOB, BOM, HDFC, AXIS, Kotak.**

---

## 0. Global Flow

```
                      ┌──────────────────────────┐
                      │   Applicant Onboarding    │
                      └────────────┬─────────────┘
                                   │
                ┌──────────────────┴──────────────────┐
                ▼                                     ▼
      [Individual Flow]                        [Company Flow]
                │                                     │
      ┌─────────┴─────────┐                 ┌─────────┴─────────┐
      ▼                   ▼                 ▼                   ▼
 [Salaried]        [Self-Employed]     [Proprietorship]    [Pvt/Public Ltd]
      └───────────────────┴─────────────────┴───────────────────┘
                                   ▼
                    [Credit Bureau & DPD Evaluation]
                                   ▼
                    [Bank-Wise Policy Matrix (8 banks)]
                                   ▼
                        [Eligibility Verdict + Reasons]
```

---

## 1. Demographics & Entity Rules (`DEM-###`) — file: `applicant_eligibility.json`

| Rule ID | Parameter | Operator | Threshold | Action | Rejection Reason |
|---|---|---|---|---|---|
| DEM-101 | age | `<` | 21 | REJECT | Applicant age is below the minimum requirement (21 years). |
| DEM-102 | age_at_last_emi_salaried | `>` | 60 | REJECT | Age at final EMI maturity exceeds 60 years for salaried applicants. |
| DEM-103 | age_at_last_emi_self_employed | `>` | 65 | REJECT | Age at final EMI maturity exceeds 65 years for self-employed applicants. |
| DEM-104 | is_nri | `==` | true | FLAG | Triggers `minimum_stay_period_nri` check (must be ≥ 182 days). |
| DEM-105 | minimum_stay_period_nri | `<` | 182 (days) | REJECT | NRI/PIO applicant does not meet minimum in-country stay period. |
| DEM-106 | marital_status | `== "UNMARRIED"` | — | FLAG | No rejection; informational flag used by underwriting. |

## 2. Residence, Office Premises & Guarantor Rules (`RES-###`) — file: `applicant_eligibility.json`

| Rule ID | Parameter | Condition | Action | Rejection Reason |
|---|---|---|---|---|
| RES-201 | rented_house_salaried | property_status == "RENTED" && occupation == "SALARIED" | FLAG | Informational — no guarantor required by default. |
| RES-202 | resi_cum_office_one_owned | property_status == "RESI_CUM_OFFICE_OWNED" && occupation == "SELF_EMPLOYED" | PASS | Owned resi-cum-office premises satisfies collateral comfort. |
| RES-203 | resi_cum_office_both_rented | property_status == "RESI_CUM_OFFICE_RENTED" | REQUIRE_GUARANTOR | Both residence and office rented — guarantor mandatory. |
| RES-204 | resi_office_separate_both_rented | property_status == "SEPARATE_BOTH_RENTED" | REQUIRE_GUARANTOR | Separate rented residence and office — guarantor mandatory. |
| RES-205 | without_guarantor | guarantor_provided == false && (RES-203 \|\| RES-204 triggered) | REJECT | Guarantor is mandatory for this property configuration. |
| RES-206 | with_guarantor | guarantor_provided == true | PASS | Guarantor condition satisfied. |

## 3. Employment Profile & Work Experience (`EMP-SAL-###`) — file: `employment_income_rules.json`

Salaried applicants only.

| Rule ID | Parameter | Condition | Action | Rejection Reason |
|---|---|---|---|---|
| EMP-SAL-201 | current_company_tenure_months | `< 24` | REQUIRE_PREVIOUS_EMPLOYMENT_FIELDS | Mandates `previous_company_name` and `previous_joining_date`. |
| EMP-SAL-202 | net_monthly_salary | `< 25000` | REJECT | Monthly net salary is below the minimum parameter (₹25,000). |
| EMP-SAL-203 | salary_payment_mode | `== "CASH"` | REJECT_OR_MANUAL_AUDIT | Cash salary requires secondary manual audit or is rejected per bank policy. |
| EMP-SAL-204 | minimum_work_experience_years | `< 1` | REJECT | Applicant does not meet minimum total work experience (1 year). |
| EMP-SAL-205 | work_experience_current_company_pvt_sec | `< 6` (months) | FLAG | Short tenure at current private-sector employer — routed for manual review. |
| EMP-SAL-206 | employer_type | one of [GOVT, PSU, PUBLIC_LTD, PVT_LTD, FIRM, AGRICULTURE] | PASS | Used to compute employer-type risk weighting per bank. |
| EMP-SAL-207 | form_16_available | `== false` && no_income_proof_segment == true | FLAG | No income proof — routed to alternate-income underwriting path. |

## 4. Income, Rental Income & FOIR (`EMP-SAL-3##`) — file: `employment_income_rules.json`

| Rule ID | Parameter | Condition | Action | Rejection Reason |
|---|---|---|---|---|
| EMP-SAL-301 | emi_income_ratio_foir | `>` bank's `max_foir_ratio` | REJECT | EMI-to-income ratio (FOIR) exceeds the selected bank's maximum threshold. |
| EMP-SAL-302 | rental_income_agreement_no_itr_not_in_bank | agreement == true && itr_filed == false && bank_reflected == false | DISCOUNT_50PCT | Rental income counted at reduced weightage due to no ITR/bank proof. |
| EMP-SAL-303 | rental_income_agreement_itr_not_in_bank | agreement == true && itr_filed == true && bank_reflected == false | DISCOUNT_25PCT | Rental income counted at partial weightage. |
| EMP-SAL-304 | rental_income_agreement_no_itr_in_bank | agreement == true && itr_filed == false && bank_reflected == true | DISCOUNT_25PCT | Rental income counted at partial weightage. |

## 5. Self-Employed Applicants (`EMP-SE-###`) — file: `employment_income_rules.json`

| Rule ID | Parameter | Logic Expression | Action | Rejection Reason |
|---|---|---|---|---|
| EMP-SE-301 | business_experience_years | `< 2` | REJECT | Minimum 2 years of business existence required. |
| EMP-SE-302 | current_itr | `< 300000` | REJECT | Current-year ITR must be at least ₹3,00,000. |
| EMP-SE-303 | previous_itr | `< 100000` | REJECT | Previous-year ITR must be at least ₹1,00,000. |
| EMP-SE-304 | itr_filed | `== false` | REJECT | Active ITR filing proof is required for self-employed profiles. |
| EMP-SE-305 | requested_loan_amount | `< 100000` | REJECT | Minimum loan ticket size for self-employed applicants is ₹1,00,000. |
| EMP-SE-306 | business_entity_type | one of [PROPRIETORSHIP, PARTNERSHIP, PVT_LTD, PUBLIC_LTD, HUF] | PASS | Entity type used for documentation and risk-tier routing. |
| EMP-SE-307 | business_proof | `== false` | REJECT | Valid business proof/registration document is required. |

## 6. Credit Bureau (CIBIL) & DPD Parsing (`BUR-###`) — file: `credit_bureau_rules.json`

The bureau PDF parser reads all active and historical loan accounts and
converts every `"STD"` string to `0` DPD before evaluation.

```
┌─────────────────────────────────────────────────────────────────┐
│                    CIBIL Report Parsing Loop                    │
└─────────────────────────────────────────────────────────────────┘
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
[Check Write-Off Amounts]                            [Check DPD Arrays]
         │                                                   │
  Is Write-Off > 0?                                   Any DPD > 90 Days?
  ├─ YES ──> REJECT (BUR-401)                         ├─ YES ──> REJECT (BUR-402)
  └─ NO  ──> Proceed                                   └─ NO  ──> Proceed
                                                             │
                                                  Indian Bank Selected?
                                                  ├─ YES & DPD > 0 ──> REJECT (BUR-403)
                                                  └─ NO            ──> PASS
```

| Rule ID | Condition | Action | Rejection Reason |
|---|---|---|---|
| BUR-401 | `credit_bureau.write_off_amount > 0` | REJECT | Application declined due to a recorded loan write-off amount. |
| BUR-402 | `count(credit_bureau.dpd_history, # > 90) > 0` | REJECT | Application declined due to DPD exceeding 90 days in past credit history. |
| BUR-403 | `selected_bank == "INDIAN_BANK" && count(credit_bureau.dpd_history, # > 0) > 0` | REJECT | Indian Bank requires zero past DPD instances across all loan accounts. |
| BUR-404 | `credit_bureau.currently_overdue == true` | REJECT | Application declined due to active currently-outstanding overdue balances. |
| BUR-405 | `credit_bureau.cibil_score < bank.min_cibil_score` | REJECT | CIBIL score is below the selected bank's minimum threshold. |
| BUR-406 | `credit_bureau.cibil_pl_score < 650` | FLAG | Personal-loan bureau score below comfortable range — routed for manual review. |
| BUR-407 | `credit_bureau.loan_enquiry_count_last_6m > 5` | FLAG | High recent loan-enquiry count — potential credit-hungry behavior flag. |

## 7. Business Entity & Tax Compliance (`ENT-###`) — file: `employment_income_rules.json`

| Rule ID | Parameter | Condition | Action | Rejection Reason |
|---|---|---|---|---|
| ENT-501 | proprietorship / partnership / pvt_ltd / public_ltd | entity registered & active | PASS | Standard entity types accepted by all partner banks. |
| ENT-502 | huf_status | entity_type == "HUF" | FLAG | HUF entities require additional coparcener documentation. |
| ENT-503 | self_employed_current_itr | see EMP-SE-302 | REJECT | (alias of EMP-SE-302 for entity-level reporting) |
| ENT-504 | self_employed_previous_itr | see EMP-SE-303 | REJECT | (alias of EMP-SE-303 for entity-level reporting) |
| ENT-505 | itr_not_filed | itr_filed == false | REJECT | Mandatory ITR filing proof missing. |
| ENT-506 | business_itr | business_itr_amount below bank-specific floor | REJECT | Declared business ITR is below the bank's minimum acceptable value. |

## 8. Co-Applicant Eligibility (`COAPP-###`) — file: `co_applicant_rules.json`

| Rule ID | Parameter | Condition | Action | Rejection Reason |
|---|---|---|---|---|
| COAPP-601 | co_applicant_age_brother | age < 21 or age > bank max co-applicant age | REJECT_COAPP | Co-applicant (brother) does not meet age eligibility. |
| COAPP-602 | co_applicant_age_sister | age < 21 or age > bank max co-applicant age | REJECT_COAPP | Co-applicant (sister) does not meet age eligibility. |
| COAPP-603 | co_applicant_income_brother | income < minimum co-applicant income floor | DISCOUNT_50PCT | Brother's income counted at reduced weightage for FOIR computation. |
| COAPP-604 | co_applicant_income_father | income < minimum co-applicant income floor | DISCOUNT_50PCT | Father's income counted at reduced weightage for FOIR computation. |
| COAPP-605 | co_applicant_income_mother | income < minimum co-applicant income floor | DISCOUNT_50PCT | Mother's income counted at reduced weightage for FOIR computation. |
| COAPP-606 | co_applicant_income_sister | income < minimum co-applicant income floor | DISCOUNT_50PCT | Sister's income counted at reduced weightage for FOIR computation. |

## 9. Existing Banking Relationship (`EXB-###`) — file: `bank_policy_matrix.json`

| Rule ID | Parameter | Condition | Action | Rejection Reason |
|---|---|---|---|---|
| EXB-701 | existing_account_holder | account_status == "ACTIVE" with selected bank | PASS | Existing relationship — eligible for pre-approved fast-track. |
| EXB-702 | existing_car_loan | active_car_loan == true && bank.allow_existing_car_loan == false | REJECT | Selected bank does not permit an existing active car loan alongside this application. |

---

## 10. Bank-Wise Policy Matrix (`BANK-001`) — file: `bank_policy_matrix.json`

All 8 partner banks, each with its own CIBIL floor, write-off tolerance,
DPD strictness, FOIR cap, and car-loan co-existence rule.

```yaml
bank_policies:
  bank_of_india:
    code: BOI
    min_cibil_score: 701
    allow_write_offs: false
    max_write_off_amount: 0
    strict_zero_dpd: false
    allow_existing_car_loan: true
    max_foir_ratio: 0.55

  indian_bank:
    code: INDIAN_BANK
    min_cibil_score: 730
    allow_write_offs: false
    max_write_off_amount: 0
    strict_zero_dpd: true
    allow_existing_car_loan: true
    max_foir_ratio: 0.50

  iob:
    code: IOB
    min_cibil_score: 700
    allow_write_offs: false
    max_write_off_amount: 0
    strict_zero_dpd: false
    allow_existing_car_loan: true
    max_foir_ratio: 0.55

  bank_of_baroda:
    code: BOB
    min_cibil_score: 700
    allow_write_offs: false
    max_write_off_amount: 5000
    strict_zero_dpd: false
    allow_existing_car_loan: true
    max_foir_ratio: 0.55

  bank_of_maharashtra:
    code: BOM
    min_cibil_score: 700
    allow_write_offs: false
    max_write_off_amount: 5000
    strict_zero_dpd: false
    allow_existing_car_loan: true
    max_foir_ratio: 0.55

  hdfc_bank:
    code: HDFC
    min_cibil_score: 701
    allow_write_offs: true
    max_write_off_amount: 10000
    strict_zero_dpd: false
    allow_existing_car_loan: true
    max_foir_ratio: 0.60

  axis_bank:
    code: AXIS
    min_cibil_score: 700
    allow_write_offs: true
    max_write_off_amount: 10000
    strict_zero_dpd: false
    allow_existing_car_loan: true
    max_foir_ratio: 0.60

  kotak_bank:
    code: KOTAK
    min_cibil_score: 701
    allow_write_offs: true
    max_write_off_amount: 10000
    strict_zero_dpd: false
    allow_existing_car_loan: false
    max_foir_ratio: 0.50
```

---

## 11. Output Decision Structure

The Zen-Engine evaluates all rule sets concurrently and returns a
standardized response JSON:

```json
{
  "application_id": "APP-2026-0722-0001",
  "evaluation_timestamp": "2026-07-22T10:00:00Z",
  "status": "REJECTED",
  "overall_eligible": false,
  "executed_rules_count": 64,
  "execution_time_ms": 7.412,
  "rejection_summary": [
    {
      "rule_id": "SE-302",
      "category": "Tax & Financials",
      "message": "Current year ITR ₹2,50,000 is below minimum threshold of ₹3,00,000."
    },
    {
      "rule_id": "BUR-402",
      "category": "Credit Bureau History",
      "message": "Found DPD value of 120 days exceeding 90-day tolerance threshold."
    }
  ],
  "bank_eligibility": {
    "BOI": false,
    "Indian_Bank": false,
    "IOB": false,
    "BOB": false,
    "BOM": false,
    "HDFC": false,
    "AXIS": false,
    "Kotak": false
  }
}
```

---

## 12. Parameter Coverage Cross-Reference (all 64 parameters)

| Module | Rule ID Prefix | Parameter Count |
|---|---|---|
| Credit Score & Bureau | BUR- | 13 |
| Demographics & Eligibility | DEM- | 7 |
| Residence & Premises | RES- | 6 |
| Employment Profile & Tenure | EMP-SAL-2xx | 8 |
| Income & Financial Ratios | EMP-SAL-3xx | 10 |
| Tax (ITR) & Business Proofs | ENT-5xx / EMP-SE-3xx | 6 |
| Business Entity Structure | ENT-501–502 | 5 |
| Co-Applicant & Relations | COAPP- | 6 |
| Existing Banking Relationship | EXB- | 2 |
| **Total** | | **64** |
