import { test, expect } from '@playwright/test'
import type { SiteNode } from '../src/site/types'
import { LONG_TEXT, mountNodes, noHorizontalOverflow } from './helpers'

interface Case {
  name: string
  nodes: SiteNode[]
}

// Every edge case, encoded here — one screenshot per case.
const CASES: Case[] = [
  { name: 'primary', nodes: [{ id: 'a', type: 'button', config: { label: 'Primary' } }] },
  { name: 'secondary', nodes: [{ id: 'a', type: 'button', config: { label: 'Secondary', variant: 'secondary' } }] },
  { name: 'outline', nodes: [{ id: 'a', type: 'button', config: { label: 'Outline', variant: 'outline' } }] },
  { name: 'sm', nodes: [{ id: 'a', type: 'button', config: { label: 'Small', size: 'sm' } }] },
  { name: 'sm-secondary', nodes: [{ id: 'a', type: 'button', config: { label: 'Small', size: 'sm', variant: 'secondary' } }] },
  { name: 'disabled', nodes: [{ id: 'a', type: 'button', config: { label: 'Disabled', disabled: true } }] },
  { name: 'full-width', nodes: [{ id: 'a', type: 'button', config: { label: 'Full width', fullWidth: true } }] },
  { name: 'center', nodes: [{ id: 'a', type: 'button', config: { label: 'Centered', align: 'center' } }] },
  { name: 'long-wrap', nodes: [{ id: 'a', type: 'button', config: { label: LONG_TEXT } }] },
  { name: 'empty-fallback', nodes: [{ id: 'a', type: 'button', config: { label: '' } }] },
  { name: 'dark-primary', nodes: [{ id: 'a', type: 'button', config: { label: 'Primary', theme: 'dark' } }] },
  { name: 'dark-secondary', nodes: [{ id: 'a', type: 'button', config: { label: 'Secondary', variant: 'secondary', theme: 'dark' } }] },
  { name: 'dark-outline', nodes: [{ id: 'a', type: 'button', config: { label: 'Outline', variant: 'outline', theme: 'dark' } }] },
  { name: 'dark-disabled', nodes: [{ id: 'a', type: 'button', config: { label: 'Disabled', disabled: true, theme: 'dark' } }] },
]

for (const c of CASES) {
  test(`button/${c.name}`, async ({ page }) => {
    await mountNodes(page, c.nodes)
    const block = page.getByTestId('osb-mount')
    await expect(block).toBeVisible()
    await expect(block).toHaveScreenshot(`osb-button-${c.name}.png`)
  })
}

test('button edge cases: disabled blocks, no overflow at 360px', async ({ page }) => {
  await mountNodes(page, [
    { id: 'a', type: 'button', config: { label: 'Disabled', disabled: true } },
    { id: 'b', type: 'button', config: { label: LONG_TEXT } },
  ])
  await expect(page.getByRole('button', { name: 'Disabled' })).toBeDisabled()
  await page.setViewportSize({ width: 360, height: 800 })
  await noHorizontalOverflow(page)
})
