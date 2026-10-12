import { test, expect } from '@playwright/test'
import { closeDrawerIfOpen, dropToCell, nodeById, openCanvas, persistedDoc } from './helpers'

// ---------------------------------------------------------------------------
// User journey, no shortcuts: drop a real palette button onto the canvas,
// open its drawer, type a link, flip "new tab", and prove the doc, the
// published shape, and the editor all agree — with screenshots of the
// actual surfaces the user sees.
// ---------------------------------------------------------------------------
test('button link: user sets a link + new tab from the drawer', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await openCanvas(page, 'e2e-button-link')
  const grid = page.getByTestId('canvas')

  // Drop a button from the palette onto the canvas (arms + lands + selects).
  await dropToCell(page, page.getByTestId('palette-button'), grid, { x: 0, y: 0 }, { cols: 4, rows: 1 })
  const drawer = page.getByTestId('config-drawer')
  await expect(drawer).toBeVisible()
  await expect(drawer).toContainText('Button settings')

  // The drawer offers link controls on the real editing surface.
  await expect(page.getByLabel('Link')).toBeVisible()
  // "Open in a new tab" stays hidden until a link is provided.
  await expect(page.getByLabel('Open in a new tab')).toBeHidden()
  await expect(drawer).toHaveScreenshot('osb-button-link-drawer.png')

  // Type a destination and flip "new tab" on, exactly like a user would.
  await page.getByLabel('Link').fill('https://example.com')
  await page.getByLabel('Open in a new tab').click()
  await expect(page.getByLabel('Open in a new tab')).toHaveText('On')
  await page.waitForTimeout(900)

  // The doc persisted what the user entered.
  const doc = await persistedDoc(page, 'e2e-button-link')
  const btn = doc.nodes.find((n) => n.type === 'button')
  if (!btn) throw new Error('dropped button missing from persisted doc')
  expect(btn.config).toMatchObject({ href: 'https://example.com', openInNewTab: true })
  await closeDrawerIfOpen(page)

  // Reload: the canvas renders a real anchor — same-tab attrs absent,
  // new-tab attrs present.
  await page.reload()
  const link = page.getByRole('link', { name: 'Button' })
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('href', 'https://example.com')
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer')

  // Clicking the linked button in the editor selects it — it must NOT
  // navigate away from the canvas.
  await link.click()
  await expect(page.getByTestId('config-drawer')).toBeVisible()
  expect(page.url()).toContain('/canvas')
  await expect(grid).toHaveScreenshot('osb-button-link-canvas.png')
  await closeDrawerIfOpen(page)
})

test('button link: unlinked button stays a plain button after reload', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await openCanvas(page, 'e2e-button-plain')
  const grid = page.getByTestId('canvas')

  await dropToCell(page, page.getByTestId('palette-button'), grid, { x: 0, y: 0 }, { cols: 4, rows: 1 })
  await expect(page.getByTestId('config-drawer')).toBeVisible()
  // Leave Link empty, close, reload: still a <button>, never an anchor.
  await closeDrawerIfOpen(page)
  await page.waitForTimeout(900)
  const before = await persistedDoc(page, 'e2e-button-plain')
  const id = before.nodes.find((n) => n.type === 'button')?.id
  if (!id) throw new Error('dropped button missing from persisted doc')

  await page.reload()
  await expect(page.getByRole('button', { name: 'Button' }).first()).toBeVisible()
  await expect(page.getByRole('link')).toHaveCount(0)
  // Untouched buttons store no link keys at all: rendering falls back to
  // defaults (plain <button>), which is also how old docs keep loading.
  const stored = nodeById(await persistedDoc(page, 'e2e-button-plain'), id).config
  expect(stored.href ?? '').toBe('')
  expect(stored.openInNewTab ?? false).toBe(false)
})
