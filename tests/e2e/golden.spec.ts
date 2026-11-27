import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'

const load = (name: string) => JSON.parse(readFileSync(new URL(`../golden/${name}`, import.meta.url), 'utf8'))
const goldens = { 'replay-v1.json': load('replay-v1.json'), 'replay-v1-legs.json': load('replay-v1-legs.json') }
// Test-only hook to prove the spec can fail: TUNGSTRIKE_CORRUPT_GOLDEN=1 changes one expected number in memory.
if (process.env.TUNGSTRIKE_CORRUPT_GOLDEN === '1') goldens['replay-v1.json'].expected.throws[0].score += 1

for (const [name, golden] of Object.entries(goldens)) {
  test(`replay gives the same result in this browser engine as in Node (${name})`, async ({ page }) => {
    await page.goto('/')
    const actual = await page.evaluate(async (log) => {
      const path = '/src/core/replay.ts'
      const mod = await import(/* @vite-ignore */ path)
      return mod.replayRun(log)
    }, golden.log)
    expect(actual).toEqual(golden.expected)
  })
}
