import { expect, type Locator, type Page } from '@playwright/test'
import type { SiteNode } from '../src/site/types'
import type { CanvasDoc } from '../src/canvas/doc'
import { GRID_MARGIN_X } from '../src/canvas/grid'

/** Mount a node stack through the generic /osb-mount harness. */
export async function mountNodes(page: Page, nodes: SiteNode[]): Promise<void> {
  await page.goto('/osb-mount#nodes=' + encodeURIComponent(JSON.stringify(nodes)))
}

export const STORAGE_KEY = (slug: string): string => `osb.project.${slug}`

/**
 * The standard canvas entry point: project cookie, an optional seeded doc,
 * then a reload so the canvas boots from storage exactly like a real revisit.
 */
export async function openCanvas(page: Page, slug: string, doc?: CanvasDoc): Promise<void> {
  // Domain-scoped, not URL-scoped: follows whatever port baseURL uses.
  await page.context().addCookies([{ name: 'obs_curr_project_name', value: slug, domain: 'localhost', path: '/' }])
  await page.goto('/canvas')
  if (doc) {
    await page.evaluate(
      ([key, seeded]: [string, unknown]) => localStorage.setItem(key, JSON.stringify(seeded)),
      [STORAGE_KEY(slug), doc] as [string, CanvasDoc],
    )
    await page.reload()
  }
}

/** The doc as the app persisted it — the source of truth after a gesture. */
export async function persistedDoc(page: Page, slug: string): Promise<CanvasDoc> {
  return page.evaluate((key: string) => {
    const raw = localStorage.getItem(key)
    if (raw === null) throw new Error(`missing storage entry ${key}`)
    return JSON.parse(raw) as CanvasDoc
  }, STORAGE_KEY(slug))
}

/** One node by id, or a failure naming it — never a bare undefined. */
export function nodeById(doc: CanvasDoc, id: string): CanvasDoc['nodes'][number] {
  const node = doc.nodes.find((n) => n.id === id)
  if (!node) throw new Error(`node ${id} missing from persisted doc`)
  return node
}

/** A visible element's box, or a failure naming it — never a bare null. */
export async function bbox(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox()
  if (!box) throw new Error('expected a bounding box for a visible element')
  return box
}

/** Grid pitch in px, measured live from the dot guides. */
export async function gridPitch(page: Page): Promise<number> {
  const dot = await bbox(page.getByTestId('canvas-dots').locator('i').first())
  return dot.width + GRID_MARGIN_X
}

/**
 * Drag an HTML5 nested child to an exact parent-local cell using midpoint
 * math. Raw mouse rather than `dragTo`: Playwright's actionability gate spins
 * in headless runs, while raw mouse drags fire the same HTML5 events.
 */
export async function dragChildToCell(
  page: Page,
  child: Locator,
  container: Locator,
  cols: number,
  rows: number,
  cx: number,
  cy: number,
): Promise<void> {
  const sbox = await bbox(child)
  const cbox = await bbox(container)
  await page.mouse.move(sbox.x + sbox.width / 2, sbox.y + sbox.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    cbox.x + ((cx + 0.5) / cols) * cbox.width,
    cbox.y + ((cy + 0.5) / rows) * cbox.height,
    { steps: 12 },
  )
  await page.mouse.up()
}

/** Press at the middle of `from`, drag to an absolute point, release there. */
export async function dragFromTo(
  page: Page,
  from: { x: number; y: number; width: number; height: number },
  to: { x: number; y: number },
  steps = 12,
): Promise<void> {
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps })
  await page.mouse.up()
}

export async function closeDrawerIfOpen(page: Page): Promise<void> {
  if ((await page.getByTestId('config-drawer').count()) > 0) {
    await page.getByRole('button', { name: 'Close settings' }).click()
    await expect(page.getByTestId('config-drawer')).toHaveCount(0)
  }
}

export interface Cell {
  x: number
  y: number
}

export interface Span {
  cols: number
  rows: number
}

/**
 * Drag source onto the target top-left cell of the canvas grid, spanning
 * `span` cells. Cursor math (item lands centered on the cursor) lives here
 * alone: pitch is measured live from the dot guides, so no test hardcodes
 * pixels and every resolution stays deterministic.
 */
export async function dropToCell(
  page: Page,
  source: Locator,
  target: Locator,
  cell: Cell,
  span: Span,
): Promise<void> {
  const dot = await bbox(page.getByTestId('canvas-dots').locator('i').first())
  const pitch = dot.width + GRID_MARGIN_X
  await source.dragTo(target, {
    targetPosition: {
      x: (cell.x + span.cols / 2) * pitch,
      y: (cell.y + span.rows / 2) * pitch,
    },
  })
}

export const LONG_TEXT =
  'This is a deliberately long string that must wrap onto multiple lines without clipping, overlapping, or horizontal overflow at any viewport width. '.repeat(
    4,
  )

/** Deterministic test image (data URI — no network, stable pixels). */
const TEST_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="225"><rect width="400" height="225" fill="#64748b"/><circle cx="200" cy="112" r="48" fill="#cbd5e1"/></svg>`
export const TEST_IMAGE = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(TEST_SVG)

export async function noHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  if (overflow !== 0) throw new Error(`horizontal overflow: ${overflow}px`)
}
