import { describe, it, expect, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../core/settings.ts'
import { decodeRunCode } from '../core/replay.ts'
import { buildPayload, parseStoredLegs, resultsText, sendResults } from './feedback.ts'
import type { LegRecord, ResultsPayload } from './feedback.ts'
import { loadUnsentVisits, markSent, saveVisit } from './visits.ts'
import type { VisitRecord } from './visits.ts'

const leg: LegRecord = { darts: 31, busts: 1, won: true, rating: 'mostly', build: 'abc1234', settingsKey: '#v1&rad=25;lead=60', visit: 'visit9', startThrow: 0 }
const payload: ResultsPayload = {
  v: 1, build: 'abc1234', visit: 'visit9', device: 'test-phone', settings: DEFAULT_SETTINGS,
  legs: [leg], run: 'RUNCODE', warmup: null, earlier: [],
}

describe('sendResults', () => {
  it('posts JSON and reports success', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 200 }))
    expect(await sendResults('https://form.example/x', payload, f as unknown as typeof fetch)).toBe(true)
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://form.example/x')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toMatchObject({ build: 'abc1234', run: 'RUNCODE', visit: 'visit9' })
  })
  it('reports failure on a non-OK response, a thrown error, or no URL', async () => {
    expect(await sendResults('https://x', payload, (async () => new Response('', { status: 500 })) as unknown as typeof fetch)).toBe(false)
    expect(await sendResults('https://x', payload, (async () => { throw new Error('offline') }) as unknown as typeof fetch)).toBe(false)
    expect(await sendResults(undefined, payload)).toBe(false)
    expect(await sendResults('', payload)).toBe(false)
  })
  it('does not call fetch at all without a URL', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 200 }))
    expect(await sendResults(undefined, payload, f as unknown as typeof fetch)).toBe(false)
    expect(f).not.toHaveBeenCalled()
  })
})

describe('resultsText', () => {
  it('includes the build, the visit, the ratings and the run code', () => {
    const t = resultsText(payload)
    expect(t).toContain('abc1234')
    expect(t).toContain('visit9')
    expect(t).toContain('mostly')
    expect(t).toContain('RUNCODE')
  })
  it('tags each leg with the settings it was played on and where it starts in the run log', () => {
    const t = resultsText({ ...payload, legs: [{ ...leg, startThrow: 7 }] })
    expect(t).toContain('#v1&rad=25;lead=60')
    expect(t).toContain('throw 7')
  })
  it('includes the warm-up code only when there is one, and marks unrated legs', () => {
    expect(resultsText(payload)).not.toContain('Warm-up code')
    const t = resultsText({ ...payload, warmup: 'WARMCODE', legs: [{ ...leg, darts: 40, busts: 0, won: false, rating: null }] })
    expect(t).toContain('Warm-up code: WARMCODE')
    expect(t).toContain('not rated')
    expect(t).toContain('not finished')
  })
  it('says so when no leg has been finished yet', () => {
    expect(resultsText({ ...payload, legs: [] })).toContain('No legs finished yet')
  })
})

describe('parseStoredLegs', () => {
  it('keeps well-formed entries', () => {
    expect(parseStoredLegs([leg])).toEqual([leg])
  })
  it('ignores non-arrays and entries that are not objects with numeric darts and busts', () => {
    expect(parseStoredLegs('nope')).toEqual([])
    expect(parseStoredLegs(null)).toEqual([])
    expect(parseStoredLegs([null, 3, 'x', { darts: '31', busts: 1 }, { darts: 31 }, { darts: NaN, busts: 0 }, leg])).toEqual([leg])
  })
  it('fills in tags missing from entries saved by an older build, and cleans the rating', () => {
    const [old] = parseStoredLegs([{ darts: 30, busts: 0, won: true, rating: 'banana' }])
    expect(old).toMatchObject({ darts: 30, busts: 0, won: true, rating: null, build: '', settingsKey: '', visit: '', startThrow: 0 })
  })
})

