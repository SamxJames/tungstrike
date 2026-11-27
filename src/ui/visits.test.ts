import { describe, it, expect } from 'vitest'
import { decodeRunCode } from '../core/replay.ts'
import { DEFAULT_SETTINGS } from '../core/settings.ts'
import type { LegRecord } from './feedback.ts'
import { earlierEntries, loadUnsentVisits, markSent, MAX_VISITS, saveVisit, VISITS_KEY } from './visits.ts'
import type { VisitRecord } from './visits.ts'

function memory(): Storage {
  const m = new Map<string, string>()
  return {
    get length() { return m.size },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  }
}
const broken: Storage = new Proxy({} as Storage, { get() { throw new Error('blocked') } })

const dart = (tick: number) => ({ target: { x: 0, y: 1030 }, releaseTick: tick, rawMs: tick * 8 })
const rec = (visit: string, over: Partial<VisitRecord> = {}): VisitRecord => ({
  visit,
  startedAt: 1000,
  seed: 7,
  played: DEFAULT_SETTINGS,
  inputs: [dart(10), dart(20)],
  warmSeed: 8,
  warmSettings: DEFAULT_SETTINGS,
  warmInputs: [dart(5)],
  sent: false,
  ...over,
})

describe('saveVisit / loadUnsentVisits', () => {
  it('round-trips a visit under ts.visits.v1 and leaves out the current visit', () => {
    const s = memory()
    expect(saveVisit(rec('a'), s)).toBe(true)
    expect(s.getItem(VISITS_KEY)).not.toBeNull()
    expect(loadUnsentVisits('b', s)).toEqual([rec('a')])
    expect(loadUnsentVisits('a', s)).toEqual([])
  })
  it('replaces the entry for the same visit instead of adding a second one', () => {
    const s = memory()
    saveVisit(rec('a'), s)
    saveVisit(rec('a', { inputs: [dart(1), dart(2), dart(3)] }), s)
    const loaded = loadUnsentVisits('z', s)
    expect(loaded).toHaveLength(1)
    expect(loaded[0].inputs).toHaveLength(3)
  })
  it(`keeps at most the last ${MAX_VISITS} visits, dropping the oldest`, () => {
    const s = memory()
    for (let i = 1; i <= MAX_VISITS + 2; i++) saveVisit(rec(`v${i}`, { startedAt: i }), s)
    expect(loadUnsentVisits('z', s).map((v) => v.visit)).toEqual(['v3', 'v4', 'v5', 'v6', 'v7'])
  })
  it('skips sent visits, visits with no darts, and malformed entries', () => {
    const s = memory()
    s.setItem(VISITS_KEY, JSON.stringify([
      rec('sent', { sent: true }),
      rec('empty', { inputs: [], warmInputs: [] }),
      null,
      { visit: 'x' },
      rec('badthrow', { inputs: [{ target: { x: 0.5, y: 0 }, releaseTick: 1 }] }),
      rec('badsettings', { played: { ...DEFAULT_SETTINGS, loopMs: 'slow' } as never }),
      rec('baddate', { startedAt: 1e300 }),
      rec('ok'),
    ]))
    expect(loadUnsentVisits('z', s).map((v) => v.visit)).toEqual(['ok'])
  })
  it('accepts a visit that only has warm-up darts (played not frozen yet)', () => {
    const s = memory()
    saveVisit(rec('w', { played: null, inputs: [] }), s)
    expect(loadUnsentVisits('z', s).map((v) => v.visit)).toEqual(['w'])
  })
  it('treats unreadable stored data as no visits', () => {
    const s = memory()
    s.setItem(VISITS_KEY, '{nope')
    expect(loadUnsentVisits('z', s)).toEqual([])
    expect(saveVisit(rec('a'), s)).toBe(true)
    expect(loadUnsentVisits('z', s)).toHaveLength(1)
  })
})

describe('markSent', () => {
  it('marks only the named visits as sent, so they are not offered again', () => {
    const s = memory()
    saveVisit(rec('a'), s)
    saveVisit(rec('b'), s)
    saveVisit(rec('c'), s)
    expect(markSent(['a', 'c'], s)).toBe(true)
    expect(loadUnsentVisits('z', s).map((v) => v.visit)).toEqual(['b'])
  })
  it('a later save of the same visit with new darts makes it unsent again', () => {
    const s = memory()
    saveVisit(rec('a'), s)
    markSent(['a'], s)
    saveVisit(rec('a', { inputs: [dart(1), dart(2), dart(3)] }), s)
    expect(loadUnsentVisits('z', s).map((v) => v.visit)).toEqual(['a'])
  })
})

describe('blocked storage', () => {
  it('never throws and reports failure', () => {
    expect(saveVisit(rec('a'), broken)).toBe(false)
    expect(markSent(['a'], broken)).toBe(false)
    expect(loadUnsentVisits('z', broken)).toEqual([])
  })
})

describe('earlierEntries', () => {
  const leg = (visit: string): LegRecord => ({ darts: 30, busts: 0, won: true, rating: 'mostly', build: 'b', settingsKey: 'k', visit, startThrow: 0 })
  it('turns each stored visit into run and warm-up codes with that visit’s legs', () => {
    const [e] = earlierEntries([rec('a')], [leg('a'), leg('b'), leg('a')])
    expect(e.visit).toBe('a')
    expect(e.legs).toEqual([leg('a'), leg('a')])
    expect(decodeRunCode(e.run)).toEqual({ v: 1, seed: 7, settings: DEFAULT_SETTINGS, throws: [dart(10), dart(20)] })
    expect(decodeRunCode(e.warmup!)).toEqual({ v: 1, seed: 8, settings: DEFAULT_SETTINGS, throws: [dart(5)] })
    expect(e.startedAt).toBe(1000)
  })
  it('has no warm-up code when the warm-up was skipped, and falls back to the warm-up settings before play', () => {
    const [e] = earlierEntries([rec('a', { warmInputs: [] })], [])
    expect(e.warmup).toBeNull()
    const warm = { ...DEFAULT_SETTINGS, leadMs: 40 }
    const [f] = earlierEntries([rec('w', { played: null, inputs: [], warmSettings: warm })], [])
    expect(decodeRunCode(f.run)).toEqual({ v: 1, seed: 7, settings: warm, throws: [] })
  })
})
