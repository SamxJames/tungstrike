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
    const s = decodeSettings('#v1&rad=999&loop=1&shp=7&zz=5&sct=-4')
    expect(s.wobbleRadius).toBe(40)
    expect(s.loopMs).toBe(800)
    expect(s.shape).toBe(7)
    expect(s.scatterCap).toBe(0)
  })
  it('ignores a junk value and keeps the default for that field', () => {
    expect(decodeSettings('#v1&loop=abc').loopMs).toBe(1600)
  })
  it('clamps lead and zoom at both ends', () => {
    expect(clampSettings({ leadMs: -999 }).leadMs).toBe(-150)
    expect(clampSettings({ leadMs: 999 }).leadMs).toBe(150)
    expect(clampSettings({ zoomPct: 1 }).zoomPct).toBe(150)
    expect(clampSettings({ zoomPct: 9999 }).zoomPct).toBe(350)
    expect(decodeSettings('#v1&zm=10').zoomPct).toBe(150)
    expect(decodeSettings('#v1&zm=900').zoomPct).toBe(350)
  })
  it('never returns -0 (a small negative lead rounds to +0)', () => {
    expect(Object.is(clampSettings({ leadMs: -0.4 }).leadMs, 0)).toBe(true)
    expect(Object.is(clampSettings({ leadMs: -0 }).leadMs, 0)).toBe(true)
  })
  it('returns defaults for an empty hash', () => {
    expect(decodeSettings('')).toEqual(DEFAULT_SETTINGS)
  })
  it('clampSettings rounds and handles NaN', () => {
    expect(clampSettings({ wobbleRadius: 24.6, leadMs: Number.NaN }).wobbleRadius).toBe(25)
    expect(clampSettings({ leadMs: Number.NaN }).leadMs).toBe(60)
  })
})