describe('buildPayload', () => {
  const store = (): Storage => {
    const m = new Map<string, string>()
    return { get length() { return m.size }, clear: () => m.clear(), getItem: (k) => m.get(k) ?? null, key: (i) => [...m.keys()][i] ?? null, removeItem: (k) => void m.delete(k), setItem: (k, v) => void m.set(k, v) }
  }
  const dart = { target: { x: 0, y: 1030 }, releaseTick: 12, rawMs: 96 }
  const visitRec = (visit: string): VisitRecord => ({ visit, startedAt: 5, seed: 1, played: DEFAULT_SETTINGS, inputs: [dart], warmSeed: 2, warmSettings: null, warmInputs: [], sent: false })
  const base = {
    build: 'abc1234', visit: 'now', device: 'test-phone', settings: DEFAULT_SETTINGS,
    run: { v: 1 as const, seed: 9, settings: DEFAULT_SETTINGS, throws: [dart] }, warm: null, logGap: false,
  }

  it('sends only this visit’s legs as legs, and each unsent earlier visit as its own entry', () => {
    const p = buildPayload({ ...base, legs: [{ ...leg, visit: 'old' }, { ...leg, visit: 'now' }], earlier: [visitRec('old')] })
    expect(p.legs).toEqual([{ ...leg, visit: 'now' }])
    expect(p.earlier).toHaveLength(1)
    expect(p.earlier[0]).toMatchObject({ visit: 'old', warmup: null, legs: [{ ...leg, visit: 'old' }] })
    expect(decodeRunCode(p.earlier[0].run).throws).toEqual([dart])
    expect(decodeRunCode(p.run)).toEqual(base.run)
    expect(p.warmup).toBeNull()
    expect(p.logGap).toBeUndefined()
  })
  it('puts a stored visit’s log gap in its earlier entry', () => {
    const p = buildPayload({ ...base, legs: [], earlier: [{ ...visitRec('old'), logGap: true }, visitRec('ok')] })
    expect(p.earlier[0].logGap).toBe(true)
    expect('logGap' in p.earlier[1]).toBe(false)
  })
  it('includes unsent earlier visits and excludes sent ones', () => {
    const s = store()
    saveVisit(visitRec('a'), s)
    saveVisit(visitRec('b'), s)
    saveVisit(visitRec('now'), s)
    markSent(['b'], s)
    const p = buildPayload({ ...base, legs: [], earlier: loadUnsentVisits('now', s) })
    expect(p.earlier.map((e) => e.visit)).toEqual(['a'])
  })
  it('flags a gap in the throw log', () => {
    expect(buildPayload({ ...base, legs: [], earlier: [], logGap: true }).logGap).toBe(true)
  })
})

describe('resultsText with earlier visits and log gaps', () => {
  it('lists each earlier visit with its legs, run code and warm-up code after the current visit', () => {
    const t = resultsText({
      ...payload,
      earlier: [{ visit: 'oldvisit', startedAt: 0, run: 'OLDRUN', warmup: 'OLDWARM', legs: [{ ...leg, visit: 'oldvisit', rating: 'rarely', darts: 44 }] }],
    })
    const lines = t.split('\n')
    const at = lines.findIndex((l) => l.startsWith('Earlier visit oldvisit'))
    expect(at).toBeGreaterThan(lines.indexOf('Run code: RUNCODE'))
    expect(lines.slice(at + 1)).toEqual([expect.stringMatching(/^Leg 1: 44 darts, .*rarely/), 'Run code: OLDRUN', 'Warm-up code: OLDWARM'])
  })
  it('notes a gap in the throw log', () => {
    expect(resultsText(payload)).not.toContain('gap')
    expect(resultsText({ ...payload, logGap: true })).toContain('Log gap detected')
  })
  it('notes a gap in an earlier visit inside that visit’s own block, and only there', () => {
    const t = resultsText({
      ...payload,
      earlier: [
        { visit: 'gappy', startedAt: 0, run: 'GAPRUN', warmup: null, legs: [], logGap: true },
        { visit: 'clean', startedAt: 0, run: 'CLEANRUN', warmup: null, legs: [] },
      ],
    })
    const lines = t.split('\n')
    const gappy = lines.findIndex((l) => l.startsWith('Earlier visit gappy'))
    const gapLine = lines.findIndex((l) => l.startsWith('Log gap detected'))
    expect(lines.filter((l) => l.startsWith('Log gap detected'))).toHaveLength(1)
    expect(gapLine).toBeGreaterThan(gappy)
    expect(gapLine).toBeLessThan(lines.indexOf('Run code: GAPRUN'))
    expect(lines.findIndex((l) => l.startsWith('Earlier visit clean'))).toBeGreaterThan(lines.indexOf('Run code: GAPRUN'))
  })
})
