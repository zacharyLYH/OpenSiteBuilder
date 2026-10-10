import { test, expect } from '@playwright/test'
import type { SiteNode } from '../src/site/types'
import { LONG_TEXT, TEST_IMAGE, mountNodes, noHorizontalOverflow } from './helpers'

interface Case {
  name: string
  nodes: SiteNode[]
}

const IMG = { imageSrc: TEST_IMAGE, imageAlt: 'Test image' }

// Every edge case, encoded here — one screenshot per case.
const CASES: Case[] = [
  { name: 'full', nodes: [{ id: 'a', type: 'card', config: { ...IMG, title: 'Card title', body: 'Card body copy.', actionLabel: 'Learn more' } }] },
  { name: 'side-image', nodes: [{ id: 'a', type: 'card', config: { ...IMG, imagePosition: 'side', title: 'Side image', body: 'Image sits beside the copy on wide screens.' } }] },
  { name: 'no-image', nodes: [{ id: 'a', type: 'card', config: { title: 'No image', body: 'Placeholder block holds the layout.' } }] },
  { name: 'outlined', nodes: [{ id: 'a', type: 'card', config: { ...IMG, variant: 'outlined', title: 'Outlined' } }] },
  { name: 'plain', nodes: [{ id: 'a', type: 'card', config: { ...IMG, variant: 'plain', title: 'Plain' } }] },
  { name: 'center', nodes: [{ id: 'a', type: 'card', config: { ...IMG, align: 'center', title: 'Centered' } }] },
  { name: 'no-action', nodes: [{ id: 'a', type: 'card', config: { ...IMG, actionLabel: '' } }] },
  { name: 'title-only', nodes: [{ id: 'a', type: 'card', config: { title: 'Title only', body: '', actionLabel: '' } }] },
  { name: 'body-only', nodes: [{ id: 'a', type: 'card', config: { title: '', body: 'Body without a title.', actionLabel: '' } }] },
  { name: 'empty-all', nodes: [{ id: 'a', type: 'card', config: { title: '', body: '', actionLabel: '' } }] },
  { name: 'long-body', nodes: [{ id: 'a', type: 'card', config: { ...IMG, title: 'Long body', body: LONG_TEXT } }] },
  { name: 'dark-full', nodes: [{ id: 'a', type: 'card', config: { ...IMG, title: 'Dark card', body: 'Dark body copy.', theme: 'dark' } }] },
  { name: 'dark-minimal', nodes: [{ id: 'a', type: 'card', config: { title: 'Dark minimal', body: '', actionLabel: '', theme: 'dark' } }] },
]

for (const c of CASES) {
  test(`card/${c.name}`, async ({ page }) => {
    await mountNodes(page, c.nodes)
    const block = page.getByTestId('osb-mount')
    await expect(block).toBeVisible()
    await expect(block).toHaveScreenshot(`osb-card-${c.name}.png`)
  })
}

test('card edge cases: action navigates nothing broken, no overflow at 360px', async ({
  page,
}) => {
  await mountNodes(page, [
    { id: 'a', type: 'card', config: { ...IMG, title: 'T', body: LONG_TEXT, actionLabel: 'Go' } },
    { id: 'b', type: 'card', config: { imagePosition: 'side', title: 'Side', body: LONG_TEXT } },
  ])
  await expect(page.getByRole('button', { name: 'Go' })).toBeVisible()
  await page.setViewportSize({ width: 360, height: 800 })
  await noHorizontalOverflow(page)
})
