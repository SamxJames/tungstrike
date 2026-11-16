# Tungstrike roadmap and gates

Budget: Sam's 5-10 hours a week, mostly reviewing and playtesting. Claude Code does the building.
Until 2026-12-04, Sam's own hands-on time goes to the Curio dig launch first. Tungstrike build sessions run alongside.

Every milestone goes through the same agent flow (see `CLAUDE.md`): brainstorm → spec → plan → subagent build →
review → PR. Each milestone is one GitHub issue with a checklist.

## M0: Foundations and Throw Lab (target 2026-11-29)
- Repo, Vite + TS, Vitest, Playwright (mobile viewport), ESLint, `npm run check`, CI on PRs, Vercel previews.
- `npm run guard`: banned brand and player terms, no `Math.random` / `Date.now` in `src/core/`.
- `src/core/`: seeded RNG, board geometry (segments, doubles, trebles, bulls), scoring, 501 double-out with busts.
- Throw mechanic v1 + **Throw Lab** at `/lab` with sliders, URL-encoded settings, and a "10 darts at T20" drill that reports
  grouping.
- Headless throw simulator: given a "skill profile" (timing error distribution), what averages come out? Is the
  difficulty curve plausible?

## Gate 1: Throw feel (2026-12-06)
Five people who are **not Sam** each play at least 10 legs on their own phone, using the Lab's best settings.
- **Pass:** at least 4 of 5 say darts land where they aimed "most of the time", **and** at least 3 of 5 start another
  leg without being asked.
- **Fail once:** one more week of tuning, with notes on what felt wrong. **Fail twice:** stop. Switch to the snooker
  fallback, or drop the project. Don't build cards on a throw that doesn't feel good.

## M1: One full run (target ~2026-12-20)
- AI opponents with visible averages and a difficulty curve across 8 legs.
- Tungsten shop with about 20 cards. Card effects are data-driven (a card = data plus a small effect function in `src/core/cards/`).
- Run end screen. Endless mode is a stretch goal.
- `balance-analyst` simulates 10,000 runs per card set and reports win rate per leg, dominant cards and dead cards.
- Soft timing hook: the World Championship is on TV mid-December to early January. Show a playable build to a few
  r/darts regulars for feedback (no launch post yet).

## M2: Daily tour and sharing (target mid-Jan 2027)
- Daily seed (same for everyone, UTC rollover), deterministic replay from seed + input log.
- Emoji share card + spoiler-free challenge link. Native share sheet on phones.
- First-party analytics: visits, run starts, legs reached, finishes, shares. Cohort tag by first-play date (same design as
  Curio's dig).
- Name checks done, domain bought, Vercel production.

## M3: Leaderboards (target Feb 2027)
- Vercel function + Upstash: submit seed + input log, replay on the server, reject impossible scores.
- Daily leaderboard and friends-only challenge comparison.

## Launch (target Feb-Mar 2027, ahead of Premier League nights)
By hand, under Sam's name: r/darts, r/roguelites, r/WebGames, Show HN, CrazyGames Basic Launch. One channel a day,
each with its own UTM tag.

## Gate 2: Strangers come back (about 30 days after launch)
- At least **200 first-time finishers** (fewer = the launch failed, not the game: try a second wave first).
- **Day-7 return of at least 15%** of first-time finishers.
- **Share or challenge rate of at least 10%** of finishers.
- Pass: retention features (unlocks, divisions, seasons), portals, Devvit. Fail on return rate with enough players:
  maintenance mode.

Sam can change any gate number, but write the change and the reason in `docs/decisions.md` **before** the gate is read,
not after.
