import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// Settings that make every dart easy: tiny wobble, slow loop, no scatter, big zoom.
const EASY = '/#v1&rad=10&loop=2500&shp=100&sct=0&zm=350'

test('leg: aim, throw, darts counter moves, screenshot', async ({ page }, info) => {
  await page.goto('/')
  await page.getByTestId('skip-calibration').click()
  await page.getByTestId('skip-warmup').click()
  await expect(page.getByTestId('board')).toBeVisible()
  await expect(page.getByTestId('remaining')).toHaveText('501')
  await page.getByTestId('board').click({ position: { x: 195, y: 150 } })
  await page.waitForTimeout(300)
  await page.getByTestId('release-pad').click()
  await expect(page.getByTestId('darts-used')).toHaveText('1', { timeout: 3000 })
  await page.screenshot({ path: `test-results/leg-${info.project.name}.png` })
})

test('leg: HUD counts three darts, shows par, no bust, no rating prompt', async ({ page }) => {
  // Record each landing chip ("T20 · 60") as it appears, so the score can be checked against the HUD.
  await page.addInitScript(() => {
    const w = window as unknown as { __chips: string[] }
    w.__chips = []
    new MutationObserver((muts) => {
      for (const m of muts)
        for (const n of Array.from(m.addedNodes))
          if (n instanceof HTMLElement && n.classList.contains('chip')) w.__chips.push(n.textContent ?? '')
    }).observe(document, { childList: true, subtree: true })
  })
  await page.goto(EASY)
  await page.getByTestId('skip-calibration').click()
  await page.getByTestId('skip-warmup').click()
  await expect(page.getByText('Par 33')).toBeVisible()
  await expect(page.getByTestId('remaining')).toHaveText('501')
  await expect(page.getByTestId('darts-used')).toHaveText('0')
  for (let n = 1; n <= 3; n++) {
    await page.waitForTimeout(700) // the previous throw's lock-out
    await page.getByTestId('release-pad').click()
    await expect(page.getByTestId('darts-used')).toHaveText(String(n), { timeout: 3000 })
    await expect(page.getByText('BUST')).toHaveCount(0)
  }
  const chips = await page.evaluate(() => (window as unknown as { __chips: string[] }).__chips)
  expect(chips).toHaveLength(3)
  const total = chips.reduce((sum, c) => sum + Number(c.match(/(\d+)$/)![1]), 0)
  // Three darts is one full turn from 501: it can't bust, so the remaining score is exactly 501 minus the three scores.
  await expect(page.getByTestId('remaining')).toHaveText(String(501 - total))
  await expect(page.getByTestId('rating-mostly')).toHaveCount(0)
  await expect(page.getByTestId('another-leg')).toHaveCount(0)
})

test('leg: ten warm-up darts lead into the leg (or offer a lead adjustment first)', async ({ page }, info) => {
  await page.goto(EASY)
  await page.screenshot({ path: `test-results/leg-calibrate-${info.project.name}.png` })
  await page.getByTestId('skip-calibration').click()
  await expect(page.getByText('Warm-up 0/10')).toBeVisible()
  await page.screenshot({ path: `test-results/leg-warmup-${info.project.name}.png` })
  for (let n = 1; n <= 10; n++) {
    await page.waitForTimeout(700)
    await page.getByTestId('release-pad').click()
    // The tenth dart ends the warm-up straight away, so only the first nine show up in the counter.
    if (n < 10) await expect(page.getByText(`Warm-up ${n}/10`)).toBeVisible({ timeout: 3000 })
  }
  const apply = page.getByTestId('apply-lead')
  const remaining = page.getByTestId('remaining')
  await expect(apply.or(remaining)).toBeVisible()
  if (await apply.isVisible()) {
    await page.getByTestId('keep-lead').click()
  }
  await expect(remaining).toHaveText('501')
  await expect(page.getByTestId('darts-used')).toHaveText('0')
})

