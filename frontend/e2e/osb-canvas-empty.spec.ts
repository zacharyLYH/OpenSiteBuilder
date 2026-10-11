import { test, expect } from '@playwright/test'

// Clean slate + mid-drag states, pinned separately from the composed shot.
test('canvas empty: nebula backdrop with an invitation, no nodes', async ({ page }) => {
  await page.context().addCookies([
    { name: 'obs_curr_project_name', value: 'e2e-canvas-empty', url: 'http://localhost:9199' },
  ])
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/canvas')

  await expect(page.getByTestId('canvas-empty')).toBeVisible()
  expect(await page.getByTestId('canvas-node').count()).toBe(0)
  await expect(page.getByTestId('canvas')).toHaveScreenshot('osb-canvas-empty.png')
})

test('canvas small viewport: dots stay square, empty state holds', async ({ page }) => {
  await page.context().addCookies([
    { name: 'obs_curr_project_name', value: 'e2e-canvas-small', url: 'http://localhost:9199' },
  ])
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/canvas')

  await expect(page.getByTestId('canvas-empty')).toBeVisible()
  expect(await page.getByTestId('canvas-node').count()).toBe(0)
  // Phone band uses chunkier cells, but they must still be square.
  const dot = await page.getByTestId('canvas-dots').locator('i').first().boundingBox()
  expect(Math.abs(dot!.width - dot!.height)).toBeLessThan(1)
  await expect(page.getByTestId('canvas')).toHaveScreenshot('osb-canvas-small.png')
})

test('canvas dragging: ghost preview follows the card mid-drag, then it lands', async ({
  page,
}) => {
  await page.context().addCookies([
    { name: 'obs_curr_project_name', value: 'e2e-canvas-drag', url: 'http://localhost:9199' },
  ])
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/canvas')

  const palette = page.getByTestId('palette-text')
  const grid = page.getByTestId('canvas')
  const from = (await palette.boundingBox())!
  const gridBox = (await grid.boundingBox())!

  // Hold the drag mid-flight: native HTML5 drag, mouse still down.
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(gridBox.x + 400, gridBox.y + 300, { steps: 12 })

  const ghost = page.locator('.react-grid-placeholder')
  await expect(ghost).toBeVisible()
  await expect(grid).toHaveScreenshot('osb-canvas-dragging.png')

  await page.mouse.up()
  await expect(page.getByTestId('canvas-node')).toHaveCount(1)
})
