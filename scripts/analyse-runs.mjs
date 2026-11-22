// Replays tester run codes and prints one summary line per run.
// Usage: node scripts/analyse-runs.mjs <file with run codes or pasted "Copy my results" messages>
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

/**
 * One line per run code found in `text`: a `Run code: <code>` line, or a bare code on its own line. A bare token that
 * is not a valid code is reported as `line N: not a valid run code`; every other line (headers, device, legs,
 * warm-up code, prose, blanks) is skipped. Rated `Leg N:` lines from pasted results are listed after the runs.
 */
export function analyse(text) {
  const runs = []
  const legs = []
  let runCount = 0
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim()
    let code
    if (RUN_CODE_LINE.test(line)) code = line.replace(RUN_CODE_LINE, '').trim()
    else if (BARE_CODE.test(line)) code = line
    else {
      const m = RATED_LEG.exec(line)
      if (m) legs.push(`leg ${m[1]}: ${m[2]} darts, ${m[3]}, landed where aimed: ${m[4]}`)
      return
    }
    try {
      runs.push(summaryLine(runCount + 1, code))
      runCount += 1
    } catch {
      runs.push(`line ${i + 1}: not a valid run code`)
    }
  })
  return [...runs, ...legs]
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2]
  if (!file) {
    console.error('Usage: node scripts/analyse-runs.mjs <file with run codes or pasted results>')
    process.exit(1)
  }
  console.log(analyse(readFileSync(file, 'utf8')).join('\n'))
}
