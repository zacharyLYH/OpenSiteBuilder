import { test, expect, type Page } from '@playwright/test'
import { bbox, closeDrawerIfOpen, dropToCell, openCanvas, persistedDoc } from './helpers'

/**
 * The dialog is only drivable once Radix finishes mounting: first paint
 * (toBeVisible) precedes the focus trap, and the outside-press dismiss path
 * additionally waits on a deferred (setTimeout 0) document listener in
 * Radix's dismissable layer. Focus landing inside proves mount + trap; the
 * short settle after it guarantees the deferred listener is attached before
 * any outside press or Escape is sent.
 */
async function awaitDialogReady(page: Page): Promise<void> {
  const content = page.getByTestId('osb-modal-content')
  await expect(content).toBeVisible()
  await expect
    .poll(async () => page.evaluate(() => !!document.querySelector('[data-testid="osb-modal-content"]')?.contains(document.activeElement)))
    .toBe(true)
  await page.waitForTimeout(150)
}

// ---------------------------------------------------------------------------
// Popup journey, no shortcuts: attach a popup from a real button drawer,
// fill it by dropping a palette atom into the shell, resize the shell,
// then exercise the transplanted shadcn contract — X closes, outside
// press closes, Escape closes — with screenshots of every surface.
// ---------------------------------------------------------------------------
test('modal: attach, fill, resize, and drive the real dialog', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  await openCanvas(page, 'e2e-modal')
  const grid = page.getByTestId('canvas')

  // A button on the canvas; its drawer offers the popup attach.
  await dropToCell(page, page.getByTestId('palette-button'), grid, { x: 0, y: 0 }, { cols: 4, rows: 1 })
  const drawer = page.getByTestId('config-drawer')
  await expect(drawer).toBeVisible()
  await expect(page.getByTestId('new-popup')).toBeVisible()
  await expect(drawer).toHaveScreenshot('osb-modal-attach.png')

  // Attach: a pre-filled shell lands, the editor opens on it, and the
  // trigger button remembers which popup it opens.
  await page.getByTestId('new-popup').click()
  const editor = page.getByTestId('modal-editor')
  await expect(editor).toBeVisible()
  await expect(drawer).toContainText('Popup settings')
  await page.waitForTimeout(900)
  let doc = await persistedDoc(page, 'e2e-modal')
  expect(doc.modals).toHaveLength(1)
  const mid = doc.modals![0].id
  expect(doc.nodes.find((n) => n.type === 'button')?.config).toMatchObject({ modalId: mid })
  await expect(page.getByTestId('modal-editor-shell')).toHaveScreenshot('osb-modal-editor.png')

  // Fill: drop a palette text into free shell cells (cells (9,6) clamp to
  // the (6,6) landing beside the default button).
  const shell = page.getByTestId('modal-editor-shell')
  const sbox = await bbox(shell)
  await page.getByTestId('palette-text').dragTo(shell, {
    targetPosition: { x: (sbox.width * 9.5) / 12, y: (sbox.height * 6.5) / 10 },
  })
  await page.waitForTimeout(900)
  doc = await persistedDoc(page, 'e2e-modal')
  expect(doc.modals![0].children).toHaveLength(4)
  await expect(shell).toHaveScreenshot('osb-modal-content.png')

  // Resize: the shell grows two columns via its SE handle.
  const handle = page.getByTestId('modal-resize-shell')
  const hbox = await bbox(handle)
  const pitchX = sbox.width / 12
  await page.mouse.move(hbox.x + hbox.width / 2, hbox.y + hbox.height / 2)
  await page.mouse.down()
  await page.mouse.move(hbox.x + hbox.width / 2 + 2 * pitchX, hbox.y + hbox.height / 2, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(900)
  doc = await persistedDoc(page, 'e2e-modal')
  expect(doc.modals![0]).toMatchObject({ cols: 14, rows: 10 })

  // The transplanted contract, live: X closes…
  await page.getByTestId('modal-test').click()
  const content = page.getByTestId('osb-modal-content')
  await awaitDialogReady(page)
  await expect(content).toContainText('Popup title')
  // Resized shell lands in the dialog: 14 cols × 28px pitch.
  await expect(content).toHaveScreenshot('osb-modal-open.png')
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(content).toHaveCount(0)

  // …outside press closes…
  await page.getByTestId('modal-test').click()
  await awaitDialogReady(page)
  await page.waitForTimeout(300)
  await page.mouse.click(40, 400)
  await expect(content).toHaveCount(0)

  // …and Escape closes.
  await page.getByTestId('modal-test').click()
  await awaitDialogReady(page)
  await page.keyboard.press('Escape')
  await expect(content).toHaveCount(0)

  // Done: back on the canvas, the trigger still selects (never navigates)
  // and its drawer names the attached popup.
  await page.getByTestId('modal-done').click()
  await expect(editor).toHaveCount(0)
  await closeDrawerIfOpen(page)
  await page.getByTestId('canvas-node').click()
  await expect(page.getByTestId('linked-popup-name')).toContainText('Popup')
  await expect(page.getByTestId('edit-popup')).toBeVisible()
  await expect(page.getByTestId('test-popup')).toBeVisible()
  await expect(page.getByTestId('unlink-popup')).toBeVisible()
  // The drawer Test button opens the same real dialog (resize honored).
  await page.getByTestId('test-popup').click()
  await awaitDialogReady(page)
  await expect(page.getByTestId('osb-modal-content')).toContainText('Popup title')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('osb-modal-content')).toHaveCount(0)
  await closeDrawerIfOpen(page)
})

test('modal: tray lists, edits, and removes popups', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  await openCanvas(page, 'e2e-modal-tray')
  const grid = page.getByTestId('canvas')

  await dropToCell(page, page.getByTestId('palette-button'), grid, { x: 0, y: 0 }, { cols: 4, rows: 1 })
  await expect(page.getByTestId('config-drawer')).toBeVisible()
  await page.getByTestId('new-popup').click()
  await expect(page.getByTestId('modal-editor')).toBeVisible()
  await page.getByTestId('modal-done').click()
  await expect(page.getByTestId('modal-editor')).toHaveCount(0)
  await closeDrawerIfOpen(page)

  // The header tray lists the popup and reopens it for editing.
  await page.getByTestId('popups').click()
  const panel = page.getByTestId('popups-panel')
  await expect(panel).toBeVisible()
  await expect(panel.getByTestId('popup-row')).toHaveCount(1)
  await expect(panel).toHaveScreenshot('osb-modal-tray.png')
  await panel.getByTestId('popup-edit').click()
  await expect(page.getByTestId('modal-editor')).toBeVisible()
  await page.getByTestId('modal-done').click()

  // Remove unlinks the trigger button and empties the tray.
  await page.getByTestId('popups').click()
  await panel.getByTestId('popup-remove').click()
  await expect(panel.getByTestId('popup-row')).toHaveCount(0)
  await expect(panel).toContainText('No popups yet')
  await page.waitForTimeout(900)
  const doc = await persistedDoc(page, 'e2e-modal-tray')
  expect(doc.modals ?? []).toHaveLength(0)
  expect(doc.nodes.find((n) => n.type === 'button')?.config).toMatchObject({ modalId: '' })

  // Reload: the removal persists (nothing prunes, nothing resurrects).
  await page.reload()
  const after = await persistedDoc(page, 'e2e-modal-tray')
  expect(after.modals ?? []).toHaveLength(0)
})
