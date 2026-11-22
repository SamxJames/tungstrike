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
