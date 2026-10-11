import { test, expect } from '@playwright/test'
import { bbox, closeDrawerIfOpen, dropToCell, gridPitch, openCanvas, persistedDoc } from './helpers'
import { validateDoc } from '../src/canvas/doc'

// Gate: a pattern drop (card + 3 atoms), a touching text neighbor, an RGL
// reposition, persistence in localStorage, and one canvas screenshot.
// All placement goes through real drags + the doc gate — exactly the user
// path — so the shot always shows a sensible, connected page.
// Cursor math lives in dropToCell; this file only declares cells.
test('canvas: compose pattern+text, reposition text, persist, screenshot', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1100 })
  await openCanvas(page, 'e2e-canvas')

  // Dots are true squares: first guide cell measures equal sides.
  const dot = await bbox(page.getByTestId('canvas-dots').locator('i').first())
  expect(Math.abs(dot.width - dot.height)).toBeLessThan(1)

  const grid = page.getByTestId('canvas')
  await dropToCell(page, page.getByTestId('palette-pattern-card-content'), grid, { x: 0, y: 0 }, { cols: 12, rows: 10 })
  // Pattern lands 4 nodes: 1 shell + 3 connected atoms.
  await expect(page.getByTestId('canvas-node')).toHaveCount(4)
  await closeDrawerIfOpen(page)

  // Text lands beside the shell (free placement, no touch gate).
  await dropToCell(page, page.getByTestId('palette-text'), grid, { x: 12, y: 0 }, { cols: 6, rows: 1 })
  await expect(page.getByTestId('canvas-node')).toHaveCount(5)
  await closeDrawerIfOpen(page)

  // Reposition: slide the text down two rows via RGL; it still touches.
  const pitch = await gridPitch(page)
  const textNode = page.getByTestId('canvas-node').filter({ hasText: 'Text' }).last()
  const box = await bbox(textNode)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 2 * pitch, { steps: 10 })
  await page.mouse.up()

  // Persist debounce is 500ms.
  await page.waitForTimeout(900)
  const doc = await persistedDoc(page, 'e2e-canvas')
  expect(doc.nodes.map((n) => n.type).sort()).toEqual(['button', 'card', 'text', 'text', 'text'])
  const at = (t: string) => doc.nodes.filter((n) => n.type === t && n.parentId === null)
  expect(at('card')).toHaveLength(1)
  expect(at('card')[0]).toMatchObject({ x: 0, y: 0, cols: 12, rows: 10 })
  expect(at('text')).toHaveLength(1)
  expect(at('text')[0]).toMatchObject({ x: 12, y: 2, cols: 6, rows: 1 })
  expect(validateDoc(doc)).toEqual({ ok: true, errors: [] })

  // The drag selected the text and opened its drawer; close it for a clean shot.
  await closeDrawerIfOpen(page)
  await expect(page.getByTestId('config-drawer')).toHaveCount(0)

  await expect(grid).toHaveScreenshot('osb-canvas.png')
})
