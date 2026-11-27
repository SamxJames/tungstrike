import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'

const golden = JSON.parse(readFileSync(new URL('../golden/replay-v1.json', import.meta.url), 'utf8'))
// Test-only hook to prove the spec can fail: TUNGSTRIKE_CORRUPT_GOLDEN=1 changes one expected number in memory.
if (process.env.TUNGSTRIKE_CORRUPT_GOLDEN === '1') golden.expected.throws[0].score += 1

test('replay gives the same result in this browser engine as in Node', async ({ page }) => {
  await page.goto('/')
  const actual = await page.evaluate(async (log) => {
    const path = '/src/core/replay.ts'
    const mod = await import(/* @vite-ignore */ path)
    return mod.replayRun(log)
  }, golden.log)
  expect(actual).toEqual(golden.expected)
})
