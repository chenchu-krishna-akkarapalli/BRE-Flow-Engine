---
name: context-mode
description: Solves long sessions dying from accumulated noise by filtering verbose shell output (npm test logs, git status spam, build output) before it hits the context window, while maintaining a running session log so work can resume exactly where it left off after a reset. Use this during long agentic coding sessions with lots of shell/tool output, or when the user mentions context running out, sessions dying, or needing to resume after a reset.
---

# Context Mode

Keeps long sessions alive by filtering noisy tool/shell output before it enters context, and maintaining a compact running log that allows exact resumption after a reset.

## Filtering shell/tool output

Before letting verbose command output enter context:
1. **Extract the signal.** For test runs: pass/fail counts and the actual failure messages/stack traces — not every passing test line. For builds: errors and warnings only, not full compiler chatter. For `git status`/`git diff`: the changed file list and a summary, not verbose porcelain output unless specifically needed.
2. **Truncate repetitive blocks.** If the same warning or line repeats many times, keep one instance and note the repeat count.
3. **Preserve anything the user or task will need verbatim** — exact error messages, exact file paths, exact line numbers — even while dropping surrounding noise.

## Maintaining the running session log

Keep a compact, continuously updated log (in a file, not just in-context memory) containing:
- Task goal and current status.
- Key decisions made so far and why.
- Commands run and their filtered (signal-only) results.
- Next planned step.

Update this log incrementally rather than reconstructing it from scratch each time, so it stays cheap to maintain.

## Resuming after a reset

When a session restarts:
1. Read the running session log first, before doing anything else.
2. Reconstruct current state from the log rather than re-running everything from scratch.
3. Confirm with the user (briefly) that the reconstructed state matches reality before continuing.

## Guardrail

Filtering is for volume, not for correctness-relevant detail — never drop the specific error, specific failing assertion, or specific file/line that the task actually depends on.
