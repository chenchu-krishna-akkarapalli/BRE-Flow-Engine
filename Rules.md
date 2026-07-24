# 📜 Rules.md — Business Rule Engine Policy Specification

Canonical, human-readable specification of every decision rule for the FlowBRE
onboarding flow. The **source of truth for evaluation is the code-defined
`BANK_MATRIX_RULES` matrix and rule functions in `app/services/bre_engine.py`**
(mirroring `app/zen_rules/Bank_Eligibility_Matrix_v1.xlsx`). The former
`zen_rules/*.json` JDM files and `/rules` API were removed — they never drove
evaluation. If you change a rule, change both this file and `bre_engine.py`.

All 64 BRE-sheet parameters are catalogued below across 9 modules. Partner banks:
**BOI, Indian Bank, IOB, BOB, BOM, HDFC, AXIS, Kotak.**

### Implementation status legend

Only **REJECT** rules change the APPROVE/REJECT verdict, and those are what the
engine implements today. `FLAG` / `PASS` / `DISCOUNT` rules are catalogued but
do not (yet) affect the verdict.

| Mark | Meaning |
|---|---|
| ✅ | Implemented — produces a rejection reason in `rejection_reasons` |
| 🕓 | Not yet implemented (FLAG / PASS / DISCOUNT, or no request-schema field) |

**Boundary semantics follow the sheet's operators exactly:** a `< N` column
rejects at the boundary (e.g. DPD `< 90` rejects a DPD of 90; a CC write-off cap
of `< 5000` rejects exactly 5000), while a `<= 0` column rejects only values `> 0`.

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

## 1. Demographics & Entity Rules (`DEM-###`) — evaluated in `_bank_rejections()` (`bre_engine.py`)

| Rule ID | Parameter | Operator | Threshold | Action | Status | Rejection Reason |
|---|---|---|---|---|---|---|
| DEM-101 | age | `<` | `min_age` (21, all banks) | REJECT | ✅ | Applicant age is below the minimum requirement (21 years). |
| DEM-102 | age_at_last_emi_salaried | `>` | `max_age_emi_salaried` (per-bank, 60–75) | REJECT | ✅ | Age at final EMI maturity exceeds the bank's salaried limit. |
| DEM-103 | age_at_last_emi_self_employed | `>` | `max_age_emi_self_employed` (per-bank, 65–75) | REJECT | ✅ | Age at final EMI maturity exceeds the bank's self-employed limit. |
| DEM-104 | is_nri && !bank.allow_nri | `==` | true | REJECT | ✅ | Selected bank does not onboard NRI/PIO applicants (e.g. BOI). |
| DEM-105 | minimum_stay_period_nri | `<` | `min_nri_stay_years` (per-bank; BOI 0, rest 2 yrs) | REJECT | ✅ | NRI/PIO applicant does not meet the bank's minimum in-country stay. |
| DEM-106 | marital_status | `== "UNMARRIED"` | — | FLAG | 🕓 | Informational flag used by underwriting; no rejection. |

> **Note:** DEM-102/103 use each bank's `max_age_emi_*` value from the matrix, not
> a flat 60/65. When the projected maturity age is absent, the engine falls back
> to the current `age`. NRI stay is expressed in **years** and only evaluated when
> `is_nri` is true.

## 2. Residence, Office Premises & Guarantor Rules (`RES-###`) — evaluated in `_bank_rejections()` (`bre_engine.py`)

| Rule ID | Parameter | Condition | Action | Status | Rejection Reason |
|---|---|---|---|---|---|
| RES-201 | rented_house_salaried | property_status == "RENTED" && occupation == "SALARIED" | FLAG | 🕓 | Informational — no guarantor required by default. |
| RES-202 | resi_cum_office_one_owned | property_status == "RESI_CUM_OFFICE_OWNED" && occupation == "SELF_EMPLOYED" | PASS | 🕓 | Owned resi-cum-office premises satisfies collateral comfort. |
| RES-203 | resi_cum_office_both_rented | property_status == "RESI_CUM_OFFICE_RENTED" | REQUIRE_GUARANTOR | ✅ | Triggers the RES-205 guarantor check. |
| RES-204 | resi_office_separate_both_rented | property_status == "SEPARATE_BOTH_RENTED" | REQUIRE_GUARANTOR | ✅ | Triggers the RES-205 guarantor check. |
| RES-205 | without_guarantor | property_status ∈ {RESI_CUM_OFFICE_RENTED, SEPARATE_BOTH_RENTED} && guarantor_provided == false && bank not in {BOM} | REJECT | ✅ | Guarantor is mandatory for this property configuration (BOM waives it — matrix col 23). |
| RES-206 | with_guarantor | guarantor_provided == true | PASS | ✅ | Guarantor condition satisfied (suppresses RES-205). |

