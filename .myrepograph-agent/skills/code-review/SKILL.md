---
name: code-review
description: Review changed code for correctness, SLA compliance, zero-PII logging, anti-hardcoding enforcement, O(1) data structure efficiency, SQLAlchemy connection pool configuration, and 5-stage memory lifecycle safety.
---

# Code Review Protocol for FlowBRE Engine

## 1. Scope the Diff & Blast Radius
Review what changed and what the change can impact. Use `repograph_impact(path, symbol)` for the blast radius — pass **both** parameters.

## 2. Inspect Authoritative Implementation Bodies
Load full implementation bodies (`signature_only` omitted) for every symbol or function under review in FastAPI backend or `flow.html`.

## 3. Verify Core Governance & Performance Guardrails
For every modified symbol, verify compliance against FlowBRE's 4 core pillars:
- **Anti-Assumption & Zero Hardcoding**: Confirm zero inline hardcoded business rules or policy thresholds (CIBIL, DPD, ITR, FOIR). Ensure all rules load dynamically from `zen_rules/*.json`.
- **Latency SLA Targets**: Verify against the budgets in CLAUDE.md.
- **Data Structure & Database Pool**: Confirm $O(1)$ Hash Maps (`dict`), pre-warmed SQLAlchemy `asyncpg` pools (`pool_size=20`, `max_overflow=10`, `pool_recycle=3600`, `pool_pre_ping=True`), pre-compiled RAM decision graphs, and zero per-request hot-path disk I/O.
- **Zero-PII Logging Audit**: Verify that log statements do not print raw Applicant PAN, DOB, or unmasked Aadhaar data.
- **5-Stage Memory Lifetime Flow**: Verify post-GC cleanup per the lifecycle in CLAUDE.md.

## 4. Run Mechanical Pre-Review Checks
Execute `./.myrepograph-agent/skills/code-review/review.sh` to trigger mechanical syntax, build, rule JSON validation, and anti-hardcoding grep checks.

## 5. Report Findings
Report defects ordered by severity (critical SLA/hardcoding/PII defects first), citing exact file path, line numbers, triggering scenario, and recommended fix.
