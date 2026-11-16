# Tungstrike: product brief

Working name: **Tungstrike** (backup: TrebleRun). Written 2026-11-15 from the 2026-11-13 idea research.
Owner: Sam (solo, 5-10 hours a week). Almost all of the building is done by Claude Code.

## One line
A free browser darts roguelite: each run is a tour of eight 501 legs against harder and harder opponents, with shop cards
that bend the rules. Everyone plays the same daily seed, and you share your scorecard.

Positioning line (use everywhere): **"Balatro on the oche. Free, in your browser, a new tour every day."**

## Why this, why now
- Darts has a big, young fandom that few games serve. The 2026 PDC World Championship final peaked at about 2.5m on Sky Sports,
  and total tournament viewing was up about 13% on the year before. r/darts has about 139k members (third-party count).
- The darts roguelites that exist are small paid Steam/itch releases. Greedy Darts has 2 Steam reviews, and Dorts has
  about 25 at 96% positive. Browser darts today means generic 501 throwers with no progression. Balatro has no browser
  version.
- **Gap:** the free, browser-first, daily, social version. Dartlatro (itch.io, browser) is the closest rival. Be better
  than it, and get there first.
- **Hard problem = throw feel.** Greedy Darts reviews complain that darts land away from where players aimed. Win here or
  don't ship.

## Core loop
1. **Start a run** (the daily seed, or endless mode).
2. **Play a leg.** 501, double out, against an AI opponent with a visible average. Each throw: a crosshair wobbles over the
   board, and the player taps to release. Where the dart lands = crosshair position at release + a small seeded scatter.
   Skill = timing, not luck.
3. **Tungsten shop** between legs. Spend winnings on cards that bend the rules, for example "treble 19s score double", "one bust
   forgiven per leg", "bullseyes stack a multiplier", "steadier hand: less wobble on doubles".
4. **Repeat** for 8 legs, each opponent harder. Lose a leg and the run ends (tune this; maybe best of 3 later).
5. **Share result:** a Wordle-style emoji scorecard plus a link to today's tour.

## Retention (later milestones, not the prototype)
- Tour of the Day (same seed for everyone) plus endless mode.
- Barrels and cards to unlock and collect.
- Weekly divisions with promotion and relegation, like a real darts league.
- Seasonal themes that follow the darts calendar (the Worlds in mid-December to early January, Premier League nights in spring).

## Distribution (designed in from day one, the lesson from Curio)
Curio was well built and almost nobody saw it. Tungstrike's sharing has to be part of the product:
- The share scorecard and challenge link ship in the **same milestone** as the daily seed, not later.
- r/darts and r/roguelites, posted **by hand under Sam's name**, timed to big TV darts nights.
- Short clips of combos (TikTok/Shorts). Later: clip export from the game.
- CrazyGames/Poki portals (Basic Launch, then Full Launch).
- Reddit Devvit version (Developer Funds paid $500 at 500 daily engagers under the H1 2026 terms; check current terms).
- Typefully is connected for X/Threads/Bluesky once accounts exist. Reddit stays manual.

## Technical shape
- **TypeScript, Vite, Canvas 2D** for the board (flat vector, no 3D). Menus and shop in plain DOM or Preact.
- **`src/core/` is pure and deterministic:** seeded RNG, board geometry and scoring, throw resolution, opponents, cards and run state.
  It has no DOM, no `Math.random`, no `Date.now`. This makes the game testable and **simulatable headless**, so agents can
  run 10,000 runs to check balance, and the server can replay a run to check a score.
- **Input log:** a run = seed + list of throw inputs. Replaying it must give the same result. That's the basis for
  leaderboards, anti-cheat and bug reports ("paste your run code").
- **Hosting:** Vercel (team "Sam's projects"). Server only arrives with leaderboards: Vercel functions + Upstash Redis
  (same pattern as Curio). Everything before that is static.
- **Throw Lab** (`/lab`): a dev page with sliders for wobble speed, wobble shape, scatter, board size and
  release delay. Settings are encoded in the URL so Sam can tune on his phone and send a link back.
- Mobile first: one-thumb play, portrait, works on a mid-range Android.

## Rules that never bend
- **No real players, no real brands:** no player names or likenesses, no PDC, WDF, Sky, Ally Pally or Premier League
  marks. Opponents are invented. A source guard (`npm run guard`) fails CI if banned terms appear in source or content.
- **No gambling look or mechanics:** no paid random rewards, no loot boxes, no casino styling. Anything paid is cosmetic
  and deterministic. (UK loot-box concerns; Devvit forbids gambling mechanics.)
- **No dark patterns:** no fake urgency, no "you'll lose your streak" push notifications.
- **Fair daily:** the daily seed is the same for everyone, and the share card never spoils the run for friends.

## Money (only after traction)
Mediavine Journey from about 1,000 premium sessions a month. Raptive from 25,000 page views a month (roughly £300-800 a month).
Portals: about €1,200 per 1m plays. Reddit Developer Funds. Cosmetic barrels. All of these are research-stage figures, so
check them before relying on them.

## Name: checks still to do (don't buy anything until they pass)
tungstrike.com / .gg / .io / .co.uk at a registrar · UKIPO, EUIPO and USPTO classes 9, 28 and 41 · @tungstrike on X, Threads,
Bluesky, TikTok and Instagram · r/tungstrike. Fallback name: TrebleRun.

## Success measures
See `docs/roadmap.md` for the gates. In short: **does the throw feel good** (week 3), then **do strangers come back**
(about 30 days after launch).
