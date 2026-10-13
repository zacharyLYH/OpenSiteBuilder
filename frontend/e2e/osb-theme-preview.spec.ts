import { test, expect } from '@playwright/test'
import { closeDrawerIfOpen, dropToCell, openCanvas, persistedDoc } from './helpers'

// Global theme: one switch in the header themes the whole canvas and persists
// to the document (site-level). It is never a per-node setting.
test('theme: header switches the whole canvas and persists to the doc', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await openCanvas(page, 'e2e-theme')
  const grid = page.getByTestId('canvas')
  await dropToCell(page, page.getByTestId('palette-text'), grid, { x: 0, y: 0 }, { cols: 6, rows: 1 })
  await closeDrawerIfOpen(page)

  await expect(grid).toHaveAttribute('data-theme', 'light')
  await expect(grid).toHaveScreenshot('osb-theme-light.png')

  // Objective: the node's own colour comes from the global theme.
  const nodeColor = () =>
    page.locator('[data-testid="canvas-node"] p').first().evaluate((el) => getComputedStyle(el).color)
  expect(await nodeColor()).toBe('rgb(15, 23, 42)')

  await page.getByTestId('theme-dark').click()
  await expect(grid).toHaveAttribute('data-theme', 'dark')
  expect(await nodeColor()).toBe('rgb(248, 250, 252)')
  await page.waitForTimeout(900)

  // The document carries one theme for the whole site — no per-node theme.
  const doc = await persistedDoc(page, 'e2e-theme')
  expect(doc.theme).toBe('dark')
  expect(doc.nodes.every((n) => (n.config as { theme?: unknown }).theme === undefined)).toBe(true)

  await expect(grid).toHaveScreenshot('osb-theme-dark.png')

  await page.reload()
  await expect(page.getByTestId('canvas')).toHaveAttribute('data-theme', 'dark')
})

// Preview: hide the editor grid (dots + backdrop) so the canvas reads as the
// real site. An editor preference — it never publishes.
test('preview: toggling off the grid shows the real site surface', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await openCanvas(page, 'e2e-preview')
  const grid = page.getByTestId('canvas')

  await expect(page.getByTestId('canvas-dots')).toHaveCount(1)
  await expect(grid).toHaveAttribute('data-preview', 'false')

  await page.getByTestId('toggle-preview').click()
  await expect(grid).toHaveAttribute('data-preview', 'true')
  await expect(page.getByTestId('canvas-dots')).toHaveCount(0)
  await expect(page.getByTestId('canvas-empty')).toHaveCount(0)
  await expect(grid).toHaveScreenshot('osb-preview-empty.png')

  await page.getByTestId('toggle-preview').click()
  await expect(grid).toHaveAttribute('data-preview', 'false')
  await expect(page.getByTestId('canvas-dots')).toHaveCount(1)
})
