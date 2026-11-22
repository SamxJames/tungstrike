import { applyDart, newLeg } from '../core/leg.ts'
import type { LegState } from '../core/leg.ts'
import type { Bed } from '../core/types.ts'
import type { LegRecord, Rating } from './feedback.ts'

/** The play-flow state of the leg screen, kept pure so the win -> rating -> another-leg path is unit-tested. */
export interface LegFlow {
  leg: LegState
  /** True from the moment the leg is won until it is rated (exactly once per won leg). */
  awaitingRating: boolean
  /** Finished legs: earlier visits (from storage) first, then this visit's. */
  legs: LegRecord[]
  /** Index in the run log where the current leg began. */
  legStartThrow: number
  /** Darts thrown so far this visit (every dart is in the run log, whether or not the leg counted it). */
  throwsInLog: number
}

export interface LegMeta { build: string; settingsKey: string; visit: string }

export function initFlow(legs: LegRecord[]): LegFlow {
  return { leg: newLeg(), awaitingRating: false, legs, legStartThrow: 0, throwsInLog: 0 }
}

/** A dart landed. The leg ignores darts once won; the log position still advances because the throw is in the log. */
export function onDart(s: LegFlow, bed: Bed): LegFlow {
  const leg = applyDart(s.leg, bed)
  return { ...s, leg, awaitingRating: s.awaitingRating || (leg.won && !s.leg.won), throwsInLog: s.throwsInLog + 1 }
}

/** Record the rating for the won leg. A no-op unless a rating is pending, so a double tap records one entry. */
export function rate(s: LegFlow, rating: Rating, meta: LegMeta): LegFlow {
  if (!s.awaitingRating) return s
  const record: LegRecord = { darts: s.leg.dartsTotal, busts: s.leg.busts, won: true, rating, ...meta, startThrow: s.legStartThrow }
  return { ...s, awaitingRating: false, legs: [...s.legs, record] }
}

/** Start a fresh leg, keeping the legs so far and noting where in the log it begins. */
export function another(s: LegFlow): LegFlow {
  return { ...s, leg: newLeg(), awaitingRating: false, legStartThrow: s.throwsInLog }
}
