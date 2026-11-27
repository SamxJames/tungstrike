import { describe, it, expect } from 'vitest'
import { bedAt, bedCentre, makeBed } from './board.ts'
import { DEFAULT_SETTINGS } from './settings.ts'
import { aimStats, summariseRun, turnStats } from './analysis.ts'
import type { ThrowOutcome } from './replay.ts'
import type { Point, RunLog } from './types.ts'

describe('summariseRun', () => {
  it('summarises legs, busts and aim', () => {
    const log: RunLog = {
      v: 1, seed: 5, settings: DEFAULT_SETTINGS,
      throws: Array.from({ length: 300 }, (_, i) => ({ target: { x: 0, y: 0 }, releaseTick: i % 150 })),
    }
    const s = summariseRun(log)
    expect(s.throws).toBe(300)
    expect(s.legsStarted).toBeGreaterThanOrEqual(1)
    expect(s.hitRate).toBeGreaterThanOrEqual(0)
    expect(s.hitRate).toBeLessThanOrEqual(1)
    expect(s.meanMissTrebleWidths).toBeGreaterThan(0)
  })
  it('handles an empty log', () => {
    const s = summariseRun({ v: 1, seed: 1, settings: DEFAULT_SETTINGS, throws: [] })
    expect(s).toMatchObject({ throws: 0, legsStarted: 0, legsWon: 0, dartsPerWonLeg: null })
  })
  it('has null for every new rate when there is nothing to measure', () => {
    const s = summariseRun({ v: 1, seed: 1, settings: DEFAULT_SETTINGS, throws: [] })
    expect(s).toMatchObject({
      misses: 0, timingMissShare: null, aimedAtT20: 0, t20Rate: null, in20Rate: null, near20Rate: null, turns: 0, threeDartAverage: null,
    })
  })
  it('with no scatter every miss is a timing miss, and the T20 rates only look at darts aimed at T20', () => {
    const t20 = bedCentre(makeBed('treble', 20))
    const log: RunLog = {
      v: 1, seed: 11, settings: { ...DEFAULT_SETTINGS, scatterCap: 0 },
      throws: [
        ...Array.from({ length: 90 }, (_, i) => ({ target: t20, releaseTick: i * 3 })),
        ...Array.from({ length: 10 }, (_, i) => ({ target: { x: 0, y: 0 }, releaseTick: i })),
      ],
    }
    const s = summariseRun(log)
    expect(s.aimedAtT20).toBe(90)
    expect(s.misses).toBeGreaterThan(0)
    expect(s.timingMissShare).toBe(1)
    expect(s.t20Rate).toBeGreaterThan(0)
    expect(s.t20Rate).toBeLessThan(1)
    expect(s.in20Rate).toBeGreaterThanOrEqual(s.t20Rate!)
    expect(s.near20Rate).toBeGreaterThanOrEqual(s.in20Rate!)
    for (const v of Object.values(s)) if (typeof v === 'number') expect(Object.is(v, -0)).toBe(false)
  })
  it('agrees with an independent count over a real replay with scatter', () => {
    const t20 = bedCentre(makeBed('treble', 20))
    const log: RunLog = {
      v: 1, seed: 21, settings: DEFAULT_SETTINGS,
      throws: Array.from({ length: 200 }, (_, i) => ({ target: t20, releaseTick: (i * 7) % 200 })),
    }
    const s = summariseRun(log)
    expect(s.aimedAtT20).toBe(200)
    expect(s.timingMissShare).not.toBeNull()
    expect(s.timingMissShare!).toBeGreaterThanOrEqual(0)
    expect(s.timingMissShare!).toBeLessThanOrEqual(1)
    // Every dart was aimed at T20, so the hit rate is the T20 rate, and the misses are the rest.
    expect(s.t20Rate).toBeCloseTo(s.hitRate, 12)
    expect(s.misses).toBe(Math.round(200 * (1 - s.hitRate)))
  })
})

/** Build the outcome of one dart from where the crosshair was and where the dart landed. */
function outcome(index: number, leg: number, crosshair: Point, landing: Point, remaining: number, bust = false): ThrowOutcome {
  const bed = bedAt(landing)
  return { index, leg, crosshair, landing, ring: bed.ring, sector: bed.sector, score: bed.score, remaining, bust }
}
const centre = (ring: Parameters<typeof makeBed>[0], sector: number) => bedCentre(makeBed(ring, sector))
const T20 = centre('treble', 20)

