---
name: impeccable
description: Compact design shorthand commands (polish, audit, distill, tighten) and reference standards for iterating on single-file Tailwind + Vanilla JS interfaces (flow.html) in FlowBRE.
---

# Impeccable (FlowBRE Single-File Edition)

Design shorthand commands and reference standards for single-file HTML/CSS/JS (`flow.html`) interfaces.

## When to use this

- Issuing short design commands ("polish this", "tighten spacing", "audit contrast") on `flow.html`.
- Iterating on simulator layout, decision cards, or SLA latency badges.

## Shorthand Commands

- **`polish`**: Refine Tailwind spacing padding (`p-4` to `p-6`), borders, and micro-transitions without changing DOM layout.
- **`tighten`**: Compact visual whitespace in telemetry grids and parameter input lists.
- **`distill`**: Strip redundant DOM wrapper elements, focusing visual weight on decision outputs and SLA badges.
- **`audit`**: Check `flow.html` against dark glassmorphism color roles, contrast guidelines, and keyboard accessibility.

## Guardrail

Never alter JavaScript element IDs (`id="cibilScore"`, `id="decisionOutput"`) or event binding functions during design polish passes.
