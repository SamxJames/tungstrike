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
})
