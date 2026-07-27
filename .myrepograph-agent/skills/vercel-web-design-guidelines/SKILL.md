---
name: vercel-web-design-guidelines
description: Audits single-file web UI markup (flow.html) against accessibility (a11y), keyboard navigation, touch target sizes, and semantic HTML correctness.
---

# Web Design & Accessibility Guidelines (FlowBRE Single-File Edition)

## Core Audit Rules

1. **Semantic Form Controls**: Ensure all onboarding input fields (`input`, `select`) in `flow.html` have associated `<label>` tags with matching `for` attributes.
2. **Keyboard Operability**: All simulator tab buttons and form submit actions must be focusable via `Tab` and triggerable via `Enter`/`Space`.
3. **Accessible Decision Banners**: Decision output alerts (APPROVED / REJECTED) must use `aria-live="polite"` so screen readers announce real-time rule updates immediately.
4. **Touch Target Size**: Interactive form inputs and tab switchers must maintain a minimum touch target area of $44 \times 44\text{px}$.
5. **Contrast Standards**: Text elements against dark slate background panels (`bg-slate-900`) must maintain WCAG AA contrast ratios ($\ge 4.5:1$).
