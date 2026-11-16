# Decisions in force

Newest first. Each entry: date · decision · why · what would change it.

- **2026-11-16 · Gate 1 wording A (Sam).** Testers are told "play as many as you like"; we count legs, and 10 or more is the bar
  for "at least 10 legs". "Starts another leg without being asked" is then measured honestly. Why: telling them to play 10
  would hide whether they'd want to. Change only before the gate is read.
- **2026-11-16 · Decision hierarchy.** Sam asked for decisions to be automated. Advisors (`game-designer`, `product-strategist`,
  `ux-reviewer`) give picks with confidence and reversibility; the lead decides and logs here with a one-line why. **Sam still
  decides** anything that costs money or opens accounts, is seen beyond the named testers, touches the never-list or
  contradicts the brief or this file, is hard to reverse (for example the run-log format once tester codes exist), or changes
  what a gate measures. Sam approves spec, plan and merge as before.
- **2026-11-16 · M0 throw (Sam's calls):** sticky target + wobbling crosshair + tap to release; 501 on every leg; a tap snaps the
  target to the bed centre. Rejected: two-tap meter (too slow for ~280 darts a run) and drag-to-aim (thumb covers the board and
  shifts on lift: the "landed where I didn't aim" complaint).
- **2026-11-16 · M0 lead calls** (see `docs/superpowers/specs/2026-11-16-m0-foundations-throw-lab.md`): headless simulator moves
  to M1 (doesn't affect throw feel) · no AI opponent in M0, a par target instead · 5 testers on one setting (3 darts-aware,
  2 casual, one mid-range Android), with a "Forgiving" preset held back · Preact · 8ms tick · integer sine table and no
  `Math.sin`/`atan2` in core (engines differ in the last bit) · bounded scatter weighted to the centre · a long-lived `gate1`
  branch for one stable preview link · a free form service for tester feedback, no backend. Change if: Gate 1 fails, or replaying
  real tester codes diverges across phones.
- **2026-11-16 · Pacing risk parked for M1.** 501 at an average of 55 is about 3 minutes a leg, so 8 legs is about 24 minutes
  against the brief's 8-12. M1 decides between cards that shorten legs, a shorter tour, or 301 early legs.

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
