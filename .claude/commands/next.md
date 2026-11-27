---
description: Pick up the next piece of work and drive it through the Superpowers flow, stopping only at Sam's gates.
---

1. Run `/status` (shipyard board), then read `docs/handover.md` and `docs/roadmap.md`.
2. Pick the work, in this order: anything `in-progress` → the current milestone's next unchecked item → the oldest
   `agent-ready` issue. If `$ARGUMENTS` names something, do that instead. Skip anything `waiting-on-sam`.
3. Tell Sam in one line what you're picking and why, and move it with the board script: `board.mjs move <n> in-progress`.
4. Drive it through the flow in `CLAUDE.md`: brainstorm → spec (**gate**) → plan (**gate**) → worktree → subagent build with
   TDD → code review → verification → PR with `Closes #<n>` (**gate: Sam merges**). Then run `board.mjs move <n> in-review`.
   If a spec or plan for it already exists and was approved, skip straight to the build. At a gate, post the one-screen
   summary as an issue comment, label it `waiting-on-sam`, and pick the next issue instead of waiting.
5. Use the project agents: `game-designer` on specs that touch gameplay, `balance-analyst` before any balance-affecting PR,
   `mobile-playtester` before any UI PR.
6. Finish with `/handover`.

$ARGUMENTS
