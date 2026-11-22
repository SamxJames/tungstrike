import { applyDart, newLeg } from './leg.ts'
import { clampSettings } from './settings.ts'
import { resolveThrow } from './throw.ts'
import type { Point, Ring, RunLog, Settings, ThrowInput } from './types.ts'

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

const MAX_THROWS = 5000
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isInt = (v: unknown): v is number => isNum(v) && Number.isInteger(v)
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Read one throw, keeping only the known fields. Adding 0 turns -0 into 0 so equal logs compare and serialise the same. */
function readThrow(raw: unknown): ThrowInput {
  if (!isObject(raw) || !isObject(raw.target)) throw new Error('shape')
  const { x, y } = raw.target
  if (!isInt(x) || !isInt(y) || !isInt(raw.releaseTick) || raw.releaseTick < 0) throw new Error('shape')
  const out: ThrowInput = { target: { x: x + 0, y: y + 0 }, releaseTick: raw.releaseTick + 0 }
  if (raw.rawMs !== undefined) {
    if (!isNum(raw.rawMs)) throw new Error('shape')
    out.rawMs = raw.rawMs + 0
  }
  return out
}

/**
 * Turn a pasted run code back into a log. Accepts URL-safe or standard base64 with surrounding whitespace, checks the
 * shape, clamps settings into their ranges and drops unknown fields. Anything else throws 'Bad run code'.
 */
export function decodeRunCode(code: string): RunLog {
  try {
    const padded = code.trim().replace(/-/g, '+').replace(/_/g, '/')
    const parsed: unknown = JSON.parse(atob(padded + '='.repeat((4 - (padded.length % 4)) % 4)))
    if (!isObject(parsed) || parsed.v !== 1 || !isInt(parsed.seed) || !isObject(parsed.settings) || !Array.isArray(parsed.throws)) {
      throw new Error('shape')
    }
    if (parsed.throws.length > MAX_THROWS || !Object.values(parsed.settings).every(isNum)) throw new Error('shape')
    return {
      v: 1,
      seed: parsed.seed + 0,
      settings: clampSettings(parsed.settings as Partial<Settings>),
      throws: (parsed.throws as unknown[]).map(readThrow),
    }
  } catch {
    throw new Error('Bad run code')
  }
}
