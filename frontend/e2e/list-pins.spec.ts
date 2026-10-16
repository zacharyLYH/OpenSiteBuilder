import { test, expect } from '@playwright/test'

// Look-pins: a seeded sample page, screenshotted exactly. No interaction here
// (behavior lives in list-canvas/list-interact) — if these shots change, the
// shipped look changed. Seed ids are fixed so output is deterministic.
const KEY = (slug: string): string => `osb.list.${slug}`

const SAMPLE = {
  version: '0.1',
  site: { name: 'pins', theme: 'light' },
  pages: [
    {
      id: 'home',
      path: '/',
      title: 'Home',
      nodes: [
        { id: 't1', type: 'text', config: { text: 'Hello world', heading: 'h1' } },
        {
          id: 'c1',
          type: 'card',
          config: {},
          children: [{ id: 'b1', type: 'button', config: { label: 'Buy now', variant: 'destructive', fill: true } }],
        },
        { id: 'i1', type: 'image', config: {} },
      ],
    },
  ],
}

async function openSeeded(page: import('@playwright/test').Page, slug: string) {
  await page.context().addCookies([{ name: 'obs_curr_project_name', value: slug, domain: 'localhost', path: '/' }])
  await page.goto('/canvas')
  await page.evaluate(([key, doc]: [string, unknown]) => localStorage.setItem(key, JSON.stringify(doc)), [KEY(slug), SAMPLE] as [string, unknown])
  await page.reload()
}

test('pinned looks: composed page', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await openSeeded(page, 'e2e-pins')
  await expect(page.getByTestId('canvas-node')).toHaveCount(4)
  await expect(page.locator('main')).toHaveScreenshot('pins-composed.png')
})

test('pinned looks: button inspector', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await openSeeded(page, 'e2e-pins-drawer')
  await page.getByTestId('canvas-node').filter({ hasText: 'Buy now' }).first().click()
  await expect(page.getByTestId('config-drawer')).toBeVisible()
  await expect(page.getByTestId('config-drawer')).toHaveScreenshot('pins-inspector.png')
})

test('pinned looks: rejected halo', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await openSeeded(page, 'e2e-pins-reject')
  // Drag the card onto the gap inside its own button child: a cycle the gate
  // refuses with a red halo + voiced reason.
  const card = page.locator('[data-testid="canvas-node"][data-type="card"]')
  const cardBox = await card.boundingBox()
  if (!cardBox) throw new Error('missing card box')
  const fromX = cardBox.x + cardBox.width / 2
  const fromY = cardBox.y + 20
  await page.mouse.move(fromX, fromY)
  await page.mouse.down()
  await page.mouse.move(fromX + 8, fromY + 8, { steps: 4 })
  await page.waitForTimeout(200)
  const innerBox = await card.getByTestId('canvas-gap').first().boundingBox()
  if (!innerBox) throw new Error('missing gap box')
  await page.mouse.move(innerBox.x + innerBox.width / 2, innerBox.y + innerBox.height / 2, { steps: 12 })
  await page.mouse.up()
  await expect(page.getByTestId('drop-message')).toContainText('cycle')
  await expect(card).toHaveScreenshot('pins-rejected.png')
})
