Here's the raw block restructured into a clean, unambiguous computation spec — this is the **self-employed income derivation step**, which runs *before* the FOIR sheet and produces the "Avg Annual Income for 2 yrs" figure that FOIR slab lookups use.

---

## Self-Employed Income Computation (Pre-FOIR Step)

**Applies to:** Self-employed applicants
**Sources combined:** ITR (Income Tax Return) + COI
**Output feeds into:** FOIR sheet's "Avg Annual Income for 2 yrs" input

### Step 1 — Base income from ITR
```
income_from_calc = ITR[Line 1A] − ITR[Line 6]
```

### Step 2 — Deductions applied to `income_from_calc`

**a) Other interest income** — deduct all of it, *except* two carve-outs:
```
deductible_interest = other_interest_income
                     − interest_on_partners_capital
                     − partner_remuneration
```
(i.e., interest on partner's capital and partner remuneration are the only interest-related items that stay in income; everything else classified as "other interest" is removed.)

**b) Capital gains** — deduct in full:
```
capital_gains_deduction = income_from_capital_gains + short_term_capital_gains + long_term_capital_gains
```

**Result:**
```
adjusted_income = income_from_calc − deductible_interest − capital_gains_deduction
```

### Step 3 — Repeat Steps 1–2 for COI
The same formula (Steps 1–2) is applied independently to the COI figures, giving a separate `adjusted_income` from COI.

### Step 4 — Combine ITR + COI, per year
```
current_income = itr_adjusted_income(current_year) + coi_adjusted_income(current_year)
prev_income     = itr_adjusted_income(prev_year)    + coi_adjusted_income(prev_year)
```

### Step 5 — Average across 2 years
```
average_income = (current_income + prev_income) / 2
```
→ This `average_income` is the "Avg Annual Income for 2 yrs" value the FOIR sheet uses to pick the self-employed slab and FOIR%.

