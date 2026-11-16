# Decisions in force

Newest first. Each entry: date · decision · why · what would change it.

- **2026-11-15 · Framework improvements over Curio.** Why each one:
  1. `.claude/` (settings, hooks, agents, commands) is **committed**. Curio gitignored it, so cloud sessions had no
     Superpowers and no Stop hook.
  2. `main` is protected and CI must pass **before** merge. Curio deployed `master` straight away, and CI only reported
     problems afterwards.
  3. **GitHub Issues as the backlog**, labelled `agent-ready` / `waiting-on-sam`, plus the Claude GitHub app so Sam can hand
     off a task from his phone with `@claude`. Curio tracked work in a 21 KB `handover.md` + 230 KB of handover docs,
     which is a lot of context to load every session.
  4. **Handover capped at 150 lines** with a rolling log; detail goes in specs, plans and PRs.
  5. **Separate data stores** for dev, preview and production from day one. Curio's local dev wrote to production Upstash.
  6. **Mobile e2e with screenshots in CI** (Playwright) and project agents (`balance-analyst`, `mobile-playtester`,
     `game-designer`), so checks happen without Sam. Curio relied on manual phone tests.
  7. **A gate before building**, not weeks in (Gate 1, throw feel).
  8. **Permission allowlist** for routine commands (tests, git, `gh pr create`), so agents run with fewer prompts.
     Pushing to main, force-pushing, merging and production deploys stay denied.
- **2026-11-15 · The gates in `docs/roadmap.md` are the defaults.** Why: Curio drifted with no kill line for weeks.
  Change: Sam edits a gate here *before* it's read.
- **2026-11-15 · Agent workflow = Superpowers (brainstorm → spec → plan → subagent build → review → PR), Sam approves at three
  points: spec, plan, merge.** Why: Sam has 5-10 hours a week and wants Claude to do the building. Superpowers is enabled in
  `.claude/settings.json` so cloud sessions get it too (it was missing from cloud Curio sessions).
- **2026-11-15 · Deterministic, pure `src/core/` with seed + input-log replay.** Why: it enables headless balance
  simulation by agents, server-side anti-cheat and reproducible bug reports.
- **2026-11-15 · Throw feel is tested first (Gate 1), before cards or progression.** Why: it's the main failure point of
  rival games.
- **2026-11-15 · Sharing ships with the daily seed (M2), not later.** Why: Curio's lesson was a well-built product nobody saw.
- **2026-11-13 · Darts roguelite chosen over chart-forecasting (27/35) and pit-wall (23/35); it scored 29/35.** Fallback if the
  throw fails: snooker.
- **2026-11-13 · Working name Tungstrike, backup TrebleRun.** Domain, trademark and handle checks are still to do.
