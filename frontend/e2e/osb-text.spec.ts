import { test, expect } from '@playwright/test'
import type { SiteNode } from '../src/site/types'
import { LONG_TEXT, mountNodes, noHorizontalOverflow } from './helpers'

interface Case {
  name: string
  nodes: SiteNode[]
  /** Global theme for the page, not a per-node config. */
  theme?: 'dark'
}

const CASES: Case[] = [
  { name: 'default', nodes: [{ id: 'a', type: 'text', config: { text: 'Text' } }] },
  { name: 'center', nodes: [{ id: 'a', type: 'text', config: { text: 'Centered', align: 'center' } }] },
  { name: 'dark', theme: 'dark', nodes: [{ id: 'a', type: 'text', config: { text: 'Dark' } }] },
  { name: 'long', nodes: [{ id: 'a', type: 'text', config: { text: LONG_TEXT } }] },
  { name: 'empty-fallback', nodes: [{ id: 'a', type: 'text', config: { text: '' } }] },
  { name: 'h1', nodes: [{ id: 'a', type: 'text', config: { text: 'Heading 1', heading: 'h1' } }] },
  { name: 'h3', nodes: [{ id: 'a', type: 'text', config: { text: 'Heading 3', heading: 'h3' } }] },
  {
    name: 'bold-italic',
    nodes: [{ id: 'a', type: 'text', config: { text: 'Bold italic', bold: true, italic: true } }],
  },
  { name: 'serif', nodes: [{ id: 'a', type: 'text', config: { text: 'Serif copy', font: 'serif' } }] },
  { name: 'mono', nodes: [{ id: 'a', type: 'text', config: { text: 'Mono copy', font: 'mono' } }] },
  { name: 'muted', nodes: [{ id: 'a', type: 'text', config: { text: 'Muted copy', tone: 'muted' } }] },
  { name: 'gradient', nodes: [{ id: 'a', type: 'text', config: { text: 'Gradient', tone: 'gradient' } }] },
  {
    name: 'dark-gradient',
    theme: 'dark',
    nodes: [{ id: 'a', type: 'text', config: { text: 'Gradient', tone: 'gradient' } }],
  },
]

for (const c of CASES) {
  test(`text/${c.name}`, async ({ page }) => {
    await mountNodes(page, c.nodes, c.theme)
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

// Objective check that the typography actually lands (not just a pixel hash).
test('text typography lands: headings scale + bold, gradient paints a clip', async ({ page }) => {
  await mountNodes(page, [
    { id: 'body', type: 'text', config: { text: 'Body', heading: 'none' } },
    { id: 'h1', type: 'text', config: { text: 'Title', heading: 'h1' } },
    { id: 'g', type: 'text', config: { text: 'Gradient', tone: 'gradient' } },
  ])
  const body = await page.locator('p').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  const heading = await page.locator('h1').evaluate((el) => {
    const s = getComputedStyle(el)
    return { size: parseFloat(s.fontSize), weight: Number(s.fontWeight) }
  })
  expect(heading.size).toBeGreaterThan(body)
  expect(heading.weight).toBeGreaterThanOrEqual(700)

  const gradient = await page.getByText('Gradient').evaluate((el) => {
    const s = getComputedStyle(el)
    return { image: s.backgroundImage, clip: s.webkitBackgroundClip ?? s.backgroundClip, color: s.color }
  })
  expect(gradient.image).toContain('linear-gradient')
  expect(gradient.clip).toBe('text')
  expect(gradient.color).toBe('rgba(0, 0, 0, 0)')
})
