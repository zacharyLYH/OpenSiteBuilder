import { describe, it, expect } from 'vitest'
import {
  canInsertReason,
  canPlaceOverlayChild,
  createOverlay,
  findOverlay,
  insertOverlayChild,
  moveOverlayChild,
  overlaysOf,
  removeOverlay,
  removeOverlayChild,
  resizeOverlay,
  updateOverlayChildConfig,
  updateOverlayConfig,
  validateDoc,
  type CanvasDoc,
  type OverlayDoc,
} from './doc'
import { siteObject } from './push'
import { validateSite } from '../site/validate'

// One shell per kind, same proven geometry.
const drawerShell = (id: string, children: OverlayDoc['children']): OverlayDoc => ({
  id,
  overlayType: 'drawer',
  config: { title: 'Panel' },
  cols: 10,
  rows: 10,
  children,
})

const SHELL: OverlayDoc = {
  id: 'm1',
  overlayType: 'modal',
  config: { title: 'Popup' },
  cols: 12,
  rows: 10,
  children: [
    { id: 't1', type: 'text', config: { text: 'Popup title' }, parentId: 'm1', x: 1, y: 1, cols: 8, rows: 2 },
    { id: 't2', type: 'text', config: { text: 'Body' }, parentId: 'm1', x: 1, y: 3, cols: 8, rows: 3 },
    { id: 'b1', type: 'button', config: { label: 'Got it' }, parentId: 'm1', x: 1, y: 6, cols: 4, rows: 1 },
  ],
}

const docWith = (overlay: OverlayDoc, nodes: CanvasDoc['nodes'] = []): CanvasDoc => ({
  version: 1,
  nodes,
  overlays: [overlay],
})

describe('overlay gate (one rule for every kind)', () => {
  it('accepts any atom inside the shell', () => {
    expect(canPlaceOverlayChild(SHELL, 'image', { x: 9, y: 1, cols: 2, rows: 2 })).toBeNull()
    const drawer = drawerShell('d1', [])
    expect(canPlaceOverlayChild(drawer, 'image', { x: 8, y: 6, cols: 2, rows: 2 })).toBeNull()
  })

  it('refuses overlay-in-overlay, containers, and unknown types', () => {
    const rect = { x: 0, y: 0, cols: 6, rows: 4 }
    expect(canPlaceOverlayChild(SHELL, 'modal', rect)).toBe('kind')
    expect(canPlaceOverlayChild(SHELL, 'drawer', rect)).toBe('kind')
    expect(canPlaceOverlayChild(SHELL, 'card', rect)).toBe('kind')
    expect(canPlaceOverlayChild(SHELL, 'audio', rect)).toBe('unknown-type')
  })

  it('refuses overflow, oversize footprints, and overlaps', () => {
    expect(canPlaceOverlayChild(SHELL, 'text', { x: 10, y: 9, cols: 6, rows: 2 })).toBe('containment')
    expect(canPlaceOverlayChild(SHELL, 'button', { x: 0, y: 0, cols: 1, rows: 1 })).toBe('footprint')
    expect(canPlaceOverlayChild(SHELL, 'button', { x: 2, y: 1, cols: 4, rows: 1 })).toBe('overlap')
    expect(canPlaceOverlayChild(SHELL, 'text', { x: 1, y: 1, cols: 8, rows: 2 }, 't1')).toBeNull()
  })
})

describe('overlay node gate', () => {
  it('overlays never enter through node ops', () => {
    expect(canInsertReason([], 'modal', { x: 0, y: 0, cols: 12, rows: 10 }, null)).toBe('kind')
    expect(canInsertReason([], 'drawer', { x: 0, y: 0, cols: 10, rows: 10 }, null)).toBe('kind')
  })
})

