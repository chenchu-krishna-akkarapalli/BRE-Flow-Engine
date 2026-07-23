# Bootstrap Hook

Run at the start of an agent session, before the first substantive reply.

1. **Verify Index**: `repograph_status` — confirm the index is live and the active root matches the workspace directory. Halt on mismatch.
2. **Load Instructions**: Load `RULES.md`, `DUTIES.md`, `SOUL.md` into the instruction layer, including quantitative performance SLAs (Simple GET `< 30 ms`, CRUD `< 80 ms`, Zen-Engine `< 10 ms`, Total `< 100 ms`) and 5-stage Memory Lifetime flow.
3. **Verify Environment & Rule Graph Readiness**: Confirm `zen_rules/*.json` decision graphs are compiled in RAM and database connection pool settings (`pool_size=20`, `max_overflow=10`, `pool_recycle=3600`, `pool_pre_ping=True`) are configured.
4. **Read Short-Term Memory**: Read `memory/runtime/context.md` for unfinished work from the last session.
5. **Orient Scope**: `repograph_files(scope)` for the area named in the task — not the whole repo.

Do not read source implementation files in this phase. Bootstrap establishes *where* things are and enforces guardrails; retrieval of *what* implementation files contain belongs to the task execution phase.
