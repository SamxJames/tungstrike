import { describe, it, expect } from 'vitest'
import { SINE, SECTOR_BOUNDARY, SECTOR_CENTRE } from './generated.ts'
import { fnv1a } from './checksum.ts'
import { sin16, cos16 } from './sine.ts'

const EXPECTED_CHECKSUM = 3142119710 // printed by `npm run gen:tables`

describe('generated tables', () => {
  it('match the committed checksum (regenerate deliberately, never by accident)', () => {
    expect(fnv1a(JSON.stringify([SINE, SECTOR_BOUNDARY, SECTOR_CENTRE]))).toBe(EXPECTED_CHECKSUM)
  })
  it('have the right sizes', () => {
    expect(SINE).toHaveLength(1024)
    expect(SECTOR_BOUNDARY).toHaveLength(20)
    expect(SECTOR_CENTRE).toHaveLength(20)
  })
  it('sin16 hits the quarter points and wraps', () => {
    expect(sin16(0)).toBe(0)
    expect(sin16(16384)).toBe(32767)
    expect(sin16(32768)).toBe(0)
    expect(sin16(49152)).toBe(-32767)
    expect(sin16(65536)).toBe(0)
    expect(cos16(0)).toBe(32767)
  })
  it('sector 20 is centred straight up', () => {
    expect(SECTOR_CENTRE[0]).toEqual([0, 65536])
  })
  it('directions run clockwise from the top: the first wire is up-left, sector 6 points right', () => {
    const [bx, by] = SECTOR_BOUNDARY[0]
    expect(bx).toBeLessThan(0)
    expect(by).toBeGreaterThan(0)
    const [cx, cy] = SECTOR_CENTRE[5]
    expect(Math.abs(cx - 65536)).toBeLessThanOrEqual(1)
    expect(Math.abs(cy)).toBeLessThanOrEqual(1)
  })
  it('sin16 and cos16 wrap for phases past one turn and below zero', () => {
    expect(sin16(65536 + 16384)).toBe(32767)
    expect(sin16(2 * 65536 + 49152)).toBe(-32767)
    expect(sin16(-16384)).toBe(-32767)
    expect(cos16(65536)).toBe(32767)
    expect(cos16(32768)).toBe(-32767)
    for (const p of [123, 4567, 40000]) expect(sin16(p + 65536)).toBe(sin16(p))
  })
})
