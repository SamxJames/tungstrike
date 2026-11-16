# Tungstrike

A free browser darts roguelite: Balatro on the oche, with a new tour every day. Working name. See `docs/brief.md`.

Built mostly by Claude Code, using an agent-first workflow:
- `CLAUDE.md`: how agents work here (Superpowers flow, gates, rules).
- `docs/brief.md` · `docs/roadmap.md` · `docs/decisions.md` · `docs/handover.md`
- `.claude/`: shared Claude Code setup (Superpowers enabled, a Stop hook that runs `npm run check`, project agents, and the
  `/next`, `/handover` and `/playtest-pack` commands).
- GitHub Issues = backlog (`agent-ready`, `waiting-on-sam`).

Start a session: open Claude Code in this repo and type `/next`.
