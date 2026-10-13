import { test, expect } from '@playwright/test'
import { bbox, closeDrawerIfOpen, dropToCell, nodeById, openCanvas, persistedDoc } from './helpers'

// Interactivity edges: what a non-technical builder does next after the
// happy path — delete the card they just made, drop twice on one spot,
// stretch a child past its shell, rewrite copy in the drawer, clear a
// text, publish an empty canvas, paste a dead image link. The sensible
// default in every case: nothing silently lost, nothing stranded, and
// every refusal says why in plain words.

test('delete cascades: removing a card removes its children and closes the drawer', async ({ page }) => {
  const slug = 'e2e-del-cascade'
  await page.setViewportSize({ width: 1280, height: 900 })
  await openCanvas(page, slug, {
    version: 1,
    nodes: [
      { id: 'card1', type: 'card', config: {}, parentId: null, x: 0, y: 0, cols: 12, rows: 10 },
      { id: 'k1', type: 'button', config: { label: 'Kid' }, parentId: 'card1', x: 1, y: 1, cols: 4, rows: 1 },
    ],
  })

  // Select the shell by its empty corner, then Delete: the whole subtree goes.
  const shell = await bbox(page.getByTestId('container-card1'))
  await page.mouse.click(shell.x + 10, shell.y + shell.height - 10)
  await expect(page.getByTestId('config-drawer')).toContainText('Card settings')
  await page.keyboard.press('Delete')
  await page.waitForTimeout(900)

  await expect(page.getByTestId('canvas-node')).toHaveCount(0)
  await expect(page.getByTestId('config-drawer')).toHaveCount(0)
  await expect(page.getByTestId('canvas-empty')).toBeVisible()
  expect(await persistedDoc(page, slug)).toEqual({ version: 1, nodes: [], modals: [] })
})

test('double drop: a second drop on the same cells is refused, doc unchanged', async ({ page }) => {
  const slug = 'e2e-double-drop'
  await page.setViewportSize({ width: 1280, height: 900 })
  await openCanvas(page, slug)

  const grid = page.getByTestId('canvas')
  await dropToCell(page, page.getByTestId('palette-button'), grid, { x: 0, y: 0 }, { cols: 4, rows: 1 })
  await expect(page.getByTestId('canvas-node')).toHaveCount(1)
  await closeDrawerIfOpen(page)
  await page.waitForTimeout(900)
  const before = await persistedDoc(page, slug)

  // Same gesture again: no duplicate, just the plain-words refusal.
  await dropToCell(page, page.getByTestId('palette-button'), grid, { x: 0, y: 0 }, { cols: 4, rows: 1 })
  await expect(page.getByTestId('drop-message')).toContainText('That spot is taken')
  await page.waitForTimeout(900)
  await expect(page.getByTestId('canvas-node')).toHaveCount(1)
  expect(await persistedDoc(page, slug)).toEqual(before)
})

