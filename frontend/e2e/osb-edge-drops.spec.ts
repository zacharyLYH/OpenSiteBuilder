import { test, expect } from '@playwright/test'
import type { CanvasDoc } from '../src/canvas/doc'
import { bbox, dragChildToCell, dragFromTo, dropToCell, nodeById, openCanvas, persistedDoc } from './helpers'

/** A shell with one atom in it — the shape every nesting edge case starts from. */
const NESTED: CanvasDoc = {
  version: 1,
  nodes: [
    { id: 'c1', type: 'card', config: {}, parentId: null, x: 0, y: 0, cols: 12, rows: 10 },
    { id: 'k1', type: 'button', config: { label: 'Kid' }, parentId: 'c1', x: 1, y: 1, cols: 4, rows: 1 },
  ],
}

// Boundaries of the root drop area. The preview the user aims with and the
// cell the item actually lands on are two different code paths — our pointer
// math versus the grid library's drop item — so the canvas edges are exactly
// where they used to drift apart.
//
// Regression: a drop near the left edge painted the placeholder red ("you
// cannot drop here") because the footprint started at cell -2, then landed the
// item at x=0 anyway. The edge now pins the item inside the grid, the same
// clamp containers already applied, so the verdict and the landing agree.
test('edge drop: the left-edge preview matches where the item lands', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 })
  await openCanvas(page, 'e2e-edge-left')

  const grid = page.getByTestId('canvas')
  const origin = await bbox(page.getByTestId('canvas-dots'))
  const from = await bbox(page.getByTestId('palette-button'))

  // Cursor 6px inside the canvas: a 4-wide footprint centred there would start
  // at cell -2. Pinning it to the edge is the sensible default.
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(origin.x + 6, origin.y + 200, { steps: 12 })
  await page.waitForTimeout(250)

  await expect(grid).toHaveClass(/dragging-on/)
  await expect(grid).not.toHaveClass(/drop-forbidden/)
  // The accepted preview itself is showing (blue, not red).
  await expect(page.locator('.react-grid-placeholder')).toBeVisible()

  await page.mouse.up()
  await page.waitForTimeout(900)
  const doc = await persistedDoc(page, 'e2e-edge-left')
  expect(doc.nodes).toHaveLength(1)
  expect(doc.nodes[0]).toMatchObject({ type: 'button', x: 0, parentId: null })
  // A landing the preview accepted is never answered with a rejection message.
  await expect(page.getByTestId('drop-message')).toHaveCount(0)
})

test('edge drop: the rightmost cell that still fits lands and stays inside', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 })
  await openCanvas(page, 'e2e-edge-right')

  const grid = page.getByTestId('canvas')
  // Text drops 6 cells wide, so cell 26 is the rightmost landing that fits.
  await dropToCell(page, page.getByTestId('palette-text'), grid, { x: 26, y: 0 }, { cols: 6, rows: 1 })
  await page.waitForTimeout(900)

  const doc = await persistedDoc(page, 'e2e-edge-right')
  expect(doc.nodes).toHaveLength(1)
  expect(doc.nodes[0]).toMatchObject({ type: 'text', x: 26, cols: 6 })
  expect(doc.nodes[0].x + doc.nodes[0].cols).toBeLessThanOrEqual(32)
  await expect(page.getByTestId('drop-message')).toHaveCount(0)
})

test('edge drop: a second drop on an occupied cell is refused and says why', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 })
  await openCanvas(page, 'e2e-edge-occupied')

  const grid = page.getByTestId('canvas')
  await dropToCell(page, page.getByTestId('palette-button'), grid, { x: 12, y: 0 }, { cols: 4, rows: 1 })
  await page.waitForTimeout(900)
  const before = await persistedDoc(page, 'e2e-edge-occupied')
  expect(before.nodes).toHaveLength(1)

  // A fresh gesture session: back-to-back synthetic drags do not re-initiate.
  await page.reload()
  await dropToCell(page, page.getByTestId('palette-button'), grid, { x: 12, y: 0 }, { cols: 4, rows: 1 })

  await expect(page.getByTestId('drop-message')).toContainText('That spot is taken')
  await page.waitForTimeout(900)
  expect(await persistedDoc(page, 'e2e-edge-occupied')).toEqual(before)
})

