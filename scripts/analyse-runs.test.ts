import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_SETTINGS } from '../src/core/settings.ts'
import { encodeRunCode } from '../src/core/replay.ts'
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
