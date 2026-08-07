# Loan Onboarding Application — Change Log

This document lists required bug fixes and functional changes for the loan onboarding form.

---

## Bug 1: CIBIL Score vs CIBIL PL Score — Validation Logic

**Current behavior:**
CIBIL PL score is not being evaluated at all. Only one bank in the parameters sheet currently has a CIBIL PL score parameter defined, and the system does not account for it.

**Issue:**
When a bank has both a CIBIL score threshold and a CIBIL PL score threshold, the customer should be evaluated against **either** score — not both. Currently there is no OR-based validation, so eligible customers can get incorrectly rejected.

**Required change:**
- If a bank's parameter sheet defines a CIBIL PL score requirement (in addition to the standard CIBIL score), validate the customer using an **OR condition** between CIBIL score and CIBIL PL score.
  - Example: Eligibility requires CIBIL score ≥ 720 **OR** CIBIL PL score ≥ 701.
  - If customer's CIBIL score = 710 (fails) and CIBIL PL score = 702 (passes) → customer should be marked **eligible**.
- If a bank does not define a CIBIL PL parameter, continue validating using CIBIL score only (no change for those banks).
- This must be generic/future-proof: if additional banks add a CIBIL PL parameter later, the same OR logic should automatically apply to them without additional code changes.
- Rule of thumb: **if either score (CIBIL or CIBIL PL) passes, the customer should not be rejected for failing the other score.**

**As implemented (2026-08-07):** the bank carrying the CIBIL PL parameter is **BOI**, at
**CIBIL ≥ 701 OR CIBIL PL ≥ 701**. The 720/701 figures in the example above are illustrative
and match no bank in the sheet; BOI's two floors are equal, so the OR changes an outcome in
exactly one band — CIBIL below 701 with a PL score at 701 or above. Every other bank is
unchanged. The parameter lives in a `CIBIL PL Score` column in
`bank_Individual_Eligibility_Matrix.xlsx`, blank for the other seven; filling a cell and its
`min_cibil_pl` key is all a further bank needs, with no rule code to write.

---

## Bug 2: Move NRI Fields to Step 3, Restrict Visibility to Salaried

**Current behavior:**
"NRI" and "Stay period of NRI" fields are shown in **Step 1**, regardless of occupation type.

**Required change:**
- Move both fields — **NRI** and **Stay period of NRI** — from Step 1 to **Step 3**.
- These fields should be visible **only** when the applicant selects **Individual → Salaried** as occupation type.
- Do **not** show these fields for Self-employed, Agriculture/Farming, Rental Income, or any other occupation category.

---

## Bug 3: Separate Flow for Agriculture / Farming (Currently Merged with Self-Employed)

**Current behavior:**
After selecting **Self-employed**, the following fields are shown:
- Work location (home / separate office)
- Guarantor
- Business start date
- Business registration / GST number
- Current Year ITR
- Previous Year ITR
- Years of filing tax returns

The **same fields** are incorrectly shown when the applicant selects **Agriculture / Farming**.

**Required change:**
- Keep **"How is your business set up?"** immediately after selecting Self-employed (unchanged).
- If the applicant selects **Agriculture / Farming**, show a **separate, distinct set of fields**:
  1. Do you own the agricultural land?
  2. Where is the agricultural land located?
  3. What is your approximate annual agricultural income?
  4. Have you filed ITR?

- **If "Have you filed ITR?" = Yes**, additionally show:
  - Current Year ITR
  - Previous Year ITR
  - Years of filing tax returns

- **If "Have you filed ITR?" = No**, additionally show:
  - Agricultural Income Proof upload
  - Verify button

- For Agriculture / Farming, **do NOT show**:
  - Business registration number
  - GST number
  - Work from home / separate office
  - Guarantor question
  - Business proof upload

---

## Bug 4: Simplify Organisation Type for Salaried Applicants

**Current behavior:**
After selecting Salaried, "What kind of organisation do you work for?" shows many organisation categories.

**Required change:**
- Reduce organisation type options to exactly **two**:
  1. Private Sector
  2. Government Sector

**If Private Sector is selected:**
- Ask: **"How long have you worked at your current job?"** with options:
  - 0–6 months
  - 6 months – 1 year
  - 1–2 years
  - 2+ years
- If tenure is **less than 2 years**, continue with the **existing** previous-employer flow (previous company name, DOJ, etc.) — **no change** to this sub-flow.

**If Government Sector is selected:**
- Ask **only** for current work experience.
- Do **not** validate this value against the parameters sheet.
- Do **not** ask for previous company name or DOJ.
- Government sector applicants must be **allowed to proceed even with less than 2 years of experience**.

---

## Bug 5: Mandatory Business Proof for Self-Employed

**Required change:**
- For Self-employed applicants, business proof upload is **mandatory**.
- If business proof is not provided, **terminate onboarding immediately** (do not allow the applicant to proceed further).

