import { test, expect, type Page } from '@playwright/test'
import type { SiteNode } from '../src/site/types'
import { bbox, closeDrawerIfOpen, dropToCell, mountNodes, openCanvas, persistedDoc } from './helpers'

const KIDS: SiteNode[] = [
  { id: 't1', type: 'text', config: { text: 'Panel title' }, x: 1, y: 1, cols: 8, rows: 2 },
  { id: 't2', type: 'text', config: { text: 'Panel body copy.' }, x: 1, y: 3, cols: 8, rows: 3 },
  { id: 'b1', type: 'button', config: { label: 'Got it' }, x: 1, y: 6, cols: 4, rows: 1 },
]

const drawerNode = (config: Record<string, unknown> = {}, cols = 10, rows = 10): SiteNode => ({
  id: 'd1',
  type: 'drawer',
  config,
  cols,
  rows,
  children: KIDS,
})

interface Case {
  name: string
  nodes: SiteNode[]
  theme?: 'dark'
}

// Every edge case, encoded here — one screenshot per case. The sheet docks
// to the edge (not centered); width comes from the shell footprint.
const CASES: Case[] = [
  { name: 'default', nodes: [drawerNode()] },
  { name: 'left', nodes: [drawerNode({ title: 'Menu', side: 'left' })] },
  { name: 'outlined', nodes: [drawerNode({ title: 'Menu', variant: 'outlined' })] },
  { name: 'plain', nodes: [drawerNode({ title: 'Menu', variant: 'plain' })] },
  { name: 'no-close', nodes: [drawerNode({ title: 'Menu', showClose: false })] },
  { name: 'empty-fallback', nodes: [drawerNode({ title: '' })] },
  { name: 'dark-default', theme: 'dark', nodes: [drawerNode()] },
  { name: 'dark-left', theme: 'dark', nodes: [drawerNode({ title: 'Menu', side: 'left' })] },
]

for (const c of CASES) {
  test(`drawer/${c.name}`, async ({ page }) => {
    await mountNodes(page, c.nodes, c.theme)
    const content = page.getByTestId('osb-drawer-content')
    await expect(content).toBeVisible()
    await expect(content).toContainText('Panel title')
    await expect(content).toHaveScreenshot(`osb-drawer-${c.name}.png`)
  })
}

test('drawer variants land their shadcn side + surface', async ({ page }) => {
  await mountNodes(page, [drawerNode({ side: 'left' })])
  const content = page.getByTestId('osb-drawer-content')
  await expect(content).toBeVisible()
  // shadcn side variants: left docks left.
  expect(await content.evaluate((el) => el.className)).toContain('left-0')
})

/**
 * The sheet is only drivable once Radix finishes mounting: first paint
 * (toBeVisible) precedes the focus trap, and the outside-press dismiss path
 * additionally waits on a deferred (setTimeout 0) document listener in
 * Radix's dismissable layer. Focus landing inside proves mount + trap; the
 * short settle after it guarantees the deferred listener is attached before
 * any outside press or Escape is sent.
 */
async function awaitDrawerReady(page: Page): Promise<void> {
  const content = page.getByTestId('osb-drawer-content')
  await expect(content).toBeVisible()
  await expect
    .poll(async () => page.evaluate(() => !!document.querySelector('[data-testid="osb-drawer-content"]')?.contains(document.activeElement)))
    .toBe(true)
  await page.waitForTimeout(150)
}