describe('overlay ops', () => {
  it('creates, resizes, and removes shells with unlinking', () => {
    let doc: CanvasDoc = { version: 1, nodes: [], overlays: [] }
    doc = createOverlay(doc, { ...SHELL, children: [] })
    doc = createOverlay(doc, { ...drawerShell('d1', []), children: [] })
    expect(overlaysOf(doc)).toHaveLength(2)
    expect(findOverlay(doc, 'm1')?.overlayType).toBe('modal')

    const grown = resizeOverlay(doc, 'm1', 14, 12)
    expect(grown.ok).toBe(true)
    if (grown.ok) doc = grown.doc
    expect(findOverlay(doc, 'm1')).toMatchObject({ cols: 14, rows: 12 })
    expect(resizeOverlay(doc, 'm1', 2, 2).ok).toBe(false)

    // Grid limits come from the shell's own kind: a 12-wide modal fits where
    // a 10-wide drawer default would already be at its max.
    expect(resizeOverlay(doc, 'd1', 12, 12).ok).toBe(true)

    // A trigger button unlinks when its overlay is removed.
    doc = {
      ...doc,
      nodes: [{ id: 'trig', type: 'button', config: { label: 'Open', targetId: 'm1' }, parentId: null, x: 0, y: 0, cols: 4, rows: 1 }],
    }
    doc = removeOverlay(doc, 'm1')
    expect(overlaysOf(doc)).toHaveLength(1)
    expect(doc.nodes[0].config).toMatchObject({ targetId: '' })
  })

  it('inserts, moves, and removes children through the gate', () => {
    let doc = docWith({ ...SHELL, children: [] })
    const kid = { id: 'k1', type: 'text' as const, config: {}, parentId: 'm1', x: 1, y: 1, cols: 8, rows: 2 }
    const inserted = insertOverlayChild(doc, 'm1', kid)
    expect(inserted.ok).toBe(true)
    if (!inserted.ok) throw new Error('insert refused')
    doc = inserted.doc

    expect(insertOverlayChild(doc, 'm1', { ...kid, id: 'k2' }).ok).toBe(false)
    const moved = moveOverlayChild(doc, 'm1', 'k1', { x: 1, y: 4, cols: 8, rows: 2 })
    expect(moved.ok).toBe(true)
    if (moved.ok) doc = moved.doc
    expect(findOverlay(doc, 'm1')!.children[0]).toMatchObject({ x: 1, y: 4 })
    doc = updateOverlayChildConfig(doc, 'm1', 'k1', { text: 'Hi' })
    expect(findOverlay(doc, 'm1')!.children[0].config).toMatchObject({ text: 'Hi' })
    doc = updateOverlayConfig(doc, 'm1', { title: 'Renamed' })
    expect(findOverlay(doc, 'm1')!.config).toMatchObject({ title: 'Renamed' })
    doc = removeOverlayChild(doc, 'm1', 'k1')
    expect(findOverlay(doc, 'm1')!.children).toHaveLength(0)
  })

  it('unknown overlay ids refuse with words', () => {
    const doc: CanvasDoc = { version: 1, nodes: [], overlays: [] }
    const kid = { id: 'k', type: 'text' as const, config: {}, parentId: 'nope', x: 0, y: 0, cols: 2, rows: 1 }
    expect(insertOverlayChild(doc, 'nope', kid)).toEqual({ ok: false, reason: 'unknown-type' })
    expect(moveOverlayChild(doc, 'nope', 'k', kid)).toEqual({ ok: false, reason: 'unknown-type' })
    expect(resizeOverlay(doc, 'nope', 12, 10)).toEqual({ ok: false, reason: 'unknown-type' })
  })
})

