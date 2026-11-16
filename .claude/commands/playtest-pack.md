---
description: Prepare a playtest for real people. A preview link, a tester script and a feedback form Sam can send from his phone.
---

Prepare a playtest of the current build for: $ARGUMENTS (default: the Gate 1 throw-feel test in `docs/roadmap.md`).

1. Make sure the branch is pushed and has a Vercel preview URL (`gh pr checks` or the PR's Vercel comment). If there's no
   preview, say so and stop.
2. Write `docs/playtests/YYYY-MM-DD-<topic>.md` with:
   - The preview link (with the Lab settings Sam chose, if it's a throw test).
   - A WhatsApp-ready message to testers: 3-4 sentences, what to do, about how long it takes, no jargon.
   - The 4-6 questions we need answered, tied to the gate's pass criteria (for Gate 1: "Did darts land where you
     aimed? Always / Mostly / Sometimes / Rarely", "Did you want another leg?", "What felt off?").
   - A results table to fill in, and the pass/fail rule copied from the roadmap.
3. If the build records analytics, list what Sam should read afterwards and where.
4. Reply with the tester message ready to paste, and the path to the doc.
