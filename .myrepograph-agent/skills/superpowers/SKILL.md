---
name: superpowers
description: Orchestrates full FlowBRE software development lifecycle by chaining Brainstorming, Implementation Planning, TDD, Subagent execution, and Two-Stage Reviews with sub-100ms SLA and 5-stage memory lifetime checkpoints.
---

# Superpowers (FlowBRE Lifecycle Edition)

Chains together the software development lifecycle for FlowBRE to plan, implement, test, and review non-trivial feature work cleanly.

## The 5-Step Lifecycle Chain

1. **Brainstorm**: Restate the goal, inspect `Backend-Playbook.md` and `flow.html`, and identify architecture constraints before committing to an approach.
2. **Implementation Plan**: Create an explicit implementation plan detailing proposed code changes, quantitative SLAs (`Simple GET < 30 ms`, `CRUD < 80 ms`, `Zen-Engine < 10 ms`), and memory safety.
3. **Test-Driven Development (TDD)**: Write automated unit and integration tests defining expected behavior first; verify tests fail, then write minimal backend/frontend code to pass.
4. **Subagent Execution**: Delegate independent tasks to specialized agents (e.g. `fact-checker`, `frontend-specialist`).
5. **Two-Stage Review**:
   - *Correctness Pass*: Verifies feature completeness, zero inline rule hardcoding, and zero un-redacted PII logging (PAN, Aadhaar).
   - *Performance & Memory Pass*: Verifies sub-100ms latency SLAs and adherence to the 5-stage request memory lifecycle (`Request Starts` → `Allocate Memory` → `Use Memory` → `Garbage Collection` → `Memory Released`).
