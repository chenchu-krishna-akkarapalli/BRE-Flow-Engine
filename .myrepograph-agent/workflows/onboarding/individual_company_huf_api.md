# Onboarding Entity Mapping Workflow (`individual_company_huf_api.md`)

Workflow for mapping frontend onboarding fields in `flow.html` to FastAPI polymorphic discriminated union endpoints.

---

## 🎯 1. Anti-Assumption & Fact Verification
- Verify input field names against `flow.html` and `.myrepograph-agent/workflows/onboarding_json_schema.json`.
- Ensure mandatory fields for `Individual`, `Company`, and `HUF` are enforced via Pydantic v2.

---

## ⚡ 2. Performance SLA Gate
- **CRUD Onboarding Evaluation Endpoint**: Must execute, parse PII, evaluate BRE in RAM, write audit log, and return response in **`< 80 ms`**.

---

## 🧠 3. Memory Lifecycle Check
- Follow 5-stage lifecycle (`Request Starts` ➔ `Allocate` ➔ `Use` ➔ `GC` ➔ `Released`).
- PII fields (PAN, DOB, Aadhaar) must be masked at Stage 3 (`AB******4F`).
