import { test, expect } from '@playwright/test'
import type { CanvasDoc } from '../src/canvas/doc'

// Bounce contract: a refused RGL drag must snap back so the DOM matches
// the doc exactly (no phantom at the rejected spot), and a later gesture
// must never move an item the user didn't drag (no follow-suit).
//
// Regression history: RGL keeps internal layout state across gestures and
// prefers it whenever our layout prop is deep-equal, so refused drags used
// to linger on screen as phantoms — and the next commit() ingested those
// dirty positions for OTHER items. commit() now persists only the dragged
// item, and the grid remounts every gesture end to resync.
test('snap-back: refused drag leaves no phantom, others never follow suit', async ({
  page,
}) => {
  await page.context().addCookies([
    { name: 'obs_curr_project_name', value: 'e2e-snapback', url: 'http://localhost:9199' },
  ])
  await page.setViewportSize({ width: 1280, height: 1100 })
  await page.goto('/canvas')
  await page.evaluate(() => {
    localStorage.setItem(
      'osb.project.e2e-snapback',
      JSON.stringify({
        version: 1,
        nodes: [
          { id: 'card1', type: 'card', config: {}, parentId: null, x: 0, y: 0, cols: 12, rows: 10 },
          { id: 'b1', type: 'button', config: { label: 'B' }, parentId: null, x: 14, y: 0, cols: 4, rows: 1 },
          { id: 'b2', type: 'button', config: { label: 'B2' }, parentId: null, x: 14, y: 2, cols: 4, rows: 1 },
        ],
      }),
    )
  })
  await page.reload()
  const grid = page.getByTestId('canvas')
  const dot = await page.getByTestId('canvas-dots').locator('i').first().boundingBox()
  const pitch = dot!.width + 8

  async function doc(): Promise<CanvasDoc> {
    return page.evaluate(() => JSON.parse(localStorage.getItem('osb.project.e2e-snapback')!))
  }
  // DOM cell of a root node, derived from its rendered box (not the doc).
  async function domCell(id: string): Promise<{ x: number; y: number }> {
    const box = (await page.locator(`[data-id="${id}"]`).boundingBox())!
    const origin = (await page.getByTestId('canvas-dots').boundingBox())!
    return {
      x: Math.round((box.x - origin.x) / pitch),
      y: Math.round((box.y - origin.y) / pitch),
    }
  }

  // 1. Drag b1 left into the card (overlap): refused, snaps back, says why.
  const b1 = (await page.locator('[data-id="b1"]').boundingBox())!
  await page.mouse.move(b1.x + b1.width / 2, b1.y + b1.height / 2)
  await page.mouse.down()
  await page.mouse.move(b1.x + b1.width / 2 - 4 * pitch, b1.y + b1.height / 2, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(900)
  expect((await doc()).nodes.find((n) => n.id === 'b1')).toMatchObject({ x: 14, y: 0 })
  // The DOM matches the doc: no phantom at the rejected cells.
  expect(await domCell('b1')).toEqual({ x: 14, y: 0 })
  await expect(page.getByTestId('drop-message')).toContainText('That spot is taken')
  await expect(grid).toHaveScreenshot('osb-snapback.png')

  // 2. Move b2 somewhere free: b1 must not follow suit.
  const b2 = (await page.locator('[data-id="b2"]').boundingBox())!
  await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2)
  await page.mouse.down()
  await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2 + 4 * pitch, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(900)
  const after = await doc()
  expect(after.nodes.find((n) => n.id === 'b2')).toMatchObject({ x: 14, y: 6 })
  expect(after.nodes.find((n) => n.id === 'b1')).toMatchObject({ x: 14, y: 0 })
  expect(await domCell('b1')).toEqual({ x: 14, y: 0 })
})
