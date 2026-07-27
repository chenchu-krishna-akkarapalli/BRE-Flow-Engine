---
name: taste-skill
description: Parametric UI design equalizer allowing tuning of 11 perceptual sliders (variance, motion intensity, visual density, contrast, glassmorphism depth) tailored specifically for single-file Tailwind + Vanilla JS interfaces (flow.html). Use this when tuning the visual feel of FlowBRE simulator components.
---

# Taste Skill (FlowBRE Single-File Tailwind Edition)

A parametric approach to UI aesthetics for `flow.html` — dial specific perceptual sliders to shape how FlowBRE's single-file Tailwind CSS + Vanilla JS interface feels.

## The 11 FlowBRE Sliders

1. **Glassmorphism Depth**: Opacity of backdrop blur (`backdrop-blur-sm` vs `backdrop-blur-xl`), border translucency, and panel elevation cues.
2. **Visual Density**: Spacing rhythm between simulation input fields and telemetry badges.
3. **Contrast**: Accent color contrast (emerald-400 for approval, rose-400 for rejection, cyan-400 for SLA metrics).
4. **Typographic Energy**: Inter / Monospace font pairing for technical stats vs readable form labels.
5. **Motion Intensity**: Micro-animations on decision banner transitions and real-time calculation counters.
6. **Design Variance**: Layout structure of simulator cards vs telemetry grids.
7. **Ornamentation**: Subtle glow borders (`shadow-emerald-500/20`) vs stripped-down dark surfaces.
8. **Corner Language**: Rounded corners (`rounded-xl` vs `rounded-2xl`) for card containers.
9. **Color Saturation**: Muted dark slate neutrals with high-saturation decision indicator badges.
10. **Rhythm / Repetition**: Card grid consistency across simulator tabs.
11. **Pace of Hierarchy**: Visual hierarchy between key decision outcomes (APPROVED / REJECTED) and detailed rule breakdowns.

## Guardrail

Always maintain the underlying Vanilla JS event listeners and real-time DOM update bindings when adjusting Tailwind styling classes in `flow.html`.
