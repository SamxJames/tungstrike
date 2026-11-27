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
  it('busts on the third dart of a turn and resets to the turn start', () => {
    let s = at(100)
    s = applyDart(s, makeBed('innerSingle', 20)) // 80
    s = applyDart(s, makeBed('innerSingle', 20)) // 60
    s = applyDart(s, makeBed('treble', 20)) // 0 on a treble: bust
    expect(s).toMatchObject({ remaining: 100, turnStart: 100, dartsInTurn: 0, dartsTotal: 3, busts: 1, won: false, lastBust: true })
  })
  it('wins on the second or third dart of a turn, counting every dart', () => {
    let s = at(60)
    s = applyDart(s, makeBed('innerSingle', 20)) // 40
    s = applyDart(s, makeBed('double', 20))
    expect(s).toMatchObject({ won: true, remaining: 0, dartsTotal: 2 })
    let t = at(61)
    t = applyDart(t, makeBed('innerSingle', 1)) // 60
    t = applyDart(t, makeBed('innerSingle', 20)) // 40
    t = applyDart(t, makeBed('double', 20))
    expect(t).toMatchObject({ won: true, dartsTotal: 3 })
  })
  it('a treble or the outer bull cannot finish: both bust', () => {
    expect(applyDart(at(60), makeBed('treble', 20))).toMatchObject({ won: false, remaining: 60, lastBust: true })
    expect(applyDart(at(25), makeBed('outerBull', 0))).toMatchObject({ won: false, remaining: 25, lastBust: true })
  })
  it('accumulates busts across turns', () => {
    let s = at(10)
    s = applyDart(s, makeBed('treble', 20)) // bust 1
    s = applyDart(s, makeBed('treble', 20)) // bust 2
    s = applyDart(s, makeBed('innerSingle', 9)) // leaves 1: bust 3
    expect(s).toMatchObject({ busts: 3, remaining: 10, dartsTotal: 3 })
  })
  it('reaching 1 with a single is a bust', () => {
    expect(applyDart(at(2), makeBed('innerSingle', 1))).toMatchObject({ remaining: 2, lastBust: true, busts: 1 })
  })
  it('clears lastBust on the next normal dart', () => {
    let s = applyDart(at(21), makeBed('double', 10))
    s = applyDart(s, makeBed('innerSingle', 1))
    expect(s.lastBust).toBe(false)
  })
})
