import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_SETTINGS } from '../src/core/settings.ts'
import { bedCentre, makeBed } from '../src/core/board.ts'
import { summariseRun } from '../src/core/analysis.ts'
import { decodeRunCode, encodeRunCode } from '../src/core/replay.ts'
import { resultsText } from '../src/ui/feedback.ts'
import type { LegRecord, ResultsPayload } from '../src/ui/feedback.ts'
import { analyse } from './analyse-runs.mjs'

const code = encodeRunCode({
  v: 1,
  seed: 3,
  settings: DEFAULT_SETTINGS,
  throws: Array.from({ length: 60 }, (_, i) => ({ target: { x: 0, y: 0 }, releaseTick: i % 100 })),
})

const leg = (over: Partial<LegRecord>): LegRecord => ({
  darts: 21,
  busts: 1,
  won: true,
  rating: 'mostly',
  build: 'abc1234',
  settingsKey: '#v1&rad=25;lead=60',
  visit: 'visit9',
  startThrow: 0,
  ...over,
})
const payload = (over: Partial<ResultsPayload>): ResultsPayload => ({
  v: 1,
  build: 'abc1234',
  visit: 'visit9',
  device: 'Pixel 8, Chrome',
  settings: DEFAULT_SETTINGS,
  legs: [],
  run: code,
  warmup: null,
  earlier: [],
  ...over,
})

describe('analyse', () => {
  it('summarises a plain run code', () => {
    const lines = analyse(code)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('run 1:')
    expect(lines[0]).toContain('throws 60')
    expect(lines[0]).toContain('legs started')
  })

  it('summarises the Run code line of a real pasted results message, skipping everything else', () => {
    const text = resultsText(
      payload({
        legs: [leg({}), leg({ rating: 'rarely', won: false, startThrow: 21 })],
        warmup: 'WARMUPCODE',
      }),
    )
    const lines = analyse(text)
    const runLines = lines.filter((l) => /^run \d+:/.test(l))
    expect(runLines).toHaveLength(1)
    expect(runLines[0]).toContain('throws 60')
    expect(lines.some((l) => l.includes('not a valid run code'))).toBe(false)
  })

  it('handles a pasted message with no legs finished yet', () => {
    const lines = analyse(resultsText(payload({ legs: [], warmup: 'WARMUPCODE' })))
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('throws 60')
  })

  it('adds one line per rated leg when the pasted text has ratings', () => {
    const text = resultsText(payload({ legs: [leg({ rating: 'mostly' }), leg({ rating: null }), leg({ rating: 'rarely', won: false })] }))
    const lines = analyse(text)
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('throws 60')
    expect(lines[1]).toBe('run 1 leg 1: 21 darts, won, landed where aimed: mostly')
    expect(lines[2]).toBe('run 1 leg 3: 21 darts, not finished, landed where aimed: rarely')
  })

  it('lists each visit’s rated legs right after that visit’s run, in a multi-visit message', () => {
    const code2 = encodeRunCode({ v: 1, seed: 4, settings: DEFAULT_SETTINGS, throws: [{ target: { x: 0, y: 0 }, releaseTick: 3 }] })
    const text = resultsText(
      payload({
        legs: [leg({ rating: 'mostly' })],
        earlier: [{ visit: 'old1', startedAt: 0, run: code2, warmup: null, legs: [leg({ visit: 'old1', rating: 'rarely', darts: 40 })] }],
      }),
    )
    expect(analyse(text)).toEqual([
      expect.stringContaining('run 1: throws 60'),
      'run 1 leg 1: 21 darts, won, landed where aimed: mostly',
      expect.stringContaining('run 2: throws 1'),
      'run 2 leg 1: 40 darts, won, landed where aimed: rarely',
    ])
  })

  it('finds the run code in a pasted share link', () => {
    const lines = analyse(`https://example.app/lab#v1&rad=25&loop=1600&run=${code}\nsee ${'https://x.app/lab?run=' + code}&zm=200`)
    expect(lines.filter((l) => /^run \d+:/.test(l))).toHaveLength(2)
    expect(lines[0]).toContain('throws 60')
  })

  it('handles several pasted messages and bare codes together', () => {
    const lines = analyse(`${resultsText(payload({}))}\n\n${code}\n`)
    expect(lines.filter((l) => /^run \d+:/.test(l))).toHaveLength(2)
    expect(lines[1]).toContain('run 2:')
  })

  it('flags junk without stopping, using real line numbers', () => {
    const lines = analyse(`\nnonsense\n${code}\nabc123\nRun code: nope!\nsome prose here\nRun code:\n`)
    expect(lines).toEqual([
      'line 2: not a valid run code',
      expect.stringContaining('run 1:'),
      'line 4: not a valid run code',
      'line 5: not a valid run code',
      'line 7: not a valid run code',
    ])
  })

  it('accepts a code with surrounding whitespace and CRLF line endings', () => {
    const lines = analyse(`  ${code}  \r\nRun code: ${code}\r\n`)
    expect(lines.filter((l) => /^run \d+:/.test(l))).toHaveLength(2)
  })

  it('returns nothing for empty or prose-only input', () => {
    expect(analyse('')).toEqual([])
    expect(analyse('  \n\n \r\n')).toEqual([])
    expect(analyse('Device: x\nVisit: y\nLeg 1: a b c\nWarm-up code: ABC\nNo legs finished yet')).toEqual([])
  })
})

