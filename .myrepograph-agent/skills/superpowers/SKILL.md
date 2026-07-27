---
name: superpowers
description: Orchestrates full FlowBRE software development lifecycle by chaining Brainstorming, Implementation Planning, TDD, Subagent execution, and Two-Stage Reviews with sub-100ms SLA and 5-stage memory lifetime checkpoints.
---

# Superpowers (FlowBRE Lifecycle Edition)

## The 5-Step Lifecycle Chain

1. **Brainstorm**: Restate the goal, inspect `Backend-Playbook.md` and `flow.html`, and identify architecture constraints before committing to an approach.
2. **Implementation Plan**: Explicit plan of code changes, target SLAs, and memory safety.
3. **Test-Driven Development (TDD)**: Write automated unit and integration tests defining expected behavior first; verify tests fail, then write minimal backend/frontend code to pass.
4. **Subagent Execution**: Delegate independent tasks to specialized agents (e.g. `fact-checker`, `frontend-specialist`).
5. **Two-Stage Review**:
   - *Correctness Pass*: Verifies feature completeness, zero inline rule hardcoding, and zero un-redacted PII logging (PAN, Aadhaar).
   - *Performance & Memory Pass*: Verifies latency SLAs and 5-stage memory lifecycle adherence.
