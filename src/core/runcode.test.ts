import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS } from './settings.ts'
import { decodeRunCode, encodeRunCode } from './replay.ts'
import type { RunLog } from './types.ts'

const log: RunLog = { v: 1, seed: 7, settings: DEFAULT_SETTINGS, throws: [{ target: { x: 0, y: 1030 }, releaseTick: 90, rawMs: 760 }] }

/** A log with `n` throws, so the encoded length (and so the base64 padding) changes with n. */
const logWith = (n: number): RunLog => ({
  v: 1,
  seed: 3,
  settings: DEFAULT_SETTINGS,
  throws: Array.from({ length: n }, (_, i) => ({ target: { x: 5 - i, y: 10 * i }, releaseTick: i })),
})

/** Encode a hand-built object the way encodeRunCode does (URL-safe), so malformed shapes can be tested. */
const codeOf = (value: unknown): string => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const validLog = { v: 1, seed: 7, settings: { ...DEFAULT_SETTINGS }, throws: [{ target: { x: 0, y: 1030 }, releaseTick: 90 }] }

/** A pinned v1 run code. If this test fails, the run-code format changed: bump the version, do not just edit the literal. */
const PINNED_V1_CODE =
  'eyJ2IjoxLCJzZWVkIjo3LCJzZXR0aW5ncyI6eyJ3b2JibGVSYWRpdXMiOjI1LCJsb29wTXMiOjE2MDAsInNoYXBlIjoxMDAsInNjYXR0ZXJDYXAiOjEwLCJsZWFkTXMiOjYwLCJ6b29tUGN0IjoyMDB9LCJ0aHJvd3MiOlt7InRhcmdldCI6eyJ4IjowLCJ5IjoxMDMwfSwicmVsZWFzZVRpY2siOjkwLCJyYXdNcyI6NzYwfV19'
const PINNED_V1_LOG: RunLog = {
  v: 1,
  seed: 7,
  settings: { wobbleRadius: 25, loopMs: 1600, shape: 100, scatterCap: 10, leadMs: 60, zoomPct: 200 },
  throws: [{ target: { x: 0, y: 1030 }, releaseTick: 90, rawMs: 760 }],
}

describe('run codes', () => {
  it('round-trips', () => {
    expect(decodeRunCode(encodeRunCode(log))).toEqual(log)
  })
  it('is URL-safe and unpadded for every padding length', () => {
    for (let n = 0; n <= 5; n++) {
      const code = encodeRunCode(logWith(n))
      expect(code).toMatch(/^[A-Za-z0-9_-]+$/)
      expect(decodeRunCode(code)).toEqual(logWith(n))
    }
  })
  it('substitutes + and / when encoding', () => {
    // Not reachable from a real log, so smuggle in a field whose bytes force '+' and '/' into plain base64.
    const noisy = { ...logWith(2), note: '>>>???~~~' } as RunLog
    expect(btoa(JSON.stringify(noisy))).toMatch(/[+/]/)
    const code = encodeRunCode(noisy)
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(code).toMatch(/[_-]/)
    expect(decodeRunCode(code)).toEqual(logWith(2))
  })
  it('decodes a code in standard base64 with +, / and = padding', () => {
    const standard = btoa(JSON.stringify({ ...logWith(2), note: '>>>???~~~~' }))
    expect(standard).toContain('+')
    expect(standard).toContain('/')
    expect(standard).toMatch(/=$/)
    expect(decodeRunCode(standard)).toEqual(logWith(2))
  })
  it('accepts surrounding whitespace and newlines', () => {
    expect(decodeRunCode(`  \n${encodeRunCode(log)}\r\n `)).toEqual(log)
  })
  it('decodes the pinned v1 literal and re-encodes it to the same literal', () => {
    expect(decodeRunCode(PINNED_V1_CODE)).toEqual(PINNED_V1_LOG)
    expect(encodeRunCode(PINNED_V1_LOG)).toBe(PINNED_V1_CODE)
  })
  it('rejects junk', () => {
    expect(() => decodeRunCode('not a run code')).toThrow('Bad run code')
    expect(() => decodeRunCode(btoa('{"v":2}'))).toThrow('Bad run code')
    expect(() => decodeRunCode('')).toThrow('Bad run code')
    expect(() => decodeRunCode(codeOf(null))).toThrow('Bad run code')
    expect(() => decodeRunCode(codeOf([]))).toThrow('Bad run code')
  })
})

