import { test, expect } from '@playwright/test'
import type { CanvasDoc } from '../src/canvas/doc'
import { openCanvas, persistedDoc } from './helpers'

// The canvas owns structure: Delete removes the selection. That is the right
// default while the canvas has focus, and the wrong one everywhere else —
// editing a field, or aiming at a control inside the settings drawer.
//
// Regression: the guard only skipped INPUT/TEXTAREA/SELECT, so pressing
// Backspace with focus on the drawer's own close button silently deleted the
// node the user was configuring.
const SLUG = 'e2e-hotkeys'
const DOC: CanvasDoc = {
  version: 1,
  nodes: [
    { id: 'c1', type: 'card', config: {}, parentId: null, x: 0, y: 0, cols: 12, rows: 10 },
    { id: 't1', type: 'text', config: { text: 'Hello' }, parentId: 'c1', x: 1, y: 1, cols: 6, rows: 2 },
    { id: 'b1', type: 'button', config: { label: 'Other' }, parentId: null, x: 14, y: 0, cols: 4, rows: 1 },
  ],
}
const ids = async (page: import('@playwright/test').Page): Promise<string[]> =>
  (await persistedDoc(page, SLUG)).nodes.map((n) => n.id)

const open = async (page: import('@playwright/test').Page): Promise<void> => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  await openCanvas(page, SLUG, DOC)
  await expect(page.getByTestId('canvas-node')).toHaveCount(3)
}

test('hotkeys: Delete inside the settings drawer never eats the node', async ({ page }) => {
  await open(page)
  await page.locator('[data-id="t1"]').click()
  await expect(page.getByTestId('config-drawer')).toBeVisible()

  // A text field is a typing surface: Delete and Backspace edit text.
  const field = page.locator('#osb-field-text')
  await field.click()
  await expect(field).toBeFocused()
  await page.keyboard.press('Delete')
  await page.keyboard.press('Backspace')
  await expect(page.getByTestId('canvas-node')).toHaveCount(3)

  // A button inside the drawer is still the drawer.
  await page.getByRole('button', { name: 'Close settings' }).focus()
  await page.keyboard.press('Delete')
  await page.keyboard.press('Backspace')
  await page.waitForTimeout(600)
  await expect(page.getByTestId('canvas-node')).toHaveCount(3)
  await expect(page.getByTestId('config-drawer')).toBeVisible()
  expect(await ids(page)).toEqual(['c1', 't1', 'b1'])
})

test('hotkeys: Delete on the canvas removes exactly the selection', async ({ page }) => {
  await open(page)

  // Nothing selected: Delete is harmless.
  await page.keyboard.press('Delete')
  await page.waitForTimeout(400)
  expect(await ids(page)).toEqual(['c1', 't1', 'b1'])

  // A nested atom: only it goes, and its shell shows the empty invitation.
  await page.locator('[data-parent="c1"]').first().click()
  await expect(page.locator('.canvas-selected')).toHaveCount(1)
  await page.keyboard.press('Delete')
  await page.waitForTimeout(600)
  await expect(page.getByTestId('empty-hint-c1')).toBeVisible()
  expect(await ids(page)).toEqual(['c1', 'b1'])

  // The shell: its children cascade with it, and the drawer closes with it.
  await page.locator('[data-id="c1"]').click()
  await expect(page.getByTestId('config-drawer')).toContainText('Card settings')
  await page.keyboard.press('Backspace')
  await page.waitForTimeout(600)
  expect(await ids(page)).toEqual(['b1'])
  await expect(page.getByTestId('config-drawer')).toHaveCount(0)
  await expect(page.locator('.canvas-selected')).toHaveCount(0)
})

test('hotkeys: Escape closes the settings drawer and clears the selection', async ({ page }) => {
  await open(page)
  await page.locator('[data-id="b1"]').click()
  await expect(page.getByTestId('config-drawer')).toBeVisible()
  expect(await page.locator('.canvas-selected').getAttribute('data-id')).toBe('b1')

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('config-drawer')).toHaveCount(0)
  await expect(page.locator('.canvas-selected')).toHaveCount(0)
  // Closing settings is never a structural change.
  expect(await ids(page)).toEqual(['c1', 't1', 'b1'])
})
