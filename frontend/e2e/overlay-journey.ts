import { test, expect, type Page } from '@playwright/test'
import type { SiteNode } from '../src/site/types'
import { OSB_REGISTRY, overlayNoun, type OSBNodeType } from '../src/osb/registry'
import { bbox, closeDrawerIfOpen, dropToCell, mountNodes, openCanvas, persistedDoc } from './helpers'

export interface OverlayVariant {
  name: string
  config: Record<string, unknown>
  theme?: 'dark'
}

export interface OverlaySuiteConfig {
  /** Registry key. Noun, testids, grid, and prefill all derive from it. */
  kind: string
  /** Snapshot + slug stem. Existing baselines stay byte-identical. */
  shotPrefix: string
  slug: string
  /** Word for test titles + journey prose. */
  titleWord: string
  /** Fraction across the shell where the fill drop lands. */
  fillFx: number
  /** Outside-press point that hits no floating panel. */
  outsideClick: { x: number; y: number }
  /** Mount-matrix cases (one screenshot each). Empty = none. */
  variants: OverlayVariant[]
  /** Extra mount assertion (drawer side docking). Absent = none. */
  sideAssert?: string
}

/**
 * THE overlay e2e suite: variant screenshots, the attach/fill/resize/drive
 * journey, and the tray round-trip. One factory for every overlay kind — a
 * new kind adds a thin config (kind + shots + slugs), never a new spec
 * body. Snapshot names come from the config, so existing baselines are
 * reused untouched.
 */