/** Clipboard stub that records what was copied, plus a recorder for the landing chips ("T20 · 60"). */
async function recordCopiesAndChips(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __copied: string[]; __chips: string[] }
    w.__copied = []
    w.__chips = []
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t: string) => { w.__copied.push(t); return Promise.resolve() } }, configurable: true })
    new MutationObserver((muts) => {
      for (const m of muts)
        for (const n of Array.from(m.addedNodes))
          if (n instanceof HTMLElement && n.classList.contains('chip')) w.__chips.push(n.textContent ?? '')
    }).observe(document, { childList: true, subtree: true })
  })
}
const copiedTexts = (page: Page) => page.evaluate(() => (window as unknown as { __copied: string[] }).__copied)
const chipScores = async (page: Page) =>
  (await page.evaluate(() => (window as unknown as { __chips: string[] }).__chips)).map((c) => Number(c.match(/(\d+)$/)![1]))

/** Replay a run code in the page with the real core modules (the same seam the analysis uses). */
function replayInPage(page: Page, code: string) {
  return page.evaluate(async (c) => {
    const path = '/src/core/replay.ts'
    const mod = await import(/* @vite-ignore */ path)
    return mod.replayRun(mod.decodeRunCode(c)) as { throws: { score: number; remaining: number }[] }
  }, code)
}

async function startLeg(page: Page) {
  await page.getByTestId('skip-calibration').click()
  await page.getByTestId('skip-warmup').click()
  await expect(page.getByTestId('remaining')).toBeVisible()
}

async function throwDarts(page: Page, n: number) {
  const before = Number(await page.getByTestId('darts-used').textContent())
  for (let i = 1; i <= n; i++) {
    await page.waitForTimeout(700) // the previous throw's lock-out
    await page.getByTestId('release-pad').click()
    await expect(page.getByTestId('darts-used')).toHaveText(String(before + i), { timeout: 3000 })
  }
}

test('leg: Copy my results is reachable before a win, confirms, replays to what the HUD showed, and goes back', async ({ page }, info) => {
  // Make the copy path deterministic: the clipboard accepts the text (same stub idea as the Lab share test).
  await recordCopiesAndChips(page)
  await page.goto(EASY)
  await startLeg(page)
  await throwDarts(page, 2)
  await page.screenshot({ path: `test-results/leg-results-btn-${info.project.name}.png` })
  await page.getByTestId('open-results').click()
  await expect(page.getByText('Your results so far')).toBeVisible()
  await page.getByTestId('copy-results').click()
  await expect(page.getByText('Copied.')).toBeVisible()
  await page.screenshot({ path: `test-results/leg-results-${info.project.name}.png` })
  const copied = await copiedTexts(page)
  expect(copied).toHaveLength(1)
  expect(copied[0]).toContain('No legs finished yet')
  // The UI-to-replay seam: the copied run code replays to exactly the darts, scores and remaining the screen showed.
  const code = copied[0].match(/^Run code: (\S+)$/m)![1]
  const replay = await replayInPage(page, code)
  expect(replay.throws).toHaveLength(2)
  expect(replay.throws.map((t) => t.score)).toEqual(await chipScores(page))
  expect(replay.throws.at(-1)!.remaining).toBe(Number(await page.getByTestId('remaining').textContent()))
  await page.getByTestId('close-results').click()
  await expect(page.getByTestId('copy-results')).toHaveCount(0)
  await expect(page.getByTestId('remaining')).toBeVisible()
})