## 3. Employment Profile & Work Experience (`EMP-SAL-###`) — evaluated in `_bank_rejections()` (`bre_engine.py`)

Salaried applicants only.

| Rule ID | Parameter | Condition | Action | Status | Rejection Reason |
|---|---|---|---|---|---|
| EMP-SAL-202 | net_monthly_salary | `< min_salary` (₹25,000 all banks) | REJECT | ✅ | Monthly net salary is below the minimum parameter (₹25,000). |
| EMP-SAL-203 | salary_payment_mode | `== "CASH"` | REJECT | ✅ | Cash salary payment mode is ineligible; direct bank credit required. |
| EMP-SAL-204 | minimum_work_experience_years | `< min_total_experience_years` (2 yrs) | REJECT | ✅ | Applicant does not meet the bank's minimum total work experience. |
| EMP-SAL-205 | current_company_tenure_months / 12 | `< min_current_company_tenure_years` (per-bank 0.5–2) | REJECT | ✅ | Current-company tenure is below the bank's minimum. |
| EMP-SAL-206 | employer_type | one of [GOVT, PSU, PUBLIC_LTD, PVT_LTD, FIRM, AGRICULTURE] | PASS | 🕓 | Employer-type risk weighting; not evaluated. |
| EMP-SAL-207 | no_income_proof_segment | `== true` && !bank.allow_no_income_proof | REJECT | ✅ | Bank requires income proof; no-income-proof profile not accepted (HDFC/AXIS/Kotak permit it). |
| EMP-SAL-208 | form_16_years | `< form16_years_required` (per-bank; BOB 1, rest 2) | REJECT | ✅ | Form-16 history is below the bank's requirement. Skipped when on an accepted no-income-proof segment. |

> **Note:** EMP-SAL-201 (require previous-employment fields when tenure < 24 mo)
> is superseded by EMP-SAL-205, which rejects sub-threshold tenure directly per
> the bank matrix.

## 4. Income, Rental Income & FOIR (`EMP-SAL-3##`) — evaluated in `_bank_rejections()` (`bre_engine.py`)

These are affordability rules (FOIR / rental-income weighting). They adjust
loan-amount sizing, **not** the APPROVE/REJECT verdict, and are not yet evaluated
by the engine.

| Rule ID | Parameter | Condition | Action | Status | Rejection Reason |
|---|---|---|---|---|---|
| EMP-SAL-301 | emi_income_ratio_foir | `>` bank's `max_foir_ratio` | REJECT | 🕓 | EMI-to-income ratio (FOIR) exceeds the bank's maximum. |
| EMP-SAL-302 | rental_income_agreement_no_itr_not_in_bank | agreement && !itr_filed && !bank_reflected | DISCOUNT_50PCT | 🕓 | Rental income counted at reduced weightage. |
| EMP-SAL-303 | rental_income_agreement_itr_not_in_bank | agreement && itr_filed && !bank_reflected | DISCOUNT_25PCT | 🕓 | Rental income counted at partial weightage. |
| EMP-SAL-304 | rental_income_agreement_no_itr_in_bank | agreement && !itr_filed && bank_reflected | DISCOUNT_25PCT | 🕓 | Rental income counted at partial weightage. |

## 5. Self-Employed Applicants (`EMP-SE-###`) — evaluated in `_bank_rejections()` (`bre_engine.py`)

