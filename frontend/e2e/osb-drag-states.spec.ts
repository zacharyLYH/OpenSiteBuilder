import { test, expect, type Locator, type Page } from '@playwright/test'
import { GRID_MARGIN_X } from '../src/canvas/grid'
import type { CanvasDoc } from '../src/canvas/doc'

async function closeDrawerIfOpen(page: Page): Promise<void> {
  if ((await page.getByTestId('config-drawer').count()) > 0) {
    await page.getByRole('button', { name: 'Close settings' }).click()
    await expect(page.getByTestId('config-drawer')).toHaveCount(0)
  }
}

/** Drag an HTML5 nested child to an exact parent-local cell (midpoint math).
 * Manual mouse: Playwright's dragTo actionability gate spins in headless
 * runs, while raw mouse drags fire the same HTML5 events reliably. */
async function dragChildToCell(
  page: Page,
  child: Locator,
  container: Locator,
  cols: number,
  rows: number,
  cx: number,
  cy: number,
): Promise<void> {
  const sbox = await child.boundingBox()
  const cbox = await container.boundingBox()
  await page.mouse.move(sbox!.x + sbox!.width / 2, sbox!.y + sbox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    cbox!.x + ((cx + 0.5) / cols) * cbox!.width,
    cbox!.y + ((cy + 0.5) / rows) * cbox!.height,
    { steps: 12 },
  )
  await page.mouse.up()
}

// Drag-state gallery: what the canvas looks like MID-GESTURE, shot full-page
// (the native drag ghost is invisible headless, so the palette context +
// canvas feedback together tell the story). Manual mouse control (down ->
// stepped move -> screenshot -> up) freezes each transient state.
// Order matters: reject first on the EMPTY card (nothing to confuse with a
// nested child), then nest, park the child, then move the card.
test('drag states: kind reject, nest highlight, reposition', async ({ page }) => {
  await page.context().addCookies([
    { name: 'obs_curr_project_name', value: 'e2e-drag', url: 'http://localhost:9199' },
  ])
  await page.setViewportSize({ width: 1280, height: 1100 })
  await page.goto('/canvas')
  await page.evaluate(() => {
    const doc: CanvasDoc = {
      version: 1,
      nodes: [
        { id: 'card1', type: 'card', config: {}, parentId: null, x: 0, y: 0, cols: 12, rows: 10 },
        { id: 't1', type: 'text', config: { text: 'Beside' }, parentId: null, x: 12, y: 0, cols: 8, rows: 2 },
      ],
    }
    localStorage.setItem('osb.project.e2e-drag', JSON.stringify(doc))
  })
  await page.reload()
  const container = page.getByTestId('container-card1')
  const cardBox = await container.boundingBox()
  const cardCX = cardBox!.x + cardBox!.width / 2
  const cardCY = cardBox!.y + cardBox!.height / 2

  // 1. REJECT: a card pattern over a card (containers never nest — R1 kind
  // deny). Red ring, no wash — the drop is refused and the doc is byte-identical.
  const before = await page.evaluate(() => localStorage.getItem('osb.project.e2e-drag')!)
  const cardPal = page.getByTestId('palette-pattern-card-content')
  await cardPal.hover()
  await page.mouse.down()
  await page.mouse.move(cardCX, cardCY, { steps: 12 })
  await page.waitForTimeout(200)
  await expect(container).not.toHaveClass(/ring-sky-400/)
  await expect(container).toHaveClass(/ring-rose-500/)
  await expect(page.getByTestId('drop-wash-card1')).toHaveCount(0)
  await expect(page).toHaveScreenshot('osb-drag-reject.png')
  await page.mouse.up()
  await page.waitForTimeout(900)
  expect(await page.evaluate(() => localStorage.getItem('osb.project.e2e-drag')!)).toBe(before)

  // 2. NEST: a button over the card. Ring + sky wash + content turned
  // translucent mark the landing target.
  const palette = page.getByTestId('palette-button')
  await palette.hover()
  await page.mouse.down()
  await page.mouse.move(cardCX, cardCY, { steps: 12 })
  await page.waitForTimeout(200)
  await expect(container).toHaveClass(/ring-sky-400/)
  await expect(page.getByTestId('drop-wash-card1')).toHaveCount(1)
  await expect(page).toHaveScreenshot('osb-drag-nest.png')
  await page.mouse.up()
  await expect(page.locator('[data-parent="card1"]')).toHaveCount(1)
  await closeDrawerIfOpen(page)

  // Park the child at (2,6) after a reload: the persisted doc is the
  // handoff between gesture phases (back-to-back synthetic drags don't
  // re-initiate dragstart in automation). It must stay clear of the grab
  // corner used for the move shot below.
  await page.waitForTimeout(900)
  await page.reload()
  const container2 = page.getByTestId('container-card1')
  const kid = page.locator('[data-parent="card1"]').first()
  await dragChildToCell(page, kid, container2, 12, 10, 2, 6)
  await page.waitForTimeout(900)
  await closeDrawerIfOpen(page)

  // 3. REPOSITION: the card mid-move to x=20 (still touching t1 at x=20).
  // RGL lifts the item with its nested child riding along.
  const dot = await page.getByTestId('canvas-dots').locator('i').first().boundingBox()
  const pitchX = dot!.width + GRID_MARGIN_X
  const node = page.locator('[data-id="card1"]')
  const nbox = await node.boundingBox()
  const grabX = nbox!.x + nbox!.width * 0.9
  const grabY = nbox!.y + nbox!.height * 0.9
  await page.mouse.move(grabX, grabY)
  await page.mouse.down()
  await page.mouse.move(grabX + 20 * pitchX, grabY, { steps: 12 })
  await page.waitForTimeout(200)
  await expect(node).toHaveClass(/react-draggable-dragging/)
  await expect(page).toHaveScreenshot('osb-drag-move.png')
  await page.mouse.up()
  await page.waitForTimeout(900)
  const moved = await page.evaluate(
    () => (JSON.parse(localStorage.getItem('osb.project.e2e-drag')!) as CanvasDoc).nodes,
  )
  expect(moved.find((n) => n.id === 'card1')).toMatchObject({ x: 20, y: 0, parentId: null })
  expect(moved.find((n) => n.parentId === 'card1')).toMatchObject({ x: 2, y: 6 })
  await closeDrawerIfOpen(page)
})
