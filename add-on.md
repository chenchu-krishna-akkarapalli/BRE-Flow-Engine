# Onboarding Form — Change Requirements

This document lists all requested changes to the loan onboarding form, step by step.

---

## Step 1 — Personal Details

### 1.1 Applicant type
- **Current:** "Who is applying for this loan?" with options *"Myself, as an individual"* / *"Company or organisation"*
- **Change to:**
  - Option 1: **Individual**
  - Option 2: **Company or organisation**

### 1.2 Date of Birth
- **Current:** "On which date were you born?"
- **Change to:** **"Date of Birth (DOB)"**

### 1.3 PAN Number
- **Current:** "What is your 10-character PAN card number?"
- **Change to:** **"PAN Number"**
- **New behavior:**
  - Add an **Upload** button next to the PAN input.
  - On upload, show a small popup/modal with two actions:
    - **Review** — shows the uploaded PAN card/document image.
    - **Extract** — runs extraction using open bharath ocr (pip install openbharatocr) on the uploaded document and auto-fills the extracted PAN number into the PAN input field.
  - Add a **Verify** button next to the PAN input field.
    - Clicking Verify calls a **dummy PAN verification API**.
    - This triggers an **OTP flow**: an OTP is sent to the user's email (dummy API), and the user is prompted to enter the OTP they received.
    - On successful OTP verification: show a success state on the PAN input field — e.g. **green border/background** and a **checkmark/tick icon**.

### 1.4 Mobile Number
- **Current:** "What is your mobile number?"
- **New behavior:**
  - Add a Non functional **Verify** button next to the mobile number field for demo.
  - Clicking Verify sends an dummy OTP to the entered mobile number.
  - User enters the OTP to verify the number.

---

## Step 2 — Residence Details

### 2.1 Own vs. Rent
- **Current:** Dropdown with options *Rented house* / *Owned house*
- **Change to:** **Radio buttons** with the same two options.
- **Conditional upload — Address Proof:**
  - If **Rented house** is selected:
    - Show an upload field titled **"Address Proof"** 
    - Helper text: *"Please upload your rental agreement document"*
  - If **Owned house** is selected:
    - Show an upload field titled **"Address Proof"**
    - Helper text: *"Please upload your Aadhaar card or electricity bill"* - using (pip install openbharatocr) extract Aadhaar number to store in DB

---

## Step 3 — Employment & Income Details

### 3.1 Employment type
- **Current:** Radio options *"I work for a company (salaried)"* / *"I work for myself (self-employed)"*
- **Change labels to:** **Salaried** / **Self-employed**

---

### 3.2 Salaried flow

**a) Income question**
- **Current:** "Do you make more than ₹25,000 every month?"
- **Change to:** **"Gross Salary"** (collect the actual gross salary amount).

**b) Tax proof question**
- **Current:** Dropdown — *"Yes, I have Form 16 or my tax returns"* / *"No, I don't have either"*
- **Change options to:**
  - **Form 16**
  - **ITR**
  - **No income proof**
- **Conditional behavior:**
  - If **Form 16** selected:
    - Show document upload field.
    - Keep existing question **"For how many years do you have Form 16?"** unchanged.
  - If **ITR** selected:
    - Show two input fields side by side, each with its own **Upload** and **Verify** buttons:
      - Left: **Current Year ITR**
      - Right: **Previous Year ITR**

**c) Rental income question**
- **Current:** Dropdown with 4 options — *No* + 3 other categories
- **Change to:** **Yes / No radio buttons**
- **Conditional behavior:**
  - If **Yes** selected: show the other 3 categories as a **dropdown**, with a suitable title reflecting what those categories represent *(title to be finalized — need the actual category list to name it accurately)*.

---

### 3.3 Self-employed flow

**a) Business registration**
- **Current:** "What is your Udyam registration or GST number?"
- **New behavior:** Add **Upload** and **Verify** buttons next to this field.

**b) Current year income**
- **Current:** "What income did you declare last year?"
- **Change to:** **"Current Year ITR"** — input field with **Upload** and **Verify** buttons.

**c) Previous year income**
- **Current:** "And the year before that?"
- **Change to:** **"Previous Year ITR"** — input field with **Upload** and **Verify** buttons.

**d) Rental income question**
- Same change as the salaried flow (§3.2c): Dropdown (No + 3 categories) → **Yes/No radio**; if **Yes**, show the other 3 categories as a dropdown with a suitable title.

---

## Step 4 — Loan Details

- **Remove:** "How old will you be when you make the last payment on this loan?" as a directly asked question.
- **Replace with computed field — Age at Last EMI:**
  - `Age at Last EMI = Age (derived from DOB collected in Step 1) + 7`
  - Example: Age 35 → Age at Last EMI = 42
  - This value is still needed downstream but is no longer asked directly.

---

## Step 5 — Co-applicant Details

- **Current:** Co-applicant age and income are always collected.
- **Change to:** Only show the co-applicant age and income section **if Age at Last EMI (computed in Step 4) > 60**.

---

## Open items / needs decision
- Exact **title** for the dropdown shown when rental income = "Yes" (both salaried and self-employed flows) — depends on what the 3 underlying categories actually are.