| Rule ID | Parameter | Logic Expression | Action | Status | Rejection Reason |
|---|---|---|---|---|---|
| EMP-SE-301 | business_experience_years | `< min_total_experience_years` (2 yrs) | REJECT | ✅ | Minimum 2 years of business existence required. |
| EMP-SE-302 | current_itr | `< se_min_current_itr` (per-bank ₹1L–₹3L) | REJECT | ✅ | Current-year ITR is below the bank's minimum. |
| EMP-SE-303 | previous_itr **or** current+previous | `< se_min_prev_itr`; for **BOB**, `current+previous < ₹600,000` | REJECT | ✅ | Previous-year ITR below the bank's floor (BOB uses the combined rule). |
| EMP-SE-304 | itr_filed | `== false` | REJECT | ✅ | Active ITR filing proof is required for self-employed profiles. |
| EMP-SE-305 | requested_loan_amount | `< 100000` | REJECT | 🕓 | Minimum loan ticket size; not evaluated. |
| EMP-SE-306 | business_entity_type | one of [PROPRIETORSHIP, PARTNERSHIP, PVT_LTD, PUBLIC_LTD, HUF] | PASS | 🕓 | Entity-type routing; not evaluated. |
| EMP-SE-307 | business_proof | `== false` | REJECT | ✅ | Valid business proof/registration document is required. |

## 6. Credit Bureau (CIBIL) & DPD Parsing (`BUR-###`) — evaluated in `_bank_rejections()` (`bre_engine.py`)

The bureau PDF parser reads all active and historical loan accounts and
converts every `"STD"` string to `0` DPD before evaluation.

The bureau `dpd_history` is normalized before evaluation: `"STD"`/`"XXX"`/`""`/`*`/`-`
map to `0`; numeric strings (`"120"`) and floats coerce to `int`; any other
non-numeric token **fails closed** (`InvalidPayloadError`, HTTP 422) rather than
being silently dropped.

```
┌─────────────────────────────────────────────────────────────────┐
│                    CIBIL Report Parsing Loop                    │
└─────────────────────────────────────────────────────────────────┘
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
[Write-Off — resolve product type]                   [DPD — per-bank tolerance]
         │                                                   │
  write_off_amount > 0 ?                              max(dpd) > bank.max_dpd ?
  ├─ type not allowed ──> REJECT (BUR-401)            ├─ YES ──> REJECT (BUR-402)
  ├─ CC & amount >= cap > REJECT (BUR-401B)           └─ NO  ──> Proceed
  ├─ unclassified ─────> REJECT (BUR-401D)                  │
  └─ allowed & in cap ─> PASS                        Indian Bank selected?
                                                     ├─ YES & DPD > 0 ──> REJECT (BUR-403)
                                                     └─ NO            ──> PASS
```

| Rule ID | Condition | Action | Status | Rejection Reason |
|---|---|---|---|---|
| BUR-401 | `write_off_amount > 0` && write-off `type` not permitted by bank (per-type flags: PL/HL/Consumer/Agri/MSME/Auto/CC) | REJECT | ✅ | `<TYPE>` write-offs are not permitted by the selected bank. |
| BUR-401B | CC write-off && `write_off_amount >= bank.max_cc_write_off_amount` (strict `<` cap: BOI/IOB 5000, BOM 10000) | REJECT | ✅ | Credit-card write-off amount is not below the bank's ceiling. |
| BUR-401D | `write_off_amount > 0` && write-off `type` absent/unrecognized | REJECT | ✅ | Unclassified write-off — type could not be validated (fail closed). |
| BUR-402 | `max(dpd_history) > bank.max_dpd` (per-bank; `<= 0` banks reject any DPD > 0, `< 90` banks reject DPD ≥ 90) | REJECT | ✅ | DPD exceeds the selected bank's tolerance. |
| BUR-403 | `selected_bank == "INDIAN_BANK" && max(dpd_history) > 0` | REJECT | ✅ | Indian Bank requires zero past DPD across all loan accounts. |
| BUR-404 | `credit_bureau.currently_overdue == true` | REJECT | ✅ | Active currently-outstanding overdue balances. |
| BUR-405 | `credit_bureau.cibil_score < bank.min_cibil` | REJECT | ✅ | CIBIL score is below the selected bank's minimum threshold. |
| BUR-406 | `credit_bureau.cibil_pl_score < 650` | FLAG | 🕓 | PL bureau score low — manual review; not evaluated. |
| BUR-407 | `credit_bureau.loan_enquiry_count_last_6m > 5` | FLAG | 🕓 | High recent enquiry count; not evaluated. |

