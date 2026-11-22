import { describe, it, expect } from 'vitest'
import { makeBed } from './board.ts'
import { summariseDrill } from './drill.ts'
import type { DrillDart } from './drill.ts'

const dart = (ring: Parameters<typeof makeBed>[0], sector: number, crosshairInT20: boolean): DrillDart => ({
  crosshair: crosshairInT20 ? { x: 0, y: 1030 } : { x: 600, y: 600 },
  landing: { x: 0, y: 0 },
  bed: makeBed(ring, sector),
})

describe('summariseDrill', () => {
  it('counts beds, total and T20 hits', () => {
    const darts = [dart('treble', 20, true), dart('treble', 20, true), dart('innerSingle', 20, true), dart('innerSingle', 1, false)]
    const s = summariseDrill(darts)
    expect(s.counts).toEqual({ T20: 2, S20: 1, S1: 1 })
    expect(s.total).toBe(60 + 60 + 20 + 1)
    expect(s.t20).toBe(2)
    expect(s.in20).toBe(3)
    expect(s.nearT20).toBe(4)
  })
  it('splits misses into timing and scatter', () => {
    const darts = [dart('innerSingle', 20, true), dart('innerSingle', 1, false), dart('innerSingle', 5, false), dart('treble', 20, true)]
    expect(summariseDrill(darts).timingShare).toBeCloseTo(2 / 3)
  })
  it('has no timing share without misses', () => {
    expect(summariseDrill([dart('treble', 20, true)]).timingShare).toBeNull()
  })
  it('gives a verdict only with enough darts', () => {
    expect(summariseDrill([dart('treble', 20, true)]).verdict).toBe('not-enough-darts')
    const tooEasy = Array.from({ length: 10 }, () => dart('treble', 20, true))
    expect(summariseDrill(tooEasy).verdict).toBe('too-easy')
    const tooLoose = Array.from({ length: 10 }, () => dart('innerSingle', 5, false))
    expect(summariseDrill(tooLoose).verdict).toBe('too-loose')
    const right = [...Array.from({ length: 3 }, () => dart('treble', 20, true)), ...Array.from({ length: 7 }, () => dart('innerSingle', 20, true))]
    expect(summariseDrill(right).verdict).toBe('right')
  })
})
