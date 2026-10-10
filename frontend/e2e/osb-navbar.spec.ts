import { test, expect } from '@playwright/test'
import type { SiteNode } from '../src/site/types'
import { LONG_TEXT, mountNodes, noHorizontalOverflow } from './helpers'

interface Case {
  name: string
  nodes: SiteNode[]
}

const FULL = {
  brand: 'Acme',
  link1Label: 'Home',
  link2Label: 'Features',
  link3Label: 'Pricing',
  ctaLabel: 'Sign up',
}

// Every edge case, encoded here — one screenshot per case.
const CASES: Case[] = [
  { name: 'outlined', nodes: [{ id: 'a', type: 'navbar', config: { ...FULL } }] },
  { name: 'plain', nodes: [{ id: 'a', type: 'navbar', config: { ...FULL, surface: 'plain' } }] },
  { name: 'filled', nodes: [{ id: 'a', type: 'navbar', config: { ...FULL, surface: 'filled' } }] },
  { name: 'centered', nodes: [{ id: 'a', type: 'navbar', config: { ...FULL, layout: 'centered' } }] },
  { name: 'no-cta', nodes: [{ id: 'a', type: 'navbar', config: { ...FULL, ctaLabel: '' } }] },
  { name: 'cta-only', nodes: [{ id: 'a', type: 'navbar', config: { brand: 'Acme', link1Label: '', link2Label: '', link3Label: '' } }] },
  { name: 'one-link', nodes: [{ id: 'a', type: 'navbar', config: { ...FULL, link2Label: '', link3Label: '' } }] },
  { name: 'brand-only', nodes: [{ id: 'a', type: 'navbar', config: { brand: 'Acme', link1Label: '', link2Label: '', link3Label: '', ctaLabel: '' } }] },
  { name: 'empty-all', nodes: [{ id: 'a', type: 'navbar', config: { brand: '', link1Label: '', link2Label: '', link3Label: '', ctaLabel: '' } }] },
  { name: 'long-labels', nodes: [{ id: 'a', type: 'navbar', config: { ...FULL, brand: LONG_TEXT, link1Label: LONG_TEXT } }] },
  { name: 'dark-outlined', nodes: [{ id: 'a', type: 'navbar', config: { ...FULL, theme: 'dark' } }] },
  { name: 'dark-plain', nodes: [{ id: 'a', type: 'navbar', config: { ...FULL, surface: 'plain', theme: 'dark' } }] },
  { name: 'dark-filled', nodes: [{ id: 'a', type: 'navbar', config: { ...FULL, surface: 'filled', theme: 'dark' } }] },
  { name: 'dark-centered', nodes: [{ id: 'a', type: 'navbar', config: { ...FULL, layout: 'centered', theme: 'dark' } }] },
]

for (const c of CASES) {
  test(`navbar/${c.name}`, async ({ page }) => {
    await mountNodes(page, c.nodes)
    const block = page.getByTestId('osb-mount')
    await expect(block).toBeVisible()
    await expect(block).toHaveScreenshot(`osb-navbar-${c.name}.png`)
  })
}

test('navbar edge cases: links and action stay reachable, no overflow at 360px', async ({ page }) => {
  await mountNodes(page, [
    { id: 'a', type: 'navbar', config: { ...FULL } },
    { id: 'b', type: 'navbar', config: { brand: LONG_TEXT, link1Label: LONG_TEXT, ctaLabel: LONG_TEXT } },
  ])
  // A navigation landmark with three real links plus its CTA button.
  const nav = page.getByRole('navigation', { name: 'Site' }).first()
  await expect(nav).toBeVisible()
  await expect(nav.getByRole('link')).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'Sign up' })).toBeVisible()
  await page.setViewportSize({ width: 360, height: 800 })
  await noHorizontalOverflow(page)
})
