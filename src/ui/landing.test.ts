import { describe, it, expect } from 'vitest'
import { FLY_MS, GHOST_MS, flightProgress, reportSafely, shouldReport } from './landing.ts'

const landed = (reported = false) => ({ releasedAt: 1000, reported })

describe('shouldReport', () => {
  it('is false before the flight ends while in cooldown', () => {
    expect(shouldReport(landed(), 1000, 'cooldown')).toBe(false)
    expect(shouldReport(landed(), 1449, 'cooldown')).toBe(false)
  })
  it('is true once ghost + flight have elapsed in cooldown', () => {
    expect(shouldReport(landed(), 1000 + GHOST_MS + FLY_MS, 'cooldown')).toBe(true)
  })
  it('is true immediately when the phase has already flipped to aiming (lost-throw case)', () => {
    expect(shouldReport(landed(), 1100, 'aiming')).toBe(true)
  })
  it('is false when already reported, in any phase', () => {
    expect(shouldReport(landed(true), 2000, 'cooldown')).toBe(false)
    expect(shouldReport(landed(true), 2000, 'aiming')).toBe(false)
  })
  it('is false when nothing has landed', () => {
    expect(shouldReport(null, 2000, 'aiming')).toBe(false)
    expect(shouldReport(null, 2000, 'cooldown')).toBe(false)
  })
})

describe('reportSafely', () => {
  it('passes the event on and reports success', () => {
    const seen: number[] = []
    expect(reportSafely((n: number) => seen.push(n), 7, () => {})).toBe(true)
    expect(seen).toEqual([7])
  })
  it('catches an exception from the game, logs it and reports failure, so the frame loop keeps running', () => {
    const logged: unknown[] = []
    const boom = new Error('boom')
    expect(() => reportSafely(() => { throw boom }, 1, (...a: unknown[]) => logged.push(...a))).not.toThrow()
    expect(reportSafely(() => { throw boom }, 1, (...a: unknown[]) => logged.push(...a))).toBe(false)
    expect(logged).toContain(boom)
  })
})

describe('flightProgress', () => {
  it('is 0 during the ghost', () => {
    expect(flightProgress(0)).toBe(0)
    expect(flightProgress(299)).toBe(0)
  })
  it('runs 0..1 over the flight and clamps', () => {
    expect(flightProgress(375)).toBeCloseTo(0.5, 5)
    expect(flightProgress(450)).toBe(1)
    expect(flightProgress(900)).toBe(1)
  })
})
