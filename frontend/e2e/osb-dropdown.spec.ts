import { test, expect, type Page } from '@playwright/test'
import type { SiteNode } from '../src/site/types'
import type { CanvasDoc } from '../src/canvas/doc'
import {
  bbox,
  closeDrawerIfOpen,
  dragFromTo,
  dropToCell,
  LONG_TEXT,
  mountNodes,
  noHorizontalOverflow,
  nodeById,
  openCanvas,
  persistedDoc,
} from './helpers'

/** Options are inspector-edited config data (PRD §6.2), never canvas nodes. */
const menuNode = (config: Record<string, unknown> = {}): SiteNode => ({
  id: 'd1',
  type: 'dropdown',
  config: {
    label: 'Products',
    items: [
      { label: 'Shop', link: 'https://example.com' },
      { label: 'About', link: '#about' },
    ],
    ...config,
  },
  cols: 6,
  rows: 4,
})

/** Open the menu, report the size of its option text, then dismiss it. */
async function menuFontSize(page: Page): Promise<number> {
  await page.getByTestId('osb-dropdown-trigger').click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  const size = await menu.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  return size
}

test('dropdown/closed', async ({ page }) => {
  await mountNodes(page, [menuNode()])
  const trigger = page.getByTestId('osb-dropdown-trigger')
  await expect(trigger).toBeVisible()
  await expect(trigger).toContainText('Products')
  await expect(trigger).toHaveScreenshot('osb-dropdown-closed.png')
})

test('dropdown/open', async ({ page }) => {
  await mountNodes(page, [menuNode()])
  await page.getByTestId('osb-dropdown-trigger').click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  await expect(menu).toContainText('Shop')
  await expect(menu).toContainText('About')
  await expect(menu).toHaveScreenshot('osb-dropdown-open.png')
})

test('dropdown/dark-closed', async ({ page }) => {
  await mountNodes(page, [menuNode()], 'dark')
  const trigger = page.getByTestId('osb-dropdown-trigger')
  await expect(trigger).toBeVisible()
  await expect(trigger).toHaveScreenshot('osb-dropdown-dark-closed.png')
})

test('dropdown/submenu', async ({ page }) => {
  await mountNodes(page, [
    menuNode({
      items: [
        { label: 'Products', link: '', children: [{ label: 'Shop', link: 'https://example.com' }, { label: 'Sale', link: '' }] },
        { label: 'About', link: '#about' },
      ],
    }),
  ])
  await page.getByTestId('osb-dropdown-trigger').click()
  const panel = page.locator('[data-slot="dropdown-menu-content"]')
  const parent = page.getByRole('menuitem', { name: 'Products' })
  // A row with children opens; it never navigates.
  await expect(parent).toHaveAttribute('aria-haspopup', 'menu')
  expect(await parent.evaluate((el) => el.tagName)).not.toBe('A')

  await parent.hover()
  const sub = page.locator('[data-slot="dropdown-menu-sub-content"]')
  await expect(sub).toBeVisible()
  await expect(sub).toContainText('Shop')
  // Submenu rows are plain options again — a linked one is the anchor.
  expect(await page.getByRole('menuitem', { name: 'Shop' }).evaluate((el) => el.tagName)).toBe('A')

  // It opens beside the row that owns it, once the open animation settles:
  // Radix places sub-panels to the right, overlapping by a few px — the
  // pointer bridge between the two panels.
  await page.waitForTimeout(300)
  const parentBox = await bbox(panel)
  const subBox = await bbox(sub)
  expect(subBox.x).toBeGreaterThan(parentBox.x + parentBox.width - 8)
  expect(subBox.y).toBeLessThan(parentBox.y + parentBox.height)

  // Both panels in one shot: a submenu only reads as one next to its opener.
  const left = Math.min(parentBox.x, subBox.x) - 6
  const top = Math.min(parentBox.y, subBox.y) - 6
  await expect(page).toHaveScreenshot('osb-dropdown-submenu.png', {
    clip: {
      x: left,
      y: top,
      width: Math.max(parentBox.x + parentBox.width, subBox.x + subBox.width) + 6 - left,
      height: Math.max(parentBox.y + parentBox.height, subBox.y + subBox.height) + 6 - top,
    },
  })
})

test('dropdown/opens-right', async ({ page }) => {
  await mountNodes(page, [menuNode({ direction: 'right' })])
  await page.getByTestId('osb-dropdown-trigger').click()
  const panel = page.locator('[data-slot="dropdown-menu-content"]')
  await expect(panel).toBeVisible()
  expect(await panel.getAttribute('data-side')).toBe('right')
  // Beside the trigger, not above or below it (after the open animation).
  await page.waitForTimeout(300)
  const trigger = await bbox(page.getByTestId('osb-dropdown-trigger'))
  const box = await bbox(panel)
  expect(box.x).toBeGreaterThanOrEqual(trigger.x + trigger.width)
})

test('dropdown/opens-above', async ({ page }) => {
  // "Above" is a preference, not a cage: the trigger needs room on that side
  // for it to stick, so a tall page pushes it down to the bottom edge first.
  const tall = Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, type: 'text' as const, config: { text: LONG_TEXT } }))
  await mountNodes(page, [...tall, menuNode({ direction: 'top' })])
  await page.getByTestId('osb-dropdown-trigger').click()
  const panel = page.locator('[data-slot="dropdown-menu-content"]')
  await expect(panel).toBeVisible()
  expect(await panel.getAttribute('data-side')).toBe('top')
  // Above the trigger, not overlapping it (after the open animation).
  await page.waitForTimeout(300)
  const trigger = await bbox(page.getByTestId('osb-dropdown-trigger'))
  const box = await bbox(panel)
  expect(box.y + box.height).toBeLessThanOrEqual(trigger.y)
})

