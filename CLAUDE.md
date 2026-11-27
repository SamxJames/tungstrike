# Tungstrike: instructions for Claude Code

Read first: `docs/brief.md` (what we're building), `docs/roadmap.md` (milestones and gates), `docs/handover.md`
(where the last session stopped), `docs/decisions.md` (decisions in force and why).

## Who you're working with
Sam is a senior data visualisation engineer (Power BI, SQL). He is **not** a TypeScript or Python developer. He often
reads on his phone. So:
- Updates are short and in plain English: what changed, what he needs to decide, what's next. No code dumps.
- When you need a decision, give 2-3 options with your recommendation first.
- Sam wants as much automation as possible. If a tool, skill, hook or connector would remove a manual step, say so.

## How we work (agentic by default)
Use the Superpowers skills. For every milestone or non-trivial feature:
1. `superpowers:brainstorming` → write the spec to `docs/superpowers/specs/YYYY-MM-DD-<topic>.md`. **Gate: Sam approves the spec.**
2. `superpowers:writing-plans` → write the plan to `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`, broken into small tasks that each have a test.
   **Gate: Sam approves the plan** (a one-screen summary is enough for him).
3. `superpowers:using-git-worktrees` → work on a branch, never on `main`.
4. `superpowers:subagent-driven-development` → one fresh subagent per task, with `superpowers:test-driven-development`.
   Run independent tasks in parallel where they touch different files.
5. `superpowers:requesting-code-review` after each batch. Fix what it finds.
6. `superpowers:verification-before-completion` → `npm run check` passes and the Playwright mobile screenshots are attached,
   **then** open a PR with `superpowers:finishing-a-development-branch`. **Merge gate (decided 2026-11-27):** a `risk:low` PR
   (UI, copy, tests, docs, tooling) is merged by Claude once CI `check` is green and the review is clean; a `risk:high` or
   unlabelled PR (money, secrets, persisted or server data, anything public, game feel or scope changes, the throw maths in
   `src/core/`) stops at the PR for Sam. Never merge a PR that touches `.claude/settings.json` or other permission config.
7. Run `/handover` at the end of every session.

Between the gates, don't stop to ask permission for routine work. Stop and ask only if a decision is product-shaped (game feel,
scope, money, anything public), irreversible, or contradicts the brief.

## Autonomous mode (runs without Sam's PC, from the repo)
A scheduled cloud routine (or `/next` in any session) works the board with no one watching:
- Pick the top GitHub issue labelled `agent-ready` that is not `in-progress` or `waiting-on-sam`. Label it `in-progress` first.
- Respect the roadmap gates in `docs/roadmap.md`: nothing from M1 onwards until Sam records that Gate 1 passed in
  `docs/decisions.md`. Issues for later milestones stay untouched.
- Issue-sized, `risk:low` work: self-approve the spec and plan against the issue's "Done when" (keep them to one screen), then
  build, review, `npm run check`, open the PR with `Closes #n`, and merge per the merge gate above.
- Anything that needs Sam (a decision, an account, a dashboard, his phone): comment the question on the issue, label it
  `waiting-on-sam`, and move on to the next issue. Nothing blocks the loop.
- End every run with `/handover`: update `docs/handover.md` (under 150 lines) and say what was done, merged, and is waiting.

Project subagents in `.claude/agents/`:
- `game-designer`: card ideas, difficulty curve, and "is this fun / is this fair" reviews against the brief.
- `balance-analyst`: runs the headless simulator and reports numbers. Use it before any card or opponent change merges.
- `mobile-playtester`: Playwright on phone viewports, screenshots, tap targets and one-thumb reach. Use it before any UI PR.

Use `superpowers:systematic-debugging` for any bug: reproduce with a seed + input log first.

## Where work lives
- **GitHub Issues are the backlog**, not long lists in docs. Labels: `milestone:M0` etc., `agent-ready` (Claude can do
  it alone), `waiting-on-sam` (needs his decision or hands), `in-progress`, `bug`. Sam triages from his phone.
- `docs/handover.md` is short (under 150 lines): status, open threads, waiting on Sam, a short session log. Detail lives in
  specs, plans, PRs and issues. Load only what the task needs: don't read every doc every session.
- `docs/decisions.md` holds decisions that are in force, with the reason. Check it before re-opening a settled question.

## Models and effort (Sam's lessons from Curio)
- Deep investigation, audits, tricky debugging, balance judgement calls: the strongest available model, medium effort.
- Routine building from an approved plan: the default model. Use high effort for changes to live or replay-critical code
  (`src/core/`), and low effort for mechanical tasks (renames, copy, config).
- Subagents for parallel, independent tasks keep the main context small. Prefer them over one long thread.

## Environments
- Dev, preview and production get **separate** data stores from the day a server exists (Curio's local dev wrote to
  production Redis; don't repeat that). Preview deploys never touch production data.
- Secrets live in Vercel and GitHub settings only. `.env.example` lists names, never values.

## Architecture rules
- `src/core/` is pure TypeScript: no DOM, no `Math.random`, no `Date.now`, no network. All randomness comes from the seeded
  RNG passed in. A run = seed + input log. Replaying it must give the same result, and there's a test for that.
- Rendering (`src/render/`) and UI (`src/ui/`) read state from core. They never decide outcomes.
- Cards are data plus a small effect function. Adding a card shouldn't need edits outside `src/core/cards/`.
- Mobile first: design at a 390×844 portrait viewport, then check desktop.
- Before using a library API, check the installed version's docs. Don't trust memory for Vite, Vitest or Playwright options.

## Never
- Push to `main`, force-push, or deploy to production. PRs only. Vercel previews are fine.
- Add real player names or likenesses, or PDC/WDF/Sky/Premier League/Ally Pally marks. Opponents are invented. `npm run guard`
  enforces this.
- Add gambling mechanics or styling: paid random rewards, loot boxes, slot-machine visuals.
- Add streak-loss guilt, fake urgency or dark patterns.
- Read, print or commit `.env*` files or secrets.
- Post anything publicly (Reddit, socials, HN). Sam posts by hand.

## Commands
`npm run dev` · `npm run check` (guard + lint + typecheck + tests; must pass before any PR) · `npm run sim -- --runs 10000`
(headless balance sim, from M1). The Stop hook runs `npm run check` when files have changed.
