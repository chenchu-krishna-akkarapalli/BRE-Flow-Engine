---
name: repograph-audit
description: Whole-repo audit for over-engineering and code bloat. Produces a ranked list of what to delete, simplify, or replace with stdlib/native equivalents.
argument-hint: "[scope glob]"
license: MIT
---

# Repo Graph Whole-Repo Bloat Audit

Scans the entire workspace tree using Repo Graph AST indices. Ranks findings biggest cut first.
Hunt: single-impl interfaces (`yagni:`), delegate wrappers (`yagni:`), dead exports (`delete:`), stdlib replacements (`stdlib:`).
Output: `<tag> <what to cut>. <replacement>. [path]`
