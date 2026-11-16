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
  it('scores trebles and doubles', () => {
    expect(bedAt({ x: 0, y: 1030 }).score).toBe(60)
    expect(bedAt({ x: 0, y: 1660 }).score).toBe(40)
    expect(bedAt({ x: 0, y: 1660 }).isDouble).toBe(true)
  })
  it('puts a point exactly on a wire in the sector clockwise of it', () => {
    // 9 degrees clockwise of straight up is the 20/1 wire; points on it belong to sector 1.
    expect(bedAt({ x: 0, y: 1030 }).sector).toBe(20)
    expect(bedAt({ x: 200, y: 1000 }).sector).toBe(1)
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
  it('centres the bulls on the origin', () => {
    expect(bedCentre(makeBed('bull', 0))).toEqual({ x: 0, y: 0 })
    expect(bedCentre(makeBed('outerBull', 0))).toEqual({ x: 0, y: 0 })
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
