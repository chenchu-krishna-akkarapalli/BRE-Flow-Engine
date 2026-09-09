---
name: improve-codebase-architecture
description: Scan a codebase for deepening opportunities, present them as a visual HTML report, and execute architectural refactoring.
---

# Improve Codebase Architecture

## Process
1. **Explore Hotspots**: Identify high-churn areas via `git log` and `repograph_impact`.
2. **Visual HTML Report**: Generate self-contained before/after diagrams using CDN Tailwind and Mermaid in `%TEMP%`.
3. **Grilling Loop**: Review decisions, update ADRs in `docs/adr/`, and refactor via `repograph_batch_edit`.