describe('overlay validation', () => {
  const trigger = (targetId: string) => ({
    id: 'trig',
    type: 'button' as const,
    config: { label: 'Open', targetId },
    parentId: null as string | null,
    x: 0,
    y: 0,
    cols: 4,
    rows: 1,
  })

  it('passes linked shells with connected children', () => {
    expect(validateDoc(docWith(SHELL, [trigger('m1')]))).toEqual({ ok: true, errors: [] })
    expect(validateDoc(docWith(drawerShell('d1', []), [trigger('d1')]))).toEqual({ ok: true, errors: [] })
  })

  it('flags dangling triggers and overlay-in-overlay buttons', () => {
    const missing = validateDoc(docWith(SHELL, [trigger('ghost')]))
    expect(missing.ok).toBe(false)
    expect(missing.errors.join('|')).toContain('opens a missing overlay')

    const nested: OverlayDoc = {
      ...SHELL,
      children: [
        ...SHELL.children,
        { id: 'nb', type: 'button', config: { label: 'More', targetId: 'm1' }, parentId: 'm1', x: 9, y: 6, cols: 2, rows: 1 },
      ],
    }
    const v = validateDoc(docWith(nested, [trigger('m1')]))
    expect(v.ok).toBe(false)
    expect(v.errors.join('|')).toContain('cannot open another overlay')
  })

  it('flags duplicate ids, scattered children, and undersized shells', () => {
    const dup: CanvasDoc = { version: 1, nodes: [], overlays: [SHELL, { ...SHELL }] }
    expect(validateDoc(dup).errors.join('|')).toContain('bad or duplicate id')

    const tight: OverlayDoc = {
      ...SHELL,
      cols: 2,
      rows: 2,
      children: [{ id: 'a', type: 'text', config: {}, parentId: 'm1', x: 1, y: 1, cols: 2, rows: 1 }],
    }
    const v = validateDoc(docWith(tight))
    expect(v.ok).toBe(false)
    expect(v.errors.join('|')).toContain('undersizes its children')
  })

  it('reads legacy modalId/drawerId triggers and legacy stores', () => {
    const legacyTrigger = {
      id: 'trig',
      type: 'button' as const,
      config: { label: 'Open', modalId: 'm1' },
      parentId: null as string | null,
      x: 0,
      y: 0,
      cols: 4,
      rows: 1,
    }
    expect(validateDoc(docWith(SHELL, [legacyTrigger])).ok).toBe(true)
    const legacyDoc = { version: 1, nodes: [], modals: [SHELL] } as unknown as CanvasDoc
    expect(overlaysOf(legacyDoc)).toHaveLength(1)
    expect(validateDoc(legacyDoc).ok).toBe(true)
  })
})

describe('overlay persistence', () => {
  it('tolerates docs saved before overlays existed', () => {
    const doc = JSON.parse(JSON.stringify({ version: 1, nodes: [] })) as CanvasDoc
    expect(overlaysOf(doc)).toEqual([])
    expect(validateDoc(doc).ok).toBe(true)
  })
})

describe('overlay publishing (manifest data, not generated JSX)', () => {
  const trigger = {
    id: 'trig',
    type: 'button' as const,
    config: { label: 'Open', targetId: 'm1' },
    parentId: null as string | null,
    x: 0,
    y: 0,
    cols: 4,
    rows: 1,
  }

  it('keeps the opener as config data — the engine turns it into onClick', () => {
    const obj = siteObject(docWith(SHELL, [trigger]), 'shop') as {
      pages: { nodes: { id: string; config: Record<string, unknown> }[] }[]
    }
    const trig = obj.pages[0].nodes.find((n) => n.id === 'trig')
    expect(trig?.config).toMatchObject({ label: 'Open', targetId: 'm1' })
  })

  it('ships shell footprint + child geometry so the engine can lay it out', () => {
    const obj = siteObject(docWith(SHELL, [trigger]), 'shop') as {
      pages: {
        overlays: { cols: number; rows: number; children: { id: string; x: number; y: number; cols: number; rows: number }[] }[]
      }[]
    }
    const shell = obj.pages[0].overlays[0]
    expect(shell.cols).toBe(12)
    expect(shell.rows).toBe(10)
    expect(shell.children.find((c) => c.id === 'b1')).toMatchObject({ x: 1, y: 6, cols: 4, rows: 1 })
  })

  it('ships every overlay kind through one store (kind is data)', () => {
    const dtrigger = { ...trigger, config: { label: 'Open', targetId: 'd1' } }
    const obj = siteObject(docWith(drawerShell('d1', SHELL.children.map((k) => ({ ...k, parentId: 'd1' }))), [dtrigger]), 'shop') as {
      pages: { overlays: { id: string; type: string }[] }[]
    }
    expect(obj.pages[0].overlays[0]).toMatchObject({ id: 'd1', type: 'drawer' })
  })

  it('ships overlays in site.json as valid top-level overlay nodes', () => {
    const obj = siteObject(docWith(SHELL, [trigger]), 'shop') as {
      pages: { nodes: unknown[]; overlays: { id: string; type: string; children: { id: string }[] }[] }[]
    }
    expect(obj.pages[0].overlays).toHaveLength(1)
    expect(obj.pages[0].overlays[0]).toMatchObject({ id: 'm1', type: 'modal' })
    expect(obj.pages[0].overlays[0].children.map((c) => c.id).sort()).toEqual(['b1', 't1', 't2'])
    expect(validateSite(obj)).toEqual({ ok: true, errors: [] })
  })
})
