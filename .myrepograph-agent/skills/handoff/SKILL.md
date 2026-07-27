---
name: handoff
description: Compresses a long session into a structured markdown handoff document when context drift begins to degrade performance, enabling a clean transfer to a fresh session, a new git worktree, or a different agent entirely. Use this when the conversation has gotten very long, when the user mentions starting a new session/chat/worktree, or when the user explicitly asks to "hand off," "summarize the session so far," or "compress context." Trigger proactively if you notice degraded recall of earlier decisions in a long session.
---

# Handoff

Compresses an in-progress session into a structured, self-contained markdown document so work can continue cleanly elsewhere — a new session, a new git worktree, or a different agent.

## What the handoff document must contain

1. **Goal** — the original task/objective in one or two sentences, plus any changes to scope agreed along the way.
2. **Current state** — what's been done, what's in progress, what's left. Be concrete: file paths, function names, commit/branch references, not vague descriptions.
3. **Key decisions and why** — any non-obvious choices made during the session (architecture, library choices, trade-offs) along with the reasoning, so they aren't silently re-litigated or reversed in the new session.
4. **Open questions / blockers** — anything unresolved that the next session needs to pick up or ask the user about.
5. **Next steps** — a concrete, ordered list of what to do next, written so a fresh agent with no memory of this conversation could act on it immediately.
6. **Relevant context to re-load** — files, docs, or prior outputs the next session should read first.

## Format

Write as clean markdown with clear headers matching the sections above. Keep it dense and factual — this document's only job is to let a completely fresh context pick up exactly where this one left off, so avoid narrative filler and prioritize specifics (paths, names, exact decisions) over prose.

## After generating

Save the handoff document to disk (or hand it directly to the user) and confirm it's ready before ending the session. If the user is spinning up a new git worktree, suggest placing the handoff file at the root of the new worktree so the next session finds it immediately.
