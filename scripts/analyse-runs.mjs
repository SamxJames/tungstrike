// Replays tester run codes and prints one summary line per run.
// Usage: node scripts/analyse-runs.mjs <file with run codes, share links or pasted "Copy my results" messages> (Node 22.18+)
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { summariseRun } from '../src/core/analysis.ts'
import { decodeRunCode } from '../src/core/replay.ts'

const BARE_CODE = /^[A-Za-z0-9_-]+$/
const RUN_CODE_LINE = /^Run code:/
const RATED_LEG = /^Leg (\d+): (\d+) darts, \d+ busts, (won|not finished), landed where aimed: (mostly|sometimes|rarely)\b/
// The header line of each visit block in a pasted "Copy my results" message (see resultsText in src/ui/feedback.ts):
// the current visit, then each earlier visit. Visit ids are hex.
const RESULTS_HEADER = /^Tungstrike results \(build [^,]*, visit ([^\s)]+)\)/
const EARLIER_HEADER = /^Earlier visit (\S+) \(started /
// "Log gap detected: ..." (the second wording is what builds before the earlier-visit fix printed for the current visit).
const GAP_LINE = /^(Log gap detected|Throw log has a gap)\b/

const pct = (v) => (v === null ? 'n/a' : `${(v * 100).toFixed(0)}%`)

function summaryLine(n, code, logGap) {
  const s = summariseRun(decodeRunCode(code))
  // Three-dart average: points scored in turns that did not bust, divided by completed turns (a bust turn counts as a
  // turn that scored nothing; a turn still in progress when the run stops is left out). See turnStats in src/core/analysis.ts.
  // Timing share: of the darts that missed their target bed, the share whose crosshair was already outside it at release
  // (spec target: 65%+). T20 / in 20 / near 20 (sectors 20, 1, 5): landing rates of darts aimed at T20
  // (first-timer targets: in 20 55%+, T20 15-25%, near 20 90%+).
  return (
    `run ${n}: throws ${s.throws}, legs started ${s.legsStarted}, won ${s.legsWon}, ` +
    `darts per won leg ${s.dartsPerWonLeg === null ? 'n/a' : s.dartsPerWonLeg.toFixed(1)}, busts ${s.busts}, ` +
    `on-target ${(s.hitRate * 100).toFixed(0)}%, mean miss ${s.meanMissTrebleWidths.toFixed(2)} treble widths, ` +
    `timing ${pct(s.timingMissShare)} of ${s.misses} misses, ` +
    `T20 ${pct(s.t20Rate)} of ${s.aimedAtT20} aimed, in 20 ${pct(s.in20Rate)}, near 20 ${pct(s.near20Rate)}, ` +
    `3-dart avg ${s.threeDartAverage === null ? 'n/a' : s.threeDartAverage.toFixed(1)} over ${s.turns} turns` +
    (logGap ? ', log gap detected (run code may not replay every dart)' : '')
  )
}

const URL_RUN = /[?#&]run=([A-Za-z0-9_-]+)/

/**
 * One line per run code found in `text`: a `Run code: <code>` line, a bare code on its own line, or a share link
 * containing `run=<code>`. A token that is not a valid code is reported as `line N: not a valid run code`; every other
 * line (headers, device, warm-up code, prose, blanks) is skipped. Pasted results put each visit's `Leg N:` lines just
 * before its `Run code:` line (several visits in one message are several such blocks), so rated legs are listed right
 * after the run they belong to, as `run N leg M: ...`. Rated legs with no run after them are listed at the end.
 *
 * Copies are cumulative: a tester who taps Copy twice in one visit sends the same visit id twice, the later block holding
 * every dart of the earlier one. Only the LAST block per visit id is analysed (so legs and darts are not counted twice),
 * and a `dropped N earlier copy/copies of visit <id>` line says what was left out. Bare codes and share links have no
 * visit id and are never dropped. A visit block with a log gap gets `log gap detected` on its run line.
 */
export function analyse(text) {
  // Pass 1: one entry per run-code line, remembering the visit id and gap flag of the block it sits in.
  const entries = []
  let pending = []
  let visit = null
  let gap = false
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim()
    const header = RESULTS_HEADER.exec(line) ?? EARLIER_HEADER.exec(line)
    if (header) {
      visit = header[1]
      gap = false
      return
    }
    if (GAP_LINE.test(line)) {
      gap = true
      return
    }
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
    const entry = { line: i + 1, code, legs: pending, visit, gap, valid: true }
    try {
      decodeRunCode(code)
    } catch {
      entry.valid = false
      entry.visit = null // a broken code is only reported; it never replaces a good copy of its visit
    }
    entries.push(entry)
    pending = []
    visit = null
    gap = false
  })

  // Keep only the last entry for each visit id; count what was dropped.
  const lastFor = new Map()
  entries.forEach((e, idx) => {
    if (e.visit !== null) lastFor.set(e.visit, idx)
  })
  const droppedBefore = new Map()
  const kept = []
  entries.forEach((e, idx) => {
    if (e.visit !== null && lastFor.get(e.visit) !== idx) droppedBefore.set(e.visit, (droppedBefore.get(e.visit) ?? 0) + 1)
    else kept.push(e)
  })

  // Pass 2: print.
  const out = []
  let runCount = 0
  for (const e of kept) {
    const dropped = e.visit === null ? 0 : (droppedBefore.get(e.visit) ?? 0)
    if (dropped > 0) out.push(`dropped ${dropped} earlier ${dropped === 1 ? 'copy' : 'copies'} of visit ${e.visit}`)
    if (e.valid) {
      runCount += 1
      out.push(summaryLine(runCount, e.code, e.gap))
      for (const l of e.legs) out.push(`run ${runCount} leg ${l.n}: ${l.text}`)
    } else {
      out.push(`line ${e.line}: not a valid run code`)
      for (const l of e.legs) out.push(`leg ${l.n}: ${l.text}`)
    }
  }
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
