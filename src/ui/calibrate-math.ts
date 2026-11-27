import { UNITS_PER_TREBLE_WIDTH } from '../core/constants.ts'
import type { LeadSuggestion } from '../core/lead.ts'

export const CYCLE_MS = 1000
export const CROSS_MS = 500
const LEAD_MIN = -150
const LEAD_MAX = 150
const LEAD_STEP = 4

/** Left edge (px) of the moving bar. At phase 0.5 the bar's centre is the track's centre (the white line). */
export function barLeftPx(phase: number, trackPx: number, barPx: number): number {
  return phase * Math.max(0, trackPx - barPx)
}

/** Signed offset (ms) of a tap from the nearest crossing: late is positive, early is negative. */
export function tapError(tapMs: number, startMs: number): number {
  const since = tapMs - startMs - CROSS_MS
  return since - Math.round(since / CYCLE_MS) * CYCLE_MS + 0
}

/**
 * Words for a lead suggestion. Late/early comes from the change against the current lead (more lead means the taps
 * ran late), and the group line is the one the Lab report shows.
 */
export function leadAdvice(s: LeadSuggestion, currentLeadMs: number): { direction: 'late' | 'early'; group: string } {
  const tw = (u: number) => (u / UNITS_PER_TREBLE_WIDTH).toFixed(1)
  return {
    direction: s.leadMs - currentLeadMs >= 0 ? 'late' : 'early',
    group: `Group ${tw(s.before)} → ${tw(s.after)} treble widths with ${s.leadMs >= 0 ? '+' : ''}${s.leadMs} ms.`,
  }
}

/** Snap a lead to the Lab slider's grid (min -150, step 4) and clamp to its range. */
export function snapLead(ms: number, min = LEAD_MIN, step = LEAD_STEP, max = LEAD_MAX): number {
  const snapped = min + Math.round((ms - min) / step) * step
  return Math.min(max, Math.max(min, snapped)) + 0
}
