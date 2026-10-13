import { test, expect, type Locator } from '@playwright/test'
import { openCanvas } from './helpers'

// The app bar is the only way to Validate, leave the project, or Publish. It
// is a fixed 56px row, so on a narrow window its content is wider than the
// page: without somewhere to go, the buttons were rendered outside the
// viewport with no way to reach them — Publish and Exit were simply lost.
// The bar now scrolls sideways, and the row keeps its natural width so the
// buttons stay readable instead of squashing.
const inViewport = async (locator: Locator, width: number): Promise<boolean> => {
  const box = await locator.boundingBox()
  return !!box && box.x >= 0 && box.x + box.width <= width
}

test('narrow window: Validate, Exit and Push stay reachable', async ({ page }) => {
  const width = 390
  await page.setViewportSize({ width, height: 844 })
  await openCanvas(page, 'e2e-narrow-header')

  const header = page.locator('header')
  expect(await header.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)

  // Reachable means each button can be scrolled into the window and clicked
  // — not that every action fits on screen at once (Popups + Drawers trays
  // widened the bar past a single 390px window).
  for (const target of [page.getByTestId('validate'), page.getByRole('button', { name: 'Exit project' }), page.getByRole('button', { name: 'Push' })]) {
    await target.scrollIntoViewIfNeeded()
    expect(await inViewport(target, width)).toBe(true)
  }
  // Reachable means clickable, not merely painted.
  await page.getByTestId('validate').click()
  await expect(page.getByTestId('validate-panel')).toBeVisible()
  await page.getByRole('button', { name: 'Close checks' }).click()
  await expect(page.getByTestId('validate-panel')).toHaveCount(0)

  // The page itself must never scroll sideways.
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
  ).toBe(0)
})

test('wide window: the bar fits and does not scroll', async ({ page }) => {
  const width = 1280
  await page.setViewportSize({ width, height: 800 })
  await openCanvas(page, 'e2e-wide-header')

  const header = page.locator('header')
  expect(await header.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(false)
  for (const action of ['Exit project', 'Push']) {
    expect(await inViewport(page.getByRole('button', { name: action }), width)).toBe(true)
  }
  expect(await inViewport(page.getByTestId('validate'), width)).toBe(true)
})
