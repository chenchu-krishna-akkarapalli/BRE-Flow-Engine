---
name: codebase-design
description: Architecture design vocabulary and principles for deepening modules, designing seams, and cutting complexity.
---

# Codebase Design Vocabulary & Principles

## Core Architecture Vocabulary
- **Module**: A cohesive unit of code hiding an implementation behind a well-defined interface. (Never call it a component or service).
- **Interface**: The public surface area exposed by a module to callers.
- **Depth (Deep Module)**: An interface that is simple and narrow while the implementation handles significant complexity.
- **Shallow Module**: An interface as complex as its implementation. Collapse or delete.
- **Seam**: A place where you can alter program behavior without changing calling code.
- **Adapter**: A concrete implementation connecting a module to a runtime dependency.
- **Leverage**: Functionality achieved per unit of interface learned.
- **Locality**: Keeping related behaviors physically close.

## Key Principles
- **The Deletion Test**: If deleting a module concentrates complexity, it was deep; if complexity just moves, it was shallow.
- **Seams & Adapters Law**: One adapter = hypothetical seam; two adapters = real seam.
- **The Interface is the Test Surface**: Tests target public module interfaces, not private internals.
