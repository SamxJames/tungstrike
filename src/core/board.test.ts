import { describe, it, expect } from 'vitest'
import { bedAt, bedCentre, bedLabel, makeBed, targetFromTap } from './board.ts'
import type { Ring } from './types.ts'

describe('bedAt', () => {
  it('finds the four compass trebles', () => {
    expect(bedLabel(bedAt({ x: 0, y: 1030 }))).toBe('T20')
    expect(bedLabel(bedAt({ x: 1030, y: 0 }))).toBe('T6')
    expect(bedLabel(bedAt({ x: 0, y: -1030 }))).toBe('T3')
    expect(bedLabel(bedAt({ x: -1030, y: 0 }))).toBe('T11')
  })
  it('scores bulls and misses', () => {
    expect(bedAt({ x: 0, y: 0 }).score).toBe(50)
    expect(bedAt({ x: 0, y: 0 }).isDouble).toBe(true)
    expect(bedAt({ x: 100, y: 0 }).score).toBe(25)
    expect(bedAt({ x: 1701, y: 0 }).ring).toBe('miss')
    expect(bedAt({ x: 1701, y: 0 }).score).toBe(0)
  })
  it('puts exact ring edges in the inner bed', () => {
    expect(bedAt({ x: 0, y: 990 }).ring).toBe('innerSingle')
    expect(bedAt({ x: 0, y: 991 }).ring).toBe('treble')
    expect(bedAt({ x: 0, y: 1070 }).ring).toBe('treble')
    expect(bedAt({ x: 0, y: 1071 }).ring).toBe('outerSingle')
    expect(bedAt({ x: 0, y: 1700 }).ring).toBe('double')
  })
  it('puts the bull, outer bull and double edges in the inner bed too', () => {
    expect(bedAt({ x: 0, y: 64 }).ring).toBe('bull')
    expect(bedAt({ x: 0, y: 65 }).ring).toBe('outerBull')
    expect(bedAt({ x: 0, y: 159 }).ring).toBe('outerBull')
    expect(bedAt({ x: 0, y: 160 }).ring).toBe('innerSingle')
    expect(bedAt({ x: 0, y: 1620 }).ring).toBe('outerSingle')
    expect(bedAt({ x: 0, y: 1621 }).ring).toBe('double')
  })
  it('scores trebles and doubles', () => {
    expect(bedAt({ x: 0, y: 1030 }).score).toBe(60)
    expect(bedAt({ x: 0, y: 1660 }).score).toBe(40)
    expect(bedAt({ x: 0, y: 1660 }).isDouble).toBe(true)
  })
  it('puts a point exactly on a wire in the sector clockwise of it', () => {
    // The four diagonals are exact table wires, so integer points sit on them.
    expect(bedAt({ x: 500, y: 500 }).sector).toBe(4)     // 18/4 wire, 45 deg
    expect(bedAt({ x: 500, y: -500 }).sector).toBe(2)    // 15/2 wire, 135 deg
    expect(bedAt({ x: -500, y: -500 }).sector).toBe(16)  // 7/16 wire, 225 deg
    expect(bedAt({ x: -500, y: 500 }).sector).toBe(12)   // 9/12 wire, 315 deg
    expect(bedAt({ x: 499, y: 500 }).sector).toBe(18)    // one unit anticlockwise of the 45 deg wire
    expect(bedAt({ x: 501, y: 500 }).sector).toBe(4)     // one unit clockwise of it
  })
})

describe('bedCentre', () => {
  const rings: Ring[] = ['innerSingle', 'treble', 'outerSingle', 'double']
  it('round-trips for every sector and ring', () => {
    for (let sector = 1; sector <= 20; sector++) {
      for (const ring of rings) {
        const bed = makeBed(ring, sector)
        expect(bedAt(bedCentre(bed))).toEqual(bed)
      }
    }
  })
  it('puts sector 20 bed centres at the mid radius of each ring', () => {
    expect(bedCentre(makeBed('innerSingle', 20))).toEqual({ x: 0, y: 575 })
    expect(bedCentre(makeBed('treble', 20))).toEqual({ x: 0, y: 1030 })
    expect(bedCentre(makeBed('outerSingle', 20))).toEqual({ x: 0, y: 1345 })
    expect(bedCentre(makeBed('double', 20))).toEqual({ x: 0, y: 1660 })
  })
  it('centres the bulls on the origin', () => {
    expect(bedCentre(makeBed('bull', 0))).toEqual({ x: 0, y: 0 })
    expect(bedCentre(makeBed('outerBull', 0))).toEqual({ x: 0, y: 0 })
  })
})

describe('bedLabel', () => {
  it('labels every kind of bed', () => {
    expect(bedLabel(makeBed('innerSingle', 7))).toBe('S7')
    expect(bedLabel(makeBed('outerSingle', 19))).toBe('S19')
    expect(bedLabel(makeBed('double', 16))).toBe('D16')
    expect(bedLabel(makeBed('treble', 20))).toBe('T20')
    expect(bedLabel(makeBed('outerBull', 0))).toBe('25')
    expect(bedLabel(makeBed('bull', 0))).toBe('Bull')
    expect(bedLabel(makeBed('miss', 0))).toBe('Miss')
  })
})

describe('targetFromTap', () => {
  it('snaps a tap to the centre of the bed', () => {
    expect(targetFromTap({ x: 30, y: 1000 })).toEqual(bedCentre(bedAt({ x: 30, y: 1000 })))
  })
  it('snaps either bull to the origin and ignores taps off the board', () => {
    expect(targetFromTap({ x: 100, y: 0 })).toEqual({ x: 0, y: 0 })
    expect(targetFromTap({ x: 5000, y: 5000 })).toBeNull()
  })
})
