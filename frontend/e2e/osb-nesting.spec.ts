import { test, expect } from '@playwright/test'
import { bbox, closeDrawerIfOpen, dragChildToCell, dropToCell, gridPitch, nodeById, openCanvas, persistedDoc } from './helpers'
import { validateDoc } from '../src/canvas/doc'
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
//   card1 (0,0,6,5)    — pattern drop: shell + title + body + button.
//     title  (0,0,5,1) — pattern-authored, touches body at y=1.
//     body   (0,1,5,2) — touches title (y=1) and button (y=3).
//     button (0,3,3,1) — pattern-authored.
//     button (0,4,3,1) — nested via palette, parked to touch at y=4,
//                        then grown +2 cols via its SE handle.
//   text (6,0,1,1)     — lands beside the shell (free placement).
//   button (0,20,3,1)  — scattered on purpose: lands, warns, and Validate
//                        pins the touch issue.
//   button take-out    — lifted from the card to (8,0).
//   red ghost          — parked button hovered over title cells previews the
//                        refusal live, releases unchanged.
//   red RGL drag       — freed button dragged over title flashes invalid,
//                        releases snapped back.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// (2) TEST — user gestures only: palette/pattern drops, child drags,
// take-out, invalid drops. No coordinate is invented here. Reloads between
// child-origin phases hand off through the persisted doc (back-to-back
// synthetic drags don't re-initiate dragstart in automation).
// ---------------------------------------------------------------------------
test('nesting: pattern card, text neighbor, nested button, take-out, invalid', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1100 })
  await openCanvas(page, 'e2e-nesting')
  const grid = page.getByTestId('canvas')

  // Pattern drop: shell + 3 connected atoms land atomically.
  await dropToCell(page, page.getByTestId('palette-pattern-card-content'), grid, { x: 0, y: 0 }, { cols: 6, rows: 5 })
  await closeDrawerIfOpen(page)
  await page.waitForTimeout(900)
  let doc = await persistedDoc(page, 'e2e-nesting')
  expect(doc.nodes).toHaveLength(4)
  const card = doc.nodes.find((n) => n.type === 'card')
  if (!card) throw new Error('pattern drop landed no card')
  const cardId = card.id
  expect(doc.nodes.filter((n) => n.parentId === cardId)).toHaveLength(3)
  expect(card).toMatchObject({ x: 0, y: 0, cols: 6, rows: 5 })

  // Text neighbor lands beside the shell (free placement, no touch gate).
  await dropToCell(page, page.getByTestId('palette-text'), grid, { x: 6, y: 0 }, { cols: 1, rows: 1 })
  await closeDrawerIfOpen(page)
  await page.waitForTimeout(900)
  doc = await persistedDoc(page, 'e2e-nesting')
  expect(doc.nodes).toHaveLength(5)

  // Nest a button into the card (dropped on free cells), then reload: the
  // persisted doc is the handoff between gesture phases (back-to-back
  // synthetic drags don't re-initiate dragstart in automation).
  await dropToCell(page, page.getByTestId('palette-button'), grid, { x: 3, y: 4 }, { cols: 3, rows: 1 })
  await expect(page.locator(`[data-parent="${cardId}"]`)).toHaveCount(4)
  await closeDrawerIfOpen(page)
  await page.waitForTimeout(900)

  // Park it at (0,4), touching the pattern button at y=4.
  await page.reload()
  const kid = page.locator(`[data-parent="${cardId}"]`).last()
  await dragChildToCell(page, kid, page.getByTestId(`container-${cardId}`), 6, 5, 0, 4)
  await page.waitForTimeout(900)
  doc = await persistedDoc(page, 'e2e-nesting')
  const kidId = await kid.getAttribute('data-id')
  if (!kidId) throw new Error('nested button has no data-id')
  expect(nodeById(doc, kidId)).toMatchObject({
    parentId: cardId,
    x: 0,
    y: 4,
  })

  // Red ghost: hovering the parked button over occupied title cells previews
  // the refusal live; releasing rejects without moving.
  await page.reload()
  const ghostKid = page.locator(`[data-parent="${cardId}"]`).last()
  const gsbox = await bbox(ghostKid)
  await page.mouse.move(gsbox.x + gsbox.width / 2, gsbox.y + gsbox.height / 2)
  await page.mouse.down()
  const gcbox = await bbox(page.getByTestId(`container-${cardId}`))
  // Title center: parent-local (2.5, 0.5).
  await page.mouse.move(
    gcbox.x + (2.5 / 6) * gcbox.width,
    gcbox.y + (0.5 / 5) * gcbox.height,
    { steps: 8 },
  )
  await expect(page.getByTestId('drop-ghost')).toBeVisible()
  await expect(page.getByTestId('drop-ghost')).toHaveClass(/rose/)
  await expect(page.getByTestId('drop-ghost')).toHaveAttribute('data-ok', 'false')
  await expect(grid).toHaveScreenshot('osb-nesting-ghost.png')
  await page.mouse.up()
  await page.waitForTimeout(900)
  doc = await persistedDoc(page, 'e2e-nesting')
  expect(nodeById(doc, kidId)).toMatchObject({ parentId: cardId, x: 0, y: 4 })
  await expect(page.getByTestId('drop-message')).toContainText('That spot is taken')
  await closeDrawerIfOpen(page)

  // Image over text: the overlapped title lights red (not the whole card),
  // and releasing refuses without moving anything.
  const imgPal = page.getByTestId('palette-image')
  const imgBox = await bbox(imgPal)
  await page.mouse.move(imgBox.x + imgBox.width / 2, imgBox.y + imgBox.height / 2)
  await page.mouse.down()
  const tcbox = await bbox(page.getByTestId(`container-${cardId}`))
  // Title center: parent-local (2.5, 0.5); the 6x4 image would cover it.
  await page.mouse.move(
    tcbox.x + (2.5 / 6) * tcbox.width,
    tcbox.y + (0.5 / 5) * tcbox.height,
    { steps: 8 },
  )
  const titleKid = page.locator(`[data-parent="${cardId}"]`).first()
  await expect(titleKid).toHaveClass(/drag-conflict/)
  await expect(page.getByTestId('drop-ghost')).toBeVisible()
  await expect(grid).toHaveScreenshot('osb-nesting-conflict.png')
  await page.mouse.up()
  await page.waitForTimeout(900)
  // Nothing landed: shell + 3 pattern kids + text + nested button.
  expect((await persistedDoc(page, 'e2e-nesting')).nodes).toHaveLength(6)
  await expect(page.getByTestId('drop-message')).toContainText('That spot is taken')
  await closeDrawerIfOpen(page)

  // Invalid: a card can never nest inside a card (R1 kind deny). Doc unchanged.
  const before = await persistedDoc(page, 'e2e-nesting')
  await dropToCell(page, page.getByTestId('palette-pattern-card-content'), grid, { x: 2, y: 2 }, { cols: 6, rows: 5 })
  await page.waitForTimeout(900)
  expect((await persistedDoc(page, 'e2e-nesting')).nodes).toHaveLength(before.nodes.length)
  await closeDrawerIfOpen(page)

  // Scattered root drops land like legos now (no touch gate); the canvas
  // warns and Validate pins the touch issue.
  await dropToCell(page, page.getByTestId('palette-button'), grid, { x: 0, y: 20 }, { cols: 3, rows: 1 })
  await page.waitForTimeout(900)
  expect((await persistedDoc(page, 'e2e-nesting')).nodes).toHaveLength(before.nodes.length + 1)
  await expect(page.getByTestId('doc-warning')).toBeVisible()
  await closeDrawerIfOpen(page)
  await page.getByTestId('validate').click()
  await expect(page.getByTestId('validate-panel')).toBeVisible()
  expect(await page.getByTestId('validate-panel').textContent()).toContain('scattered')
  await page.getByRole('button', { name: 'Close checks' }).click()
  await expect(page.getByTestId('validate-panel')).toHaveCount(0)

  // Invalid: nesting onto occupied card cells is an overlap, and says so.
  await dropToCell(page, page.getByTestId('palette-button'), grid, { x: 1, y: 1 }, { cols: 3, rows: 1 })
  await expect(page.getByTestId('drop-message')).toContainText('That spot is taken')
  await page.waitForTimeout(900)
  expect((await persistedDoc(page, 'e2e-nesting')).nodes).toHaveLength(before.nodes.length + 1)
  await closeDrawerIfOpen(page)

  // Resize: the parked button grows in place via its SE handle (+2 cols).
  const parked = page.locator(`[data-parent="${cardId}"]`).last()
  const parkedId0 = await parked.getAttribute('data-id')
  if (!parkedId0) throw new Error('parked button has no data-id')
  await parked.click()
  const rhandle = page.getByTestId(`resize-${parkedId0}`)
  await expect(rhandle).toBeVisible()
  const hbox = await bbox(rhandle)
  const pitchX = await gridPitch(page)
  await page.mouse.move(hbox.x + hbox.width / 2, hbox.y + hbox.height / 2)
  await page.mouse.down()
  await page.mouse.move(hbox.x + hbox.width / 2 + 2 * pitchX, hbox.y + hbox.height / 2, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(900)
  doc = await persistedDoc(page, 'e2e-nesting')
  expect(nodeById(doc, parkedId0)).toMatchObject({ cols: 5, rows: 1, parentId: cardId })
  await closeDrawerIfOpen(page)

  // Bounds: selecting the shell draws every child's box (text is invisible
  // otherwise).
  // The children fill the shell's left columns; the rightmost strip is the
  // empty part of the card, so click there to select the shell itself.
  const cbox = await bbox(page.getByTestId(`container-${cardId}`))
  await page.mouse.click(cbox.x + cbox.width * 0.95, cbox.y + cbox.height * 0.5)
  await expect(page.getByTestId('config-drawer')).toContainText('Card settings')
  const outline = await page
    .locator(`[data-parent="${cardId}"]`)
    .first()
    .evaluate((el) => getComputedStyle(el).outlineStyle)
  expect(outline).toBe('dashed')
  await closeDrawerIfOpen(page)

  // Take out: reload first (child-origin drags need a fresh gesture
  // session), then drag the parked (now 5-wide) button to (8,0). RGL centers
  // the take-out on the cursor, so aim the cursor at the footprint center.
  // It must leave as a root node with old and new sets still connected.
  await page.reload()
  const parkedId = await page.locator(`[data-parent="${cardId}"]`).last().getAttribute('data-id')
  if (!parkedId) throw new Error('parked button has no data-id')
  await dropToCell(page, page.locator(`[data-parent="${cardId}"]`).last(), grid, { x: 8, y: 0 }, { cols: 5, rows: 1 })
  await page.waitForTimeout(900)
  doc = await persistedDoc(page, 'e2e-nesting')
  expect(nodeById(doc, parkedId)).toMatchObject({ parentId: null, x: 8, y: 0 })
  expect(doc.nodes.filter((n) => n.parentId === cardId)).toHaveLength(3)
  await closeDrawerIfOpen(page)

  // Red while dragging: an RGL drag of the freed button over occupied card
  // cells flashes invalid mid-flight; releasing snaps back unchanged.
  await page.reload()
  doc = await persistedDoc(page, 'e2e-nesting')
  const freedNode = doc.nodes.find((n) => n.parentId === null && n.type === 'button' && n.x === 8)
  if (!freedNode) throw new Error('freed button missing from persisted doc')
  const freedId = freedNode.id
  const freed = page.locator(`[data-id="${freedId}"]`)
  const fbox = await bbox(freed)
  const rpitch = await gridPitch(page)
  // Freed center is root (10.5,0.5); title center is root (2.5,0.5): delta in cells.
  await page.mouse.move(fbox.x + fbox.width / 2, fbox.y + fbox.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    fbox.x + fbox.width / 2 - 8 * rpitch,
    fbox.y + fbox.height / 2,
    { steps: 10 },
  )
  await expect(freed).toHaveClass(/drag-invalid/)
  await expect(grid).toHaveScreenshot('osb-nesting-drag-invalid.png')
  await page.mouse.up()
  await page.waitForTimeout(900)
  expect(nodeById(await persistedDoc(page, 'e2e-nesting'), freedId)).toMatchObject({ parentId: null, x: 8, y: 0 })
  await closeDrawerIfOpen(page)

  // (2a) FINAL artifacts: the free-placed doc flags its scattered island in
  // Validate, while site.json — the manifest the engine renders (codegen v2
  // emits data, never JSX) — nests the card's children.
  const v = validateDoc(doc)
  expect(v.ok).toBe(false)
  expect(v.errors.join('|')).toContain('scattered')
  const roots = doc.nodes.filter((n) => n.parentId === null)
  expect(roots.map((n) => n.type).sort()).toEqual(['button', 'button', 'card', 'text'])
  const manifest = {
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
  }
  const site = JSON.stringify(manifest)
  const types = doc.nodes.map((n) => n.type).sort()
  const cardKids = (manifest.pages[0].nodes.find((n) => n.type === 'card')?.children ?? []).map((k) => k.type)
  expect({
    ok: validateSite(manifest).ok,
    hasCard: types.includes('card'),
    buttonInCard: cardKids.includes('button'),
    textInCard: cardKids.includes('text'),
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
