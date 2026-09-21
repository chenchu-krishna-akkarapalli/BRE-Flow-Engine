# FOIR Calculation Sheet — Verification & CRE Readiness Review

Source file: `FOIR_Calculation.xlsx` (sheets: `Catogories`, `Calculation`, `Sheet3` — empty)

## 1. What the sheet contains

A FOIR (Fixed Obligation to Income Ratio) eligibility policy reference across **5 lenders**,
each split into **Salaried** and **Self-Employed** segments.

| Bank | Segment | Income basis | FOIR slabs |
|---|---|---|---|
| BOB | Salaried | Gross Monthly Income (GMI) | 0.60 / 0.70 / 0.80 across 3 bands |
| BOB | Self-employed | Avg Annual Income (2 yr) | 0.60 / 0.80, 2 bands |
| BOM | Salaried | GMI | 0.60 → 0.80, 5 bands |
| BOM | Self-employed | Avg Annual Income (2 yr) | 0.60 → 0.80, 5 bands |
| BOI | Salaried | Avg 6-month Gross Salary | 0.60 / 0.70 / 0.75, 3 bands |
| BOI | Self-employed | Annual income, converted to GMI | same 3 bands |
| Indian Bank | Salaried | GMI | 0.60, then **flat ₹50K deduction** above ₹15L |
| Indian Bank | Self-employed | Avg Annual Income (2 yr) | same 0.60 / ₹50K pattern |
| IOB | Salaried | GMI | 0.60 / 0.70, 2 bands (2nd band needs **DGM approval**) |
| IOB | Self-employed | Annual income, converted to GMI | mirrors salaried |

### Calculation formulas (from the `Calculation` sheet)

Two distinct formula families — not one:

- **BOB / BOM / BOI / IOB:**
  `(Income × FOIR%) − Existing EMI − Proposed EMI`
- **Indian Bank (structurally different):**
  `Net Salary − (40% of Gross Salary, or flat ₹50K if above 15L) − Existing EMI − Proposed EMI`

## 2. Issues to resolve before this becomes a rule engine spec

1. **Mixed data types in one field.** Indian Bank's `FOIR%` column holds both a percentage
   (`0.6`) and a flat rupee amount (stored as text, `'50K '`, with a trailing space). A rule
   engine field can't be both a multiplier and an absolute deduction — needs a `rule_type`
   discriminator (`percentage` vs `flat_deduction`) and numeric parsing of `"50K"` → `50000`.

2. **Boundary ambiguity.** E.g. BOB's bands are `0–50000` and `50000–150000` — is exactly
   ₹50,000 in the lower or upper slab? Every bank's slabs share this overlap-at-the-edge
   problem. Needs an explicit inclusive/exclusive convention.

3. **Non-numeric exception buried in a slab.** IOB's "1 lakh and above" row is annotated
   *"It is DGM Approval"* — a workflow/escalation condition, not a calculation. The engine
   needs an explicit "requires manual approval" output state, not just a number.

4. **Unit conversions referenced but not defined.** BOI and IOB say self-employed annual
   income is "converted into GMI" — presumably ÷12 — but the formula is never stated, and
   it's unclear whether conversion happens before or after the slab lookup (matters at
   boundaries).

5. **Inconsistent extra columns.** BOB alone has `For Categorisation` (Gross Salary) vs
   `For Eligibility Calculation` (Net Salary) as separate inputs. No other bank distinguishes
   these — either it's implicit elsewhere, or the other sheets are just less documented.

6. **No rounding rule, no floor for negative eligibility**, and no definition of
   "Existing EMI" (bureau-fetched vs self-declared).

7. Minor: typos (`Catogories`, `Monnthly`, `Emplyoed`) — cosmetic only.

## 3. Recommended normalized schema for the rule engine

Instead of bank-specific branches, flatten everything into one table:

```
bank | segment | income_type | min_income | max_income |
rule_type ("percentage" | "flat_deduction") | rate_or_amount |
requires_approval (bool) | notes
```

This single shape absorbs both formula families (percentage-based and deduction-based) and
gives the engine one lookup path instead of special-casing Indian Bank.

## 4. Open questions for the policy owner

- Boundary inclusivity convention (≤ vs <) for every slab.
- Source/logic of the 40% / ₹50K constant used only by Indian Bank.
- Exact annual→GMI conversion formula for BOI / IOB self-employed cases, and its position
  relative to the slab lookup.
- Desired behavior when the eligibility formula goes negative (hard reject vs floor to 0).
- Desired downstream behavior for "DGM Approval" cases (block / flag / route to reviewer).

## 5. Bottom line

The policy logic itself looks sound and matches typical Indian bank FOIR grids — nothing
here looks contradictory. It's currently a **human-readable reference**, not a
**machine-ready ruleset**. Normalizing it into the schema above, and getting the open
questions answered, is the main work before encoding it into a credit rule engine.
