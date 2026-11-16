import { describe, it, expect } from 'vitest'
import { makeBed } from './board.ts'
import { applyDart, newLeg } from './leg.ts'

const at = (remaining: number) => ({ ...newLeg(), remaining, turnStart: remaining })

describe('leg', () => {
  it('starts at 501', () => {
    expect(newLeg().remaining).toBe(501)
  })
  it('subtracts a dart and counts it', () => {
    const s = applyDart(newLeg(), makeBed('treble', 20))
    expect(s.remaining).toBe(441)
    expect(s.dartsTotal).toBe(1)
    expect(s.dartsInTurn).toBe(1)
  })
  it('starts a new turn after three darts', () => {
    let s = newLeg()
    for (let i = 0; i < 3; i++) s = applyDart(s, makeBed('treble', 20))
    expect(s.remaining).toBe(321)
    expect(s.turnStart).toBe(321)
    expect(s.dartsInTurn).toBe(0)
  })
  it('busts on overshoot and resets to the start of the turn', () => {
    let s = at(100)
    s = applyDart(s, makeBed('treble', 20)) // 40 left
    s = applyDart(s, makeBed('treble', 20)) // bust: -20
    expect(s.remaining).toBe(100)
    expect(s.dartsInTurn).toBe(0)
    expect(s.busts).toBe(1)
    expect(s.lastBust).toBe(true)
    expect(s.dartsTotal).toBe(2)
  })
  it('busts on leaving 1', () => {
    const s = applyDart(at(21), makeBed('double', 10))
    expect(s.remaining).toBe(21)
    expect(s.lastBust).toBe(true)
  })
  it('busts on reaching 0 without a double', () => {
    const s = applyDart(at(20), makeBed('innerSingle', 20))
    expect(s.won).toBe(false)
    expect(s.remaining).toBe(20)
    expect(s.lastBust).toBe(true)
  })
  it('wins on a double and on the bull', () => {
    expect(applyDart(at(40), makeBed('double', 20)).won).toBe(true)
    expect(applyDart(at(50), makeBed('bull', 0)).won).toBe(true)
  })
  it('ignores darts after the leg is won', () => {
    const won = applyDart(at(40), makeBed('double', 20))
    expect(applyDart(won, makeBed('treble', 20))).toBe(won)
  })
  it('clears lastBust on the next normal dart', () => {
    let s = applyDart(at(21), makeBed('double', 10))
    s = applyDart(s, makeBed('innerSingle', 1))
    expect(s.lastBust).toBe(false)
  })
})
