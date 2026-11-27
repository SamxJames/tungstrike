# Handover

Kept current by `/handover` at the end of every Claude Code session. Read this first.

## Status
- **Milestone:** M0 (Foundations and Throw Lab) is built on branch `feat/m0-foundations` (worktree `.claude/worktrees/m0`),
  final fix wave done, all checks green. Not merged, not deployed. Next: PR to `main` once Sam has looked.
- What it does: `/` is a solo 501 leg with par, warm-up and lead check, and a "did darts land where you aimed?" rating per
  won leg; `/lab` tunes the throw with sliders, a 10-dart drill report and share links. Results go out by Send (form) or
  Copy; throw logs survive reloads on the phone until sent. `node scripts/analyse-runs.mjs <file>` replays pasted results.
- Spec: `docs/superpowers/specs/2026-11-16-m0-foundations-throw-lab.md`.

## Open threads
- Open the M0 PR from `feat/m0-foundations` (mobile screenshots attached), then a Vercel preview link for testers.
- Deferred on purpose: Lab pad position, drill verdict band, extra stats (timing share, T20 rate, 3-dart average).

## Waiting on Sam
- Tune the throw in `/lab` on your phone and freeze the settings for Gate 1 (share the link).
- Feedback form: create one (Formspree recommended: it takes JSON posts; Tally has no public JSON endpoint as far as we
  know), then set `VITE_FEEDBACK_URL` in Vercel (preview and production) and add the name to `.env.example` by hand.
- Vercel: connect the repo and send the preview link.
- Line up 5 non-Sam phone testers for Gate 1 (target 2026-12-06).
- Name checks (domain, UKIPO/EUIPO/USPTO, handles): see `docs/brief.md`.

## Session log
(newest first, one or two lines each)
- 2026-11-27: M0 final fix wave: visits kept across reloads, private-tab notice, landscape fixes, first-screen intro,
  overlay contrast, CI build step, guard hardening, more pinned tests and a second replay golden.
