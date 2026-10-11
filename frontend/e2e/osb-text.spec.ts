import { test, expect } from '@playwright/test'
import type { SiteNode } from '../src/site/types'
import { LONG_TEXT, mountNodes, noHorizontalOverflow } from './helpers'

interface Case {
  name: string
  nodes: SiteNode[]
}

const CASES: Case[] = [
  { name: 'default', nodes: [{ id: 'a', type: 'text', config: { text: 'Text' } }] },
  { name: 'center', nodes: [{ id: 'a', type: 'text', config: { text: 'Centered', align: 'center' } }] },
  { name: 'dark', nodes: [{ id: 'a', type: 'text', config: { text: 'Dark', theme: 'dark' } }] },
  { name: 'long', nodes: [{ id: 'a', type: 'text', config: { text: LONG_TEXT } }] },
  { name: 'empty-fallback', nodes: [{ id: 'a', type: 'text', config: { text: '' } }] },
]

for (const c of CASES) {
  test(`text/${c.name}`, async ({ page }) => {
    await mountNodes(page, c.nodes)
    const block = page.getByTestId('osb-mount')
    await expect(block).toBeVisible()
    await expect(block).toHaveScreenshot(`osb-text-${c.name}.png`)
  })
}

test('text edge cases: long copy wraps, no overflow at 360px', async ({ page }) => {
  await mountNodes(page, [{ id: 'a', type: 'text', config: { text: LONG_TEXT } }])
  await expect(page.getByText('deliberately long string')).toBeVisible()
  await page.setViewportSize({ width: 360, height: 800 })
  await noHorizontalOverflow(page)
})