test('resize clamp: growing a nested child past the shell pins it inside', async ({ page }) => {
  const slug = 'e2e-resize-clamp'
  await page.setViewportSize({ width: 1280, height: 1100 })
  await openCanvas(page, slug, {
    version: 1,
    nodes: [
      { id: 'card1', type: 'card', config: {}, parentId: null, x: 0, y: 0, cols: 12, rows: 10 },
      { id: 'k1', type: 'button', config: { label: 'Kid' }, parentId: 'card1', x: 1, y: 1, cols: 4, rows: 1 },
    ],
  })

  // Grab the SE handle and fling it far past the shell edge: the gate pins
  // the child at the shell wall instead of hanging it out.
  await page.locator('[data-id="k1"]').click()
  const handle = page.getByTestId('resize-k1')
  await expect(handle).toBeVisible()
  const hbox = await bbox(handle)
  await page.mouse.move(hbox.x + hbox.width / 2, hbox.y + hbox.height / 2)
  await page.mouse.down()
  await page.mouse.move(hbox.x + hbox.width / 2 + 800, hbox.y + hbox.height / 2, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(900)

  const kid = nodeById(await persistedDoc(page, slug), 'k1')
  expect(kid).toMatchObject({ parentId: 'card1', x: 1, y: 1, rows: 1, cols: 11 })
  expect(kid.x + kid.cols).toBeLessThanOrEqual(12)
  await expect(page.getByTestId('drop-message')).toHaveCount(0)
  await closeDrawerIfOpen(page)
})

test('drawer edit: button text round-trips to the canvas and storage', async ({ page }) => {
  const slug = 'e2e-drawer-edit'
  await page.setViewportSize({ width: 1280, height: 1100 })
  await openCanvas(page, slug)

  // Dropping selects the node, so its settings are already open.
  const grid = page.getByTestId('canvas')
  await dropToCell(page, page.getByTestId('palette-button'), grid, { x: 0, y: 0 }, { cols: 4, rows: 1 })
  await expect(page.getByTestId('config-drawer')).toContainText('Button settings')

  await page.getByLabel('Button text').fill('Ship it')
  await expect(page.getByTestId('canvas-node').filter({ hasText: 'Ship it' })).toBeVisible()
  await page.waitForTimeout(900)
  const doc = await persistedDoc(page, slug)
  expect(doc.nodes).toHaveLength(1)
  expect(doc.nodes[0].config).toMatchObject({ label: 'Ship it' })
  await closeDrawerIfOpen(page)
})

test('empty text: clearing copy shows the fallback instead of vanishing', async ({ page }) => {
  const slug = 'e2e-text-fallback'
  await page.setViewportSize({ width: 1280, height: 900 })
  await openCanvas(page, slug)

  const grid = page.getByTestId('canvas')
  await dropToCell(page, page.getByTestId('palette-text'), grid, { x: 0, y: 0 }, { cols: 6, rows: 1 })
  await expect(page.getByTestId('config-drawer')).toContainText('Text settings')

  // Clear every character: the node stays put and readable, never blank.
  await page.getByLabel('Text', { exact: true }).fill('')
  await expect(page.getByTestId('canvas-node').filter({ hasText: 'Text' })).toBeVisible()
  await page.waitForTimeout(900)
  const doc = await persistedDoc(page, slug)
  expect(doc.nodes).toHaveLength(1)
  expect(doc.nodes[0].config).toMatchObject({ text: '' })
  await closeDrawerIfOpen(page)
})

test('push honesty: disabled when empty, enabled after the first drop', async ({ page }) => {
  const slug = 'e2e-push-honesty'
  await page.setViewportSize({ width: 1280, height: 900 })
  await openCanvas(page, slug)

  const push = page.getByRole('button', { name: 'Push' })
  await expect(push).toBeDisabled()

  const grid = page.getByTestId('canvas')
  await dropToCell(page, page.getByTestId('palette-button'), grid, { x: 0, y: 0 }, { cols: 4, rows: 1 })
  await expect(push).toBeEnabled()
  await closeDrawerIfOpen(page)
})

test('broken image: a dead URL falls back to the placeholder, src kept', async ({ page }) => {
  const slug = 'e2e-broken-image'
  await page.setViewportSize({ width: 1280, height: 900 })
  await openCanvas(page, slug, {
    version: 1,
    nodes: [
      {
        id: 'img1',
        type: 'image',
        config: { imageSrc: 'https://osb.invalid/broken.png', imageAlt: '' },
        parentId: null,
        x: 0,
        y: 0,
        cols: 8,
        rows: 6,
      },
    ],
  })

  // A typo'd link heals the view, not the data: placeholder shows, the URL
  // stays stored so fixing it restores the picture.
  await expect(page.getByTestId('osb-image-fallback')).toBeVisible()
  await page.waitForTimeout(900)
  expect(nodeById(await persistedDoc(page, slug), 'img1').config).toMatchObject({
    imageSrc: 'https://osb.invalid/broken.png',
  })
})
