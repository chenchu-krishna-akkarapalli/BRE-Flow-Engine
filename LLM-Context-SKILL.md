---
name: opus-5-prompt-engineering
description: Use this skill whenever the user wants to write, review, or tune a system prompt (or agent/harness instructions) targeting Claude Opus 5 — including requests like "write me a system prompt," "help me prompt-engineer this for Opus 5," "our agent is too verbose/over-verifies/spawns too many subagents," or any context-engineering task for a Claude-powered product. Also trigger when the user asks about Opus 5's behavioral quirks (narration, self-correction, verbosity, effort, thinking-disabled artifacts) even if they don't explicitly ask for a prompt to be written. Make sure to use this skill proactively any time system-prompt or agent-instruction text is being drafted for Opus 5, not just when the user names the model explicitly.
---

# Prompting Claude Opus 5: Strategic System Prompt Engineering

Opus 5 is strong out of the box on Opus 4.8 prompts, but it has default tendencies that need explicit correction in the system prompt if the product wants different behavior. This skill turns those known tendencies into concrete system-prompt language. Don't just paste the snippets below verbatim — adapt wording and placement to the rest of the prompt's voice and structure.

## Step 1: Diagnose which tendencies matter for this product

Ask (or infer from context) which of these apply, since not every product needs every correction:

| Opus 5 default tendency | Symptom if uncorrected | Fix category |
|---|---|---|
| Longer user-facing responses by default | Bloated chat replies | Conciseness instruction |
| Narrates before/during/after tool calls | Noisy agent transcripts | Narration cadence instruction |
| Over-verifies its own work | Wasted tokens, redundant "let me double check" steps | Remove legacy verification instructions |
| Expands or reinterprets task scope | Does more (or different) than asked | Scope-constraint instruction |
| Delegates to subagents readily | Cost/latency multiplication on small tasks | Subagent delegation guidance |
| Self-corrects and narrates the correction | Distracting mid-task "actually, I was wrong" asides | Correction-narration instruction |
| Thinking disabled (effort ≤ high only) | Tool calls leak as text; internal XML tags leak into output | Explicit permission + general tag instruction |

Only add the snippets for tendencies actually relevant to the target product — don't pad the prompt with unused guidance (see "Written deliverable length" pattern below, which applies recursively to the prompts you write).

## Step 2: Apply the relevant snippet patterns

### Conciseness (response length)
Effort controls thinking volume, not answer length — conciseness must be prompted explicitly.
```
Keep responses focused, brief, and concise. Keep disclaimers and caveats short, and spend most of the response on the main answer. When asked to explain something, give a high-level summary unless an in-depth explanation is specifically requested.
```
For long system prompts, also add a short reminder near the end:
```
<tone_preference>
Keep outputs reasonably concise.
</tone_preference>
```

### Narration cadence (agentic progress updates)
Default: describe cadence and shape explicitly rather than just saying "narrate less."
```
Before your first tool call, say in one sentence what you're about to do. While working, give a brief update only when you find something important or change direction. When you finish, lead with the outcome: your first sentence should answer "what happened" or "what did you find," with supporting detail after it for readers who want it.
```
To turn narration *up* or restyle it, use positive examples of the desired update style rather than negative instructions — examples outperform "don't do X" framing.

### Remove over-verification, don't add it
If migrating a prompt from an older model, **delete** legacy lines like "include a final verification step for any non-trivial task" or "use a subagent to verify." Opus 5 already verifies its own work; these instructions compound with default behavior and waste tokens without improving quality. Same logic applies to "double-check your answer" / "re-verify before responding" for self-correction — remove, don't add.

### Task scope constraint
For narrowly-scoped tasks where the model shouldn't editorialize or expand the ask:
```
Deliver what was asked, at the scope intended. Make routine judgment calls yourself, and check in only when different readings of the request would lead to materially different work. If the request seems mistaken or a better approach exists, say so in a sentence and continue with the task as asked rather than quietly narrowing, widening, or transforming it. Finish the whole task, and stop short of actions that are clearly beyond what was asked.
```

### Subagent delegation caps
If the harness supports subagents, give explicit criteria (or a deterministic cap) rather than leaving delegation to the model's judgment:
```
Delegate to a subagent only for large tasks that are genuinely independent and parallelizable, such as a wide multi-file investigation. Do not delegate work you can finish yourself in a handful of tool calls, and do not use subagents to verify or double-check your own work. If one subagent can complete the task, use one rather than several, and keep spawn counts low.
```

### Correction narration
```
Only correct an earlier statement when the error would change the user's code, conclusions, or decisions. State corrections plainly and briefly, then continue the task. For slips that change nothing for the user, make the fix and move on without noting it.
```

### Written deliverable length
Applies to files/reports/docs Opus 5 writes to disk, separate from chat verbosity:
```
Match the length of written documents to what the task needs: cover the substance, but do not pad with filler sections, redundant summaries, or boilerplate.
```

### Thinking-disabled artifacts (only if thinking will be off, effort ≤ high)
Two leak modes to guard against:
- Tool calls written as plain text instead of a real tool_use block (loop breaks silently, and the leaked text persists in history for later turns):
```
You may say a brief sentence before using a tool.
```
- Internal `<thinking>`-style tags leaking into visible output — use a *general* instruction, since naming "thinking tags" specifically increases leakage:
```
Do not include internal or system XML tags in your response.
```
Never include a rule like "don't think" or "don't reason" — that increases tag leakage rather than reducing it. The primary mitigation is still to keep thinking enabled and use lower effort for cost control instead of disabling thinking.

### Effort and review-prompt phrasing (context, not a snippet)
- `low`/`medium` effort now give strong quality at much lower cost than before; sweep effort levels against real evals rather than assuming a prior model's defaults still hold. `xhigh` remains the recommended starting point for coding/agentic work.
- For code-review prompts: asking to "only report high-severity issues" or "be conservative" is followed literally and suppresses findings. Prefer "report everything" plus a separate filtering pass, since accuracy holds at lower effort and precision/recall are both strong.

## Step 3: Assemble and place

- Put behavior-shaping instructions in the same structural location the rest of the system prompt uses for tone/behavior sections (e.g., near tone/verbosity tags, or near the end as a reminder block) — consistency with existing prompt structure matters more than any single snippet's exact wording.
- Don't stack unused snippets "just in case" — this doc itself explicitly warns against padding, and unused instructions compete for attention with the ones that matter.
- If updating an existing (pre-Opus-5) system prompt: actively search it for legacy verification/self-correction scaffolding and *remove* those lines as part of the update, not just add new ones on top.

## Output format

When producing the final system prompt for the user, give the complete prompt text (not a diff-only description) with the relevant snippets integrated into its existing voice and section structure, and briefly note which tendencies you corrected for and why, based on Step 1.
