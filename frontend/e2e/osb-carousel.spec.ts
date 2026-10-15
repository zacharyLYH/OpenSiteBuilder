import { test, expect } from '@playwright/test'
import type { SiteNode } from '../src/site/types'
import {
  bbox,
  closeDrawerIfOpen,
  dragChildToCell,
  dropToCell,
  mountNodes,
  nodeById,
  openCanvas,
  persistedDoc,
} from './helpers'
import { validateDoc, type CanvasDoc } from '../src/canvas/doc'

// ---------------------------------------------------------------------------
// (1) COMPONENT CASES — the real shadcn carousel, mounted through the generic
// harness (the published engine path). 12 columns over 3 slides = 4-cell
// bands ([0,4) [4,8) [8,12)), so each slide's atoms are laid out in that
// slide's own space. The children mirror what the Carousel pattern starts a
// page with: one small, indented atom per slide.
// ---------------------------------------------------------------------------
const CAROUSEL = (over: Partial<SiteNode> = {}): SiteNode => ({
  id: 'car',
  type: 'carousel',
  config: { items: 3 },
  cols: 12,
  rows: 7,
  children: [
    { id: 'c1', type: 'image', config: {}, x: 1, y: 1, cols: 2, rows: 2, slot: 0 },
    { id: 'c2', type: 'text', config: { text: 'Swipe for more', heading: 'h4' }, x: 5, y: 1, cols: 2, rows: 1, slot: 1 },
    { id: 'c3', type: 'badge', config: { text: 'New slide' }, x: 9, y: 1, cols: 2, rows: 1, slot: 2 },
  ],
  ...over,
})

interface Case {
  name: string
  nodes: SiteNode[]
  /** Global theme for the page, not a per-node config. */
  theme?: 'dark'
}

const CASES: Case[] = [
  { name: 'default', nodes: [CAROUSEL()] },
  { name: 'two-in-view', nodes: [CAROUSEL({ config: { items: 3, perView: '2' } })] },
  { name: 'empty', nodes: [CAROUSEL({ children: [] })] },
  { name: 'plain', nodes: [CAROUSEL({ config: { items: 3, arrows: false, dots: false } })] },
  { name: 'dark', theme: 'dark', nodes: [CAROUSEL()] },
]

for (const c of CASES) {
  test(`carousel/${c.name}`, async ({ page }) => {
    await mountNodes(page, c.nodes, c.theme)
    const block = page.getByTestId('osb-mount')
    await expect(block).toBeVisible()
    await expect(block).toHaveScreenshot(`osb-carousel-${c.name}.png`)
  })
}

// Objective checks (not just a pixel hash): one slide on screen, arrows and
// dots present, and each slide's atom laid out from ITS slide's left edge.
test('carousel chrome lands: one slide on screen, arrows + dots, slide-local atoms', async ({ page }) => {
  await mountNodes(page, [CAROUSEL()])
  await expect(page.getByTestId('osb-carousel-slide')).toHaveCount(3)
  await expect(page.getByLabel('Previous slide')).toBeVisible()
  await expect(page.getByLabel('Next slide')).toBeVisible()
  await expect(page.getByTestId('osb-carousel-dots').locator('button')).toHaveCount(3)
  // Only one slide is in the viewport at a time.
  const block = await page.getByTestId('osb-mount').boundingBox()
  const slide = await page.getByTestId('osb-carousel-slide').first().boundingBox()
  expect(slide?.width).toBeLessThanOrEqual((block?.width ?? 0) + 1)
})

// ---------------------------------------------------------------------------
// (2) EDITOR LOOP — the canvas renders the REAL carousel, and each slide is a
// container of its own. Whatever slide is on screen is the one you drop into;
// the arrows/dots move the editor; each atom remembers the slide it landed on.
// ---------------------------------------------------------------------------
const DOC: CanvasDoc = {
  version: 1,
  nodes: [{ id: 'car', type: 'carousel', config: { items: 3 }, parentId: null, x: 0, y: 0, cols: 12, rows: 6 }],
}

