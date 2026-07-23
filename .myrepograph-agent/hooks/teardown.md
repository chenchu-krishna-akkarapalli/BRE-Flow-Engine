# Teardown Hook

Run before ending a session.

1. **Checklist Update**: Mark completed items in `memory/runtime/context.md`; leave unfinished ones open with a clear status note.
2. **SLA & Anti-Hardcoding Audit Verification**: Verify that changed code contains zero hardcoded thresholds, complies with target SLAs (Simple GET `< 30 ms`, CRUD `< 80 ms`, Zen-Engine `< 10 ms`, Total `< 100 ms`), and adheres to the 5-stage memory lifetime flow.
3. **Daily Log Close-out**: Append a close-out entry to `memory/runtime/dailylog.md`: what changed, how it was verified, performance benchmark numbers, and what remains outstanding.
4. **Record Surprises**: Record any wrong assumptions or schema corrections caught during the session.
5. **Clean State Guarantee**: Leave the workspace building and its tests passing, with empirical output captured.
