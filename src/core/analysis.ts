import { bedAt } from './board.ts'
import { DARTS_PER_TURN, UNITS_PER_TREBLE_WIDTH } from './constants.ts'
import { replayRun } from './replay.ts'
import type { ThrowOutcome } from './replay.ts'
import type { Point, RunLog } from './types.ts'

export interface RunSummary {
  throws: number
  legsStarted: number
  legsWon: number
  dartsPerWonLeg: number | null
  busts: number
  hitRate: number
  meanMissTrebleWidths: number
  /** Darts that did not land in the bed they were aimed at. */
  misses: number
  /** Share of misses where the crosshair was already outside the target bed at release; the rest are scatter. Null with no misses. */
  timingMissShare: number | null
  /** Darts aimed at the treble 20. */
  aimedAtT20: number
  /** Of the darts aimed at T20: share landing in T20, in any part of the 20 wedge, and in the 20, 1 or 5 wedge. Null when none were aimed at T20. */
  t20Rate: number | null
  in20Rate: number | null
  near20Rate: number | null
  /** Completed 3-dart turns, and the three-dart average over them (see `turnStats`). Null before the first completed turn. */
  turns: number
  threeDartAverage: number | null
}

export interface AimStats {
  misses: number
  timingMissShare: number | null
  aimedAtT20: number
  t20Rate: number | null
  in20Rate: number | null
  near20Rate: number | null
}

const isT20 = (b: { ring: string; sector: number }) => b.ring === 'treble' && b.sector === 20

/**
 * Timing versus scatter, and the T20 landing rates. `targets[i]` is where dart i was aimed (from the run log).
 * A miss is a dart that did not land in its target's bed (same ring and sector). A timing miss is a miss whose crosshair
 * was already outside the target bed at release; a scatter miss had the crosshair inside the bed and the scatter pushed
 * the dart out. The T20 rates use only the darts aimed at the treble 20: T20 is the treble 20, "in 20" is any ring of
 * the 20 wedge, "near 20" is the 20, 1 or 5 wedge.
 */
export function aimStats(throws: ThrowOutcome[], targets: Point[]): AimStats {
  let misses = 0
  let timingMisses = 0
  let aimed = 0
  let t20 = 0
  let in20 = 0
  let near20 = 0
  throws.forEach((t, i) => {
    const targetBed = bedAt(targets[i])
    if (t.ring !== targetBed.ring || t.sector !== targetBed.sector) {
      misses++
      const c = bedAt(t.crosshair)
      if (c.ring !== targetBed.ring || c.sector !== targetBed.sector) timingMisses++
    }
    if (isT20(targetBed)) {
      aimed++
      if (isT20(t)) t20++
      if (t.sector === 20) in20++
      if (t.sector === 20 || t.sector === 1 || t.sector === 5) near20++
    }
  })
  return {
    misses,
    timingMissShare: misses === 0 ? null : timingMisses / misses,
    aimedAtT20: aimed,
    t20Rate: aimed === 0 ? null : t20 / aimed,
    in20Rate: aimed === 0 ? null : in20 / aimed,
    near20Rate: aimed === 0 ? null : near20 / aimed,
  }
}

/**
 * Three-dart average. A turn is three darts, or fewer when it ends early in a bust or a checkout. The average is the
 * points scored in turns that did not bust divided by the number of completed turns, so a bust turn counts as a turn
 * that scored nothing. A turn that has not finished when the run stops (fewer than three darts, no bust, no checkout)
 * is left out, so stopping mid-turn does not drag the average down. Null before the first completed turn.
 */
export function turnStats(throws: ThrowOutcome[]): { turns: number; points: number; average: number | null } {
  let turns = 0
  let points = 0
  let turnPoints = 0
  let darts = 0
  let leg = -1
  for (const t of throws) {
    if (t.leg !== leg) {
      leg = t.leg
      turnPoints = 0
      darts = 0
    }
    darts++
    turnPoints += t.score
    const checkout = t.remaining === 0 && !t.bust
    if (t.bust || checkout || darts === DARTS_PER_TURN) {
      turns++
      if (!t.bust) points += turnPoints
      turnPoints = 0
      darts = 0
    }
  }
  return { turns, points, average: turns === 0 ? null : points / turns }
}

export function summariseRun(log: RunLog): RunSummary {
  const r = replayRun(log)
  const won = r.legs.filter((l) => l.won)
  let hits = 0
  let missUnits = 0
  r.throws.forEach((t, i) => {
    const target = log.throws[i].target
    const targetBed = bedAt(target)
    const landedBed = { ring: t.ring, sector: t.sector }
    if (landedBed.ring === targetBed.ring && landedBed.sector === targetBed.sector) hits++
    missUnits += Math.hypot(t.landing.x - target.x, t.landing.y - target.y)
  })
  const n = r.throws.length
  const aim = aimStats(r.throws, log.throws.map((t) => t.target))
  const turn = turnStats(r.throws)
  return {
    throws: n,
    legsStarted: r.legs.length,
    legsWon: won.length,
    dartsPerWonLeg: won.length === 0 ? null : won.reduce((s, l) => s + l.darts, 0) / won.length,
    busts: r.legs.reduce((s, l) => s + l.busts, 0),
    hitRate: n === 0 ? 0 : hits / n,
    meanMissTrebleWidths: n === 0 ? 0 : missUnits / n / UNITS_PER_TREBLE_WIDTH,
    ...aim,
    turns: turn.turns,
    threeDartAverage: turn.average,
  }
}
