import { test, expect } from '@playwright/test'
import { dropToCell } from './helpers'

// Gate: a left-aligned landing column (hero, card, CTA button), a drag
// reposition, persistence in localStorage, and one canvas screenshot.
// All placement goes through real drags + the canPlace gate — exactly the
// user path — so the shot always shows a sensible, overlap-free page.
// Cursor math lives in dropToCell; this file only declares cells.
test('canvas: compose hero+card+button, reposition button, persist, screenshot', async ({
  page,
}) => {
  await page.context().addCookies([
    { name: 'obs_curr_project_name', value: 'e2e-canvas', url: 'http://localhost:9199' },
  ])
  await page.setViewportSize({ width: 1280, height: 1100 })
  await page.goto('/canvas')

  // Dots are true squares: first guide cell measures equal sides.
  const dot = await page.getByTestId('canvas-dots').locator('i').first().boundingBox()
  expect(Math.abs(dot!.width - dot!.height)).toBeLessThan(1)

  const grid = page.getByTestId('canvas')
  await dropToCell(page, page.getByTestId('palette-hero'), grid, { x: 6, y: 0 }, { cols: 20, rows: 8 })
  await dropToCell(page, page.getByTestId('palette-card'), grid, { x: 6, y: 8 }, { cols: 10, rows: 10 })
  await dropToCell(page, page.getByTestId('palette-button'), grid, { x: 18, y: 8 }, { cols: 6, rows: 2 })
  await expect(page.getByTestId('canvas-node')).toHaveCount(3)

  // Reposition: slide the button down under the card, still left-aligned.
  await dropToCell(page, page.getByTestId('canvas-node').last(), grid, { x: 6, y: 18 }, { cols: 6, rows: 2 })

  // Persist debounce is 500ms.
  await page.waitForTimeout(900)
  const doc = await page.evaluate(
    () => JSON.parse(localStorage.getItem('osb.project.e2e-canvas')!) as {
      nodes: { type: string; x: number; y: number; cols: number; rows: number }[]
    },
  )
  expect(doc.nodes.map((n) => n.type).sort()).toEqual(['button', 'card', 'hero'])
  const at = (t: string) => doc.nodes.find((n) => n.type === t)!
  expect(at('hero')).toMatchObject({ x: 6, y: 0, cols: 20, rows: 8 })
  expect(at('card')).toMatchObject({ x: 6, y: 8, cols: 10, rows: 10 })
  expect(at('button')).toMatchObject({ x: 6, y: 18, cols: 6, rows: 2 })

  // The drag selected the button and opened its drawer; close it for a clean shot.
  await page.getByRole('button', { name: 'Close settings' }).click()
  await expect(page.getByTestId('config-drawer')).toHaveCount(0)

  await expect(grid).toHaveScreenshot('osb-canvas.png')
})
