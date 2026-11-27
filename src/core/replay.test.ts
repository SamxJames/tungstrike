import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { bedCentre, makeBed } from './board.ts'
import { applyDart, newLeg } from './leg.ts'
import { DEFAULT_SETTINGS } from './settings.ts'
import { replayRun } from './replay.ts'
import { resolveThrow } from './throw.ts'
import type { RunLog, ThrowInput } from './types.ts'

/** Builds a log that finishes `legsWanted` legs by scanning for a release tick that lands in the bed we want. */
function finishingLog(legsWanted: number): RunLog {
  const settings = { ...DEFAULT_SETTINGS, scatterCap: 0, shape: 100 }
  const seed = 777
  const throws: ThrowInput[] = []
  let leg = newLeg()
  let won = 0
  while (won < legsWanted && throws.length < 400) {
    const r = leg.remaining
    const want =
      r > 100 ? makeBed('treble', 20)
      : r > 60 ? makeBed('innerSingle', 20)
      : r > 40 ? makeBed('innerSingle', r - 40)
      : r % 2 === 0 ? makeBed('double', r / 2)
      : makeBed('innerSingle', 1)
    const target = bedCentre(want)
    const index = throws.length
    let tick = 0
    for (let t = 0; t < 200; t++) {
      const b = resolveThrow({ seed, throwIndex: index, settings, target }, t).bed
      if (b.ring === want.ring && b.sector === want.sector) {
        tick = t
        break
      }
    }
    throws.push({ target, releaseTick: tick })
    leg = applyDart(leg, resolveThrow({ seed, throwIndex: index, settings, target }, tick).bed)
    if (leg.won) {
      won++
      leg = newLeg()
    }
  }
  return { v: 1, seed, settings, throws }
}

function sampleLog(n: number): RunLog {
  return {
    v: 1,
    seed: 12345,
    settings: DEFAULT_SETTINGS,
    throws: Array.from({ length: n }, (_, i) => ({ target: { x: 0, y: 1030 }, releaseTick: 20 + ((i * 37) % 160) })),
  }
}

describe('replayRun', () => {
  it('gives identical results every time', () => {
    expect(replayRun(sampleLog(40))).toEqual(replayRun(sampleLog(40)))
  })
  it('records one outcome per throw with running scores', () => {
    const r = replayRun(sampleLog(12))
    expect(r.throws).toHaveLength(12)
    expect(r.throws[0].index).toBe(0)
    expect(r.throws[0].remaining).toBe(501 - r.throws[0].score)
  })
  it('summarises the unfinished leg', () => {
    const r = replayRun(sampleLog(5))
    expect(r.legs).toHaveLength(1)
    expect(r.legs[0]).toMatchObject({ darts: 5, won: false })
  })
  it('starts a new leg after a win', () => {
    const r = replayRun(finishingLog(2))
    expect(r.legs).toHaveLength(2)
    expect(r.legs[0].won).toBe(true)
    expect(r.legs[1].won).toBe(true)
    expect(r.throws.at(-1)?.leg).toBe(1)
  })
  it('summarises each won leg with its own darts and busts', () => {
    const log = finishingLog(2)
    const r = replayRun(log)
    // Recount from the outcomes: darts per leg index, busts per leg index.
    for (const [i, summary] of r.legs.entries()) {
      const mine = r.throws.filter((t) => t.leg === i)
      expect(summary.darts).toBe(mine.length)
      expect(summary.busts).toBe(mine.filter((t) => t.bust).length)
      expect(mine.at(-1)!.remaining).toBe(0)
    }
    expect(r.legs.reduce((n, l) => n + l.darts, 0)).toBe(log.throws.length)
  })
  it('matches the committed legs golden file (won legs, a double finish, a miss, rawMs in the log)', () => {
    const golden = JSON.parse(readFileSync(new URL('../../tests/golden/replay-v1-legs.json', import.meta.url), 'utf8'))
    const r = replayRun(golden.log)
    expect(r).toEqual(golden.expected)
    expect(r.legs.filter((l) => l.won).length).toBeGreaterThanOrEqual(1)
    expect(r.throws.some((t) => t.ring === 'miss')).toBe(true)
    expect(r.throws.some((t) => t.ring === 'double')).toBe(true)
    expect(golden.log.throws.some((t: { rawMs?: number }) => t.rawMs !== undefined)).toBe(true)
  })
  it('matches the committed golden file (a change here means the run-log format needs a version bump)', () => {
    const golden = JSON.parse(readFileSync(new URL('../../tests/golden/replay-v1.json', import.meta.url), 'utf8'))
    expect(replayRun(golden.log)).toEqual(golden.expected)
  })
})
