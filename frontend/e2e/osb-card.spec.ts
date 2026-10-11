import { test, expect } from '@playwright/test'
import type { SiteNode } from '../src/site/types'
import { LONG_TEXT, TEST_IMAGE, mountNodes, noHorizontalOverflow } from './helpers'

interface Case {
  name: string
  nodes: SiteNode[]
}

// A card is chrome only: variant + theme. All content is real child nodes.
const CASES: Case[] = [
  { name: 'empty', nodes: [{ id: 'a', type: 'card', config: {} }] },
  { name: 'outlined', nodes: [{ id: 'a', type: 'card', config: { variant: 'outlined' } }] },
  { name: 'plain', nodes: [{ id: 'a', type: 'card', config: { variant: 'plain' } }] },
  { name: 'dark', nodes: [{ id: 'a', type: 'card', config: { theme: 'dark' } }] },
  {
    name: 'content',
    nodes: [
      {
        id: 'a',
        type: 'card',
        config: {},
        children: [
          { id: 't1', type: 'text', config: { text: 'Card title' } },
          { id: 't2', type: 'text', config: { text: 'Card body copy.' } },
          { id: 'b1', type: 'button', config: { label: 'Learn more' } },
        ],
      },
    ],
  },
  {
    name: 'dark-content',
    nodes: [
      {
        id: 'a',
        type: 'card',
        config: { variant: 'outlined', theme: 'dark' },
        children: [
          { id: 't1', type: 'text', config: { text: 'Dark card', theme: 'dark' } },
          { id: 'b1', type: 'button', config: { label: 'Go', theme: 'dark' } },
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
    await mountNodes(page, c.nodes)
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