export function defineOverlaySuite(cfg: OverlaySuiteConfig): void {
  const { kind, shotPrefix, slug, titleWord, fillFx, outsideClick } = cfg
  const noun = overlayNoun(kind)
  const entry = OSB_REGISTRY[kind as OSBNodeType]
  const grid = entry.grid
  const fallbackTitle = (entry.defaults as { title?: unknown }).title
  const titleBase = typeof fallbackTitle === 'string' && fallbackTitle.length > 0 ? fallbackTitle : noun
  const kidTitle = `${titleBase} title`
  const contentTestid = `osb-${kind}-content`

  const shellNode = (config: Record<string, unknown> = {}, cols = grid.cols, rows = grid.rows): SiteNode => ({
    id: 'o1',
    type: kind as SiteNode['type'],
    config,
    cols,
    rows,
    children: [
      { id: 't1', type: 'text', config: { text: kidTitle }, x: 1, y: 1, cols: 8, rows: 2 },
      { id: 't2', type: 'text', config: { text: `${titleBase} body copy.` }, x: 1, y: 3, cols: 8, rows: 3 },
      { id: 'b1', type: 'button', config: { label: 'Got it' }, x: 1, y: 6, cols: 4, rows: 1 },
    ],
  })

  for (const c of cfg.variants) {
    test(`${titleWord}/${c.name}`, async ({ page }) => {
      await mountNodes(page, [shellNode(c.config)], c.theme)
      const content = page.getByTestId(contentTestid)
      await expect(content).toBeVisible()
      await expect(content).toContainText(kidTitle)
      await expect(content).toHaveScreenshot(`${shotPrefix}-${c.name}.png`)
    })
  }

  if (cfg.sideAssert) {
    const needle = cfg.sideAssert
    test(`${titleWord} variants land their shadcn side + surface`, async ({ page }) => {
      await mountNodes(page, [shellNode({ side: 'left' })])
      const content = page.getByTestId(contentTestid)
      await expect(content).toBeVisible()
      expect(await content.evaluate((el) => el.className)).toContain(needle)
    })
  }

  /**
   * The portal is only drivable once Radix finishes mounting: first paint
   * (toBeVisible) precedes the focus trap, and the outside-press dismiss
   * path additionally waits on a deferred (setTimeout 0) document listener
   * in Radix's dismissable layer. Focus landing inside proves mount + trap;
   * the short settle after it guarantees the deferred listener is attached
   * before any outside press or Escape is sent.
   */
  async function awaitOverlayReady(page: Page): Promise<void> {
    const content = page.getByTestId(contentTestid)
    await expect(content).toBeVisible()
    await expect
      .poll(async () => page.evaluate((sel) => !!document.querySelector(sel)?.contains(document.activeElement), `[data-testid="${contentTestid}"]`))
      .toBe(true)
    await page.waitForTimeout(150)
  }

  // ---------------------------------------------------------------------------
  // Overlay journey, no shortcuts: attach from a real trigger drawer, fill by
  // dropping a palette atom into the shell, resize the shell, then exercise
  // the transplanted shadcn contract — X closes, outside press closes,
  // Escape closes — with screenshots of every surface.
  // ---------------------------------------------------------------------------
  test(`${titleWord}: attach, fill, resize, and drive the real ${entry.chrome === 'sheet' ? 'sheet' : 'dialog'}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 1000 })
    await openCanvas(page, slug)
    const gridEl = page.getByTestId('canvas')

    // A trigger on the canvas; its drawer offers the overlay attach.
    await dropToCell(page, page.getByTestId('palette-button'), gridEl, { x: 0, y: 0 }, { cols: 4, rows: 1 })
    const drawer = page.getByTestId('config-drawer')
    await expect(drawer).toBeVisible()
    await expect(page.getByTestId(`new-${noun}`)).toBeVisible()
    await expect(drawer).toHaveScreenshot(`${shotPrefix}-attach.png`)

    // Attach: a pre-filled shell lands, the editor opens on it, and the
    // trigger remembers which overlay it opens.
    await page.getByTestId(`new-${noun}`).click()
    const editor = page.getByTestId(`${kind}-editor`)
    await expect(editor).toBeVisible()
    await expect(drawer).toContainText(`${entry.name} settings`)
    await page.waitForTimeout(900)
    let doc = await persistedDoc(page, slug)
    expect(doc.overlays).toHaveLength(1)
    const oid = doc.overlays![0].id
    expect(doc.nodes.find((n) => n.type === 'button')?.config).toMatchObject({ targetId: oid })
    await expect(page.getByTestId(`${kind}-editor-shell`)).toHaveScreenshot(`${shotPrefix}-editor.png`)

    // Fill: drop a palette text into free shell cells.
    const shell = page.getByTestId(`${kind}-editor-shell`)
    const sbox = await bbox(shell)
    await page.getByTestId('palette-text').dragTo(shell, {
      targetPosition: { x: sbox.width * fillFx, y: (sbox.height * 6.5) / grid.rows },
    })
    await page.waitForTimeout(900)
    doc = await persistedDoc(page, slug)
    expect(doc.overlays![0].children).toHaveLength(4)
    await expect(shell).toHaveScreenshot(`${shotPrefix}-content.png`)

    // Resize: the shell grows two columns via its SE handle.
    const handle = page.getByTestId(`${kind}-resize-shell`)
    const hbox = await bbox(handle)
    const pitchX = sbox.width / grid.cols
    await page.mouse.move(hbox.x + hbox.width / 2, hbox.y + hbox.height / 2)
    await page.mouse.down()
    await page.mouse.move(hbox.x + hbox.width / 2 + 2 * pitchX, hbox.y + hbox.height / 2, { steps: 8 })
    await page.mouse.up()
    await page.waitForTimeout(900)
    doc = await persistedDoc(page, slug)
    expect(doc.overlays![0]).toMatchObject({ cols: grid.cols + 2, rows: grid.rows })

    // The transplanted contract, live: X closes…
    await page.getByTestId(`${kind}-test`).click()
    const content = page.getByTestId(contentTestid)
    await awaitOverlayReady(page)
    await expect(content).toContainText(kidTitle)
    // Resized shell lands in the portal: (cols + 2) × 28px pitch.
    await expect(content).toHaveScreenshot(`${shotPrefix}-open.png`)
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(content).toHaveCount(0)

    // …outside press closes…
    await page.getByTestId(`${kind}-test`).click()
    await awaitOverlayReady(page)
    await page.waitForTimeout(300)
    await page.mouse.click(outsideClick.x, outsideClick.y)
    await expect(content).toHaveCount(0)

    // …and Escape closes.
    await page.getByTestId(`${kind}-test`).click()
    await awaitOverlayReady(page)
    await page.keyboard.press('Escape')
    await expect(content).toHaveCount(0)

    // Done: back on the canvas, the trigger still selects (never navigates)
    // and its drawer names the attached shell.
    await page.getByTestId(`${kind}-done`).click()
    await expect(editor).toHaveCount(0)
    await closeDrawerIfOpen(page)
    await page.getByTestId('canvas-node').click()
    await expect(page.getByTestId(`linked-${noun}-name`)).toContainText(titleBase)
    await expect(page.getByTestId(`edit-${noun}`)).toBeVisible()
    await expect(page.getByTestId(`test-${noun}`)).toBeVisible()
    await expect(page.getByTestId(`unlink-${noun}`)).toBeVisible()
    // The drawer Test button opens the same real portal (resize honored).
    await page.getByTestId(`test-${noun}`).click()
    await awaitOverlayReady(page)
    await expect(page.getByTestId(contentTestid)).toContainText(kidTitle)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId(contentTestid)).toHaveCount(0)
    await closeDrawerIfOpen(page)
  })

  test(`${titleWord}: tray lists, edits, and removes overlays`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 })
    const traySlug = `${slug}-tray`
    await openCanvas(page, traySlug)
    const gridEl = page.getByTestId('canvas')

    await dropToCell(page, page.getByTestId('palette-button'), gridEl, { x: 0, y: 0 }, { cols: 4, rows: 1 })
    await expect(page.getByTestId('config-drawer')).toBeVisible()
    await page.getByTestId(`new-${noun}`).click()
    await expect(page.getByTestId(`${kind}-editor`)).toBeVisible()
    await page.getByTestId(`${kind}-done`).click()
    await expect(page.getByTestId(`${kind}-editor`)).toHaveCount(0)
    await closeDrawerIfOpen(page)

    // The header tray lists the overlay and reopens it for editing.
    await page.getByTestId('overlays').click()
    const panel = page.getByTestId('overlays-panel')
    await expect(panel).toBeVisible()
    await expect(panel.getByTestId('overlay-row')).toHaveCount(1)
    await expect(panel).toHaveScreenshot(`${shotPrefix}-tray.png`)
    await panel.getByTestId('overlay-edit').click()
    await expect(page.getByTestId(`${kind}-editor`)).toBeVisible()
    await page.getByTestId(`${kind}-done`).click()

    // Remove unlinks the trigger and empties the tray.
    await page.getByTestId('overlays').click()
    await panel.getByTestId('overlay-remove').click()
    await expect(panel.getByTestId('overlay-row')).toHaveCount(0)
    await expect(panel).toContainText('No overlays yet')
    await page.waitForTimeout(900)
    const doc = await persistedDoc(page, traySlug)
    expect(doc.overlays ?? []).toHaveLength(0)
    expect(doc.nodes.find((n) => n.type === 'button')?.config).toMatchObject({ targetId: '' })

    // Reload: the removal persists (nothing prunes, nothing resurrects).
    await page.reload()
    const after = await persistedDoc(page, traySlug)
    expect(after.overlays ?? []).toHaveLength(0)
  })
}
