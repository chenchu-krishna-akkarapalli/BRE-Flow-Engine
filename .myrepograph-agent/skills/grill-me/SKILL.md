---
name: grill-me
description: Planning tool used before any code is written that forces a relentless interview down every branch of the design tree until a shared understanding is reached and all dependency decisions are resolved. Use this when the user wants to design something before implementing it, when requirements are vague or high-stakes, or when the user explicitly asks to be "grilled" or interviewed about a design. Trigger before starting any non-trivial build where wrong early assumptions would be expensive to unwind later.
---

# Grill Me

An interview-first planning skill. The point is to resolve ambiguity through structured questioning *before* any code exists, not to guess and course-correct later.

## When to use this

- The user describes a system, feature, or architecture they want built, but key decisions (data model, boundaries, failure modes, scale) are unstated.
- The cost of a wrong assumption is high (shared infra, public API, data migrations, security-sensitive flows).
- The user says something like "help me design X" rather than "just build X."

## How to run the interview

1. **Map the design tree.** From the initial request, enumerate the major branch points: architecture choices, data model choices, integration points, failure/edge-case handling, non-functional requirements (performance, security, cost).
2. **Walk each branch to resolution.** For each branch, ask focused questions until there's a concrete answer — not a vague preference. Don't move to the next branch while the current one is still ambiguous in a way that would change the implementation.
3. **Surface dependencies explicitly.** When one decision depends on another (e.g. "the auth model changes if you need multi-tenant support"), say so and resolve the dependency before treating either as settled.
4. **Summarize before building.** Once every branch is resolved, restate the full design back to the user as a summary and get explicit confirmation before writing any code.

## Question style

- Ask one focused question at a time rather than a wall of questions — but don't stop until the branch is actually resolved.
- Prefer concrete forced-choice questions ("Postgres or a document store, and why does it matter here?") over open-ended ones when a decision has a small number of real options.
- Push back gently on non-answers ("whatever's best") by presenting the real trade-off and asking which property matters more to them.

## When to stop grilling

- Every branch that would change the implementation has a concrete, confirmed answer.
- Remaining unknowns are genuinely low-stakes or reversible — flag them as such rather than grilling further.
- The user explicitly says they want to skip ahead — respect that, but note what was left unresolved.