test('edge drop: releasing outside the canvas changes nothing and leaves no stuck state', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 })
  await openCanvas(page, 'e2e-edge-abort')

  const grid = page.getByTestId('canvas')
  const gridBox = await bbox(grid)
  const origin = await bbox(page.getByTestId('canvas-dots'))
  const from = await bbox(page.getByTestId('palette-button'))

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(origin.x + 300, origin.y + 200, { steps: 10 })
  await expect(grid).toHaveClass(/dragging-on/)
  // Release over the app bar: the palette item is simply abandoned.
  await page.mouse.move(gridBox.x + 300, gridBox.y - 30, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(900)

  expect((await persistedDoc(page, 'e2e-edge-abort')).nodes).toHaveLength(0)
  await expect(grid).not.toHaveClass(/dragging-on/)
  await expect(grid).not.toHaveClass(/drop-forbidden/)
  await expect(page.getByTestId('canvas-node')).toHaveCount(0)
})

// A node can never be left hanging half out of the thing that contains it —
// neither its shell nor the canvas. Each gesture either lands fully inside or
// gives the node back unchanged; there is no in-between state to clean up.
test('edge drop: a nested child snaps to the shell edge instead of hanging out', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 })
  await openCanvas(page, 'e2e-nested-edge', NESTED)

  const container = page.getByTestId('container-c1')
  const kid = page.locator('[data-parent="c1"]').first()
  // Released inside the shell but aimed past its right edge: a 4-wide atom
  // cannot sit at cell 11 in a 12-wide shell, so it is pinned to cell 8.
  await dragChildToCell(page, kid, container, 12, 10, 11, 5)
  await page.waitForTimeout(900)

  const child = nodeById(await persistedDoc(page, 'e2e-nested-edge'), 'k1')
  expect(child).toMatchObject({ parentId: 'c1', cols: 4, rows: 1, x: 8, y: 5 })
  expect(child.x + child.cols).toBeLessThanOrEqual(12)
  expect(child.y + child.rows).toBeLessThanOrEqual(10)
  await expect(page.getByTestId('drop-message')).toHaveCount(0)
})

test('edge drop: a child dropped over the root takes out and stays inside the canvas', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 })
  await openCanvas(page, 'e2e-nested-takeout', NESTED)

  const container = page.getByTestId('container-c1')
  const kid = page.locator('[data-parent="c1"]').first()
  const shell = await bbox(container)
  // Released on the root, below the shell: a take-out, not a snap-back.
  await dragFromTo(page, await bbox(kid), { x: shell.x + 200, y: shell.y + shell.height + 30 })
  await page.waitForTimeout(900)

  const child = nodeById(await persistedDoc(page, 'e2e-nested-takeout'), 'k1')
  expect(child.parentId).toBeNull()
  expect(child.x).toBeGreaterThanOrEqual(0)
  expect(child.x + child.cols).toBeLessThanOrEqual(32)
})

test('edge drop: a root node dragged past the left edge snaps fully inside', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 })
  await openCanvas(page, 'e2e-root-edge', {
    version: 1,
    nodes: [{ id: 'b1', type: 'button', config: { label: 'B' }, parentId: null, x: 10, y: 0, cols: 4, rows: 1 }],
  })

  const origin = await bbox(page.getByTestId('canvas-dots'))
  await dragFromTo(page, await bbox(page.locator('[data-id="b1"]')), { x: origin.x + 6, y: origin.y + 200 })
  await page.waitForTimeout(900)

  const node = nodeById(await persistedDoc(page, 'e2e-root-edge'), 'b1')
  expect(node).toMatchObject({ x: 0, parentId: null })
  expect(node.x + node.cols).toBeLessThanOrEqual(32)
  await expect(page.getByTestId('drop-message')).toHaveCount(0)
})
