# Rule Updates & Bank Policy Matrix Sync Workflow (`rule_updates_checklist.md`)

This workflow defines the operational steps for updating business rules and synchronizing the 8-partner bank policy matrix (`BOI`, `INDIAN_BANK`, `IOB`, `BOB`, `BOM`, `HDFC`, `AXIS`, `KOTAK`) in FlowBRE.

---

## 🎯 1. Anti-Assumption & Fact Verification

Before updating any rule threshold or bank policy parameter:
1. Inspect the human-readable policy spec: [Rules.md](file:///c:/Projects/onboarding-bre-engine/Rules.md).
2. Inspect active JSON AST decision graphs:
   - `bank_policy_matrix.json`
   - `credit_bureau_rules.json`
   - `employment_income_rules.json`
3. Confirm 1:1 mapping between Rule ID string (e.g., `BUR-405`), condition expression, and rejection reason.

---

## ⚡ 2. Performance SLA Verification Gate

Rule updates must not introduce per-request file parsing overhead:
- **Zero Hot-Path Disk I/O**: Rulesets must pre-compile into RAM at server boot (`RuleEngineRegistry`).
- **Zen-Engine Execution Budget**: **`< 10 ms`** across all 8 partner banks in parallel.
- **GET Response SLA**: **`< 30 ms`**.
- **CRUD Response SLA**: **`< 80 ms`**.

---

## 🧠 3. 5-Stage Memory Lifecycle Check

Verify that rule evaluation memory follows the 5-stage lifecycle:
1. **Request Starts**: Context variables set (`X-Tenant-ID`).
2. **Allocate Memory**: Transient Pydantic v2 objects allocated on CPython heap.
3. **Use Memory**: Pre-compiled RAM decision graph evaluated; no new dict trees allocated.
4. **Garbage Collection**: Object reference counters reset (`ob_refcnt = 0`).
5. **Memory Released**: CPython arena allocator (`pymalloc`) reclaims memory, maintaining process RSS baseline.

---

## 📋 4. Step-by-Step Update Checklist

- [ ] **Step 4.1**: Update parameter in `bank_policy_matrix.json` (e.g. `min_cibil_score`).
- [ ] **Step 4.2**: Update human-readable table in `Rules.md §10`.
- [ ] **Step 4.3**: Update frontend bank selection card in `flow.html`.
- [ ] **Step 4.4**: Execute unit test suite to verify 100% policy compliance.