describe('run code shape validation', () => {
  it('accepts a well-formed hand-built code', () => {
    expect(decodeRunCode(codeOf(validLog))).toEqual(validLog)
  })
  it.each([
    ['wrong version', { ...validLog, v: 2 }],
    ['non-integer seed', { ...validLog, seed: 1.5 }],
    ['string seed', { ...validLog, seed: '7' }],
    ['null settings', { ...validLog, settings: null }],
    ['array settings', { ...validLog, settings: [] }],
    ['non-numeric setting', { ...validLog, settings: { ...DEFAULT_SETTINGS, loopMs: 'fast' } }],
    ['null setting', { ...validLog, settings: { ...DEFAULT_SETTINGS, loopMs: null } }],
    ['throws not an array', { ...validLog, throws: {} }],
    ['throw is null', { ...validLog, throws: [null] }],
    ['missing target', { ...validLog, throws: [{ releaseTick: 1 }] }],
    ['null target', { ...validLog, throws: [{ target: null, releaseTick: 1 }] }],
    ['non-numeric target', { ...validLog, throws: [{ target: { x: 'a', y: 0 }, releaseTick: 1 }] }],
    ['fractional target', { ...validLog, throws: [{ target: { x: 0.5, y: 0 }, releaseTick: 1 }] }],
    ['negative releaseTick', { ...validLog, throws: [{ target: { x: 0, y: 0 }, releaseTick: -1 }] }],
    ['fractional releaseTick', { ...validLog, throws: [{ target: { x: 0, y: 0 }, releaseTick: 1.5 }] }],
    ['missing releaseTick', { ...validLog, throws: [{ target: { x: 0, y: 0 } }] }],
    ['non-numeric rawMs', { ...validLog, throws: [{ target: { x: 0, y: 0 }, releaseTick: 1, rawMs: 'x' }] }],
  ])('rejects %s', (_name, value) => {
    expect(() => decodeRunCode(codeOf(value))).toThrow('Bad run code')
  })
  it('rejects non-finite numbers (which JSON turns into null)', () => {
    expect(() => decodeRunCode(codeOf({ ...validLog, seed: Infinity }))).toThrow('Bad run code')
    expect(() => decodeRunCode(codeOf({ ...validLog, throws: [{ target: { x: NaN, y: 0 }, releaseTick: 1 }] }))).toThrow('Bad run code')
  })
  it('caps the run at 5000 throws', () => {
    const throws = (n: number) => Array.from({ length: n }, () => ({ target: { x: 0, y: 0 }, releaseTick: 0 }))
    expect(decodeRunCode(codeOf({ ...validLog, throws: throws(5000) })).throws).toHaveLength(5000)
    expect(() => decodeRunCode(codeOf({ ...validLog, throws: throws(5001) }))).toThrow('Bad run code')
  })
  it('clamps out-of-range settings and drops unknown keys', () => {
    const settings = { ...DEFAULT_SETTINGS, wobbleRadius: 9999, leadMs: -9999, evil: 1 }
    const decoded = decodeRunCode(codeOf({ ...validLog, settings }))
    expect(decoded.settings).toEqual({ ...DEFAULT_SETTINGS, wobbleRadius: 40, leadMs: -150 })
    expect(decoded.settings).not.toHaveProperty('evil')
  })
  it('fills missing settings fields with defaults', () => {
    expect(decodeRunCode(codeOf({ ...validLog, settings: {} })).settings).toEqual(DEFAULT_SETTINGS)
  })
  it('keeps rawMs only when present and drops other unknown fields', () => {
    const decoded = decodeRunCode(codeOf({ ...validLog, extra: 1, throws: [{ target: { x: 1, y: 2 }, releaseTick: 3, junk: 'x' }] }))
    expect(decoded).toEqual({ ...validLog, throws: [{ target: { x: 1, y: 2 }, releaseTick: 3 }] })
    expect(decoded.throws[0]).not.toHaveProperty('rawMs')
  })
  it('normalises -0 targets to 0', () => {
    const decoded = decodeRunCode('eyJ2IjoxLCJzZWVkIjoxLCJzZXR0aW5ncyI6e30sInRocm93cyI6W3sidGFyZ2V0Ijp7IngiOi0wLCJ5IjowfSwicmVsZWFzZVRpY2siOjB9XX0')
    expect(Object.is(decoded.throws[0].target.x, 0)).toBe(true)
  })
})
