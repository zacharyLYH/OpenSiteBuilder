import { test, expect, type Locator, type Page } from '@playwright/test'
import type { SiteNode } from '../src/site/types'
import type { CanvasDoc } from '../src/canvas/doc'
import { closeDrawerIfOpen, mountNodes, noHorizontalOverflow, openCanvas } from './helpers'

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

// ---------------------------------------------------------------------------
// Playability. A local ffmpeg-generated clip is served through the page, so
// "the video plays" is pinned against real decoding — never a live network
// fetch and never a broken URL that only checks attributes.
// ---------------------------------------------------------------------------
const FIXTURE = 'e2e/fixtures/sample.mp4'
const SRC = '/sample.mp4'

async function serveVideo(page: Page): Promise<void> {
  await page.route(`**${SRC}`, (route) => route.fulfill({ path: FIXTURE, contentType: 'video/mp4' }))
}

/** Wait until the player has decoded enough to play. */
async function waitForClip(video: Locator): Promise<void> {
  await expect(video).toBeVisible()
  await video.evaluate(
    (el) =>
      new Promise<void>((resolve) => {
        const v = el as HTMLVideoElement
        if (v.readyState >= 2) return resolve()
        v.addEventListener('loadeddata', () => resolve(), { once: true })
      }),
  )
}

/** Chrome's native control bar puts the play/pause button hit area ~10px in
 * and ~30px up from the player's bottom-left corner. */
async function clickPlay(video: Locator): Promise<void> {
  const box = await video.boundingBox()
  if (!box) throw new Error('video has no bounding box')
  await video.click({ position: { x: 10, y: box.height - 30 } })
}

async function expectPlaying(video: Locator): Promise<void> {
  await expect.poll(() => video.evaluate((el) => (el as HTMLVideoElement).paused)).toBe(false)
  const played = await video.evaluate(async (el) => {
    const v = el as HTMLVideoElement
    await new Promise((r) => setTimeout(r, 250))
    return { t: v.currentTime, dur: v.duration }
  })
  expect(played.dur).toBeGreaterThan(0)
  expect(played.t).toBeGreaterThan(0)
}

const videoDoc = (): CanvasDoc => ({
  version: 1,
  theme: 'light',
  nodes: [
    { id: 'v1', type: 'video', config: { videoSrc: SRC, loop: true }, parentId: null, x: 0, y: 0, cols: 12, rows: 10 },
  ],
  overlays: [],
})

test('video plays a real clip (mount harness)', async ({ page }) => {
  await serveVideo(page)
  await mountNodes(page, [{ id: 'a', type: 'video', config: { videoSrc: SRC, loop: true } }])
  const video = page.locator('video')
  await waitForClip(video)
  await clickPlay(video)
  await expectPlaying(video)
})

test('canvas edit mode keeps the player playable', async ({ page }) => {
  await serveVideo(page)
  await page.setViewportSize({ width: 1280, height: 1000 })
  await openCanvas(page, 'e2e-video-edit', videoDoc())
  const video = page.locator('[data-testid="canvas-node"] video')
  await waitForClip(video)
  // Selecting the node — the normal way to edit its URL — must not put the
  // selection chrome over the controls: the canvas keeps playing, not just
  // preview mode.
  await page.locator('[data-testid="canvas-node"]').first().click()
  await expect(page.locator('[data-testid="canvas-node"].canvas-selected')).toHaveCount(1)
  await clickPlay(video)
  await expectPlaying(video)
})

test('canvas preview plays the clip instead of hijacking the click', async ({ page }) => {
  await serveVideo(page)
  await page.setViewportSize({ width: 1280, height: 1000 })
  await openCanvas(page, 'e2e-video-play', videoDoc())
  const video = page.locator('video')
  await waitForClip(video)
  // Preview hides the editor chrome so the canvas reads as the real site.
  await page.getByTestId('toggle-preview').click()
  await expect(page.getByTestId('canvas')).toHaveAttribute('data-preview', 'true')
  await clickPlay(video)
  await expectPlaying(video)
})

test('sidebar preview keeps the player playable', async ({ page }) => {
  await serveVideo(page)
  await page.setViewportSize({ width: 1280, height: 1000 })
  await openCanvas(page, 'e2e-video-drawer', videoDoc())
  await page.locator('[data-testid="canvas-node"]').first().click()
  const preview = page.locator('[data-testid="config-drawer"] video')
  await waitForClip(preview)
  await clickPlay(preview)
  await expectPlaying(preview)
  await closeDrawerIfOpen(page)
})
