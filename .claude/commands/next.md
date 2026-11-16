---
description: Pick up the next piece of work and drive it through the Superpowers flow, stopping only at Sam's gates.
---

1. Read `docs/handover.md`, `docs/roadmap.md` and the open GitHub issues (`gh issue list`).
2. Pick the work, in this order: anything `in-progress` → the current milestone's next unchecked item → the oldest
   `agent-ready` issue. If `$ARGUMENTS` names something, do that instead.
3. Tell Sam in one line what you're picking and why.
4. Drive it through the flow in `CLAUDE.md`: brainstorm → spec (**gate**) → plan (**gate**) → worktree → subagent build with
   TDD → code review → verification → PR (**gate: Sam merges**). If a spec or plan for it already exists and was approved, skip
   straight to the build.
5. Use the project agents: `game-designer` on specs that touch gameplay, `balance-analyst` before any balance-affecting PR,
   `mobile-playtester` before any UI PR.
6. Finish with `/handover`.

$ARGUMENTS
