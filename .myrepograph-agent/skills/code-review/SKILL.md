---
name: code-review
description: Review changed code for correctness, SLA compliance, zero-PII logging, anti-hardcoding enforcement, O(1) data structure efficiency, and memory lifecycle safety.
---

# Code Review Protocol for FlowBRE Engine

## 1. Scope the Diff & Blast Radius
Review what changed and what the change can impact. Use `repograph_impact(path, symbol)` for the blast radius — pass **both** parameters.

## 2. Inspect Authoritative Implementation Bodies
Signatures are sufficient for mapping call graphs, but insufficient for logic review. Load full implementation bodies (`signature_only` omitted) for every symbol or function under review.

## 3. Verify Core Governance & Performance Guardrails
For every modified symbol, verify compliance against the 4 core pillars:
- **Anti-Assumption & Zero Hardcoding**: Confirm zero inline hardcoded business rules or policy thresholds (CIBIL, DPD, ITR, FOIR). Ensure all rules load dynamically from `zen_rules/*.json`.
- **Latency SLA Targets**: Verify performance latency budgets:
  - Simple GET Operations: **`< 30 ms`**
  - CRUD & Transactions: **`< 80 ms`**
  - Zen-Engine Evaluation: **`< 10 ms`**
  - Total End-to-End: **`< 100 ms`**
- **Data Structure Selection**: Confirm $O(1)$ Hash Maps (`dict`), pre-warmed SQLAlchemy `asyncpg` pools (`pool_size=20`, `max_overflow=10`), pre-compiled RAM decision graphs, and zero per-request hot-path disk I/O.
- **Zero-PII Logging**: Verify that log statements do not print raw Applicant PAN, Aadhaar, or unmasked PII.
- **Memory Lifetime Flow**: Verify post-GC memory cleanup adhering to `Request Starts` → `Allocate Memory` → `Use Memory` → `Garbage Collection` → `Memory Released`.

## 4. Run Mechanical Pre-Review Checks
Execute `./review.sh` from this directory to trigger mechanical syntax, build, rule JSON validation, and test runners.

## 5. Report Findings
Report defects ordered by severity (critical SLA/hardcoding defects first), citing exact file path, line numbers, triggering scenario, and recommended fix.
