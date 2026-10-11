import { test, expect } from '@playwright/test'
import { bbox, openCanvas } from './helpers'

// Clean slate + mid-drag states, pinned separately from the composed shot.
test('canvas empty: nebula backdrop with an invitation, no nodes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await openCanvas(page, 'e2e-canvas-empty')

  await expect(page.getByTestId('canvas-empty')).toBeVisible()
  expect(await page.getByTestId('canvas-node').count()).toBe(0)
  await expect(page.getByTestId('canvas-empty')).toContainText('Drag a component here to start building')
})

test('canvas small viewport: dots stay square, empty state holds', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openCanvas(page, 'e2e-canvas-small')

  await expect(page.getByTestId('canvas-empty')).toBeVisible()
  expect(await page.getByTestId('canvas-node').count()).toBe(0)
  // Phone band uses chunkier cells, but they must still be square.
  const dot = await bbox(page.getByTestId('canvas-dots').locator('i').first())
  expect(Math.abs(dot.width - dot.height)).toBeLessThan(1)
})

test('canvas dragging: ghost preview follows the card mid-drag, then it lands', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await openCanvas(page, 'e2e-canvas-drag')

  const palette = page.getByTestId('palette-text')
  const grid = page.getByTestId('canvas')
  const from = await bbox(palette)
  const gridBox = await bbox(grid)

  // Hold the drag mid-flight: native HTML5 drag, mouse still down.
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(gridBox.x + 400, gridBox.y + 300, { steps: 12 })

  const ghost = page.locator('.react-grid-placeholder')
  await expect(ghost).toBeVisible()

  await page.mouse.up()
  await expect(page.getByTestId('canvas-node')).toHaveCount(1)
})
