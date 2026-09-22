# Phase 1 Test Sets (15 Unique Scenarios)

This directory contains **15 distinct test sets** (`test 1` through `test 15`) specifically prepared for evaluating **Phase 1: 2-Year Document-Based Income Assessment**.

---

## Strict Uniqueness Guarantee
- **Total Sets**: 15
- **Total Folders**: 30 (`current/` and `prev/` in each test set)
- **Total Files**: 60 unique PDF documents (30 ITRs + 30 COIs)
- **Zero Duplicate Documents**: Every single file across all 15 test sets and all subfolders is completely unique.

---

## Test Sets Directory Map

| Test Set | Folder Path | Current Year (`current/`) | Previous Year (`prev/`) | Description |
| :--- | :--- | :--- | :--- | :--- |
| **test 1** | `test files/test 1/` | • `ITR-V_EPUPR9271B_2025.PDF`<br>• `Computation_EPUPR9271B_2025.pdf` | • `ITR-V_EPUPR9271B_2024.PDF`<br>• `Computation_EPUPR9271B_2024.pdf` | **Matched Applicant (Shashank Rai)**: Complete real 2-year matched ITR + COI filing. Assessed Average: **₹4,48,922.50**. |
| **test 2** | `test files/test 2/` | • `ARPNESH SINGH ITR 25-26.pdf`<br>• `ARPNESH SINGH COI 25-26.pdf` | • `ARPNESH SINGH ITR 24-25.pdf`<br>• `ARPNESH SINGH COI 24-25.pdf` | **Matched Applicant (Arpnesh Singh)**: Realistic 2-year business filings for AY 2025-26 & AY 2024-25. |
| **test 3** | `test files/test 3/` | • `ITR ACKMT FOR_A.Y-2025-26.pdf`<br>• `Computation 2025-26.pdf` | • `ITR ACKMT FOR_A.Y-2024-25.pdf`<br>• `Computation 2024-25.pdf` | Standard AY sequence returns (AY 2025-26 vs AY 2024-25). |
| **test 4** | `test files/test 4/` | • `NITAMBHAI ACK AY 24-25 (1).pdf`<br>• `Computation of Income for FY 2025-26_Kanhaiya.pdf` | • `NITAMBHAI ACK AY 23-24 (1).pdf`<br>• `Computation of Income for FY 2024-25_Kanhaiya.pdf` | Cross-verification with Kanhaiya multi-year computations. |
| **test 5** | `test files/test 5/` | • `p24.pdf`<br>• `Computation F.Y. 2025-26_Sandeep.pdf` | • `p23.pdf`<br>• `Computation F.Y. 2024-25_Sandeep.pdf` | Sequential year returns + Sandeep 2-year computation sheets. |
| **test 6** | `test files/test 6/` | • `ARPNESH SINGH ITR 26-27.pdf`<br>• `ARPNESH SINGH COI 26-27.pdf` | • `ITRV AY 2024-25.pdf`<br>• `ARPNESH SINGH COI 23-24.pdf` | High-income returns (Mayank Patel AY 24-25 + Arpnesh AY 26-27). |
| **test 7** | `test files/test 7/` | • `ITR F.Y. 2025-26_Sandeep.pdf`<br>• `ANOOP COM 2025-26.pdf` | • `ITRV.pdf`<br>• `ANOOP COM 2024-25.pdf` | Anoop multi-year computation set. |
| **test 8** | `test files/test 8/` | • `Srinivas_ITR_25-26.pdf`<br>• `BRIJESH COMP26.pdf` | • `MRINAL PANDEY AY 2023-24 ITR.pdf`<br>• `BRIJESH COMP25.pdf` | Brijesh 2-year business computations + Srinivas/Mrinal ITRs. |
| **test 9** | `test files/test 9/` | • `2025-26.pdf`<br>• `25-26.pdf` | • `SMITHA BIJAY_03-Aug-2026_141625930.pdf`<br>• `24-25.pdf` | Standard returns + Smitha Bijay verified filing. |
| **test 10** | `test files/test 10/` | • `Form_pdf_971326240310726.pdf`<br>• `HEMANT COMPUTATION 26-27.pdf` | • `IT_ACK808409400190724_260807_193730.pdf`<br>• `HEMANT COMPUTATION 2025-26.pdf` | Hemant 2-year computation sequence. |
| **test 11** | `test files/test 11/` | • `Pdf_536820640280726.pdf`<br>• `mohit Computation 25-26.pdf` | • `Pdf_418491990140826.pdf`<br>• `mohit Computation 24-25.pdf` | Mohit Tyagi 2-year business computation set. |
| **test 12** | `test files/test 12/` | • `Pdf_186281050300825.pdf`<br>• `Computation25.pdf` | • `ACK608106150210826.pdf`<br>• `Computation24.pdf` | Verified ACK returns + Computation 24 & 25. |
| **test 13** | `test files/test 13/` | • `ACK606060640210826 (1).pdf`<br>• `COMPUTATION A.Y 2025-26.pdf` | • `ACK601553350210826.pdf`<br>• `Computation 2023-24.pdf` | Multi-year ACK series + AY 2025-26 computation. |
| **test 14** | `test files/test 14/` | • `ACK542774410150925 (1).pdf`<br>• `CHHAMMI COMPUTATION 2026-27.pdf` | • `ACK437565850140925 (3).pdf`<br>• `SUNEEL COMPUTATION 2026-27.pdf` | Multi-source business return sets. |
| **test 15** | `test files/test 15/` | • `ACK292280050090826.pdf`<br>• `SUNITA COMPUTATION 2026-27.pdf` | • `ACK270752260080826 (1).pdf`<br>• `COM REENA.pdf` | Reena & Sunita business computation sets. |

---

## How to Test in the Frontend UI (`http://localhost:3000`)

1. Open `http://localhost:3000`.
2. Fill **Step 1** (Identity) and **Step 2** (Address).
3. In **Step 3** (Your work and income):
   - Choose `Self-Employed` (or `Company`).
   - For **Current Year ITR**: Click *Upload* and pick the ITR file from `test files/test X/current/`.
   - For **Previous Year ITR**: Click *Upload* and pick the ITR file from `test files/test X/prev/`.
   - For **Current Year COI**: Click *Upload* in COI section and pick the COI file from `test files/test X/current/`.
   - For **Previous Year COI**: Click *Upload* in COI section and pick the COI file from `test files/test X/prev/`.
4. Complete **Step 4** (Banking) and **Step 5** (Co-Applicant).
5. On **Step 6** ("Phase 1: Income Assessment"):
   - Inspect the **Assessed 2-Year Average Income** hero banner.
   - Review the **Side-by-Side Audit Trail Table** (Step 1, Step 2, Step 3, Step 4).
   - Click *"Verify with Server"* to confirm the server calculation matches 100%.
   - Click **"Evaluate Application"** to see final bank decisions on **Step 7**.
