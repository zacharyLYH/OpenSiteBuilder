import { describe, it, expect } from 'vitest'
import { generatePage } from './codegen'
import {
  canInsertReason,
  canPlaceDrawerChild,
  canPlaceOverlayChild,
  createDrawer,
  drawersOf,
  insertDrawerChild,
  moveDrawerChild,
  removeDrawer,
  removeDrawerChild,
  resizeDrawer,
  updateDrawerChildConfig,
  updateDrawerConfig,
  validateDoc,
  type CanvasDoc,
  type DrawerDoc,
} from './doc'
import { siteObject } from './push'
import { validateSite } from '../site/validate'

// A 10x10 shell mirroring the modal's proven geometry.
const SHELL: DrawerDoc = {
  id: 'd1',
  config: { title: 'Panel' },
  cols: 10,
  rows: 10,
  children: [
    { id: 't1', type: 'text', config: { text: 'Panel title' }, parentId: 'd1', x: 1, y: 1, cols: 8, rows: 2 },
    { id: 't2', type: 'text', config: { text: 'Body' }, parentId: 'd1', x: 1, y: 3, cols: 8, rows: 3 },
    { id: 'b1', type: 'button', config: { label: 'Got it' }, parentId: 'd1', x: 1, y: 6, cols: 4, rows: 1 },
  ],
}

const docWith = (drawer: DrawerDoc, nodes: CanvasDoc['nodes'] = []): CanvasDoc => ({
  version: 1,
  nodes,
  drawers: [drawer],
})

describe('drawer gate (shared overlay core)', () => {
  it('accepts any atom inside the shell', () => {
    expect(canPlaceDrawerChild(SHELL, 'image', { x: 8, y: 6, cols: 2, rows: 2 })).toBeNull()
  })

  it('shares one gate with popups', () => {
    const rect = { x: 0, y: 0, cols: 6, rows: 4 }
    expect(canPlaceDrawerChild(SHELL, 'drawer', rect)).toBe('kind')
    expect(canPlaceDrawerChild(SHELL, 'modal', rect)).toBe('kind')
    expect(canPlaceDrawerChild(SHELL, 'card', rect)).toBe('kind')
    expect(canPlaceOverlayChild(SHELL, 'video', rect)).toBe('unknown-type')
  })

  it('refuses overflow, oversize footprints, and overlaps', () => {
    expect(canPlaceDrawerChild(SHELL, 'text', { x: 8, y: 9, cols: 6, rows: 2 })).toBe('containment')
    expect(canPlaceDrawerChild(SHELL, 'button', { x: 0, y: 0, cols: 1, rows: 1 })).toBe('footprint')
    expect(canPlaceDrawerChild(SHELL, 'button', { x: 2, y: 1, cols: 4, rows: 1 })).toBe('overlap')
    expect(canPlaceDrawerChild(SHELL, 'text', { x: 1, y: 1, cols: 8, rows: 2 }, 't1')).toBeNull()
  })
})

describe('drawer node gate', () => {
  it('drawers never enter through node ops', () => {
    expect(canInsertReason([], 'drawer', { x: 0, y: 0, cols: 10, rows: 10 }, null)).toBe('kind')
  })
})

describe('drawer ops', () => {
  it('creates, resizes, and removes shells with unlinking', () => {
    let doc: CanvasDoc = { version: 1, nodes: [], drawers: [] }
    doc = createDrawer(doc, { ...SHELL, children: [] })
    expect(drawersOf(doc)).toHaveLength(1)

    const grown = resizeDrawer(doc, 'd1', 12, 12)
    expect(grown.ok).toBe(true)
    if (grown.ok) doc = grown.doc
    expect(drawersOf(doc)[0]).toMatchObject({ cols: 12, rows: 12 })
    expect(resizeDrawer(doc, 'd1', 2, 2).ok).toBe(false)

    doc = {
      ...doc,
      nodes: [{ id: 'trig', type: 'button', config: { label: 'Open', drawerId: 'd1' }, parentId: null, x: 0, y: 0, cols: 4, rows: 1 }],
    }
    doc = removeDrawer(doc, 'd1')
    expect(drawersOf(doc)).toHaveLength(0)
    expect(doc.nodes[0].config).toMatchObject({ drawerId: '' })
  })

  it('inserts, moves, and removes children through the gate', () => {
    let doc = docWith({ ...SHELL, children: [] })
    const kid = { id: 'k1', type: 'text' as const, config: {}, parentId: 'd1', x: 1, y: 1, cols: 8, rows: 2 }
    const inserted = insertDrawerChild(doc, 'd1', kid)
    expect(inserted.ok).toBe(true)
    if (!inserted.ok) throw new Error('insert refused')
    doc = inserted.doc

    expect(insertDrawerChild(doc, 'd1', { ...kid, id: 'k2' }).ok).toBe(false)
    const moved = moveDrawerChild(doc, 'd1', 'k1', { x: 1, y: 4, cols: 8, rows: 2 })
    expect(moved.ok).toBe(true)
    if (moved.ok) doc = moved.doc
    expect(drawersOf(doc)[0].children[0]).toMatchObject({ x: 1, y: 4 })
    doc = updateDrawerChildConfig(doc, 'd1', 'k1', { text: 'Hi' })
    expect(drawersOf(doc)[0].children[0].config).toMatchObject({ text: 'Hi' })
    doc = updateDrawerConfig(doc, 'd1', { title: 'Renamed' })
    expect(drawersOf(doc)[0].config).toMatchObject({ title: 'Renamed' })
    doc = removeDrawerChild(doc, 'd1', 'k1')
    expect(drawersOf(doc)[0].children).toHaveLength(0)
  })

  it('unknown drawer ids refuse with words', () => {
    const doc: CanvasDoc = { version: 1, nodes: [], drawers: [] }
    const kid = { id: 'k', type: 'text' as const, config: {}, parentId: 'nope', x: 0, y: 0, cols: 2, rows: 1 }
    expect(insertDrawerChild(doc, 'nope', kid)).toEqual({ ok: false, reason: 'unknown-type' })
    expect(moveDrawerChild(doc, 'nope', 'k', kid)).toEqual({ ok: false, reason: 'unknown-type' })
    expect(resizeDrawer(doc, 'nope', 10, 10)).toEqual({ ok: false, reason: 'unknown-type' })
  })
})

