---
name: repograph-review
description: Code review focused exclusively on over-engineering. Finds what to delete: reinvented standard library, unneeded dependencies, speculative abstractions, and dead flexibility.
argument-hint: "[diff or path]"
license: MIT
---

# Repo Graph Review

Review diffs for unnecessary complexity. One line per finding: location, what to cut, what replaces it.
Tags: `delete:`, `stdlib:`, `native:`, `yagni:`, `shrink:`.
Call `repograph_callers` to ensure root-cause fixes across all callers.
End with: `net: -<N> lines possible.` or `Lean already. Ship.`