test('leg: a reload keeps the throw log; the next copy includes the earlier visit once', async ({ page }) => {
  await recordCopiesAndChips(page)
  await page.goto(EASY)
  await startLeg(page)
  await throwDarts(page, 1)
  const firstScores = await chipScores(page)
  await page.reload()
  await startLeg(page)
  await page.getByTestId('open-results').click()
  await expect(page.getByTestId('earlier-visits')).toContainText('1 earlier visit')
  await page.getByTestId('copy-results').click()
  await expect(page.getByText('Copied.')).toBeVisible()
  const [text] = await copiedTexts(page)
  expect(text).toMatch(/^Earlier visit /m)
  const codes = [...text.matchAll(/^Run code: (\S+)$/gm)].map((m) => m[1])
  expect(codes).toHaveLength(2)
  const earlier = await replayInPage(page, codes[1])
  expect(earlier.throws.map((t) => t.score)).toEqual(firstScores)
  // Copied once: it is marked sent, so the next visit does not offer it again.
  await page.reload()
  await startLeg(page)
  await page.getByTestId('open-results').click()
  await expect(page.getByText('Your results so far')).toBeVisible()
  await expect(page.getByTestId('earlier-visits')).toHaveCount(0)
})

test('leg: with storage blocked (private tab) the leg still plays and says progress is not saved', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked') }, configurable: true })
  })
  await page.goto(EASY)
  await startLeg(page)
  await throwDarts(page, 1)
  await page.getByTestId('open-results').click()
  await expect(page.getByTestId('not-saved')).toHaveText("Private tab: your progress isn't saved on this phone. Copy or send after each leg.")
})

test('leg: first screen names the game, explains it, and has a big Skip above the pad', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('calibrate-intro')).toContainText('Tungstrike')
  await expect(page.getByTestId('calibrate-intro')).toContainText('A darts game: time your tap to throw.')
  const skip = (await page.getByTestId('skip-calibration').boundingBox())!
  const pad = (await page.getByTestId('calibrate-pad').boundingBox())!
  expect(skip.height).toBeGreaterThanOrEqual(48)
  expect(skip.y + skip.height).toBeLessThanOrEqual(pad.y)
})

test('leg: landscape 844x390 keeps the timing track visible and every overlay button reachable', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) }, configurable: true })
  })
  await page.goto(EASY)
  expect((await page.getByTestId('calibrate-track').boundingBox())!.height).toBeGreaterThanOrEqual(12)
  await startLeg(page)
  await throwDarts(page, 1)
  await page.getByTestId('open-results').click()
  await page.getByTestId('copy-results').click()
  await expect(page.locator('textarea')).toBeVisible() // the tallest version of the panel
  expect((await page.locator('textarea').boundingBox())!.height).toBeGreaterThan(40)
  const back = page.getByTestId('close-results')
  await back.scrollIntoViewIfNeeded()
  await expect(back).toBeInViewport()
  await back.click()
  await expect(page.getByTestId('copy-results')).toHaveCount(0)
})

for (const clipboard of ['accepts', 'rejects'] as const) {
  test(`leg: copy status goes stale-free when a dart lands after it (clipboard ${clipboard})`, async ({ page }) => {
    await page.addInitScript((mode) => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: () => (mode === 'accepts' ? Promise.resolve() : Promise.reject(new Error('denied'))) },
        configurable: true,
      })
    }, clipboard)
    await page.goto(EASY)
    await page.getByTestId('skip-calibration').click()
    await page.getByTestId('skip-warmup').click()
    await page.waitForTimeout(700)
    await page.getByTestId('release-pad').click()
    await expect(page.getByTestId('darts-used')).toHaveText('1', { timeout: 3000 })
    await page.getByTestId('open-results').click()
    await page.getByTestId('copy-results').click()
    if (clipboard === 'accepts') await expect(page.getByText('Copied.')).toBeVisible()
    else await expect(page.locator('textarea')).toBeVisible()
    await page.getByTestId('close-results').click()
    await page.waitForTimeout(700)
    await page.getByTestId('release-pad').click()
    await expect(page.getByTestId('darts-used')).toHaveText('2', { timeout: 3000 })
    await page.getByTestId('open-results').click()
    // The data changed since the copy, so neither the confirmation nor the old fallback text may still show.
    await expect(page.getByText('Your results so far')).toBeVisible()
    await expect(page.getByText('Copied.')).toHaveCount(0)
    await expect(page.getByText('Could not copy')).toHaveCount(0)
    await expect(page.locator('textarea')).toHaveCount(0)
  })
}
