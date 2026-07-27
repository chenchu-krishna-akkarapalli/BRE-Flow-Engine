---
name: anthropic-frontend-design
description: Pushes past generic "AI slop" aesthetics by banning overused fonts and default purple gradients, forcing a commitment to a specific, bold visual direction (dark glassmorphism, technical monospace) for single-file Tailwind + Vanilla JS architectures (e.g. flow.html). Use this whenever building or redesigning any user-facing UI, landing page, or simulator component in FlowBRE.
---

# Anthropic Frontend Design (FlowBRE Single-File Tailwind Edition)

Forces an explicit, committed aesthetic direction for single-file HTML/JS interfaces (`flow.html`) using Tailwind CSS and Vanilla JavaScript.

## Banned defaults

- Default purple-to-blue gradients as a stand-in for "modern."
- Generic, unexamined sans-serif font fallbacks.
- Center-aligned hero + 3-icon-feature-grid layouts used without design reasoning.
- Overused soft pastel palettes that clash with FlowBRE's dark glassmorphic engine aesthetic.

## Core FlowBRE Design Rules

1. **Preserve Glassmorphic Theme**: Maintain backdrop blur (`backdrop-blur-md`), dark slate/slate-900 surface panels (`bg-slate-900/80`), subtle slate borders (`border-slate-800`), and vivid accent glows (emerald for approval, rose for rejection, amber for warning, indigo for telemetry).
2. **Bidirectional Sync Preservation**: Any UI edit to Step 4 onboarding input fields must maintain real-time bidirectional reactive sync with Tab 2 decision simulator cards and latency SLA telemetry strips.
3. **Single-File Tailwind Efficiency**: Structure all layout utilities using inline Tailwind classes and modular Vanilla JS functions inside `<script>` blocks — no external React/Vue framework dependencies.
4. **Latency Telemetry Badges**: Always highlight target SLAs on technical engine headers and footers:
   - Simple GET: `< 30 ms`
   - CRUD & Transactions: `< 80 ms`
   - Zen-Engine Evaluation: `< 10 ms`
   - Total End-to-End Latency: `< 100 ms`

## Guardrail

Never break existing DOM IDs or event listeners connected to the JS decision engine simulator in `flow.html`.
