import { test, expect } from '@playwright/test'
import type { SiteNode } from '../src/site/types'
import { mountNodes, noHorizontalOverflow } from './helpers'

interface Case {
  name: string
  nodes: SiteNode[]
}

const CLIP = 'https://example.com/clip.mp4'

const CASES: Case[] = [
  { name: 'with-video', nodes: [{ id: 'a', type: 'video', config: { videoSrc: CLIP } }] },
  { name: 'placeholder', nodes: [{ id: 'a', type: 'video', config: {} }] },
]

for (const c of CASES) {
  test(`video/${c.name}`, async ({ page }) => {
    await mountNodes(page, c.nodes)
    const block = page.getByTestId('osb-mount')
    await expect(block).toBeVisible()
    await expect(block).toHaveScreenshot(`osb-video-${c.name}.png`)
  })
}

test('video edge cases: player carries the full <video> contract, no overflow at 360px', async ({ page }) => {
  await mountNodes(page, [
    {
      id: 'a',
      type: 'video',
      config: { videoSrc: CLIP, poster: 'https://example.com/cover.jpg', loop: true, muted: true },
    },
    { id: 'b', type: 'video', config: {} },
  ])
  const player = page.locator('video').first()
  await expect(player).toHaveCount(1)
  await expect(player).toHaveAttribute('src', CLIP)
  await expect(player).toHaveAttribute('poster', 'https://example.com/cover.jpg')
  await expect(player).toHaveAttribute('controls', '')
  await expect(player).toHaveAttribute('playsinline', '')
  await expect(player).toHaveAttribute('loop', '')
  // The placeholder fills its grid box; the flow-layout mount gives it no
  // intrinsic height, so assert attachment + label, not visibility.
  const fallback = page.getByTestId('osb-video-fallback')
  await expect(fallback).toHaveCount(1)
  await expect(fallback).toHaveAttribute('aria-label', 'Video placeholder')
  await page.setViewportSize({ width: 360, height: 800 })
  await noHorizontalOverflow(page)
})