> **Write-off type** is supplied via `credit_bureau.write_off_type`
> (`CC`/`PL`/`HL`/`CONSUMER`/`AGRI`/`MSME`/`AUTO`). Per the matrix (Ver 4.0), the
> only permitted write-off for any bank is **Credit Card** at BOI, IOB and BOM
> (within their caps); every other type/bank combination rejects.

## 7. Business Entity & Tax Compliance (`ENT-###`) — evaluated in `_bank_rejections()` (`bre_engine.py`)

| Rule ID | Parameter | Condition | Action | Status | Rejection Reason |
|---|---|---|---|---|---|
| ENT-501 | proprietorship / partnership / pvt_ltd / public_ltd | entity registered & active | PASS | 🕓 | Standard entity types accepted by all partner banks. |
| ENT-502 | huf_status | entity_type == "HUF" | FLAG | 🕓 | HUF entities require additional coparcener documentation. |
| ENT-503 | self_employed_current_itr | see EMP-SE-302 | REJECT | ✅ | Enforced via **EMP-SE-302**. |
| ENT-504 | self_employed_previous_itr | see EMP-SE-303 | REJECT | ✅ | Enforced via **EMP-SE-303** (BOB: combined rule). |
| ENT-505 | itr_not_filed | itr_filed == false | REJECT | ✅ | Enforced via **EMP-SE-304**. |
| ENT-506 | business_itr | business_itr_amount below bank floor | REJECT | 🕓 | No `business_itr_years` field in the request schema; not evaluated. |

## 8. Co-Applicant Eligibility (`COAPP-###`) — catalogued only (not evaluated)

Co-applicant rules affect FOIR/affordability weighting, not the verdict, and are
not yet evaluated. (The matrix does record `allow_sibling_coapplicant` per bank
for a future hard-reject on disallowed sibling co-applicants.)

| Rule ID | Parameter | Condition | Action | Status | Rejection Reason |
|---|---|---|---|---|---|
| COAPP-601 | co_applicant_age_brother | age < 21 or > bank max co-applicant age | REJECT_COAPP | 🕓 | Co-applicant (brother) does not meet age eligibility. |
| COAPP-602 | co_applicant_age_sister | age < 21 or > bank max co-applicant age | REJECT_COAPP | 🕓 | Co-applicant (sister) does not meet age eligibility. |
| COAPP-603 | co_applicant_income_brother | income < minimum co-applicant income floor | DISCOUNT_50PCT | 🕓 | Brother's income counted at reduced weightage. |
| COAPP-604 | co_applicant_income_father | income < minimum co-applicant income floor | DISCOUNT_50PCT | 🕓 | Father's income counted at reduced weightage. |
| COAPP-605 | co_applicant_income_mother | income < minimum co-applicant income floor | DISCOUNT_50PCT | 🕓 | Mother's income counted at reduced weightage. |
| COAPP-606 | co_applicant_income_sister | income < minimum co-applicant income floor | DISCOUNT_50PCT | 🕓 | Sister's income counted at reduced weightage. |

## 9. Existing Banking Relationship (`EXB-###`) — evaluated in `_bank_rejections()` (`bre_engine.py`)

| Rule ID | Parameter | Condition | Action | Status | Rejection Reason |
|---|---|---|---|---|---|
| EXB-701 | existing_account_holder | account_status == "ACTIVE" with selected bank | PASS | 🕓 | Existing relationship — eligible for pre-approved fast-track. |
| EXB-702 | active_car_loan | `active_car_loan == true` && bank ∈ {IOB, BOB} | REJECT | ✅ | Selected bank does not permit an existing active car loan (matrix col 19). |

---

## 10. Bank-Wise Policy Matrix — source: `Bank_Eligibility_Matrix_v1.xlsx`