describe('drawer validation', () => {
  const trigger = (drawerId: string) => ({
    id: 'trig',
    type: 'button' as const,
    config: { label: 'Open', drawerId },
    parentId: null as string | null,
    x: 0,
    y: 0,
    cols: 4,
    rows: 1,
  })

  it('passes a linked shell with connected children', () => {
    expect(validateDoc(docWith(SHELL, [trigger('d1')]))).toEqual({ ok: true, errors: [] })
  })

  it('flags dangling triggers, double triggers, and drawer-in-drawer buttons', () => {
    const missing = validateDoc(docWith(SHELL, [trigger('ghost')]))
    expect(missing.ok).toBe(false)
    expect(missing.errors.join('|')).toContain('opens a missing drawer')

    const both = validateDoc(
      docWith(SHELL, [{ ...trigger('d1'), config: { label: 'Open', modalId: 'm1', drawerId: 'd1' } }]),
    )
    expect(both.ok).toBe(false)
    expect(both.errors.join('|')).toContain('cannot open two overlays')

    const nested: DrawerDoc = {
      ...SHELL,
      children: [
        ...SHELL.children,
        { id: 'nb', type: 'button', config: { label: 'More', drawerId: 'd1' }, parentId: 'd1', x: 8, y: 6, cols: 2, rows: 1 },
      ],
    }
    const v = validateDoc(docWith(nested, [trigger('d1')]))
    expect(v.ok).toBe(false)
    expect(v.errors.join('|')).toContain('cannot open another drawer')
  })
})

describe('drawer publishing', () => {
  const trigger = {
    id: 'trig',
    type: 'button' as const,
    config: { label: 'Open', drawerId: 'd1' },
    parentId: null as string | null,
    x: 0,
    y: 0,
    cols: 4,
    rows: 1,
  }

  it('emits one shared state, trigger openers, and controlled drawers', () => {
    const out = generatePage(docWith(SHELL, [trigger]))
    expect(out).toContain(`import OSBDrawer from './osb/OSBDrawer'`)
    expect(out).toContain(`import { OSBOverlayBody } from './osb/OSBOverlay'`)
    expect(out).toContain('const [openDrawer, setOpenDrawer] = useState(null)')
    expect(out).toContain('<OSBButton config={{"label":"Open","drawerId":"d1"}} onClick={() => setOpenDrawer("d1")} />')
    expect(out).toContain('cols={10} rows={10}')
    expect(out).toContain('<OSBOverlayBody cols={10} rows={10}')
    expect(out).toContain('{ id: "b1", x: 1, y: 6, cols: 4, rows: 1 }')
    expect(out).toContain('open={openDrawer === "d1"}')
    expect(out).toContain('onOpenChange={(o) => setOpenDrawer(o ? "d1" : null)}')
  })

  it('ships drawers in site.json as valid top-level drawer nodes', () => {
    const obj = siteObject(docWith(SHELL, [trigger]), 'shop') as {
      pages: { nodes: unknown[]; drawers: { id: string; type: string; children: { id: string }[] }[] }[]
    }
    expect(obj.pages[0].drawers).toHaveLength(1)
    expect(obj.pages[0].drawers[0]).toMatchObject({ id: 'd1', type: 'drawer' })
    expect(obj.pages[0].drawers[0].children.map((c) => c.id).sort()).toEqual(['b1', 't1', 't2'])
    expect(validateSite(obj)).toEqual({ ok: true, errors: [] })
  })
})
