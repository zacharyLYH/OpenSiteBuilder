import { test, expect } from '@playwright/test'
import type { SiteNode } from '../src/site/types'
import { LONG_TEXT, mountNodes, noHorizontalOverflow } from './helpers'

interface Case {
  name: string
  nodes: SiteNode[]
}

const FULL = {
  brand: 'Acme',
  tagline: 'Handmade goods for the whole family.',
  link1Label: 'Home',
  link2Label: 'About',
  link3Label: 'Contact',
  copyright: '© Acme',
}

// Every edge case, encoded here — one screenshot per case.
const CASES: Case[] = [
  { name: 'outlined', nodes: [{ id: 'a', type: 'footer', config: { ...FULL } }] },
  { name: 'plain', nodes: [{ id: 'a', type: 'footer', config: { ...FULL, surface: 'plain' } }] },
  { name: 'filled', nodes: [{ id: 'a', type: 'footer', config: { ...FULL, surface: 'filled' } }] },
  { name: 'centered', nodes: [{ id: 'a', type: 'footer', config: { ...FULL, align: 'center' } }] },
  { name: 'no-links', nodes: [{ id: 'a', type: 'footer', config: { ...FULL, link1Label: '', link2Label: '', link3Label: '' } }] },
  { name: 'one-link', nodes: [{ id: 'a', type: 'footer', config: { ...FULL, link2Label: '', link3Label: '' } }] },
  { name: 'no-tagline', nodes: [{ id: 'a', type: 'footer', config: { ...FULL, tagline: '' } }] },
  { name: 'no-copyright', nodes: [{ id: 'a', type: 'footer', config: { ...FULL, copyright: '' } }] },
  { name: 'brand-only', nodes: [{ id: 'a', type: 'footer', config: { brand: 'Acme', tagline: '', link1Label: '', link2Label: '', link3Label: '', copyright: '' } }] },
  { name: 'empty-all', nodes: [{ id: 'a', type: 'footer', config: { brand: '', tagline: '', link1Label: '', link2Label: '', link3Label: '', copyright: '' } }] },
  { name: 'long-tagline', nodes: [{ id: 'a', type: 'footer', config: { ...FULL, tagline: LONG_TEXT, copyright: LONG_TEXT } }] },
  { name: 'dark-outlined', nodes: [{ id: 'a', type: 'footer', config: { ...FULL, theme: 'dark' } }] },
  { name: 'dark-plain', nodes: [{ id: 'a', type: 'footer', config: { ...FULL, surface: 'plain', theme: 'dark' } }] },
  { name: 'dark-filled-centered', nodes: [{ id: 'a', type: 'footer', config: { ...FULL, surface: 'filled', align: 'center', theme: 'dark' } }] },
]

for (const c of CASES) {
  test(`footer/${c.name}`, async ({ page }) => {
    await mountNodes(page, c.nodes)
    const block = page.getByTestId('osb-mount')
    await expect(block).toBeVisible()
    await expect(block).toHaveScreenshot(`osb-footer-${c.name}.png`)
  })
}

test('footer edge cases: content is a footer landmark with links, no overflow at 360px', async ({ page }) => {
  await mountNodes(page, [
    { id: 'a', type: 'footer', config: { ...FULL } },
    { id: 'b', type: 'footer', config: { tagline: LONG_TEXT, copyright: LONG_TEXT, align: 'center' } },
  ])
  const footer = page.getByRole('contentinfo').first()
  await expect(footer).toBeVisible()
  await expect(footer.getByRole('link')).toHaveCount(3)
  await page.setViewportSize({ width: 360, height: 800 })
  await noHorizontalOverflow(page)
})
