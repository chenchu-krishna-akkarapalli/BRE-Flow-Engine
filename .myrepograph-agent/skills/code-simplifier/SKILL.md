---
name: code-simplifier
description: Focused readability-preserving cleanup pass on recently written FastAPI and Vanilla JS code. Enforces $O(1)$ Hash Map lookups, zero synchronous disk I/O, zero un-redacted PII logging, and protection of sub-100ms SLAs.
---

# Code Simplifier (FlowBRE Backend & Engine Edition)

A focused cleanup pass for recently written FastAPI backend and FlowBRE engine code, preserving behavior while improving readability and enforcing architectural performance constraints.

## Architectural Constraints to Enforce

1. **Zero Synchronous / Hot-Path Disk I/O**: Flag and eliminate any blocking synchronous file I/O (`open()`, `read()`) inside FastAPI endpoint handlers or Zen-Engine evaluation loops.
2. **$O(1)$ Hash Map Lookups**: Ensure in-memory parameter evaluations use Python dictionaries (`dict`) and sets (`set`) to maintain $O(1)$ execution time.
3. **Zero Un-Redacted PII Logging**: Flag any log statements that attempt to print raw Applicant PAN, DOB, or Aadhaar data — enforce masking/redaction (`***XXXX`).
4. **Flatten Nested Conditionals**: Replace deeply nested `if/else` branches with early guard clauses, preserving exact control flow.
5. **Protect Latency SLAs**:
   - Simple GET: `< 30 ms`
   - CRUD & Transactions: `< 80 ms`
   - Zen-Engine Evaluation: `< 10 ms`
   - Total End-to-End Latency: `< 100 ms`

## Hard Constraint

Never alter backend API signatures or change evaluation logic during readability passes.
