import { test, expect } from '@playwright/test'
import type { SiteNode } from '../src/site/types'
import { LONG_TEXT, mountNodes, noHorizontalOverflow } from './helpers'

interface Case {
  name: string
  nodes: SiteNode[]
  /** Global theme for the page, not a per-node config. */
  theme?: 'dark'
}

// Every edge case, encoded here — one screenshot per case. The button fills
// its grid box (box is the component); size only changes the font scale.
const CASES: Case[] = [
  { name: 'default', nodes: [{ id: 'a', type: 'button', config: { label: 'Primary' } }] },
  { name: 'secondary', nodes: [{ id: 'a', type: 'button', config: { label: 'Secondary', variant: 'secondary' } }] },
  { name: 'destructive', nodes: [{ id: 'a', type: 'button', config: { label: 'Danger', variant: 'destructive' } }] },
  { name: 'outline', nodes: [{ id: 'a', type: 'button', config: { label: 'Outline', variant: 'outline' } }] },
  { name: 'ghost', nodes: [{ id: 'a', type: 'button', config: { label: 'Ghost', variant: 'ghost' } }] },
  { name: 'link', nodes: [{ id: 'a', type: 'button', config: { label: 'Link', variant: 'link' } }] },
  { name: 'sm', nodes: [{ id: 'a', type: 'button', config: { label: 'Small', size: 'sm' } }] },
  { name: 'lg', nodes: [{ id: 'a', type: 'button', config: { label: 'Large', size: 'lg' } }] },
  { name: 'sm-secondary', nodes: [{ id: 'a', type: 'button', config: { label: 'Small', size: 'sm', variant: 'secondary' } }] },
  { name: 'center', nodes: [{ id: 'a', type: 'button', config: { label: 'Centered', align: 'center' } }] },
  { name: 'long-wrap', nodes: [{ id: 'a', type: 'button', config: { label: LONG_TEXT } }] },
  { name: 'empty-fallback', nodes: [{ id: 'a', type: 'button', config: { label: '' } }] },
  // Docs saved before the shadcn vocabulary still render styled.
  { name: 'legacy-primary', nodes: [{ id: 'a', type: 'button', config: { label: 'Legacy', variant: 'primary', size: 'md' } }] },
  { name: 'dark-default', theme: 'dark', nodes: [{ id: 'a', type: 'button', config: { label: 'Primary' } }] },
  { name: 'dark-secondary', theme: 'dark', nodes: [{ id: 'a', type: 'button', config: { label: 'Secondary', variant: 'secondary' } }] },
  { name: 'dark-outline', theme: 'dark', nodes: [{ id: 'a', type: 'button', config: { label: 'Outline', variant: 'outline' } }] },
]

for (const c of CASES) {
  test(`button/${c.name}`, async ({ page }) => {
    await mountNodes(page, c.nodes, c.theme)
    const block = page.getByTestId('osb-mount')
    await expect(block).toBeVisible()
    await expect(block).toHaveScreenshot(`osb-button-${c.name}.png`)
  })
}

test('button edge cases: long label wraps, no overflow at 360px', async ({ page }) => {
  await mountNodes(page, [{ id: 'b', type: 'button', config: { label: LONG_TEXT } }])
  await expect(page.getByRole('button').first()).toBeVisible()
  await page.setViewportSize({ width: 360, height: 800 })
  await noHorizontalOverflow(page)
})

// Objective check that shadcn variant values actually land (not just a hash).
test('button variants land their shadcn colours', async ({ page }) => {
  await mountNodes(page, [
    { id: 'd', type: 'button', config: { label: 'Default' } },
    { id: 'x', type: 'button', config: { label: 'Danger', variant: 'destructive' } },
    { id: 'g', type: 'button', config: { label: 'Ghost', variant: 'ghost' } },
  ])
  const bg = async (name: string) =>
    page.getByRole('button', { name }).evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(await bg('Default')).toBe('rgb(15, 23, 42)') // slate-900
  expect(await bg('Danger')).toBe('rgb(220, 38, 38)') // red-600
  expect(await bg('Ghost')).toBe('rgba(0, 0, 0, 0)') // transparent
})

test('legacy primary/md config still renders as the default variant', async ({ page }) => {
  await mountNodes(page, [{ id: 'l', type: 'button', config: { label: 'Legacy', variant: 'primary', size: 'md' } }])
  const style = await page.getByRole('button', { name: 'Legacy' }).evaluate((el) => {
    const s = getComputedStyle(el)
    return { bg: s.backgroundColor, size: parseFloat(s.fontSize) }
  })
  expect(style.bg).toBe('rgb(15, 23, 42)')
  expect(style.size).toBe(14) // text-sm / Medium
})
