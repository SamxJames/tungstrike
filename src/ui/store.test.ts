import { describe, it, expect } from 'vitest'
import { loadJson, loadLead, saveJson, saveLead } from './store.ts'

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

describe('store', () => {
  it('saves and loads the release lead', () => {
    const s = memory()
    expect(loadLead(s)).toBeNull()
    saveLead(44, s)
    expect(loadLead(s)).toBe(44)
  })
  it('round-trips JSON and falls back on bad data', () => {
    const s = memory()
    expect(saveJson('k', { a: 1 }, s)).toBe(true)
    expect(loadJson('k', null, s)).toEqual({ a: 1 })
    s.setItem('bad', '{nope')
    expect(loadJson('bad', 'fallback', s)).toBe('fallback')
  })
  it('never throws when storage is blocked', () => {
    expect(loadLead(broken)).toBeNull()
    expect(() => saveLead(10, broken)).not.toThrow()
    expect(saveJson('k', 1, broken)).toBe(false)
    expect(loadJson('k', 5, broken)).toBe(5)
  })
})
