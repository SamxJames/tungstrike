import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS } from './settings.ts'
import { decodeRunCode, encodeRunCode } from './replay.ts'
import type { RunLog } from './types.ts'

const log: RunLog = { v: 1, seed: 7, settings: DEFAULT_SETTINGS, throws: [{ target: { x: 0, y: 1030 }, releaseTick: 90, rawMs: 760 }] }

describe('run codes', () => {
  it('round-trips', () => {
    expect(decodeRunCode(encodeRunCode(log))).toEqual(log)
  })
  it('is URL-safe', () => {
    expect(encodeRunCode(log)).toMatch(/^[A-Za-z0-9_-]+$/)
  })
  it('rejects junk', () => {
    expect(() => decodeRunCode('not a run code')).toThrow('Bad run code')
    expect(() => decodeRunCode(btoa('{"v":2}'))).toThrow('Bad run code')
  })
})
