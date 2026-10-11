import { test, expect, type Locator, type Page } from '@playwright/test'
import { dropToCell } from './helpers'
import { GRID_MARGIN_X } from '../src/canvas/grid'
import { generatePage } from '../src/canvas/codegen'
import { validateDoc, type CanvasDoc } from '../src/canvas/doc'
import { validateSite } from '../src/site/validate'

// ---------------------------------------------------------------------------
// (1) LAYOUT PLAN — the theory. Every final coordinate is decided here, up
// front, by grid arithmetic — never by trial drags.
//
// Canvas is 32 cols. R1–R4 + contiguity (see src/canvas/doc.ts and
// specs/nesting-rules.md) constrain every move: kind (atoms in cards,
// cards at root), full containment, sibling exclusivity, footprints, and
// one edge-connected patch per sibling set (corner contact is not enough).
//
//   card1 (0,0,12,10)  — pattern drop: shell + title + body + button.
//     title  (1,1,8,2) — pattern-authored, touches body at y=3.
//     body   (1,3,8,3) — touches title (y=3) and button (y=6).
//     button (1,6,4,1) — pattern-authored.
//     button (5,6,4→6,1) — nested via palette, parked to touch at x=5,
//                        then grown +2 cols via its SE handle.
//   text (12,0,6,1)    — lands beside the shell (free placement).
//   button (0,20,4,1)  — scattered on purpose: lands, warns, and Validate
//                        pins the touch issue.
//   button take-out    — lifted from the card to (20,0).
//   red ghost          — parked button hovered over title cells previews the
//                        refusal live, releases unchanged.
//   red RGL drag       — freed button dragged over title flashes invalid,
//                        releases snapped back.
// ---------------------------------------------------------------------------
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

async function docOf(page: Page): Promise<CanvasDoc> {
  return page.evaluate(
    () => JSON.parse(localStorage.getItem('osb.project.e2e-nesting')!) as CanvasDoc,
  )
}

