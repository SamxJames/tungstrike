import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanRoot } from './guard.mjs'

let root = ''
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'guard-'))
  mkdirSync(join(root, 'src', 'core', 'tables'), { recursive: true })
  mkdirSync(join(root, 'src', 'ui'), { recursive: true })
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})
const put = (rel: string, body: string) => writeFileSync(join(root, rel), body)

describe('guard', () => {
  it('passes clean code', () => {
    put('src/core/a.ts', 'export const a = 1\n')
    expect(scanRoot(root)).toEqual([])
  })
  it.each(['Math.random()', 'Date.now()', 'performance.now()', 'new Date()', 'Math.sin(1)', 'Math.cos(1)', 'Math.tan(1)', 'Math.atan2(1, 2)'])(
    'flags %s in core',
    (snippet) => {
      put('src/core/a.ts', `export const a = ${snippet}\n`)
      expect(scanRoot(root)).toHaveLength(1)
    },
  )
  it('reports problems as path:line: reason', () => {
    put('src/core/a.ts', 'export const ok = 1\nexport const a = Math.random()\n')
    expect(scanRoot(root)).toEqual(['src/core/a.ts:2: Math.random is banned in src/core (use the seeded draws)'])
  })
  it.each(['a.tsx', 'a.mts', 'a.js', 'a.mjs'])('applies the core rules to %s in core', (name) => {
    put(`src/core/${name}`, 'export const a = Math.random()\n')
    expect(scanRoot(root)).toHaveLength(1)
  })
  it('allows trig only in exactly src/core/tables/generated.ts, and still applies the other core rules there', () => {
    put('src/core/tables/generated.ts', 'export const s = Math.sin(1)\n')
    expect(scanRoot(root)).toEqual([])
    put('src/core/tables/generated.ts', 'export const s = Math.random()\n')
    expect(scanRoot(root)).toHaveLength(1)
  })
  it('does not exempt lookalike paths from the trig rule', () => {
    mkdirSync(join(root, 'src', 'core', 'other', 'tables'), { recursive: true })
    put('src/core/other/tables/generated.ts', 'export const s = Math.sin(1)\n')
    put('src/core/generated.ts', 'export const s = Math.cos(1)\n')
    expect(scanRoot(root)).toHaveLength(2)
  })
  it('allows those APIs outside core', () => {
    put('src/ui/a.ts', 'export const a = Math.random() + Date.now() + Math.sin(1)\n')
    expect(scanRoot(root)).toEqual([])
  })
  it('flags banned brand and player terms anywhere in src', () => {
    put('src/ui/a.ts', "export const t = 'Premier League'\n")
    put('src/core/b.ts', '// Luke Littler\nexport const b = 1\n')
    expect(scanRoot(root)).toHaveLength(2)
  })
  it('scans text files only (not images or other binaries)', () => {
    mkdirSync(join(root, 'public'), { recursive: true })
    put('public/notes.txt', 'Premier League\n')
    put('public/manifest.webmanifest', '{"name": "PDC"}\n')
    put('public/icon.png', 'Premier League\n') // a binary that happens to contain the bytes
    put('src/ui/a.css', '/* Ally Pally */\n')
    expect(scanRoot(root).map((p) => p.split(':')[0]).sort()).toEqual(['public/manifest.webmanifest', 'public/notes.txt', 'src/ui/a.css'])
  })
  it('does not flag lookalike words', () => {
    put('src/ui/a.ts', "export const t = 'pdcx skyline'\n")
    expect(scanRoot(root)).toEqual([])
  })
})

describe('guard CLI', () => {
  it('exits 0 on this repository', () => {
    const r = spawnSync(process.execPath, [join(import.meta.dirname, 'guard.mjs')], { encoding: 'utf8' })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('guard: ok')
  })
  it('exits 1 and prints path:line: problems for a bad root', () => {
    put('src/core/a.ts', 'export const a = Date.now()\n')
    const r = spawnSync(process.execPath, [join(import.meta.dirname, 'guard.mjs'), root], { encoding: 'utf8' })
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('src/core/a.ts:1: Date.now is banned')
  })
})
