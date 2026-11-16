---
description: End-of-session handover. Update docs/handover.md, docs/decisions.md and GitHub issues so the next session (or Sam on his phone) can pick up cold.
---

Close out this session:

1. **`docs/handover.md`**: rewrite "Status", "Open threads" and "Waiting on Sam" to match reality now. Add one or two lines
   at the top of "Session log". **Keep the whole file under 150 lines.** When the session log passes 15 entries, fold the
   oldest into a one-line monthly summary. Detail belongs in specs, plans, PRs and issues, not here.
2. **`docs/decisions.md`**: add any decision made this session (date · decision · why · what would change it). Don't
   record routine implementation choices.
3. **GitHub issues**: tick off finished checklist items. Open an issue for any follow-up you found but didn't do, labelled
   `agent-ready` (a clear task Claude can do alone) or `waiting-on-sam` (needs his decision or hands). Give each issue
   enough context to start cold.
4. Commit the doc changes on the current branch (never on `main`).
5. Reply to Sam in **5 lines or fewer**: what got done, what's waiting on him (with links), and what the next session starts on.

$ARGUMENTS
