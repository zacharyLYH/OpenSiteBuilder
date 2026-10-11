import { test, expect } from '@playwright/test'
import type { SiteNode } from '../src/site/types'
import { TEST_IMAGE, mountNodes, noHorizontalOverflow } from './helpers'

interface Case {
  name: string
  nodes: SiteNode[]
}

const CASES: Case[] = [
  { name: 'with-image', nodes: [{ id: 'a', type: 'image', config: { imageSrc: TEST_IMAGE, imageAlt: 'Test image' } }] },
  { name: 'placeholder', nodes: [{ id: 'a', type: 'image', config: {} }] },
]

for (const c of CASES) {
  test(`image/${c.name}`, async ({ page }) => {
    await mountNodes(page, c.nodes)
    const block = page.getByTestId('osb-mount')
    await expect(block).toBeVisible()
    await expect(block).toHaveScreenshot(`osb-image-${c.name}.png`)
  })
}

test('image edge cases: placeholder has a label, no overflow at 360px', async ({ page }) => {
  await mountNodes(page, [
    { id: 'a', type: 'image', config: { imageSrc: TEST_IMAGE, imageAlt: 'Test image' } },
    { id: 'b', type: 'image', config: {} },
  ])
  await expect(page.getByRole('img', { name: 'Test image' })).toBeVisible()
  // The placeholder fills its grid box; the flow-layout mount gives it no
  // intrinsic height, so assert attachment + label, not visibility.
  const fallback = page.getByTestId('osb-image-fallback')
  await expect(fallback).toHaveCount(1)
  await expect(fallback).toHaveAttribute('aria-label', 'Image placeholder')
  await page.setViewportSize({ width: 360, height: 800 })
  await noHorizontalOverflow(page)
})
