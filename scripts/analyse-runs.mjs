// Replays tester run codes and prints one summary line per run.
// Usage: node scripts/analyse-runs.mjs <file with run codes, share links or pasted "Copy my results" messages> (Node 22.18+)
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { summariseRun } from '../src/core/analysis.ts'
import { decodeRunCode } from '../src/core/replay.ts'

const BARE_CODE = /^[A-Za-z0-9_-]+$/
const RUN_CODE_LINE = /^Run code:/
const RATED_LEG = /^Leg (\d+): (\d+) darts, \d+ busts, (won|not finished), landed where aimed: (mostly|sometimes|rarely)\b/

function summaryLine(n, code) {
  const s = summariseRun(decodeRunCode(code))
  return (
    `run ${n}: throws ${s.throws}, legs started ${s.legsStarted}, won ${s.legsWon}, ` +
    `darts per won leg ${s.dartsPerWonLeg === null ? 'n/a' : s.dartsPerWonLeg.toFixed(1)}, busts ${s.busts}, ` +
    `on-target ${(s.hitRate * 100).toFixed(0)}%, mean miss ${s.meanMissTrebleWidths.toFixed(2)} treble widths`
  )
}

const URL_RUN = /[?#&]run=([A-Za-z0-9_-]+)/

/**
 * One line per run code found in `text`: a `Run code: <code>` line, a bare code on its own line, or a share link
 * containing `run=<code>`. A token that is not a valid code is reported as `line N: not a valid run code`; every other
 * line (headers, device, warm-up code, prose, blanks) is skipped. Pasted results put each visit's `Leg N:` lines just
 * before its `Run code:` line (several visits in one message are several such blocks), so rated legs are listed right
 * after the run they belong to, as `run N leg M: ...`. Rated legs with no run after them are listed at the end.
 */
export function analyse(text) {
  const out = []
  let pending = []
  let runCount = 0
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim()
    let code
    const fromUrl = URL_RUN.exec(line)
    if (RUN_CODE_LINE.test(line)) code = line.replace(RUN_CODE_LINE, '').trim()
    else if (BARE_CODE.test(line)) code = line
    else if (fromUrl) code = fromUrl[1]
    else {
      const m = RATED_LEG.exec(line)
      if (m) pending.push({ n: m[1], text: `${m[2]} darts, ${m[3]}, landed where aimed: ${m[4]}` })
      return
    }
    try {
      out.push(summaryLine(runCount + 1, code))
      runCount += 1
      for (const l of pending) out.push(`run ${runCount} leg ${l.n}: ${l.text}`)
    } catch {
      out.push(`line ${i + 1}: not a valid run code`)
      for (const l of pending) out.push(`leg ${l.n}: ${l.text}`)
    }
    pending = []
  })
  for (const l of pending) out.push(`leg ${l.n}: ${l.text}`)
  return out
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2]
  if (!file) {
    console.error('Usage: node scripts/analyse-runs.mjs <file with run codes, share links or pasted results> (needs Node 22.18 or newer)')
    process.exitCode = 1
  } else {
    console.log(analyse(readFileSync(file, 'utf8')).join('\n'))
  }
}