test('carousel: the arrows pick the slide you edit, and slides are containers', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 })
  await openCanvas(page, 'e2e-carousel', DOC)

  await expect(page.getByLabel('Previous slide')).toBeVisible()
  await expect(page.getByLabel('Next slide')).toBeVisible()
  await expect(page.getByTestId('osb-carousel-dots')).toBeVisible()
  // Slide 1 is showing and empty — its invitation names the slide.
  await expect(page.getByTestId('empty-hint-car-0')).toContainText('Slide 1')
  await expect(page.getByTestId('empty-hint-car-1')).toHaveCount(0)

  // Drop an atom into the slide that is showing.
  await dropToCell(page, page.getByTestId('palette-text'), page.getByTestId('container-car'), { x: 0, y: 1 }, { cols: 1, rows: 1 })
  await closeDrawerIfOpen(page)
  await page.waitForTimeout(900)

  // The arrow moves the editor to slide 2, which becomes the drop zone.
  await page.getByLabel('Next slide').click()
  await expect(page.getByTestId('empty-hint-car-1')).toContainText('Slide 2')
  await dropToCell(page, page.getByTestId('palette-text'), page.getByTestId('container-car'), { x: 0, y: 1 }, { cols: 1, rows: 1 })
  await closeDrawerIfOpen(page)
  await page.waitForTimeout(900)

  // A dot jumps straight to a slide — and that slide is drop-ready too.
  await page.getByLabel('Go to slide 3').click()
  await expect(page.getByTestId('empty-hint-car-2')).toContainText('Slide 3')
  await dropToCell(page, page.getByTestId('palette-text'), page.getByTestId('container-car'), { x: 0, y: 1 }, { cols: 1, rows: 1 })
  await closeDrawerIfOpen(page)
  await page.waitForTimeout(900)

  const doc = await persistedDoc(page, 'e2e-carousel')
  const kids = doc.nodes.filter((n) => n.parentId === 'car').sort((a, b) => a.x - b.x)
  expect(kids).toHaveLength(3)
  // Each atom landed on the slide that was on screen, inside that slide's own
  // band — never straddling the gap between two slides.
  expect(kids.map((k) => k.slot)).toEqual([0, 1, 2])
  for (const [i, kid] of kids.entries()) {
    expect(kid.x).toBeGreaterThanOrEqual(i * 4)
    expect(kid.x + kid.cols).toBeLessThanOrEqual((i + 1) * 4)
  }
})

test('carousel: an image or video drops into the slide on screen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 })
  // 8 rows: an image's four rows sit clear of the shell's bottom edge.
  await openCanvas(page, 'e2e-carousel-media', {
    version: 1,
    nodes: [{ id: 'car', type: 'carousel', config: { items: 3 }, parentId: null, x: 0, y: 0, cols: 12, rows: 8 }],
  })

  // An image's palette box is 6 cells wide in a 12-cell shell whose slides take
  // a third each: the drop scales to one slide (2 cells) instead of swallowing
  // it, and keeps the leaf's own four rows.
  await dropToCell(page, page.getByTestId('palette-image'), page.getByTestId('container-car'), { x: 0, y: 1 }, { cols: 1, rows: 1 })
  await closeDrawerIfOpen(page)
  await page.waitForTimeout(900)

  await page.getByLabel('Next slide').click()
  await expect(page.getByTestId('empty-hint-car-1')).toContainText('Slide 2')
  await dropToCell(page, page.getByTestId('palette-video'), page.getByTestId('container-car'), { x: 0, y: 1 }, { cols: 1, rows: 1 })
  await closeDrawerIfOpen(page)
  await page.waitForTimeout(900)

  const doc = await persistedDoc(page, 'e2e-carousel-media')
  const image = doc.nodes.find((n) => n.type === 'image')
  const video = doc.nodes.find((n) => n.type === 'video')
  // Both media atoms landed, one per slide, each scaled to its own band.
  expect(image).toMatchObject({ parentId: 'car', slot: 0, cols: 2, rows: 4 })
  expect(video).toMatchObject({ parentId: 'car', slot: 1, cols: 2, rows: 4 })
  for (const kid of [image!, video!]) {
    expect(kid.x).toBeGreaterThanOrEqual(kid.slot! * 4)
    expect(kid.x + kid.cols).toBeLessThanOrEqual((kid.slot! + 1) * 4)
  }
  expect(validateDoc(doc)).toEqual({ ok: true, errors: [] })
})

