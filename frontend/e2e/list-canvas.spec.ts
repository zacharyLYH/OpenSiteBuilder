import { test, expect } from '@playwright/test'

// List canvas journey (behavior only, no screenshots — looks live in
// list-pins): palette click adds, invalid gap drop voices its reason, valid
const KEY = (slug: string): string => `osb.list.${slug}`

async function openList(page: import('@playwright/test').Page, slug: string) {
  await page.context().addCookies([{ name: 'obs_curr_project_name', value: slug, domain: 'localhost', path: '/' }])
  await page.goto('/canvas')
}

test('list canvas: compose, reject, push, screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await openList(page, 'e2e-list')

  // Success path: text + button land as nodes. The drawer opens per add but
  // sits below the header, so palette clicks never need a deselect first.
  await page.getByTestId('palette-text').click()
  await page.getByTestId('palette-button').click()
  await expect(page.getByTestId('canvas-node')).toHaveCount(2)

  // Inspector: selecting the button opens its settings (label, style, size).
  // Look is pinned in list-pins; here only open/close behavior.
  await page.getByTestId('canvas-node').filter({ hasText: 'Button' }).first().click()
  await expect(page.getByTestId('config-drawer')).toBeVisible()
  await expect(page.getByTestId('config-drawer')).toContainText('Button text')
  // Outside click closes; the drawer has no X by design. Click the empty
  // canvas below the last node.
  const mainBox = await page.locator('main').boundingBox()
  if (!mainBox) throw new Error('missing main box')
  await page.mouse.click(mainBox.x + mainBox.width / 2, mainBox.y + mainBox.height - 5)
  await expect(page.getByTestId('config-drawer')).toHaveCount(0)

  // Failed state: drag the card into its own child (a cycle). The refusing
  // gap halos red and the complaint voices the reason.
  await page.getByTestId('add-card').click()
  await expect(page.getByTestId('canvas-node')).toHaveCount(3)
  const card = page.getByTestId('canvas-node').filter({ hasText: 'Drop here' })
  await expect(card).toHaveCount(1)
  const cardBox = await card.boundingBox()
  if (!cardBox) throw new Error('missing card box')
  const fromX = cardBox.x + cardBox.width / 2
  const fromY = cardBox.y + 20
  await page.mouse.move(fromX, fromY)
  await page.mouse.down()
  // Nudge past the native drag threshold so dragstart fires and gaps arm,
  // THEN measure: arming resizes gaps, so pre-drag boxes go stale.
  await page.mouse.move(fromX + 8, fromY + 8, { steps: 4 })
  await page.waitForTimeout(200)
  const innerGap = card.getByTestId('canvas-gap').first()
  const innerBox = await innerGap.boundingBox()
  if (!innerBox) throw new Error('missing gap box')
  await page.mouse.move(innerBox.x + innerBox.width / 2, innerBox.y + innerBox.height / 2, { steps: 12 })
  await page.mouse.up()
  await expect(page.getByTestId('drop-message')).toContainText('cycle')

  // Recovery: nest the button inside the same card via gap drag (raw mouse —
  // dragTo's actionability gate spins on tiny gap targets; raw mouse fires
  // the same HTML5 events).
  const button = page.getByTestId('canvas-node').filter({ hasText: 'Button' }).first()
  const sbox = await button.boundingBox()
  if (!sbox) throw new Error('missing button box')
  const srcX = sbox.x + sbox.width / 2
  const srcY = sbox.y + sbox.height / 2
  await page.mouse.move(srcX, srcY)
  await page.mouse.down()
  // Nudge past the native drag threshold so dragstart fires and gaps arm,
  // THEN measure: arming resizes gaps, so pre-drag boxes go stale.
  await page.mouse.move(srcX + 8, srcY + 8, { steps: 4 })
  await page.waitForTimeout(200)
  const gapAfter = card.getByTestId('canvas-gap').first()
  const gbox = await gapAfter.boundingBox()
  if (!gbox) throw new Error('missing gap box')
  await page.mouse.move(gbox.x + gbox.width / 2, gbox.y + gbox.height / 2, { steps: 12 })
  // Live verdict: the hovered gap glows green before release (accept territory).
  await expect(card.getByTestId('canvas-gap').first()).toHaveAttribute('data-accept', 'true')
  await page.mouse.up()
  await page.waitForTimeout(700)
  const afterDrop = await page.evaluate((k: string) => localStorage.getItem(k), KEY('e2e-list'))
  const dropped = JSON.parse(afterDrop as string)
  expect(dropped.pages[0].nodes[1].children.map((n: { type: string }) => n.type)).toEqual(['button'])

  // Push reports the mocked commit.
  await page.route('/api/publish', (route) =>
    route.fulfill({ status: 200, json: { commit: 'deadbee123', url: 'https://x.github.io/y/' } }),
  )
  await page.getByTestId('push').click()
  await expect(page.getByTestId('push-status')).toContainText('Pushed deadbee')

  // Persisted manifest keeps nesting + order: button now lives in the card.
  await page.waitForTimeout(700)
  const raw = await page.evaluate((k: string) => localStorage.getItem(k), KEY('e2e-list'))
  const manifest = JSON.parse(raw as string)
  expect(manifest.pages[0].nodes.map((n: { type: string }) => n.type)).toEqual(['text', 'card'])
  expect(manifest.pages[0].nodes[1].children.map((n: { type: string }) => n.type)).toEqual(['button'])

  // Richer page before pinning: headline text on top, danger-fill button in
  // the card, image placeholder below. Full-page shot pins the composed look.
  await page.getByTestId('canvas-node').filter({ hasText: 'Text' }).first().click()
  await page.getByLabel('Text', { exact: true }).fill('Hello world')
  await page.locator('main').click({ position: { x: 10, y: 10 } })
  const cardButton = page.getByTestId('canvas-node').filter({ hasText: 'Button' }).first()
  await cardButton.click()
  await page.getByLabel('Style').click()
  await page.getByRole('option', { name: 'Danger' }).click()
  await page.getByLabel('Fill container width').click()
  await page.locator('main').click({ position: { x: 10, y: 10 } })
  await page.getByTestId('palette-image').click()
  await expect(page.getByTestId('canvas-node')).toHaveCount(4)
  await page.locator('main').click({ position: { x: 10, y: 10 } })
  await page.waitForTimeout(700)
})
