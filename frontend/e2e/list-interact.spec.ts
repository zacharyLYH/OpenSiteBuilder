import { test, expect } from '@playwright/test'

// Interactivity contract for the list canvas: the settings drawer never
// vanishes mid-edit, every offered control persists, and the action bar only
// offers moves that can actually land.
const KEY = (slug: string): string => `osb.list.${slug}`

async function openList(page: import('@playwright/test').Page, slug: string) {
  await page.context().addCookies([{ name: 'obs_curr_project_name', value: slug, domain: 'localhost', path: '/' }])
  await page.goto('/canvas')
}

test('drawer survives focus + edits and persists them', async ({ page }) => {
  await openList(page, 'e2e-interact')
  await page.getByTestId('palette-button').click()
  const node = page.getByTestId('canvas-node').first()
  await node.click()
  await expect(page.getByTestId('config-drawer')).toBeVisible()

  // Clicking the text box must not dismiss the drawer.
  await page.getByLabel('Button text').click()
  await page.getByLabel('Button text').fill('Buy now')
  await expect(page.getByTestId('config-drawer')).toBeVisible()

  // Changing a style must not dismiss either — and it must persist.
  await page.getByLabel('Style').click()
  await page.getByRole('option', { name: 'Danger' }).click()
  await expect(page.getByTestId('config-drawer')).toBeVisible()
  await page.waitForTimeout(700)
  const raw = await page.evaluate((k: string) => localStorage.getItem(k), KEY('e2e-interact'))
  const manifest = JSON.parse(raw as string)
  expect(manifest.pages[0].nodes[0].config).toMatchObject({ label: 'Buy now', variant: 'destructive' })
})

test('button width control exists and fills its box', async ({ page }) => {
  await openList(page, 'e2e-width')
  await page.getByTestId('palette-button').click()
  await page.getByTestId('canvas-node').first().click()
  await expect(page.getByTestId('config-drawer')).toBeVisible()
  await page.getByLabel('Fill container width').click()
  await page.waitForTimeout(700)
  const raw = await page.evaluate((k: string) => localStorage.getItem(k), KEY('e2e-width'))
  const manifest = JSON.parse(raw as string)
  expect(manifest.pages[0].nodes[0].config).toMatchObject({ fill: true })
})

test('action bar only offers landable moves', async ({ page }) => {
  await openList(page, 'e2e-bar')
  await page.getByTestId('palette-button').click()
  await page.getByTestId('canvas-node').first().click()
  // Atoms hold nothing: no add-inside, and no nest with no container beside.
  await expect(page.getByTestId('target-here')).toHaveCount(0)
  await expect(page.getByTestId('nest-in')).toHaveCount(0)
  await expect(page.getByTestId('remove-node')).toBeVisible()

  // With a card beside it, nesting becomes offerable.
  await page.getByTestId('add-card').click()
  await page.getByTestId('canvas-node').filter({ hasText: 'Button' }).first().click()
  await expect(page.getByTestId('nest-in')).toBeVisible()

  // Containers offer add-inside.
  await page.getByTestId('canvas-node').filter({ hasText: 'Drop here' }).click()
  await expect(page.getByTestId('target-here')).toBeVisible()
})
