---
name: repograph-debt
description: Harvest every repograph: comment in the codebase into a technical debt ledger to track deliberate shortcuts and upgrade triggers.
argument-hint: "[filter tag]"
license: MIT
---

# Repo Graph Technical Debt Ledger

Scans the repo for `(#|//) ?(repograph|ponytail):` markers.
Format: `<file>:<line>, <what was simplified>. ceiling: <limit>. upgrade: <trigger>.`
Flags shortcuts without upgrade triggers with `no-trigger`.