/** A run code with `n` darts, all aimed at the treble 20 with no scatter (every miss is a timing miss). */
const t20Code = (n: number, seed = 5) =>
  encodeRunCode({
    v: 1,
    seed,
    settings: { ...DEFAULT_SETTINGS, scatterCap: 0 },
    throws: Array.from({ length: n }, (_, i) => ({ target: bedCentre(makeBed('treble', 20)), releaseTick: (i * 3) % 150 })),
  })

describe('analyse: the same visit copied more than once', () => {
  // Copies are cumulative: each later copy of a visit holds every earlier dart plus more.
  const copy1 = resultsText(payload({ run: t20Code(20), legs: [leg({ darts: 11 })] }))
  const copy2 = resultsText(payload({ run: t20Code(40), legs: [leg({ darts: 11 }), leg({ darts: 15, startThrow: 11 })] }))
  const copy3 = resultsText(payload({ run: t20Code(60), legs: [leg({ darts: 11 }), leg({ darts: 15, startThrow: 11 }), leg({ darts: 34, won: false, startThrow: 26 })] }))
  const runLines = (lines: string[]) => lines.filter((l) => /^run \d+:/.test(l))

  it('analyses only the last copy of a visit, so legs and darts are not counted twice, and says what it dropped', () => {
    const lines = analyse([copy1, copy2, copy3].join('\n\n'))
    expect(runLines(lines)).toHaveLength(1)
    expect(runLines(lines)[0]).toContain('throws 60')
    expect(lines.filter((l) => /^run 1 leg \d+:/.test(l))).toEqual([
      'run 1 leg 1: 11 darts, won, landed where aimed: mostly',
      'run 1 leg 2: 15 darts, won, landed where aimed: mostly',
      'run 1 leg 3: 34 darts, not finished, landed where aimed: mostly',
    ])
    expect(lines).toContain('dropped 2 earlier copies of visit visit9')
  })
  it('says copy, not copies, for one dropped copy, and does not mention drops when there are none', () => {
    expect(analyse([copy1, copy2].join('\n'))).toContain('dropped 1 earlier copy of visit visit9')
    expect(analyse(copy3).some((l) => l.startsWith('dropped'))).toBe(false)
  })
  it('keeps different visits apart, and de-duplicates earlier-visit blocks too', () => {
    const early = (run: string) => ({ visit: 'old1', startedAt: 0, run, warmup: null, legs: [leg({ visit: 'old1', darts: 40 })] })
    const first = resultsText(payload({ run: t20Code(20), earlier: [early(t20Code(5, 8))] }))
    const second = resultsText(payload({ run: t20Code(40), earlier: [early(t20Code(9, 8))] }))
    const other = resultsText(payload({ visit: 'visit8', run: t20Code(7, 9) }))
    const lines = analyse([first, other, second].join('\n'))
    expect(runLines(lines)).toEqual([
      expect.stringContaining('run 1: throws 7,'),
      expect.stringContaining('run 2: throws 40,'),
      expect.stringContaining('run 3: throws 9,'),
    ])
    expect(lines).toContain('dropped 1 earlier copy of visit visit9')
    expect(lines).toContain('dropped 1 earlier copy of visit old1')
    expect(lines.some((l) => l.includes('visit8') && l.startsWith('dropped'))).toBe(false)
    expect(lines.filter((l) => /^run 3 leg/.test(l))).toEqual(['run 3 leg 1: 40 darts, won, landed where aimed: mostly'])
  })
  it('keeps the fullest copy when copies are pasted out of order, and the later one on a tie', () => {
    const lines = analyse([copy3, copy1, copy2].join('\n\n'))
    expect(runLines(lines)).toHaveLength(1)
    expect(runLines(lines)[0]).toContain('throws 60')
    expect(lines).toContain('dropped 2 earlier copies of visit visit9')
    const tie = analyse([copy2, copy2.replace('visit9', 'visit9')].join('\n\n'))
    expect(runLines(tie)).toHaveLength(1)
    expect(tie).toContain('dropped 1 earlier copy of visit visit9')
  })
  it('de-duplicates copies with CRLF line endings', () => {
    const lines = analyse([copy1, copy2, copy3].join('\r\n\r\n').replace(/\n(?!\r)/g, '\r\n'))
    expect(runLines(lines)).toHaveLength(1)
    expect(runLines(lines)[0]).toContain('throws 60')
    expect(lines).toContain('dropped 2 earlier copies of visit visit9')
  })
  it('never drops a bare code or share link, even when the same code is pasted twice', () => {
    expect(runLines(analyse(`${code}\n${code}`))).toHaveLength(2)
  })
})

