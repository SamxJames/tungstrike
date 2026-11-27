import { bedAt } from './board.ts'
import { UNITS_PER_TREBLE_WIDTH } from './constants.ts'
import { replayRun } from './replay.ts'
import type { RunLog } from './types.ts'

export interface RunSummary {
  throws: number
  legsStarted: number
  legsWon: number
  dartsPerWonLeg: number | null
  busts: number
  hitRate: number
  meanMissTrebleWidths: number
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
  return {
    throws: n,
    legsStarted: r.legs.length,
    legsWon: won.length,
    dartsPerWonLeg: won.length === 0 ? null : won.reduce((s, l) => s + l.darts, 0) / won.length,
    busts: r.legs.reduce((s, l) => s + l.busts, 0),
    hitRate: n === 0 ? 0 : hits / n,
    meanMissTrebleWidths: n === 0 ? 0 : missUnits / n / UNITS_PER_TREBLE_WIDTH,
  }
}
