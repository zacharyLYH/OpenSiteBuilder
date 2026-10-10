import type { Locator, Page } from '@playwright/test'
import type { SiteNode } from '../src/site/types'
import { GRID_MARGIN_X } from '../src/canvas/grid'

/** Mount a node stack through the generic /osb-mount harness. */
export async function mountNodes(page: Page, nodes: SiteNode[]): Promise<void> {
  await page.goto('/osb-mount#nodes=' + encodeURIComponent(JSON.stringify(nodes)))
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
  const dot = await page.getByTestId('canvas-dots').locator('i').first().boundingBox()
  const pitch = dot!.width + GRID_MARGIN_X
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
