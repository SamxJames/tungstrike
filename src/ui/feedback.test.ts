import { describe, it, expect, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../core/settings.ts'
import { resultsText, sendResults } from './feedback.ts'
import type { ResultsPayload } from './feedback.ts'

const payload: ResultsPayload = {
  v: 1, build: 'abc1234', device: 'test-phone', settings: DEFAULT_SETTINGS,
  legs: [{ darts: 31, busts: 1, won: true, rating: 'mostly' }], run: 'RUNCODE', warmup: null,
}

describe('sendResults', () => {
  it('posts JSON and reports success', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 200 }))
    expect(await sendResults('https://form.example/x', payload, f as unknown as typeof fetch)).toBe(true)
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://form.example/x')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toMatchObject({ build: 'abc1234', run: 'RUNCODE' })
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
  it('includes the build, the ratings and the run code', () => {
    const t = resultsText(payload)
    expect(t).toContain('abc1234')
    expect(t).toContain('mostly')
    expect(t).toContain('RUNCODE')
  })
  it('includes the warm-up code only when there is one, and marks unrated legs', () => {
    expect(resultsText(payload)).not.toContain('Warm-up code')
    const t = resultsText({ ...payload, warmup: 'WARMCODE', legs: [{ darts: 40, busts: 0, won: false, rating: null }] })
    expect(t).toContain('Warm-up code: WARMCODE')
    expect(t).toContain('not rated')
    expect(t).toContain('not finished')
  })
})