describe('analyse: what each run line reports', () => {
  const runLine = (text: string) => analyse(text).find((l) => l.startsWith('run 1:'))!

  it('prints the timing share, T20 rate, in-20 and near-20 rates and the three-dart average', () => {
    const s = summariseRun(decodeRunCode(t20Code(90)))
    const pct = (v: number | null) => (v === null ? 'n/a' : `${(v * 100).toFixed(0)}%`)
    const line = runLine(t20Code(90))
    expect(line).toContain(`timing ${pct(s.timingMissShare)} of ${s.misses} misses`)
    expect(line).toContain(`T20 ${pct(s.t20Rate)} of ${s.aimedAtT20} aimed`)
    expect(line).toContain(`in 20 ${pct(s.in20Rate)}`)
    expect(line).toContain(`near 20 ${pct(s.near20Rate)}`)
    expect(line).toContain(`per-turn avg ${s.threeDartAverage === null ? 'n/a' : s.threeDartAverage.toFixed(1)} over ${s.turns} turns`)
    expect(line).toContain('timing 100% of')
  })
  it('says n/a rather than NaN when there is nothing to measure', () => {
    const line = runLine(encodeRunCode({ v: 1, seed: 1, settings: DEFAULT_SETTINGS, throws: [] }))
    expect(line).toContain('timing n/a of 0 misses')
    expect(line).toContain('T20 n/a of 0 aimed')
    expect(line).toContain('per-turn avg n/a over 0 turns')
    expect(line).not.toContain('NaN')
  })
  it('echoes a log gap on the run line of the visit it belongs to, current or earlier', () => {
    const text = resultsText(
      payload({
        logGap: true,
        earlier: [
          { visit: 'old1', startedAt: 0, run: code, warmup: null, legs: [], logGap: true },
          { visit: 'old2', startedAt: 0, run: code, warmup: null, legs: [] },
        ],
      }),
    )
    const runs = analyse(text).filter((l) => /^run \d+:/.test(l))
    expect(runs).toHaveLength(3)
    expect(runs[0]).toContain('log gap detected')
    expect(runs[1]).toContain('log gap detected')
    expect(runs[2]).not.toContain('log gap')
  })
  it('still understands the gap line an earlier build printed', () => {
    const text = resultsText(payload({})).replace('Device: Pixel 8, Chrome', 'Device: Pixel 8, Chrome\nThrow log has a gap: this run code may not replay every dart.')
    expect(runLine(text)).toContain('log gap detected')
  })
})

describe('analyse-runs CLI', () => {
  const script = join(import.meta.dirname, 'analyse-runs.mjs')

  it('prints a usage error without arguments', () => {
    const r = spawnSync(process.execPath, [script], { encoding: 'utf8' })
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('Usage')
    expect(r.stderr).toContain('Node 22.18')
  })

  it('analyses a file', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'analyse-')), 'results.txt')
    writeFileSync(file, `Run code: ${code}\n`)
    const out = execFileSync(process.execPath, [script, file], { encoding: 'utf8' })
    expect(out).toContain('throws 60')
  })
})
