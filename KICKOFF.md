# Kickoff prompt (paste into Claude Code, on your computer, in this folder)

Run it on your computer the first time, because Superpowers is installed there and `/install-github-app` needs you at the
keyboard. After that, cloud sessions on your phone work too (`/next`).

---

This folder is the starter kit for Tungstrike, a new browser darts roguelite. Read `CLAUDE.md`, `docs/brief.md`,
`docs/roadmap.md` and `docs/decisions.md` first, then do the setup below. Keep your updates to me short and in plain
English: I'm not a TypeScript developer, and I'll often be on my phone.

**Part 1: Repo and guard rails (do these yourself, then report)**
1. `git init -b main`, commit the starter kit as-is ("chore: starter kit"), then
   `gh repo create SamxJames/tungstrike --public --source . --push`.
   Public, like curio-web, so branch protection is free on my GitHub plan. If anything in the kit looks unsafe to make
   public, stop and tell me.
2. Protect `main`: require a PR, and require the `check` status from `.github/workflows/ci.yml`, using `gh api` with a ruleset
   or branch protection. No required reviews (I'm solo), but no direct pushes. Confirm it by trying a dry run, or by
   reading the rules back.
3. Create labels: `milestone:M0`, `milestone:M1`, `milestone:M2`, `milestone:M3`, `agent-ready`, `waiting-on-sam`,
   `in-progress`, `bug`.
4. Create one issue per milestone in `docs/roadmap.md` (M0-M3 + Launch), with the roadmap bullets as a checklist and the
   gate criteria quoted. Create two `waiting-on-sam` issues: "Name checks (domain, trademarks, handles)" and "Line up 5
   non-Sam phone testers for Gate 1 by 2026-12-06".
5. Check that the Superpowers skills are available in this session, and that `.claude/settings.json` loaded (project agents
   `game-designer`, `balance-analyst` and `mobile-playtester`, and the commands `/next`, `/handover` and `/playtest-pack`). Test the
   Stop hook with sample JSON on stdin (it should exit 0 now, because there's no package.json yet). Report anything that
   didn't load.

**Part 2: Things only I can do. List them for me as a numbered checklist with the exact commands or links:**
- `/install-github-app` (so I can comment `@claude` on issues from my phone). Use my subscription (OAuth token), not an
  API key: the API account behind Curio's reviewer is out of credit.
- Link the repo to Vercel (team "Sam's projects") for PR previews only. **No production domain yet.**

**Part 3: Start M0**
6. Run `superpowers:brainstorming` for M0 (foundations + Throw Lab). Bring in `game-designer` for the throw mechanic. Ask
   me at most 5 questions, one at a time, with your recommendation for each. The throw mechanic is the most important
   decision in the project.
7. Write the spec to `docs/superpowers/specs/`, and stop for my approval. After I approve, write the plan, then stop for
   approval again, then build with `superpowers:subagent-driven-development` on a worktree branch, and open a PR with
   mobile screenshots and a Vercel preview link I can open on my phone.
8. Finish with `/handover`.