// ---------------------------------------------------------------------------
// (2) TEST — user gestures only: palette/pattern drops, child drags,
// take-out, invalid drops. No coordinate is invented here. Reloads between
// child-origin phases hand off through the persisted doc (back-to-back
// synthetic drags don't re-initiate dragstart in automation).
// ---------------------------------------------------------------------------
test('nesting: pattern card, text neighbor, nested button, take-out, invalid', async ({
  page,
}) => {
  await page.context().addCookies([
    { name: 'obs_curr_project_name', value: 'e2e-nesting', url: 'http://localhost:9199' },
  ])
  await page.setViewportSize({ width: 1280, height: 1100 })
  await page.goto('/canvas')
  const grid = page.getByTestId('canvas')

  // Pattern drop: shell + 3 connected atoms land atomically.
  await dropToCell(page, page.getByTestId('palette-pattern-card-content'), grid, { x: 0, y: 0 }, { cols: 12, rows: 10 })
  await closeDrawerIfOpen(page)
  await page.waitForTimeout(900)
  let doc = await docOf(page)
  expect(doc.nodes).toHaveLength(4)
  const cardId = doc.nodes.find((n) => n.type === 'card')!.id
  expect(doc.nodes.filter((n) => n.parentId === cardId)).toHaveLength(3)

  // Text neighbor lands beside the shell (free placement, no touch gate).
  await dropToCell(page, page.getByTestId('palette-text'), grid, { x: 12, y: 0 }, { cols: 6, rows: 1 })
  await closeDrawerIfOpen(page)
  await page.waitForTimeout(900)
  doc = await docOf(page)
  expect(doc.nodes).toHaveLength(5)

  // Nest a button into the card (dropped on free cells), then reload: the
  // persisted doc is the handoff between gesture phases (back-to-back
  // synthetic drags don't re-initiate dragstart in automation).
  await dropToCell(page, page.getByTestId('palette-button'), grid, { x: 3, y: 6 }, { cols: 4, rows: 1 })
  await expect(page.locator(`[data-parent="${cardId}"]`)).toHaveCount(4)
  await closeDrawerIfOpen(page)
  await page.waitForTimeout(900)

  // Park it at (5,6), touching the pattern button at x=5.
  await page.reload()
  const kid = page.locator(`[data-parent="${cardId}"]`).last()
  await dragChildToCell(page, kid, page.getByTestId(`container-${cardId}`), 12, 10, 5, 6)
  await page.waitForTimeout(900)
  doc = await docOf(page)
  const kidId = await kid.getAttribute('data-id')
  expect(doc.nodes.find((n) => n.id === kidId)).toMatchObject({
    parentId: cardId,
    x: 5,
    y: 6,
  })

  // Red ghost: hovering the parked button over occupied title cells previews
  // the refusal live; releasing rejects without moving.
  await page.reload()
  const ghostKid = page.locator(`[data-parent="${cardId}"]`).last()
  const gsbox = (await ghostKid.boundingBox())!
  await page.mouse.move(gsbox.x + gsbox.width / 2, gsbox.y + gsbox.height / 2)
  await page.mouse.down()
  const gcbox = (await page.getByTestId(`container-${cardId}`).boundingBox())!
  // Title center: parent-local (5,2).
  await page.mouse.move(
    gcbox.x + ((1 + 4) / 12) * gcbox.width,
    gcbox.y + ((1 + 1) / 10) * gcbox.height,
    { steps: 8 },
  )
  await expect(page.getByTestId('drop-ghost')).toBeVisible()
  await expect(page.getByTestId('drop-ghost')).toHaveClass(/rose/)
  await expect(page.getByTestId('drop-ghost')).toHaveAttribute('data-ok', 'false')
  await expect(grid).toHaveScreenshot('osb-nesting-ghost.png')
  await page.mouse.up()
  await page.waitForTimeout(900)
  doc = await docOf(page)
  expect(doc.nodes.find((n) => n.id === kidId)).toMatchObject({ parentId: cardId, x: 5, y: 6 })
  await expect(page.getByTestId('drop-message')).toContainText('That spot is taken')
  await closeDrawerIfOpen(page)

  // Image over text: the overlapped title lights red (not the whole card),
  // and releasing refuses without moving anything.
  const imgPal = page.getByTestId('palette-image')
  const imgBox = (await imgPal.boundingBox())!
  await page.mouse.move(imgBox.x + imgBox.width / 2, imgBox.y + imgBox.height / 2)
  await page.mouse.down()
  const tcbox = (await page.getByTestId(`container-${cardId}`).boundingBox())!
  // Title center: parent-local (5,2); the 8x6 image would cover it.
  await page.mouse.move(
    tcbox.x + ((1 + 4) / 12) * tcbox.width,
    tcbox.y + ((1 + 1) / 10) * tcbox.height,
    { steps: 8 },
  )
  const titleKid = page.locator(`[data-parent="${cardId}"]`).first()
  await expect(titleKid).toHaveClass(/drag-conflict/)
  await expect(page.getByTestId('drop-ghost')).toBeVisible()
  await expect(grid).toHaveScreenshot('osb-nesting-conflict.png')
  await page.mouse.up()
  await page.waitForTimeout(900)
  // Nothing landed: shell + 3 pattern kids + text + nested button.
  expect((await docOf(page)).nodes).toHaveLength(6)
  await expect(page.getByTestId('drop-message')).toContainText('That spot is taken')
  await expect(grid).toHaveScreenshot('osb-nesting-denied.png')
  await closeDrawerIfOpen(page)

  // Invalid: a card can never nest inside a card (R1 kind deny). Doc unchanged.
  const before = await docOf(page)
  await dropToCell(page, page.getByTestId('palette-pattern-card-content'), grid, { x: 2, y: 2 }, { cols: 12, rows: 10 })
  await page.waitForTimeout(900)
  expect((await docOf(page)).nodes).toHaveLength(before.nodes.length)
  await closeDrawerIfOpen(page)

  // Scattered root drops land like legos now (no touch gate); the canvas
  // warns and Validate pins the touch issue.
  await dropToCell(page, page.getByTestId('palette-button'), grid, { x: 0, y: 20 }, { cols: 4, rows: 1 })
  await page.waitForTimeout(900)
  expect((await docOf(page)).nodes).toHaveLength(before.nodes.length + 1)
  await expect(page.getByTestId('doc-warning')).toBeVisible()
  await closeDrawerIfOpen(page)
  await page.getByTestId('validate').click()
  await expect(page.getByTestId('validate-panel')).toBeVisible()
  expect(await page.getByTestId('validate-panel').textContent()).toContain('scattered')
  await expect(grid).toHaveScreenshot('osb-nesting-validate.png')
  await page.getByRole('button', { name: 'Close checks' }).click()
  await expect(page.getByTestId('validate-panel')).toHaveCount(0)

  // Invalid: nesting onto occupied card cells is an overlap, and says so.
  await dropToCell(page, page.getByTestId('palette-button'), grid, { x: 1, y: 1 }, { cols: 4, rows: 1 })
  await expect(page.getByTestId('drop-message')).toContainText('That spot is taken')
  await page.waitForTimeout(900)
  expect((await docOf(page)).nodes).toHaveLength(before.nodes.length + 1)
  await closeDrawerIfOpen(page)

  // Resize: the parked button grows in place via its SE handle (+2 cols).
  const parked = page.locator(`[data-parent="${cardId}"]`).last()
  const parkedId0 = await parked.getAttribute('data-id')
  await parked.click()
  const rhandle = page.getByTestId(`resize-${parkedId0}`)
  await expect(rhandle).toBeVisible()
  await expect(grid).toHaveScreenshot('osb-nesting-resize.png')
  const hbox = (await rhandle.boundingBox())!
  const dot = await page.getByTestId('canvas-dots').locator('i').first().boundingBox()
  const pitchX = dot!.width + GRID_MARGIN_X
  await page.mouse.move(hbox.x + hbox.width / 2, hbox.y + hbox.height / 2)
  await page.mouse.down()
  await page.mouse.move(hbox.x + hbox.width / 2 + 2 * pitchX, hbox.y + hbox.height / 2, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(900)
  doc = await docOf(page)
  expect(doc.nodes.find((n) => n.id === parkedId0)).toMatchObject({ cols: 6, rows: 1, parentId: cardId })
  await closeDrawerIfOpen(page)

  // Bounds: selecting the shell draws every child's box (text is invisible
  // otherwise).
  const cbox = (await page.getByTestId(`container-${cardId}`).boundingBox())!
  await page.mouse.click(cbox.x + 10, cbox.y + cbox.height - 10)
  await expect(page.getByTestId('config-drawer')).toContainText('Card settings')
  const outline = await page
    .locator(`[data-parent="${cardId}"]`)
    .first()
    .evaluate((el) => getComputedStyle(el).outlineStyle)
  expect(outline).toBe('dashed')
  await expect(grid).toHaveScreenshot('osb-nesting-bounds.png')
  await closeDrawerIfOpen(page)

  // Take out: reload first (child-origin drags need a fresh gesture
  // session), then drag the parked (now 6-wide) button to (20,0), touching
  // the text at x=20. RGL centers the take-out on the cursor, so aim the
  // cursor at the footprint center (23, 0.5).
  // It must leave as a root node with old and new sets still connected.
  await page.reload()
  const parkedId = await page.locator(`[data-parent="${cardId}"]`).last().getAttribute('data-id')
  await dropToCell(page, page.locator(`[data-parent="${cardId}"]`).last(), grid, { x: 20, y: 0 }, { cols: 6, rows: 1 })
  await page.waitForTimeout(900)
  doc = await docOf(page)
  expect(doc.nodes.find((n) => n.id === parkedId)).toMatchObject({ parentId: null, x: 20, y: 0 })
  expect(doc.nodes.filter((n) => n.parentId === cardId)).toHaveLength(3)
  await closeDrawerIfOpen(page)

  // Red while dragging: an RGL drag of the freed button over occupied card
  // cells flashes invalid mid-flight; releasing snaps back unchanged.
  await page.reload()
  doc = await docOf(page)
  const freedId = doc.nodes.find((n) => n.parentId === null && n.type === 'button' && n.x === 20)!.id
  const freed = page.locator(`[data-id="${freedId}"]`)
  const fbox = (await freed.boundingBox())!
  const rdot = await page.getByTestId('canvas-dots').locator('i').first().boundingBox()
  const rpitch = rdot!.width + GRID_MARGIN_X
  // Freed center is root (23,0.5); title center is root (5,2): delta in cells.
  await page.mouse.move(fbox.x + fbox.width / 2, fbox.y + fbox.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    fbox.x + fbox.width / 2 - 18 * rpitch,
    fbox.y + fbox.height / 2 + 1.5 * rpitch,
    { steps: 10 },
  )
  await expect(freed).toHaveClass(/drag-invalid/)
  await expect(grid).toHaveScreenshot('osb-nesting-drag-invalid.png')
  await page.mouse.up()
  await page.waitForTimeout(900)
  expect((await docOf(page)).nodes.find((n) => n.id === freedId)).toMatchObject({ parentId: null, x: 20, y: 0 })
  await closeDrawerIfOpen(page)

  // (2a) FINAL artifacts: the free-placed doc flags its scattered island
  // in Validate, while site.json + generated React still agree with it.
  const v = validateDoc(doc)
  expect(v.ok).toBe(false)
  expect(v.errors.join('|')).toContain('scattered')
  const roots = doc.nodes.filter((n) => n.parentId === null)
  expect(roots.map((n) => n.type).sort()).toEqual(['button', 'button', 'card', 'text'])
  const site = JSON.stringify({
    version: '0.1',
    site: { name: 'e2e-nesting', theme: 'light' },
    pages: [
      {
        id: 'home',
        path: '/',
        title: 'Home',
        nodes: roots.map((n) => ({
          id: n.id,
          type: n.type,
          config: n.config ?? {},
          ...(doc.nodes.some((k) => k.parentId === n.id)
            ? { children: doc.nodes.filter((k) => k.parentId === n.id).map((k) => ({ id: k.id, type: k.type, config: k.config ?? {} })) }
            : {}),
        })),
      },
    ],
  })
  const react = generatePage(doc)
  const types = doc.nodes.map((n) => n.type).sort()
  expect({
    ok: validateSite(JSON.parse(site)).ok,
    hasCard: types.includes('card'),
    buttonInCard: /<OSBCard[\s\S]*<OSBButton[\s\S]*<\/OSBCard>/.test(react),
    textInCard: /<OSBCard[\s\S]*<OSBText[\s\S]*<\/OSBCard>/.test(react),
    siteNests: site.includes('"children"'),
  }).toEqual({
    ok: true,
    hasCard: true,
    buttonInCard: true,
    textInCard: true,
    siteNests: true,
  })

  await expect(grid).toHaveScreenshot('osb-nesting.png')
})
