import { describe, expect, it } from 'vitest'
import { barLeftPx, snapLead, tapError } from './calibrate-math.ts'

describe('barLeftPx', () => {
  it('runs from the left edge to the right edge of the track', () => {
    expect(barLeftPx(0, 300, 16)).toBe(0)
    expect(barLeftPx(1, 300, 16)).toBe(284)
  })
  it('puts the bar centre exactly on the track centre at phase 0.5', () => {
    expect(barLeftPx(0.5, 300, 16) + 16 / 2).toBe(300 / 2)
    expect(barLeftPx(0.5, 311, 16) + 16 / 2).toBe(311 / 2)
  })
  it('never goes negative for a track narrower than the bar', () => {
    expect(barLeftPx(0.5, 10, 16)).toBe(0)
  })
})

describe('tapError', () => {
  it('is 0 for a tap exactly on the crossing (and not -0)', () => {
    expect(Object.is(tapError(500, 0), 0)).toBe(true)
    expect(Object.is(tapError(1500, 0), 0)).toBe(true)
  })
  it('is positive when late and negative when early', () => {
    expect(tapError(530, 0)).toBe(30)
    expect(tapError(470, 0)).toBe(-30)
  })
  it('measures from the nearest crossing in any cycle, relative to the start time', () => {
    expect(tapError(2000 + 1530, 2000)).toBe(30)
    expect(tapError(7000 + 4470, 7000)).toBe(-30)
    expect(tapError(250 + 3000 + 500 + 12, 250)).toBe(12)
  })
})

describe('snapLead', () => {
  it('snaps to the slider grid (min -150, step 4)', () => {
    expect(snapLead(61)).toBe(62)
    expect(snapLead(59)).toBe(58)
    expect(snapLead(-150)).toBe(-150)
    expect(snapLead(0)).toBe(2)
  })
  it('clamps to the slider range', () => {
    expect(snapLead(400)).toBe(150)
    expect(snapLead(-400)).toBe(-150)
  })
  it('always lands on the grid', () => {
    for (let v = -160; v <= 160; v += 7) expect((snapLead(v) + 150) % 4).toBe(0)
  })
})
