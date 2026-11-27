import { crosshairAt, releaseTickFor } from './throw.ts'
import type { Point, ThrowCtx } from './types.ts'

export const LEAD_MIN = -150
export const LEAD_MAX = 150
export const LEAD_STEP = 4

export interface LeadSuggestion { usable: boolean; leadMs: number; before: number; after: number; gain: number }

function meanAimError(ctxs: ThrowCtx[], rawMs: number[], target: Point, leadMs: number): number {
  let sum = 0
  ctxs.forEach((ctx, i) => {
    const p = crosshairAt(ctx, releaseTickFor(rawMs[i], leadMs))
    sum += Math.hypot(p.x - target.x, p.y - target.y)
  })
  return sum / ctxs.length
}

export function bestLead(ctxs: ThrowCtx[], rawMs: number[], target: Point, currentLeadMs: number): LeadSuggestion {
  const before = ctxs.length === 0 ? 0 : meanAimError(ctxs, rawMs, target, currentLeadMs)
  if (ctxs.length < 8) return { usable: false, leadMs: currentLeadMs, before, after: before, gain: 0 }
  let bestLeadMs = currentLeadMs
  let best = before
  for (let lead = LEAD_MIN; lead <= LEAD_MAX; lead += LEAD_STEP) {
    const e = meanAimError(ctxs, rawMs, target, lead)
    if (e < best - 1e-9 || (Math.abs(e - best) <= 1e-9 && Math.abs(lead - currentLeadMs) < Math.abs(bestLeadMs - currentLeadMs))) {
      best = e
      bestLeadMs = lead
    }
  }
  const gain = before === 0 ? 0 : (before - best) / before
  const usable = gain >= 0.1
  // A suggestion that is not worth taking leaves the lead where it is.
  return { usable, leadMs: usable ? bestLeadMs : currentLeadMs, before, after: best, gain }
}

export function estimateLead(errorsMs: number[]): number {
  if (errorsMs.length === 0) return 0
  const sorted = [...errorsMs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  // + 0 normalises -0 (Math.round of a small negative) so the result serialises and compares as 0.
  return Math.min(LEAD_MAX, Math.max(LEAD_MIN, Math.round(median))) + 0
}