test('dropdown edge cases: options keep link semantics, no overflow at 360px', async ({ page }) => {
  await mountNodes(page, [menuNode()])
  await page.getByTestId('osb-dropdown-trigger').click()
  // A linked option IS the anchor (asChild), so right-click + keyboard work.
  const shop = page.getByRole('menuitem', { name: 'Shop' })
  expect(await shop.evaluate((el) => el.tagName)).toBe('A')
  expect(await shop.getAttribute('href')).toBe('https://example.com')
  await page.setViewportSize({ width: 360, height: 800 })
  await noHorizontalOverflow(page)
})

test('dropdown canvas: resizing the node resizes the menu items', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  const doc: CanvasDoc = {
    version: 1,
    theme: 'light',
    nodes: [
      {
        id: 'd1',
        type: 'dropdown',
        config: { label: 'Products', items: [{ label: 'Shop', link: '' }] },
        parentId: null,
        x: 0,
        y: 0,
        // The registry default: a dropdown is a trigger, not a panel.
        cols: 3,
        rows: 1,
      },
    ],
    overlays: [],
  }
  await openCanvas(page, 'e2e-dropdown-resize', doc)
  const small = await menuFontSize(page)

  // Drag the node's corner handle down: the box is the component, so the
  // options grow with it (the trigger is button-sized by default).
  const node = page.locator('[data-testid="canvas-node"]').first()
  const box = await bbox(node)
  const handle = await bbox(node.locator('.react-resizable-handle'))
  await dragFromTo(page, handle, { x: handle.x + handle.width / 2, y: box.y + box.height * 3 })
  await page.waitForTimeout(600)
  expect(nodeById(await persistedDoc(page, 'e2e-dropdown-resize'), 'd1').rows).toBeGreaterThan(1)

  const big = await menuFontSize(page)
  expect(big).toBeGreaterThan(small)
})

test('dropdown canvas: it is a leaf — options come from the sidebar, nothing nests inside', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  await openCanvas(page, 'e2e-dropdown')
  const grid = page.getByTestId('canvas')

  // A dropdown lands like any atom; its drawer edits the label and the items.
  await dropToCell(page, page.getByTestId('palette-dropdown'), grid, { x: 0, y: 0 }, { cols: 6, rows: 4 })
  const drawer = page.getByTestId('config-drawer')
  await expect(drawer).toContainText('Dropdown settings')
  await expect(drawer).toContainText('Menu items')
  // "Add item" creates an option row — no canvas node, no drag involved.
  await drawer.getByTestId('osb-add-item').click()
  await drawer.getByLabel('Item label').fill('Shop')
  await drawer.getByLabel('Item link').fill('https://example.com')
  await closeDrawerIfOpen(page)
  await page.waitForTimeout(700)

  let doc = await persistedDoc(page, 'e2e-dropdown')
  const menu = doc.nodes.find((n) => n.type === 'dropdown')
  if (!menu) throw new Error('dropdown did not land')
  expect(menu.config.items).toEqual([{ label: 'Shop', link: 'https://example.com' }])
  expect(doc.nodes.filter((n) => n.parentId === menu.id)).toHaveLength(0)

  // Dragging a button over the dropdown is refused: a dropdown is not a
  // container, so nothing ever becomes a child of it.
  const node = page.locator('[data-testid="canvas-node"][data-type="dropdown"]')
  const nbox = await bbox(node)
  await page.getByTestId('palette-button').dragTo(node, { targetPosition: { x: nbox.width / 2, y: nbox.height / 2 } })
  await page.waitForTimeout(900)
  doc = await persistedDoc(page, 'e2e-dropdown')
  expect(doc.nodes.filter((n) => n.parentId === menu.id)).toHaveLength(0)
  expect(doc.nodes.some((n) => n.type === 'button')).toBe(false)
  await expect(page.getByTestId('drop-message')).toContainText('That spot is taken')
  await closeDrawerIfOpen(page)
})

test('dropdown canvas: a submenu row lands in the doc as nested config', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  await openCanvas(page, 'e2e-dropdown-sub')
  await dropToCell(page, page.getByTestId('palette-dropdown'), page.getByTestId('canvas'), { x: 0, y: 0 }, { cols: 3, rows: 1 })

  const drawer = page.getByTestId('config-drawer')
  await drawer.getByTestId('osb-add-item').click()
  await drawer.getByLabel('Item label').fill('Products')
  // "↳" nests one level: the sub-item is data on the row, never a node.
  await drawer.getByLabel('Add sub-item').click()
  const sub = drawer.getByTestId('osb-sub-items')
  await sub.getByLabel('Item label').fill('Shop')
  await sub.getByLabel('Item link').fill('https://example.com')
  await closeDrawerIfOpen(page)
  await page.waitForTimeout(700)

  const doc = await persistedDoc(page, 'e2e-dropdown-sub')
  const menu = doc.nodes.find((n) => n.type === 'dropdown')
  if (!menu) throw new Error('dropdown did not land')
  expect(menu.config.items).toEqual([
    { label: 'Products', link: '', children: [{ label: 'Shop', link: 'https://example.com' }] },
  ])
  expect(doc.nodes.filter((n) => n.parentId === menu.id)).toHaveLength(0)
})
