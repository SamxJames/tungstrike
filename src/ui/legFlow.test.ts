import { describe, it, expect } from 'vitest'
import { makeBed } from '../core/board.ts'
import { newLeg } from '../core/leg.ts'
import { another, initFlow, onDart, rate } from './legFlow.ts'
import type { LegFlow } from './legFlow.ts'

const META = { build: 'abc1234', settingsKey: '#v1&rad=25;lead=60', visit: 'v1' }
const D20 = makeBed('double', 20)
const T20 = makeBed('treble', 20)
const S1 = makeBed('innerSingle', 1)

/** A flow whose leg is about to finish: 40 left. */
const nearFinish = (): LegFlow => {
  const f = initFlow([])
  return { ...f, leg: { ...newLeg(), remaining: 40, turnStart: 40 } }
}

describe('legFlow', () => {
  it('starts on a fresh 501 leg with nothing pending', () => {
    const f = initFlow([])
    expect(f.leg.remaining).toBe(501)
    expect(f.awaitingRating).toBe(false)
    expect(f.legStartThrow).toBe(0)
    expect(f.throwsInLog).toBe(0)
  })

  it('counts every dart into the log position', () => {
    let f = initFlow([])
    f = onDart(f, T20)
    f = onDart(f, T20)
    expect(f.throwsInLog).toBe(2)
    expect(f.leg.dartsTotal).toBe(2)
  })

  it('a winning double sets awaitingRating once', () => {
    const won = onDart(nearFinish(), D20)
    expect(won.leg.won).toBe(true)
    expect(won.awaitingRating).toBe(true)
  })

  it('a dart after the win is ignored by the leg and does not re-arm the rating', () => {
    let f = onDart(nearFinish(), D20)
    f = rate(f, 'mostly', META)
    expect(f.awaitingRating).toBe(false)
    const after = onDart(f, T20)
    expect(after.leg).toEqual(f.leg)
    expect(after.awaitingRating).toBe(false)
    expect(after.throwsInLog).toBe(f.throwsInLog + 1) // still in the replay log, so the offset stays honest
  })

  it('two rate calls record one entry with the right darts and busts', () => {
    let f = nearFinish()
    f = onDart(f, T20) // bust (40 - 60 < 0): 1 bust, back to 40
    f = onDart(f, D20) // win on dart 2
    f = rate(f, 'sometimes', META)
    f = rate(f, 'rarely', META)
    expect(f.legs).toHaveLength(1)
    expect(f.legs[0]).toMatchObject({ darts: 2, busts: 1, won: true, rating: 'sometimes', ...META, startThrow: 0 })
  })

  it('rate with nothing pending is a no-op', () => {
    const f = initFlow([])
    expect(rate(f, 'mostly', META)).toBe(f)
    const mid = onDart(f, S1)
    expect(rate(mid, 'mostly', META).legs).toHaveLength(0)
  })

  it('a bust increments busts and the recorded value', () => {
    let f = nearFinish()
    f = onDart(f, T20)
    expect(f.leg.busts).toBe(1)
    expect(f.leg.lastBust).toBe(true)
    f = onDart(f, D20)
    f = rate(f, 'mostly', META)
    expect(f.legs[0].busts).toBe(1)
  })

  it('another resets the leg, keeps the legs and records where the new leg starts in the log', () => {
    let f = nearFinish()
    f = onDart(f, D20)
    f = rate(f, 'mostly', META)
    f = another(f)
    expect(f.leg.remaining).toBe(501)
    expect(f.leg.won).toBe(false)
    expect(f.awaitingRating).toBe(false)
    expect(f.legs).toHaveLength(1)
    expect(f.legStartThrow).toBe(1)
    expect(f.throwsInLog).toBe(1)
    f = onDart(f, T20)
    f = onDart(f, T20)
    expect(f.throwsInLog).toBe(3)
    expect(f.legStartThrow).toBe(1)
  })

  it('the second leg is recorded with its own start offset and does not touch the first', () => {
    let f = nearFinish()
    f = onDart(f, D20)
    f = rate(f, 'mostly', META)
    f = another(f)
    f = { ...f, leg: { ...newLeg(), remaining: 40, turnStart: 40 } }
    f = onDart(f, D20)
    f = rate(f, 'rarely', META)
    expect(f.legs.map((l) => [l.darts, l.rating, l.startThrow])).toEqual([[1, 'mostly', 0], [1, 'rarely', 1]])
  })

  it('another before the leg is won still starts a fresh leg at the current log position', () => {
    let f = initFlow([])
    f = onDart(f, T20)
    f = another(f)
    expect(f.leg.dartsTotal).toBe(0)
    expect(f.legStartThrow).toBe(1)
  })
})
