import { applyDart, newLeg } from './leg.ts'
import { resolveThrow } from './throw.ts'
import type { Point, Ring, RunLog } from './types.ts'

export interface ThrowOutcome {
  index: number
  leg: number
  crosshair: Point
  landing: Point
  ring: Ring
  sector: number
  score: number
  remaining: number
  bust: boolean
}
export interface LegSummary { darts: number; won: boolean; busts: number }
export interface ReplayResult { throws: ThrowOutcome[]; legs: LegSummary[] }

export function replayRun(log: RunLog): ReplayResult {
  const throws: ThrowOutcome[] = []
  const legs: LegSummary[] = []
  let leg = newLeg()
  let legIndex = 0
  log.throws.forEach((input, index) => {
    const result = resolveThrow({ seed: log.seed, throwIndex: index, settings: log.settings, target: input.target }, input.releaseTick)
    leg = applyDart(leg, result.bed)
    throws.push({
      index,
      leg: legIndex,
      crosshair: result.crosshair,
      landing: result.landing,
      ring: result.bed.ring,
      sector: result.bed.sector,
      score: result.bed.score,
      remaining: leg.remaining,
      bust: leg.lastBust,
    })
    if (leg.won) {
      legs.push({ darts: leg.dartsTotal, won: true, busts: leg.busts })
      leg = newLeg()
      legIndex += 1
    }
  })
  if (leg.dartsTotal > 0) legs.push({ darts: leg.dartsTotal, won: false, busts: leg.busts })
  return { throws, legs }
}

export function encodeRunCode(log: RunLog): string {
  return btoa(JSON.stringify(log)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeRunCode(code: string): RunLog {
  try {
    const padded = code.replace(/-/g, '+').replace(/_/g, '/')
    const parsed: unknown = JSON.parse(atob(padded + '='.repeat((4 - (padded.length % 4)) % 4)))
    const log = parsed as RunLog
    if (log.v !== 1 || typeof log.seed !== 'number' || !Array.isArray(log.throws) || typeof log.settings !== 'object') {
      throw new Error('shape')
    }
    return log
  } catch {
    throw new Error('Bad run code')
  }
}
