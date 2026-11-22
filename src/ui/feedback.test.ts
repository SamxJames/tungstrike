import { describe, it, expect, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../core/settings.ts'
import { parseStoredLegs, resultsText, sendResults } from './feedback.ts'
import type { LegRecord, ResultsPayload } from './feedback.ts'

const leg: LegRecord = { darts: 31, busts: 1, won: true, rating: 'mostly', build: 'abc1234', settingsKey: '#v1&rad=25;lead=60', visit: 'visit9', startThrow: 0 }
const payload: ResultsPayload = {
  v: 1, build: 'abc1234', visit: 'visit9', device: 'test-phone', settings: DEFAULT_SETTINGS,
  legs: [leg], run: 'RUNCODE', warmup: null,
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