---

## Bug 6: Minimum Salary Cutoff for Salaried Applicants

**Required change:**
- If the applicant's monthly salary is **below ₹25,000**, the onboarding process must **stop automatically** at Step 3.

---

## Bug 7: Replace Rental Income Sub-Questions with New Top-Level Occupation Category

**Current behavior:**
Under Self-employed/Salaried flow, there's a question **"Do you earn any rent from a property you own?"** — if Yes, it asks **"How is that rental income documented?"**.

**Required change:**
- **Remove** both of the above questions entirely from wherever they currently appear.
- Add a **new top-level category** to **"Do you work for a company, or do you run your own business?"**:
  - Salaried
  - Self-employed
  - **Rental Income** *(new)*

**If "Rental Income" is selected**, show:
1. Address of the property given on rent
2. **How is that rental income documented?** with three options:
   - Yes – I have a rent agreement, but no tax return, and the rent is not paid into my bank
   - Yes – I have a rent agreement and a tax return, but the rent is not paid into my bank
   - Yes – I have a rent agreement and the rent is paid into my bank, but no tax return

**Conditional fields based on documentation option:**
- If **"Yes – I have a rent agreement and a tax return, but the rent is not paid into my bank"** is selected:
  - Show Current Year ITR
  - Show Previous Year ITR
- If **"Yes – I have a rent agreement and the rent is paid into my bank, but no tax return"** is selected:
  - Ask to upload bank statement
  - Ask to fill income amount

*(Note: behavior for the first option — "rent agreement, but no tax return, and rent not paid into bank" — was not specified; confirm required fields for this case before implementation.)*

---

## Bug 8: Step 5 — Co-Applicant for Age vs Co-Applicant for Income (Separate Conditions)

**Current behavior:**
"Co-applicant for age" and "Co-applicant for income" both show only when **age at last EMI > 60**.

**Required change — split into two independent conditions:**

1. **Co-applicant for age**
   - Show **only** when age at last EMI is more than 60 (unchanged trigger, now decoupled from income condition).

2. **Co-applicant for income**
   - Show when **either** Current ITR amount **or** Previous ITR amount is **less than ₹1,00,000**.
     > **Superseded 2026-08-07 by Bug 9.** This clause originally read "**both** … **and** …".
     > The stricter reading hid the question from the applicants it exists for: someone
     > declaring ₹95,000 current and ₹4,00,000 previous has exactly the weak year that
     > clubbing covers, and was never offered a co-applicant. Bug 9 specifies **either**
     > for the self-employed flow; that is now the single rule on both screens.
   - Display with the existing option set.
   - If the applicant selects **any option other than "None" / "No one"**:
     - Show additional fields: Co-applicant name, DOB, Co-applicant's Current ITR, Co-applicant's Previous ITR.

3. **Which step asks the question**
   - The **self-employed** flow asks in **Step 3**, directly beneath the two ITR amounts (Bug 9).
   - Every other flow asks in **Step 5**.
   - It is asked in exactly one place per applicant. Both screens read and write the same
     answer, so asking twice could only produce two views of it that disagree — whichever
     screen was edited last would silently win.

4. **Income clubbing:**
   - Applicant's and co-applicant's income should be **clubbed** using **both Current ITR and Previous ITR** values.
   - Send the clubbed income to the evaluation/parameters check **after final evaluation**, so the parameters sheet is validated against the combined amount.
   - Pooling applies only while the question is still being asked: editing the ITR amounts
     back above ₹1,00,000 retracts it, rather than leaving a co-applicant's income clubbed
     into a total the applicant is no longer shown.

---

## Bug 9: Co-Applicant for Income Not Showing for Self-Employed (Step 3)

**Current behavior:**
In Step 3, when the applicant selects **Self-employed** and fills in Current Year ITR and Previous Year ITR, the **"Co-applicant for income"** question — with categories Father, Mother, Sister, Brother, Son, Daughter — is not appearing at all, even when ITR values are low.

**Required change:**

1. **Trigger condition:**
   After the self-employed applicant fills in Current ITR and Previous ITR amounts, show **"Co-applicant for income"** if **either** amount is less than ₹1,00,000.

2. **Co-applicant for income field:** shown with the existing category options — Father, Mother, Sister, Brother, Son, Daughter.

3. **On selecting a category:** ask for the co-applicant's Name, Date of Birth, Current Year ITR and Previous Year ITR.

4. **Final validation:**
   Cumulate the Current ITR amounts and the Previous ITR amounts of applicant and co-applicant, and validate the combined totals against the parameters in the Excel sheet.

**Resolution of the open question in this bug's note:** the two conditions were *not*
intentionally separate. Bug 8's "both" was the error and has been corrected above; **either**
is now the single rule for every flow. The farming branch fills the same two ITR fields, so
the Step 3 trigger reaches it as well.

---
