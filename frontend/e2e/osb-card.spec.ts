import { test, expect } from '@playwright/test'
import type { SiteNode } from '../src/site/types'
import { LONG_TEXT, TEST_IMAGE, mountNodes, noHorizontalOverflow } from './helpers'

interface Case {
  name: string
  nodes: SiteNode[]
  /** Global theme for the page, not a per-node config. */
  theme?: 'dark'
}

// A card is chrome only: variant. Theme is global. All content is real nodes.
const CASES: Case[] = [
  { name: 'empty', nodes: [{ id: 'a', type: 'card', config: {} }] },
  { name: 'outlined', nodes: [{ id: 'a', type: 'card', config: { variant: 'outlined' } }] },
  { name: 'plain', nodes: [{ id: 'a', type: 'card', config: { variant: 'plain' } }] },
  { name: 'dark', theme: 'dark', nodes: [{ id: 'a', type: 'card', config: {} }] },
  {
    name: 'content',
    nodes: [
      {
        id: 'a',
        type: 'card',
        config: {},
        children: [
          { id: 't1', type: 'text', config: { text: 'Card title', heading: 'h4' } },
          { id: 't2', type: 'text', config: { text: 'Card body copy.', tone: 'muted' } },
          { id: 'b1', type: 'button', config: { label: 'Learn more' } },
        ],
      },
    ],
  },
  {
    name: 'dark-content',
    theme: 'dark',
    nodes: [
      {
        id: 'a',
        type: 'card',
        config: { variant: 'outlined' },
        children: [
          { id: 't1', type: 'text', config: { text: 'Dark card', heading: 'h4' } },
          { id: 'b1', type: 'button', config: { label: 'Go' } },
        ],
      },
    ],
  },
  {
    name: 'with-image',
    nodes: [
      {
        id: 'a',
        type: 'card',
        config: {},
        children: [
          { id: 'i1', type: 'image', config: { imageSrc: TEST_IMAGE, imageAlt: 'Test image' } },
          { id: 't1', type: 'text', config: { text: 'Caption' } },
        ],
      },
    ],
  },
]

for (const c of CASES) {
  test(`card/${c.name}`, async ({ page }) => {
    await mountNodes(page, c.nodes, c.theme)
    const block = page.getByTestId('osb-mount')
    await expect(block).toBeVisible()
    await expect(block).toHaveScreenshot(`osb-card-${c.name}.png`)
  })
}

test('card edge cases: every visible thing is a real node, no overflow at 360px', async ({
  page,
}) => {
  await mountNodes(page, [
    {
      id: 'a',
      type: 'card',
      config: {},
      children: [
        { id: 't', type: 'text', config: { text: LONG_TEXT } },
        { id: 'b', type: 'button', config: { label: 'Go' } },
      ],
    },
  ])
  // No ghost internals: the only button is the real child node.
  await expect(page.getByRole('button', { name: 'Go' })).toBeVisible()
  await expect(page.getByTestId('osb-card-children')).toHaveCount(1)
  await page.setViewportSize({ width: 360, height: 800 })
  await noHorizontalOverflow(page)
})

// Objective check that the shadcn card chrome actually lands.
test('card chrome lands: bordered surface with a shadow, rounded corners', async ({ page }) => {
  await mountNodes(page, [
    {
      id: 'a',
      type: 'card',
      config: {},
      children: [{ id: 't', type: 'text', config: { text: 'Title', heading: 'h4' } }],
    },
  ])
  const card = await page.locator('[data-slot="card"]').evaluate((el) => {
    const s = getComputedStyle(el)
    return { bg: s.backgroundColor, borderWidth: s.borderTopWidth, radius: parseFloat(s.borderTopLeftRadius), shadow: s.boxShadow }
  })
  expect(card.bg).toBe('rgb(255, 255, 255)')
  expect(parseFloat(card.borderWidth)).toBeGreaterThan(0)
  expect(card.radius).toBeGreaterThanOrEqual(12)
  expect(card.shadow).not.toBe('none')
})
