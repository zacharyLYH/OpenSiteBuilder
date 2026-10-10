import type { Page } from '@playwright/test'
import type { SiteNode } from '../src/site/types'

/** Mount a node stack through the generic /osb-mount harness. */
export async function mountNodes(page: Page, nodes: SiteNode[]): Promise<void> {
  await page.goto('/osb-mount#nodes=' + encodeURIComponent(JSON.stringify(nodes)))
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
