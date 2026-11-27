import { describe, it, expect } from 'vitest'
import { draw } from './rng.ts'

describe('draw', () => {
  it('is deterministic', () => {
    expect(draw(1, 2, 3)).toBe(draw(1, 2, 3))
  })
  it('returns uint32 values', () => {
    for (let n = 0; n < 200; n++) {
      const v = draw(99, n, n % 18)
      expect(Number.isInteger(v) && v >= 0 && v <= 0xffffffff).toBe(true)
    }
  })
  it('differs when any input differs', () => {
    const base = draw(5, 5, 5)
    expect(draw(6, 5, 5)).not.toBe(base)
    expect(draw(5, 6, 5)).not.toBe(base)
    expect(draw(5, 5, 6)).not.toBe(base)
  })
  it('does not depend on call order (no shared stream)', () => {
    const a = draw(7, 10, 1)
    draw(7, 3, 0)
    draw(7, 11, 4)
    expect(draw(7, 10, 1)).toBe(a)
  })
  it('spreads roughly evenly across 16 buckets', () => {
    const buckets = new Array(16).fill(0)
    for (let i = 0; i < 4000; i++) buckets[draw(42, i, 0) % 16]++
    for (const b of buckets) expect(b).toBeGreaterThan(180)
  })
})