The authoritative per-bank values, mirrored exactly in `BANK_MATRIX_RULES`
(`app/services/bre_engine.py`). "CC cap" is the strict `<` credit-card write-off
ceiling (only CC write-offs are permitted, and only at BOI/IOB/BOM); every other
write-off type rejects at every bank.

| Bank | min CIBIL | CC write-off cap | Max DPD | Age@EMI Sal/SE | NRI (min stay) | Existing car loan | No-income-proof | Form-16 yrs | SE ITR cur/prev | Curr-co tenure |
|---|---|---|---|---|---|---|---|---|---|---|
| **BOI** | 701 | `< 5000` | `<= 0` | 60 / 65 | ✗ | ✓ | ✗ | ≥ 2 | ₹3L / ₹1L | ≥ 2 yr |
| **Indian Bank** | 730 | ✗ (none) | `<= 0` | 60 / 70 | ✓ (2 yr) | ✓ | ✗ | ≥ 2 | ₹3L / ₹3L | ≥ 2 yr |
| **IOB** | 701 | `< 5000` | `< 90` | 75 / 75 | ✓ (2 yr) | ✗ | ✗ | ≥ 2 | ₹3L / ₹3L | ≥ 1 yr |
| **BOB** | 726 | ✗ (none) | `< 90` | 60 / 70 | ✓ (2 yr) | ✗ | ✗ | ≥ 1 | ₹3L / cur+prev ≥ ₹6L | ≥ 2 yr |
| **BOM** | 650 | `< 10000` | `<= 0` | 70 / 70 | ✓ (2 yr) | ✓ | ✗ | ≥ 2 | ₹1L / ₹1L | ≥ 2 yr |
| **HDFC** | 701 | ✗ (none) | `< 90` | 70 / 70 | ✓ (2 yr) | ✓ | ✓ | ≥ 2 | ₹1L / ₹1L | ≥ 0.5 yr |
| **AXIS** | 701 | ✗ (none) | `< 90` | 70 / 70 | ✓ (2 yr) | ✓ | ✓ | ≥ 2 | ₹1L / ₹1L | ≥ 0.5 yr |
| **Kotak** | 701 | ✗ (none) | `< 90` | 70 / 70 | ✓ (2 yr) | ✓ | ✓ | ≥ 2 | ₹1L / ₹1L | ≥ 0.5 yr |

Legend: **NRI** ✓ = onboards NRIs (min in-country stay in years); **Existing car
loan** ✗ = an active car loan rejects (EXB-702); **No-income-proof** ✓ = accepts
the no-income-proof segment. Min salary is ₹25,000 and min age 21 for all banks.
Boundary operators are literal: `< 90` rejects DPD 90; `< 5000` rejects a CC
write-off of exactly 5000.

---

## 11. Output Decision Structure

The engine evaluates the selected bank (which drives `overall_eligible`) and the
full 8-bank map via the **same** rule function, and returns:

```json
{
  "success": true,
  "status": "REJECTED",
  "overall_eligible": false,
  "executed_rules_count": 64,
  "execution_time_ms": 7.412,
  "rejection_reasons": [
    {
      "rule_id": "EMP-SE-302",
      "category": "Self-Employed",
      "message": "Current-year ITR (Rs 250,000) is below BOI minimum (Rs 300,000)."
    },
    {
      "rule_id": "BUR-402",
      "category": "Credit Bureau History",
      "message": "DPD value (120) exceeds BOI tolerance (0 days)."
    }
  ],
  "bank_eligibility": {
    "BOI": false,
    "INDIAN_BANK": false,
    "IOB": false,
    "BOB": false,
    "BOM": false,
    "HDFC": false,
    "AXIS": false,
    "KOTAK": false
  }
}
```

Notes: `bank_eligibility` keys are the bank **codes** (upper-case, `INDIAN_BANK`,
`KOTAK`); each is `true` only when that bank has zero violations **and** the
selected-bank verdict is eligible. `executed_rules_count` is
`len(rejection_reasons) + 62`. Malformed input (bad `credit_bureau` shape,
non-numeric NRI/DPD) returns **HTTP 422** with a typed `InvalidPayloadError`.

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
