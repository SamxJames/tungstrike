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
