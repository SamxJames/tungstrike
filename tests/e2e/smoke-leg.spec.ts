import { test, expect } from '@playwright/test'

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

test('leg: Copy my results is reachable before a win, confirms, and goes back to the leg', async ({ page }, info) => {
  // Make the copy path deterministic: the clipboard accepts the text (same stub idea as the Lab share test).
  await page.addInitScript(() => {
    const w = window as unknown as { __copied: string[] }
    w.__copied = []
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t: string) => { w.__copied.push(t); return Promise.resolve() } }, configurable: true })
  })
  await page.goto(EASY)
  await page.getByTestId('skip-calibration').click()
  await page.getByTestId('skip-warmup').click()
  await page.waitForTimeout(700)
  await page.getByTestId('release-pad').click()
  await expect(page.getByTestId('darts-used')).toHaveText('1', { timeout: 3000 })
  await page.screenshot({ path: `test-results/leg-results-btn-${info.project.name}.png` })
  await page.getByTestId('open-results').click()
  await expect(page.getByText('Your results so far')).toBeVisible()
  await page.getByTestId('copy-results').click()
  await expect(page.getByText('Copied.')).toBeVisible()
  await page.screenshot({ path: `test-results/leg-results-${info.project.name}.png` })
  const copied = await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied)
  expect(copied).toHaveLength(1)
  expect(copied[0]).toContain('Run code:')
  expect(copied[0]).toContain('No legs finished yet')
  await page.getByTestId('close-results').click()
  await expect(page.getByTestId('copy-results')).toHaveCount(0)
  await expect(page.getByTestId('remaining')).toBeVisible()
})