describe('aimStats', () => {
  it('splits misses into timing (crosshair already outside the target bed) and scatter (crosshair inside it)', () => {
    const throws = [
      outcome(0, 0, T20, T20, 441), // hit
      outcome(1, 0, T20, centre('outerSingle', 20), 421), // scatter miss: crosshair inside T20, dart outside
      outcome(2, 0, centre('outerSingle', 20), centre('outerSingle', 20), 401), // timing miss
      outcome(3, 0, centre('innerSingle', 1), T20, 341), // lucky hit: not a miss at all
      outcome(4, 0, centre('outerSingle', 5), centre('innerSingle', 5), 336), // timing miss
    ]
    const a = aimStats(throws, throws.map(() => T20))
    expect(a.misses).toBe(3)
    expect(a.timingMissShare).toBeCloseTo(2 / 3, 12)
  })
  it('has no timing share when there are no misses', () => {
    const a = aimStats([outcome(0, 0, T20, T20, 441)], [T20])
    expect(a).toMatchObject({ misses: 0, timingMissShare: null })
  })
  it('measures T20, in-20 and near-20 (20, 1, 5) landing rates over the darts aimed at T20 only', () => {
    const bull = { x: 0, y: 0 }
    const throws = [
      outcome(0, 0, T20, T20, 441), // T20
      outcome(1, 0, T20, centre('outerSingle', 20), 421), // S20: in the 20 wedge
      outcome(2, 0, T20, centre('outerSingle', 1), 420), // S1: near
      outcome(3, 0, T20, centre('innerSingle', 5), 415), // S5: near
      outcome(4, 0, T20, centre('outerSingle', 18), 397), // S18: none
      outcome(5, 0, bull, T20, 337), // aimed at the bull: left out of the T20 rates
    ]
    const targets = [T20, T20, T20, T20, T20, bull]
    const a = aimStats(throws, targets)
    expect(a.aimedAtT20).toBe(5)
    expect(a.t20Rate).toBeCloseTo(1 / 5, 12)
    expect(a.in20Rate).toBeCloseTo(2 / 5, 12)
    expect(a.near20Rate).toBeCloseTo(4 / 5, 12)
  })
  it('has null T20 rates when no dart was aimed at T20', () => {
    const a = aimStats([outcome(0, 0, { x: 0, y: 0 }, T20, 441)], [{ x: 0, y: 0 }])
    expect(a).toMatchObject({ aimedAtT20: 0, t20Rate: null, in20Rate: null, near20Rate: null })
  })
})

describe('turnStats (three-dart average)', () => {
  // A turn is three darts, or fewer if it ends early in a bust or a checkout. A bust turn scores nothing but still
  // counts as a turn. A trailing turn that has not finished yet is left out, so a run stopped mid-turn is not dragged down.
  const dart = (index: number, leg: number, ring: 'treble' | 'innerSingle', sector: number, remaining: number, bust = false) =>
    outcome(index, leg, T20, centre(ring, sector), remaining, bust)

  it('averages completed turns, counting a bust turn as nothing and leaving out the unfinished trailing turn', () => {
    const throws = [
      dart(0, 0, 'treble', 20, 441), dart(1, 0, 'treble', 20, 381), dart(2, 0, 'treble', 20, 321), // 60 x 3 = 180
      dart(3, 0, 'treble', 20, 261), dart(4, 0, 'treble', 20, 321, true), // bust: back to 321, ends the turn
      dart(5, 0, 'innerSingle', 20, 301), dart(6, 0, 'innerSingle', 20, 281), // unfinished
    ]
    expect(turnStats(throws)).toEqual({ turns: 2, points: 180, average: 90 })
  })
  it('counts a checkout turn that ended early, and starts afresh for the next leg', () => {
    const throws = [
      dart(0, 0, 'treble', 20, 60), dart(1, 0, 'treble', 20, 0), // checkout after two darts: 120 points in that turn
      dart(2, 1, 'innerSingle', 20, 481), dart(3, 1, 'innerSingle', 20, 461), dart(4, 1, 'innerSingle', 20, 441), // 60
    ]
    expect(turnStats(throws)).toEqual({ turns: 2, points: 180, average: 90 })
  })
  it('has no average before the first turn is complete', () => {
    expect(turnStats([])).toEqual({ turns: 0, points: 0, average: null })
    expect(turnStats([dart(0, 0, 'treble', 20, 441), dart(1, 0, 'treble', 20, 381)])).toEqual({ turns: 0, points: 0, average: null })
  })
})
