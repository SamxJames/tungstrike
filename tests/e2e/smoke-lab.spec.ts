import { test, expect } from '@playwright/test'

test('lab: tune, throw a drill dart, and screenshot', async ({ page }, info) => {
  await page.goto('/lab')
  await expect(page.getByTestId('board')).toBeVisible()
  const wobble = page.getByTestId('lab-slider-wobbleRadius').locator('input')
  await wobble.fill('30')
  await expect.poll(() => page.url()).toContain('rad=30')
  await page.getByTestId('start-drill').click()
  await page.waitForTimeout(300)
  await page.getByTestId('release-pad').click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: `test-results/lab-${info.project.name}.png`, fullPage: false })
})

test('lab: timing check bar sweeps the whole track, five taps set a grid-snapped lead once', async ({ page }, info) => {
  await page.goto('/lab')
  await page.getByTestId('timing-check').click()
  const bar = page.getByTestId('calibrate-bar')
  const track = page.getByTestId('calibrate-track')
  await expect(bar).toBeVisible()
  const trackBox = (await track.boundingBox())!
  const barW = (await bar.boundingBox())!.width
  const travel = trackBox.width - barW
  // Sample the bar for at least 600ms and at least 8 samples (a busy machine samples slowly). One sweep is 1000ms, so
  // in 600ms it covers well over a third of the track wherever it starts: judge relative to the track, not in pixels.
  const xs: number[] = []
  const t0 = Date.now()
  while ((Date.now() - t0 < 600 || xs.length < 8) && Date.now() - t0 < 5000) {
    const b = await bar.boundingBox()
    if (b) xs.push(b.x - trackBox.x)
    await page.waitForTimeout(30)
  }
  expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(travel * 0.3)
  expect(Math.min(...xs)).toBeGreaterThanOrEqual(-1)
  expect(Math.max(...xs)).toBeLessThanOrEqual(travel + 1)
  await page.screenshot({ path: `test-results/lab-timing-${info.project.name}.png`, fullPage: false })

  // Five taps finish the check once; extra taps are ignored; the lead lands on the slider grid.
  const pad = page.getByTestId('calibrate-pad')
  for (let i = 0; i < 5; i++) {
    await pad.click()
    await page.waitForTimeout(170)
  }
  await expect(page.getByTestId('calibrate-pad')).toHaveCount(0)
  const text = await page.getByTestId('lab-slider-leadMs').locator('output').innerText()
  const lead = Number.parseInt(text, 10)
  expect(Number.isFinite(lead)).toBe(true)
  expect((lead + 150) % 4).toBe(0)
})

test('lab: in landscape the drill report has a close button that stays at the top while scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/lab')
  await page.getByTestId('start-drill').click()
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(700)
    await page.getByTestId('release-pad').click()
  }
  await expect(page.getByTestId('drill-report')).toBeVisible({ timeout: 3000 })
  const top = page.getByTestId('close-report-top')
  await expect(top).toBeInViewport()
  await page.locator('.sheet').evaluate((el) => el.scrollTo(0, el.scrollHeight))
  await expect(top).toBeInViewport()
  await top.click()
  await expect(page.getByTestId('drill-report')).toHaveCount(0)
})

test('lab: share link, play-leg link, slider sizes', async ({ page }) => {
  // Make the share path deterministic: no native share sheet, clipboard accepts the text.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.resolve() }, configurable: true })
  })
  await page.goto('/lab')
  await page.getByTestId('share-link').click()
  await expect(page.getByText('Copied', { exact: true })).toBeVisible()
  // Slider touch sizes.
  const row = page.getByTestId('lab-slider-zoomPct')
  expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(56)
  expect((await row.locator('button.step').first().boundingBox())!.height).toBeGreaterThanOrEqual(44)
  expect((await row.locator('button.lbl').boundingBox())!.height).toBeGreaterThanOrEqual(44)
  // Play-leg is a full-width primary button on its own row.
  const play = (await page.getByTestId('play-leg').boundingBox())!
  expect(play.width).toBeGreaterThan(300)
  await expect(page.getByTestId('play-leg')).toHaveAttribute('href', /^\/#v1&rad=/)
})
