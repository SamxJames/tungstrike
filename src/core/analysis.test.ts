import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS } from './settings.ts'
import { summariseRun } from './analysis.ts'
import type { RunLog } from './types.ts'

describe('summariseRun', () => {
  it('summarises legs, busts and aim', () => {
    const log: RunLog = {
      v: 1, seed: 5, settings: DEFAULT_SETTINGS,
      throws: Array.from({ length: 300 }, (_, i) => ({ target: { x: 0, y: 0 }, releaseTick: i % 150 })),
    }
    const s = summariseRun(log)
    expect(s.throws).toBe(300)
    expect(s.legsStarted).toBeGreaterThanOrEqual(1)
    expect(s.hitRate).toBeGreaterThanOrEqual(0)
    expect(s.hitRate).toBeLessThanOrEqual(1)
    expect(s.meanMissTrebleWidths).toBeGreaterThan(0)
  })
  it('handles an empty log', () => {
    const s = summariseRun({ v: 1, seed: 1, settings: DEFAULT_SETTINGS, throws: [] })
    expect(s).toMatchObject({ throws: 0, legsStarted: 0, legsWon: 0, dartsPerWonLeg: null })
  })
})
