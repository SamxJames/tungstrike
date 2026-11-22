import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanRoot } from './guard.mjs'

let root = ''
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'guard-'))
  mkdirSync(join(root, 'src', 'core'), { recursive: true })
  mkdirSync(join(root, 'src', 'ui'), { recursive: true })
})
const put = (rel: string, body: string) => writeFileSync(join(root, rel), body)

describe('guard', () => {
  it('passes clean code', () => {
    put('src/core/a.ts', 'export const a = 1\n')
    expect(scanRoot(root)).toEqual([])
  })
  it.each(['Math.random()', 'Date.now()', 'performance.now()', 'new Date()', 'Math.sin(1)', 'Math.cos(1)', 'Math.atan2(1, 2)'])(
    'flags %s in core',
    (snippet) => {
      put('src/core/a.ts', `export const a = ${snippet}\n`)
      expect(scanRoot(root)).toHaveLength(1)
    },
  )
  it('allows those APIs outside core', () => {
    put('src/ui/a.ts', 'export const a = Math.random() + Date.now() + Math.sin(1)\n')
    expect(scanRoot(root)).toEqual([])
  })
  it('flags banned brand and player terms anywhere in src', () => {
    put('src/ui/a.ts', "export const t = 'Premier League'\n")
    put('src/core/b.ts', '// Luke Littler\nexport const b = 1\n')
    expect(scanRoot(root)).toHaveLength(2)
  })
  it('does not flag lookalike words', () => {
    put('src/ui/a.ts', "export const t = 'pdcx skyline'\n")
    expect(scanRoot(root)).toEqual([])
  })
})
