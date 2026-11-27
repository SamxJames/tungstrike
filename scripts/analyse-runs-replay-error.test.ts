import { describe, it, expect, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../src/core/settings.ts'
import { encodeRunCode } from '../src/core/replay.ts'

vi.mock('../src/core/analysis.ts', async (orig) => {
  const real = await orig<typeof import('../src/core/analysis.ts')>()
  return {
    ...real,
    summariseRun: (log: { seed: number }) => {
      if (log.seed === 666) throw new Error('replay blew up')
      return real.summariseRun(log as never)
    },
  }
})
const { analyse } = await import('./analyse-runs.mjs')

const mk = (seed: number) => encodeRunCode({ v: 1, seed, settings: DEFAULT_SETTINGS, throws: [] })

describe('analyse: a code that decodes but throws during replay', () => {
  it('is reported as not a valid run code and does not stop the other runs', () => {
    const lines = analyse(`${mk(1)}\n${mk(666)}\n${mk(2)}`)
    expect(lines).toHaveLength(3)
    expect(lines[0]).toMatch(/^run 1:/)
    expect(lines[1]).toBe('line 2: not a valid run code')
    expect(lines[2]).toMatch(/^run 2:/)
  })
})
