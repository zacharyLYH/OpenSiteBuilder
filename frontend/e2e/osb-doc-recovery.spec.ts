import { test, expect } from '@playwright/test'
import { openCanvas, persistedDoc, STORAGE_KEY } from './helpers'

// The doc lives in the user's own browser, and it is the single source of
// truth, so the boot path has to survive whatever is in there: a half-written
// string from a crashed tab, node types we no longer ship, or nesting that
// breaks the depth-1 rule. A sensible default is a working canvas plus a
// self-healed document — never a blank screen or a crash.
const setRaw = (page: import('@playwright/test').Page, slug: string, raw: string) =>
  page.evaluate(([key, value]: [string, string]) => localStorage.setItem(key, value), [STORAGE_KEY(slug), raw] as [string, string])

test('recovery: corrupt storage boots an empty canvas instead of crashing', async ({ page }) => {
  const slug = 'e2e-recovery-corrupt'
  await page.setViewportSize({ width: 1280, height: 900 })
  await openCanvas(page, slug)
  await setRaw(page, slug, '{"version":1,"nodes":[{"id":"t1"')
  await page.reload()

  await expect(page.getByTestId('canvas')).toBeVisible()
  await expect(page.getByTestId('canvas-empty')).toBeVisible()
  await expect(page.getByTestId('canvas-node')).toHaveCount(0)
  // Usable again, and the first save overwrites the damaged entry.
  await page.waitForTimeout(900)
  expect(await persistedDoc(page, slug)).toEqual({ version: 1, nodes: [], overlays: [], theme: 'light' })
})

test('recovery: unknown types, orphans and broken nesting are pruned and persisted', async ({ page }) => {
  const slug = 'e2e-recovery-prune'
  await page.setViewportSize({ width: 1280, height: 900 })
  await openCanvas(page, slug)

  // One good card, plus every way a stored doc can disagree with the engine:
  // a removed component type, a child whose parent is gone, a container
  // nested in a container, and a node under that illegal grandparent.
  await setRaw(
    page,
    slug,
    JSON.stringify({
      version: 1,
      nodes: [
        { id: 'c1', type: 'card', config: {}, parentId: null, x: 0, y: 0, cols: 12, rows: 10 },
        { id: 'orphan', type: 'text', config: {}, parentId: 'gone', x: 0, y: 0, cols: 4, rows: 1 },
        { id: 'ghost', type: 'audio', config: {}, parentId: null, x: 14, y: 0, cols: 4, rows: 1 },
        { id: 'inner', type: 'card', config: {}, parentId: 'c1', x: 1, y: 1, cols: 6, rows: 4 },
        { id: 'deep', type: 'text', config: {}, parentId: 'inner', x: 0, y: 0, cols: 4, rows: 1 },
      ],
    }),
  )
  await page.reload()
  await page.waitForTimeout(900)

  // Only the node the engine still understands is rendered...
  await expect(page.getByTestId('canvas-node')).toHaveCount(1)
  await expect(page.locator('[data-id="c1"]')).toBeVisible()
  await expect(page.locator('[data-id="orphan"]')).toHaveCount(0)
  await expect(page.locator('[data-id="ghost"]')).toHaveCount(0)
  await expect(page.locator('[data-id="inner"]')).toHaveCount(0)
  await expect(page.locator('[data-id="deep"]')).toHaveCount(0)
  // ...and the pruned doc is what gets saved back, so it heals permanently.
  expect((await persistedDoc(page, slug)).nodes.map((n) => n.id)).toEqual(['c1'])
})

test('status: an empty doc offers no publish, and Validate reports all checks pass', async ({ page }) => {
  const slug = 'e2e-recovery-status'
  await page.setViewportSize({ width: 1280, height: 900 })
  await openCanvas(page, slug)

  // Nothing to publish yet: the action is present but cannot be fired.
  await expect(page.getByRole('button', { name: 'Push' })).toBeDisabled()

  await page.getByTestId('validate').click()
  await expect(page.getByTestId('validate-panel')).toBeVisible()
  await expect(page.getByTestId('validate-ok')).toBeVisible()
  await expect(page.getByTestId('validate-issue')).toHaveCount(0)
  await page.getByRole('button', { name: 'Close checks' }).click()
  await expect(page.getByTestId('validate-panel')).toHaveCount(0)
})
