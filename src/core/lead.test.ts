import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS } from './settings.ts'
import { bestLead, estimateLead } from './lead.ts'
import { crosshairAt } from './throw.ts'
import type { ThrowCtx } from './types.ts'

const target = { x: 0, y: 1030 }
const ctxFor = (i: number): ThrowCtx => ({ seed: 99, throwIndex: i, settings: DEFAULT_SETTINGS, target })

/** The tick (0..399) where this dart's crosshair is closest to the target. */
function bestTick(ctx: ThrowCtx): number {
  let best = 0
  let bestD = Infinity
  for (let t = 0; t < 400; t++) {
    const p = crosshairAt(ctx, t)
    const d = Math.hypot(p.x - target.x, p.y - target.y)
    if (d < bestD) { bestD = d; best = t }
  }
  return best
}

describe('bestLead', () => {
  it('finds the lead a consistently late tapper needs', () => {
    const ctxs = Array.from({ length: 10 }, (_, i) => ctxFor(i))
    const rawMs = ctxs.map((c) => bestTick(c) * 8 + 40)
    const s = bestLead(ctxs, rawMs, target, 0)
    expect(s.usable).toBe(true)
    expect(Math.abs(s.leadMs - 40)).toBeLessThanOrEqual(8)
    expect(s.after).toBeLessThan(s.before)
    expect(s.gain).toBeGreaterThan(0.1)
  })
  it('is not usable with fewer than 8 darts', () => {
    const ctxs = Array.from({ length: 5 }, (_, i) => ctxFor(i))
    expect(bestLead(ctxs, ctxs.map(() => 500), target, 0).usable).toBe(false)
  })
  it('still finds a late tapper’s lead when the taps jitter by up to 10ms', () => {
    const ctxs = Array.from({ length: 12 }, (_, i) => ctxFor(i))
    const jitter = [10, -10, 4, -6, 0, 8, -2, -9, 6, 3, -4, 9]
    const rawMs = ctxs.map((c, i) => bestTick(c) * 8 + 40 + jitter[i])
    const s = bestLead(ctxs, rawMs, target, 0)
    expect(s.usable).toBe(true)
    expect(Math.abs(s.leadMs - 40)).toBeLessThanOrEqual(12)
  })
  it('keeps the current lead when changing it would not tighten the group by 10%', () => {
    const ctxs = Array.from({ length: 10 }, (_, i) => ctxFor(i))
    const rawMs = ctxs.map((c) => bestTick(c) * 8 + 20) // already perfect at a 20ms lead
    const s = bestLead(ctxs, rawMs, target, 20)
    expect(s.usable).toBe(false)
    expect(s.leadMs).toBe(20)
  })
  it('handles no darts at all', () => {
    expect(bestLead([], [], target, 36)).toEqual({ usable: false, leadMs: 36, before: 0, after: 0, gain: 0 })
  })
  it('returns the current lead (not a nearby grid value) whenever the suggestion is not usable', () => {
    for (const seedShift of [0, 50, 100]) {
      const ctxs = Array.from({ length: 10 }, (_, i) => ctxFor(i + seedShift))
      const rawMs = ctxs.map((c, i) => bestTick(c) * 8 + 30 + (i % 3) * 4) // near-perfect at 30-38ms
      const s = bestLead(ctxs, rawMs, target, 34)
      if (!s.usable) expect(s.leadMs).toBe(34)
    }
  })
})

describe('estimateLead', () => {
  it('takes the median and clamps', () => {
    expect(estimateLead([30, 50, 40, 400, 45])).toBe(45)
    expect(estimateLead([500, 600, 700])).toBe(150)
    expect(estimateLead([-500, -600, -700])).toBe(-150)
    expect(estimateLead([])).toBe(0)
  })
  it('never returns negative zero', () => {
    expect(Object.is(estimateLead([-0.4]), 0)).toBe(true)
    expect(Object.is(estimateLead([-1, 1]), 0)).toBe(true)
  })
})
