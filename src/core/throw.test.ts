import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS } from './settings.ts'
import { UNITS_PER_TREBLE_WIDTH } from './constants.ts'
import { crosshairAt, releaseTickFor, resolveThrow, scatterFor } from './throw.ts'
import type { ThrowCtx } from './types.ts'

const ctx = (over: Partial<ThrowCtx> = {}, settings = DEFAULT_SETTINGS): ThrowCtx => ({
  seed: 1234, throwIndex: 0, settings, target: { x: 0, y: 1030 }, ...over,
})

describe('releaseTickFor', () => {
  it('subtracts lead, floors to 8ms ticks and never goes below 0', () => {
    expect(releaseTickFor(1000, 60)).toBe(117)
    expect(releaseTickFor(10, 60)).toBe(0)
    expect(releaseTickFor(1000, -40)).toBe(130)
  })
})

describe('crosshairAt', () => {
  it('is deterministic and loops after one loop time', () => {
    const c = ctx()
    expect(crosshairAt(c, 37)).toEqual(crosshairAt(c, 37))
    const loopTicks = DEFAULT_SETTINGS.loopMs / 8
    expect(crosshairAt(c, 0)).toEqual(crosshairAt(c, loopTicks))
  })
  it('stays within the wobble radius of the target', () => {
    const radius = DEFAULT_SETTINGS.wobbleRadius * 8
    for (let t = 0; t < 400; t += 7) {
      const p = crosshairAt(ctx(), t)
      expect(Math.hypot(p.x - 0, p.y - 1030)).toBeLessThanOrEqual(radius + 1)
    }
  })
  it('starts each dart at a different place on the loop', () => {
    const starts = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const p = crosshairAt(ctx({ throwIndex: i }), 0)
      starts.add(`${p.x},${p.y}`)
    }
    expect(starts.size).toBeGreaterThan(10)
  })
  it('circle shape reaches the radius, figure-8 is at most about half as tall', () => {
    const circle = { ...DEFAULT_SETTINGS, shape: 0 }
    const eight = { ...DEFAULT_SETTINGS, shape: 100 }
    let maxCircleY = 0
    let maxEightY = 0
    for (let t = 0; t < 200; t++) {
      maxCircleY = Math.max(maxCircleY, Math.abs(crosshairAt(ctx({}, circle), t).y - 1030))
      maxEightY = Math.max(maxEightY, Math.abs(crosshairAt(ctx({}, eight), t).y - 1030))
    }
    expect(maxCircleY).toBeGreaterThan(maxEightY * 1.6)
  })
})

describe('scatterFor', () => {
  it('never exceeds the cap and is zero when the cap is zero', () => {
    const cap = DEFAULT_SETTINGS.scatterCap * 8
    for (let i = 0; i < 2000; i++) {
      const s = scatterFor(ctx({ throwIndex: i }))
      expect(Math.hypot(s.x, s.y)).toBeLessThanOrEqual(cap)
    }
    const none = scatterFor(ctx({}, { ...DEFAULT_SETTINGS, scatterCap: 0 }))
    expect(none).toEqual({ x: 0, y: 0 })
  })
  it('is weighted to the centre: median offset at most 35% of the cap', () => {
    const cap = DEFAULT_SETTINGS.scatterCap * 8
    const d: number[] = []
    for (let i = 0; i < 2000; i++) {
      const s = scatterFor(ctx({ throwIndex: i }))
      d.push(Math.hypot(s.x, s.y))
    }
    d.sort((a, b) => a - b)
    expect(d[1000]).toBeLessThanOrEqual(cap * 0.35)
    expect(d[1000]).toBeGreaterThan(cap * 0.2)
  })
  it('does not depend on the release time', () => {
    const a = resolveThrow(ctx(), 10).scatter
    const b = resolveThrow(ctx(), 90).scatter
    expect(a).toEqual(b)
  })
})

describe('resolveThrow', () => {
  it('lands at crosshair plus scatter and reports the bed there', () => {
    const r = resolveThrow(ctx(), 55)
    expect(r.landing).toEqual({ x: r.crosshair.x + r.scatter.x, y: r.crosshair.y + r.scatter.y })
    expect(r.bed.ring).toBeDefined()
  })
  it('guarantees a hit when the ring is fully inside the bed', () => {
    // Tiny cap (0.2 treble width = 16 units) around the middle of T20: every dart lands in the treble.
    const s = { ...DEFAULT_SETTINGS, wobbleRadius: 10, scatterCap: 2 }
    for (let i = 0; i < 300; i++) {
      const r = resolveThrow(ctx({ throwIndex: i }, s), 0)
      const cross = Math.hypot(r.crosshair.x, r.crosshair.y - 1030)
      if (cross + 2 * 8 < (UNITS_PER_TREBLE_WIDTH / 2) - 1) {
        expect(r.bed.ring === 'treble' && r.bed.sector === 20).toBe(true)
      }
    }
  })
})
