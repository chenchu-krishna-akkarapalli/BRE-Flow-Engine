---
name: karpathy-guidelines
description: Encodes 4 strict behavioral rules (Think before coding, Simplicity first, Surgical changes, Goal-driven execution) adapted for FlowBRE to enforce sub-100ms SLAs, zero inline hardcoding, PII redaction, and 5-stage memory lifetime compliance.
---

# Andrej Karpathy's Guidelines (FlowBRE Edition)

## The Four Rules

### 1. Think Before Coding
Restate the actual goal and inspect authoritative source files (`zen_rules/*.json`, `Backend-Playbook.md`, `flow.html`). Never guess schemas, variable names, or rule thresholds.

### 2. Simplicity First
Default to the smallest, most boring solution that meets the CLAUDE.md SLA budgets.

### 3. Surgical Changes & Zero Inline Hardcoding
Touch only what the task requires. Load all business rules and thresholds (CIBIL, DPD, ITR, FOIR) dynamically from `zen_rules/*.json` — never hardcode inline in Python handlers.

### 4. Goal-Driven Execution & Memory Safety
Keep the original goal visible; verify against the 5-stage memory lifecycle in CLAUDE.md.

## Anti-Patterns to Catch

- Hardcoding threshold numbers inline in Python endpoints.
- Synchronous blocking disk I/O inside API request hot paths.
- Logging un-redacted PII data (PAN, Aadhaar, DOB).
- Allowing simple GET requests to exceed 30 ms or CRUD operations to exceed 80 ms.
