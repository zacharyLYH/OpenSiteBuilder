import { test, expect } from '@playwright/test'
import { dropToCell } from './helpers'
import { validateDoc, type CanvasDoc } from '../src/canvas/doc'

// Gate: a pattern drop (card + 3 atoms), a touching text neighbor, an RGL
// reposition, persistence in localStorage, and one canvas screenshot.
// All placement goes through real drags + the doc gate — exactly the user
// path — so the shot always shows a sensible, connected page.
// Cursor math lives in dropToCell; this file only declares cells.
test('canvas: compose pattern+text, reposition text, persist, screenshot', async ({
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
  await dropToCell(page, page.getByTestId('palette-pattern-card-content'), grid, { x: 0, y: 0 }, { cols: 12, rows: 10 })
  // Pattern lands 4 nodes: 1 shell + 3 connected atoms.
  await expect(page.getByTestId('canvas-node')).toHaveCount(4)
  if ((await page.getByTestId('config-drawer').count()) > 0) {
    await page.getByRole('button', { name: 'Close settings' }).click()
  }

  // Text touches the shell at x=12.
  await dropToCell(page, page.getByTestId('palette-text'), grid, { x: 12, y: 0 }, { cols: 8, rows: 2 })
  await expect(page.getByTestId('canvas-node')).toHaveCount(5)
  if ((await page.getByTestId('config-drawer').count()) > 0) {
    await page.getByRole('button', { name: 'Close settings' }).click()
  }

  // Reposition: slide the text down two rows via RGL; it still touches.
  const pitch = dot!.width + 8
  const textNode = page.getByTestId('canvas-node').filter({ hasText: 'Text' }).last()
  const box = (await textNode.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 2 * pitch, { steps: 10 })
  await page.mouse.up()

  // Persist debounce is 500ms.
  await page.waitForTimeout(900)
  const doc = await page.evaluate(
    () => JSON.parse(localStorage.getItem('osb.project.e2e-canvas')!) as CanvasDoc,
  )
  expect(doc.nodes.map((n) => n.type).sort()).toEqual(['button', 'card', 'text', 'text', 'text'])
  const at = (t: string) => doc.nodes.filter((n) => n.type === t && n.parentId === null)
  expect(at('card')).toHaveLength(1)
  expect(at('card')[0]).toMatchObject({ x: 0, y: 0, cols: 12, rows: 10 })
  expect(at('text')).toHaveLength(1)
  expect(at('text')[0]).toMatchObject({ x: 12, y: 2, cols: 8, rows: 2 })
  expect(validateDoc(doc)).toEqual({ ok: true, errors: [] })

  // The drag selected the text and opened its drawer; close it for a clean shot.
  if ((await page.getByTestId('config-drawer').count()) > 0) {
    await page.getByRole('button', { name: 'Close settings' }).click()
  }
  await expect(page.getByTestId('config-drawer')).toHaveCount(0)

  await expect(grid).toHaveScreenshot('osb-canvas.png')
})