// ---------------------------------------------------------------------------
// Drawer journey, no shortcuts: attach a drawer from a real button drawer,
// fill it by dropping a palette atom into the shell, resize the shell,
// then exercise the transplanted shadcn contract — X closes, outside
// press closes, Escape closes — with screenshots of every surface.
// ---------------------------------------------------------------------------
test('drawer: attach, fill, resize, and drive the real sheet', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  await openCanvas(page, 'e2e-drawer')
  const grid = page.getByTestId('canvas')

  // A button on the canvas; its drawer offers the drawer attach.
  await dropToCell(page, page.getByTestId('palette-button'), grid, { x: 0, y: 0 }, { cols: 4, rows: 1 })
  const drawer = page.getByTestId('config-drawer')
  await expect(drawer).toBeVisible()
  await expect(page.getByTestId('new-drawer')).toBeVisible()
  await expect(drawer).toHaveScreenshot('osb-drawer-attach.png')

  // Attach: a pre-filled shell lands, the editor opens on it, and the
  // trigger button remembers which drawer it opens.
  await page.getByTestId('new-drawer').click()
  const editor = page.getByTestId('drawer-editor')
  await expect(editor).toBeVisible()
  await expect(drawer).toContainText('Drawer settings')
  await page.waitForTimeout(900)
  let doc = await persistedDoc(page, 'e2e-drawer')
  expect(doc.drawers).toHaveLength(1)
  const did = doc.drawers![0].id
  expect(doc.nodes.find((n) => n.type === 'button')?.config).toMatchObject({ drawerId: did })
  await expect(page.getByTestId('drawer-editor-shell')).toHaveScreenshot('osb-drawer-editor.png')

  // Fill: drop a palette text into free shell cells.
  const shell = page.getByTestId('drawer-editor-shell')
  const sbox = await bbox(shell)
  await page.getByTestId('palette-text').dragTo(shell, {
    targetPosition: { x: (sbox.width * 7.5) / 10, y: (sbox.height * 6.5) / 10 },
  })
  await page.waitForTimeout(900)
  doc = await persistedDoc(page, 'e2e-drawer')
  expect(doc.drawers![0].children).toHaveLength(4)
  await expect(shell).toHaveScreenshot('osb-drawer-content.png')

  // Resize: the shell grows two columns via its SE handle.
  const handle = page.getByTestId('drawer-resize-shell')
  const hbox = await bbox(handle)
  const pitchX = sbox.width / 10
  await page.mouse.move(hbox.x + hbox.width / 2, hbox.y + hbox.height / 2)
  await page.mouse.down()
  await page.mouse.move(hbox.x + hbox.width / 2 + 2 * pitchX, hbox.y + hbox.height / 2, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(900)
  doc = await persistedDoc(page, 'e2e-drawer')
  expect(doc.drawers![0]).toMatchObject({ cols: 12, rows: 10 })

  // The transplanted contract, live: X closes…
  await page.getByTestId('drawer-test').click()
  const content = page.getByTestId('osb-drawer-content')
  await awaitDrawerReady(page)
  await expect(content).toContainText('Panel title')
  // Resized shell lands in the sheet: 12 cols × 28px pitch.
  await expect(content).toHaveScreenshot('osb-drawer-open.png')
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(content).toHaveCount(0)

  // …outside press closes…
  await page.getByTestId('drawer-test').click()
  await awaitDrawerReady(page)
  await page.waitForTimeout(300)
  await page.mouse.click(400, 400)
  await expect(content).toHaveCount(0)

  // …and Escape closes.
  await page.getByTestId('drawer-test').click()
  await awaitDrawerReady(page)
  await page.keyboard.press('Escape')
  await expect(content).toHaveCount(0)

  // Done: back on the canvas, the trigger still selects (never navigates)
  // and its drawer names the attached panel.
  await page.getByTestId('drawer-done').click()
  await expect(editor).toHaveCount(0)
  await closeDrawerIfOpen(page)
  await page.getByTestId('canvas-node').click()
  await expect(page.getByTestId('linked-drawer-name')).toContainText('Panel')
  await expect(page.getByTestId('edit-drawer')).toBeVisible()
  await expect(page.getByTestId('test-drawer')).toBeVisible()
  await expect(page.getByTestId('unlink-drawer')).toBeVisible()
  // The drawer Test button opens the same real sheet (resize honored).
  await page.getByTestId('test-drawer').click()
  await awaitDrawerReady(page)
  await expect(page.getByTestId('osb-drawer-content')).toContainText('Panel title')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('osb-drawer-content')).toHaveCount(0)
  await closeDrawerIfOpen(page)
})

test('drawer: tray lists, edits, and removes drawers', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  await openCanvas(page, 'e2e-drawer-tray')
  const grid = page.getByTestId('canvas')

  await dropToCell(page, page.getByTestId('palette-button'), grid, { x: 0, y: 0 }, { cols: 4, rows: 1 })
  await expect(page.getByTestId('config-drawer')).toBeVisible()
  await page.getByTestId('new-drawer').click()
  await expect(page.getByTestId('drawer-editor')).toBeVisible()
  await page.getByTestId('drawer-done').click()
  await expect(page.getByTestId('drawer-editor')).toHaveCount(0)
  await closeDrawerIfOpen(page)

  // The header tray lists the drawer and reopens it for editing.
  await page.getByTestId('drawers').click()
  const panel = page.getByTestId('drawers-panel')
  await expect(panel).toBeVisible()
  await expect(panel.getByTestId('drawer-row')).toHaveCount(1)
  await expect(panel).toHaveScreenshot('osb-drawer-tray.png')
  await panel.getByTestId('drawer-edit').click()
  await expect(page.getByTestId('drawer-editor')).toBeVisible()
  await page.getByTestId('drawer-done').click()

  // Remove unlinks the trigger button and empties the tray.
  await page.getByTestId('drawers').click()
  await panel.getByTestId('drawer-remove').click()
  await expect(panel.getByTestId('drawer-row')).toHaveCount(0)
  await expect(panel).toContainText('No drawers yet')
  await page.waitForTimeout(900)
  const doc = await persistedDoc(page, 'e2e-drawer-tray')
  expect(doc.drawers ?? []).toHaveLength(0)
  expect(doc.nodes.find((n) => n.type === 'button')?.config).toMatchObject({ drawerId: '' })

  // Reload: the removal persists (nothing prunes, nothing resurrects).
  await page.reload()
  const after = await persistedDoc(page, 'e2e-drawer-tray')
  expect(after.drawers ?? []).toHaveLength(0)
})