// The user's own flow: the Carousel pattern arrives with a starter atom in each
// slide. Those starters used to fill their slide, so the NEXT drop had nowhere
// to go and every attempt was refused with "That spot is taken" — the whole
// reason images and videos "could not be dragged in".
test('carousel: a pre-filled slide still takes the next drop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 })
  await openCanvas(page, 'e2e-carousel-filled')
  const grid = page.getByTestId('canvas')
  // Insert the pattern and a plain atom at root, exactly as a user does.
  await dropToCell(page, page.getByTestId('palette-pattern-carousel-slides'), grid, { x: 0, y: 0 }, { cols: 12, rows: 7 })
  await closeDrawerIfOpen(page)
  await page.waitForTimeout(900)
  await dropToCell(page, page.getByTestId('palette-badge'), grid, { x: 16, y: 0 }, { cols: 2, rows: 1 })
  await closeDrawerIfOpen(page)
  await page.waitForTimeout(900)

  const seeded = await persistedDoc(page, 'e2e-carousel-filled')
  const carId = seeded.nodes.find((n) => n.type === 'carousel')!.id
  const outside = seeded.nodes.find((n) => n.type === 'badge' && n.parentId === null)!
  const container = page.getByTestId(`container-${carId}`)

  // Below the starter image, in the slide on screen.
  await dropToCell(page, page.getByTestId('palette-image'), container, { x: 0, y: 3 }, { cols: 1, rows: 1 })
  await closeDrawerIfOpen(page)
  await page.waitForTimeout(900)
  await expect(page.getByTestId('drop-message')).toHaveCount(0)

  // A root atom dragged onto the shell lands on the VISIBLE slide too, not on
  // a hidden one — both landings read the same window rule.
  const cbox = await bbox(container)
  const bdg = page.locator(`[data-id="${outside.id}"]`)
  const b = await bbox(bdg)
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await page.mouse.down()
  await page.mouse.move(cbox.x + cbox.width / 2, cbox.y + cbox.height / 2, { steps: 20 })
  await page.mouse.up()
  await page.waitForTimeout(900)
  await closeDrawerIfOpen(page)

  const doc = await persistedDoc(page, 'e2e-carousel-filled')
  const image = doc.nodes.find((n) => n.type === 'image' && n.parentId === carId)!
  const moved = doc.nodes.find((n) => n.id === outside.id)!
  expect(image).toMatchObject({ slot: 0, cols: 2 })
  expect(moved).toMatchObject({ parentId: carId, slot: 0 })
  // Nothing straddles a slide boundary, and the doc is still clean.
  for (const kid of [image, moved]) {
    expect(kid.x).toBeGreaterThanOrEqual(kid.slot! * 4)
    expect(kid.x + kid.cols).toBeLessThanOrEqual((kid.slot! + 1) * 4)
  }
  expect(validateDoc(doc)).toEqual({ ok: true, errors: [] })
})

// Atoms travel between containers, not just into them: a badge sitting in a
// card is dragged onto the carousel and belongs to the slide on screen.
test('carousel: an atom dragged out of a card lands in the slide on screen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 })
  await openCanvas(page, 'e2e-carousel-cross', {
    version: 1,
    nodes: [
      { id: 'car', type: 'carousel', config: { items: 3 }, parentId: null, x: 0, y: 0, cols: 12, rows: 7 },
      // Touching the carousel: the page stays one connected patch.
      { id: 'cd', type: 'card', config: {}, parentId: null, x: 12, y: 0, cols: 12, rows: 6 },
      { id: 'bdg', type: 'badge', config: { text: 'In card' }, parentId: 'cd', x: 1, y: 1, cols: 3, rows: 1 },
    ],
    overlays: [],
    theme: 'light',
  })
  await dragChildToCell(page, page.locator('[data-id="bdg"]'), page.getByTestId('container-car'), 12, 7, 3, 3)
  await page.waitForTimeout(900)
  await closeDrawerIfOpen(page)

  const doc = await persistedDoc(page, 'e2e-carousel-cross')
  const kid = nodeById(doc, 'bdg')
  expect(kid).toMatchObject({ parentId: 'car', slot: 0 })
  expect(kid.x + kid.cols).toBeLessThanOrEqual((kid.slot! + 1) * 4)
  expect(validateDoc(doc)).toEqual({ ok: true, errors: [] })
})

test('carousel: dragging a slide atom sideways moves it into the next slide', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 })
  await openCanvas(page, 'e2e-carousel-move', {
    ...DOC,
    nodes: [
      { ...DOC.nodes[0], rows: 8, config: { items: 2, perView: '2' } },
      { id: 'k1', type: 'text', config: { text: 'Kid' }, parentId: 'car', x: 0, y: 1, cols: 2, rows: 1, slot: 0 },
    ],
  })
  // Both slides are on screen, so the atom and its target band both are.
  await expect(page.getByTestId('osb-carousel-slide')).toHaveCount(2)

  const kid = page.locator('[data-id="k1"]')
  // 12 columns over 2 slides = 6-cell bands: cell 8 is inside the second one.
  await dragChildToCell(page, kid, page.getByTestId('container-car'), 12, 8, 8, 1)
  await closeDrawerIfOpen(page)
  await page.waitForTimeout(900)

  const doc = await persistedDoc(page, 'e2e-carousel-move')
  const moved = doc.nodes.find((n) => n.id === 'k1')
  expect(moved?.slot).toBe(1)
  expect(moved?.x).toBeGreaterThanOrEqual(6)
  expect((moved?.x ?? 0) + (moved?.cols ?? 0)).toBeLessThanOrEqual(12)
})
