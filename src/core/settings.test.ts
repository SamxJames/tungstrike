import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS, clampSettings, decodeSettings, encodeSettings } from './settings.ts'

describe('settings', () => {
  it('encodes the defaults as a versioned integer hash without release lead', () => {
    expect(encodeSettings(DEFAULT_SETTINGS)).toBe('#v1&rad=25&loop=1600&shp=100&sct=10&zm=200')
  })
  it('round-trips everything except lead', () => {
    const s = { ...DEFAULT_SETTINGS, wobbleRadius: 31, loopMs: 1250, shape: 40, scatterCap: 14, zoomPct: 260 }
    expect(decodeSettings(encodeSettings(s))).toEqual({ ...s, leadMs: DEFAULT_SETTINGS.leadMs })
  })
  it('clamps out-of-range values and ignores junk and unknown keys', () => {
    const s = decodeSettings('#v1&rad=999&loop=1&shp=abc&zz=5&sct=-4')
    expect(s.wobbleRadius).toBe(40)
    expect(s.loopMs).toBe(800)
    expect(s.shape).toBe(100)
    expect(s.scatterCap).toBe(0)
  })
  it('returns defaults for an empty hash', () => {
    expect(decodeSettings('')).toEqual(DEFAULT_SETTINGS)
  })
  it('clampSettings rounds and handles NaN', () => {
    expect(clampSettings({ wobbleRadius: 24.6, leadMs: Number.NaN }).wobbleRadius).toBe(25)
    expect(clampSettings({ leadMs: Number.NaN }).leadMs).toBe(60)
  })
})
