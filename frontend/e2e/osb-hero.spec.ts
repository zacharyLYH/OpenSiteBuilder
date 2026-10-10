import { test, expect } from '@playwright/test'
import type { SiteNode } from '../src/site/types'
import { LONG_TEXT, TEST_IMAGE, mountNodes, noHorizontalOverflow } from './helpers'

interface Case {
  name: string
  nodes: SiteNode[]
}

const IMG = { imageSrc: TEST_IMAGE, imageAlt: 'Test image' }
const FULL = {
  eyebrow: 'New',
  title: 'Welcome to my site',
  body: 'Hero body copy that explains the offer in one or two sentences.',
  primaryLabel: 'Get started',
  secondaryLabel: 'Learn more',
}

// Every edge case, encoded here — one screenshot per case.
const CASES: Case[] = [
  { name: 'full-split', nodes: [{ id: 'a', type: 'hero', config: { ...FULL, ...IMG } }] },
  { name: 'stacked', nodes: [{ id: 'a', type: 'hero', config: { ...FULL, ...IMG, layout: 'stacked' } }] },
  { name: 'center', nodes: [{ id: 'a', type: 'hero', config: { ...FULL, ...IMG, layout: 'stacked', align: 'center' } }] },
  { name: 'no-image', nodes: [{ id: 'a', type: 'hero', config: { ...FULL } }] },
  { name: 'title-only', nodes: [{ id: 'a', type: 'hero', config: { title: 'Just a title', body: '', primaryLabel: '', secondaryLabel: '', eyebrow: '' } }] },
  { name: 'single-action', nodes: [{ id: 'a', type: 'hero', config: { ...FULL, ...IMG, secondaryLabel: '' } }] },
  { name: 'no-eyebrow', nodes: [{ id: 'a', type: 'hero', config: { ...FULL, ...IMG, eyebrow: '' } }] },
  { name: 'long-title', nodes: [{ id: 'a', type: 'hero', config: { ...FULL, ...IMG, title: LONG_TEXT } }] },
  { name: 'dark-full', nodes: [{ id: 'a', type: 'hero', config: { ...FULL, ...IMG, theme: 'dark' } }] },
  { name: 'dark-stacked', nodes: [{ id: 'a', type: 'hero', config: { ...FULL, layout: 'stacked', theme: 'dark' } }] },
]

for (const c of CASES) {
  test(`hero/${c.name}`, async ({ page }) => {
    await mountNodes(page, c.nodes)
    const block = page.getByTestId('osb-mount')
    await expect(block).toBeVisible()
    await expect(block).toHaveScreenshot(`osb-hero-${c.name}.png`)
  })
}

test('hero edge cases: both actions visible, stacks without overflow at 360px', async ({
  page,
}) => {
  await mountNodes(page, [{ id: 'a', type: 'hero', config: { ...FULL, ...IMG, title: LONG_TEXT } }])
  await expect(page.getByRole('button', { name: 'Get started' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Learn more' })).toBeVisible()
  await expect(page.locator('h1').first()).toBeVisible()
  await page.setViewportSize({ width: 360, height: 800 })
  await noHorizontalOverflow(page)
})
