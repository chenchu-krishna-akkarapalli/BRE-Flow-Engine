---
name: Rules
description: Spacing, border-radius, grid, and typographic-rhythm formulas for UI layout. Concentric nesting radius math, 8px spacing scale, responsive grid parameters, and optical corrections. Load with ui_ux_design when computing concrete padding/radius values.
---

# Layout Formulas — Spacing, Radius, Grid

## Spacing scale (8px grid)

`[2, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128]` px. Every value must come from this scale.

| Band | Range | Use |
|---|---|---|
| Micro | 2–4 | Tooltip padding, badge offset, icon-to-text |
| Component | 8–16 | Button/input padding, list gaps |
| Layout | 24–48 | Card padding, section gaps, gutters |
| Macro | 64+ | Page margins, major dividers |

**Button padding:** `horizontal = 1.5x to 2x vertical`. Standard: `12px 24px` at 14–16px font.

**Container nesting:** `internal_gap ≈ 0.5 x container_padding`. A 24px-padded card uses 12–16px internal gaps. Internal gaps exceeding container padding make the card look overfull.

## Border radius

**Concentric nesting (required for nested elements):**

```
R_inner = R_outer - P                    # P = padding between parent and child
R_inner = R_outer - (P + border_width)   # when the parent has a visible border
R_inner = 0 when R_outer <= P
```

Example: outer 16px, padding 12px → inner 4px. Equal radii on nested elements make corners look pinched.

| Scale | Components | Radius |
|---|---|---|
| Small | Badges, tooltips, checkboxes | 2–4px |
| Medium | Buttons, inputs, dropdowns | 6–8px |
| Large | Cards, modals, popovers | 12–24px |
| Pill | Avatars, status tags | 9999px |

```css
.child { border-radius: max(0px, calc(var(--radius-outer) - var(--padding-container))); }
```

## Quick reference

| Pattern | Padding | Gap | Radius |
|---|---|---|---|
| Primary button | `12px 24px` | 8px icon-to-text | 8px or 9999px |
| Form input | `10px 14px` | 6px label-to-input | 6px |
| Table cell | `12px 16px` | 12px | 0 |
| Card | `24px` | 16px | 16px outer → 8px inner |
| Modal | `32px` | 24px | 24px |
| Nav bar | `16px 32px` | 24px | 0 |

## Responsive grid

`screen = (2 x margin) + (N x column) + ((N-1) x gutter)`

| Viewport | Cols | Margin | Gutter | Max width |
|---|---|---|---|---|
| Mobile < 600px | 4 | 16px | 16px | 100% |
| Tablet 600–1024px | 8 | 32px | 20px | 100% |
| Desktop 1025–1440px | 12 | 64px | 24px | 1200–1280px |
| Ultra-wide > 1440px | 12 | auto | 32px | 1440px centered |

## Typographic rhythm

- Body line-height ratio 1.4–1.6 (16px → 24px). Headings 1.1–1.25, rounded onto the grid.
- Heading margins: `margin-top = 2 x margin-bottom` (groups the heading with its section).

## Optical corrections

1. Pill-radius buttons need 20–30% more horizontal padding than rectangular ones or the text crowds the ends.
2. Normalize icon bounding boxes to 24x24 or 20x20 before computing gaps — SVG transparent padding breaks mathematical alignment.
