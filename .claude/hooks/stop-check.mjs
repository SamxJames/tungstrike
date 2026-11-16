// Stop hook: when Claude finishes a turn having changed files, run `npm run check`.
// If it fails, exit 2 so the failure text goes back to Claude and it keeps fixing.
// Safe by design:
//   - never loops (respects stop_hook_active)
//   - does nothing before package.json / a "check" script exists
//   - does nothing when no tracked or new files have changed
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  /* no or invalid stdin: treat as a normal stop */
}
if (input.stop_hook_active) process.exit(0);

const pkgPath = path.join(root, "package.json");
if (!existsSync(pkgPath)) process.exit(0);
let pkg;
try {
  pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
} catch {
  process.exit(0);
}
if (!pkg.scripts || !pkg.scripts.check) process.exit(0);

const status = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
if (status.status !== 0 || !status.stdout.trim()) process.exit(0);

const run = spawnSync("npm", ["run", "check", "--silent"], {
  cwd: root,
  encoding: "utf8",
  shell: process.platform === "win32",
});
if (run.status === 0) process.exit(0);

const out = `${run.stdout || ""}\n${run.stderr || ""}`.trim().split("\n");
process.stderr.write(
  "npm run check failed. Fix this before finishing (last 60 lines):\n" + out.slice(-60).join("\n") + "\n"
);
process.exit(2);
