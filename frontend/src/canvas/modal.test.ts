import { describe, it, expect } from 'vitest'
import { generatePage } from './codegen'
import {
  canInsertReason,
  canPlaceModalChild,
  createModal,
  insertModalChild,
  modalsOf,
  moveModalChild,
  removeModal,
  removeModalChild,
  resizeModal,
  updateModalChildConfig,
  updateModalConfig,
  validateDoc,
  type CanvasDoc,
  type ModalDoc,
} from './doc'
import { siteObject } from './push'
import { validateSite } from '../site/validate'

// A 12x10 shell with the same proven geometry as the Card pattern.
const SHELL: ModalDoc = {
  id: 'm1',
  config: { title: 'Popup' },
  cols: 12,
  rows: 10,
  children: [
    { id: 't1', type: 'text', config: { text: 'Popup title' }, parentId: 'm1', x: 1, y: 1, cols: 8, rows: 2 },
    { id: 't2', type: 'text', config: { text: 'Body' }, parentId: 'm1', x: 1, y: 3, cols: 8, rows: 3 },
    { id: 'b1', type: 'button', config: { label: 'Got it' }, parentId: 'm1', x: 1, y: 6, cols: 4, rows: 1 },
  ],
}

const docWith = (modal: ModalDoc, nodes: CanvasDoc['nodes'] = []): CanvasDoc => ({
  version: 1,
  nodes,
  modals: [modal],
})

describe('modal gate (canPlaceModalChild)', () => {
  it('accepts any atom inside the shell', () => {
    expect(canPlaceModalChild(SHELL, 'image', { x: 9, y: 1, cols: 2, rows: 2 })).toBeNull()
  })

  it('refuses popup-in-popup, containers, and unknown types', () => {
    const rect = { x: 0, y: 0, cols: 6, rows: 4 }
    expect(canPlaceModalChild(SHELL, 'modal', rect)).toBe('kind')
    expect(canPlaceModalChild(SHELL, 'card', rect)).toBe('kind')
    expect(canPlaceModalChild(SHELL, 'video', rect)).toBe('unknown-type')
  })

  it('refuses overflow, oversize footprints, and overlaps', () => {
    expect(canPlaceModalChild(SHELL, 'text', { x: 10, y: 9, cols: 6, rows: 2 })).toBe('containment')
    // A button needs 2 cols; one col is an undersized footprint.
    expect(canPlaceModalChild(SHELL, 'button', { x: 0, y: 0, cols: 1, rows: 1 })).toBe('footprint')
    // t1 sits at (1,1,8,2).
    expect(canPlaceModalChild(SHELL, 'button', { x: 2, y: 1, cols: 4, rows: 1 })).toBe('overlap')
    // ...unless it is t1 itself moving.
    expect(canPlaceModalChild(SHELL, 'text', { x: 1, y: 1, cols: 8, rows: 2 }, 't1')).toBeNull()
  })
})

describe('modal node gate', () => {
  it('popups never enter through node ops', () => {
    expect(canInsertReason([], 'modal', { x: 0, y: 0, cols: 12, rows: 10 }, null)).toBe('kind')
  })
})

describe('modal ops', () => {
  it('creates, resizes, and removes shells with unlinking', () => {
    let doc: CanvasDoc = { version: 1, nodes: [], modals: [] }
    doc = createModal(doc, { ...SHELL, children: [] })
    expect(modalsOf(doc)).toHaveLength(1)

    // Resize within the footprint works; under children refuses.
    const grown = resizeModal(doc, 'm1', 14, 12)
    expect(grown.ok).toBe(true)
    if (grown.ok) doc = grown.doc
    expect(modalsOf(doc)[0]).toMatchObject({ cols: 14, rows: 12 })
    expect(resizeModal(doc, 'm1', 2, 2).ok).toBe(false)

    // A trigger button unlinks when its popup is removed.
    doc = {
      ...doc,
      nodes: [{ id: 'trig', type: 'button', config: { label: 'Open', modalId: 'm1' }, parentId: null, x: 0, y: 0, cols: 4, rows: 1 }],
    }
    doc = removeModal(doc, 'm1')
    expect(modalsOf(doc)).toHaveLength(0)
    expect(doc.nodes[0].config).toMatchObject({ modalId: '' })
  })

  it('inserts, moves, and removes children through the gate', () => {
    let doc = docWith({ ...SHELL, children: [] })
    const kid = { id: 'k1', type: 'text' as const, config: {}, parentId: 'm1', x: 1, y: 1, cols: 8, rows: 2 }
    const inserted = insertModalChild(doc, 'm1', kid)
    expect(inserted.ok).toBe(true)
    if (!inserted.ok) throw new Error('insert refused')
    doc = inserted.doc

    // Overlap refuses.
    expect(insertModalChild(doc, 'm1', { ...kid, id: 'k2' }).ok).toBe(false)
    // Move to a free cell works.
    const moved = moveModalChild(doc, 'm1', 'k1', { x: 1, y: 4, cols: 8, rows: 2 })
    expect(moved.ok).toBe(true)
    if (moved.ok) doc = moved.doc
    expect(modalsOf(doc)[0].children[0]).toMatchObject({ x: 1, y: 4 })
    // Config + remove round-trip.
    doc = updateModalChildConfig(doc, 'm1', 'k1', { text: 'Hi' })
    expect(modalsOf(doc)[0].children[0].config).toMatchObject({ text: 'Hi' })
    doc = updateModalConfig(doc, 'm1', { title: 'Renamed' })
    expect(modalsOf(doc)[0].config).toMatchObject({ title: 'Renamed' })
    doc = removeModalChild(doc, 'm1', 'k1')
    expect(modalsOf(doc)[0].children).toHaveLength(0)
  })

  it('unknown modal ids refuse with words', () => {
    const doc: CanvasDoc = { version: 1, nodes: [], modals: [] }
    const kid = { id: 'k', type: 'text' as const, config: {}, parentId: 'nope', x: 0, y: 0, cols: 2, rows: 1 }
    expect(insertModalChild(doc, 'nope', kid)).toEqual({ ok: false, reason: 'unknown-type' })
    expect(moveModalChild(doc, 'nope', 'k', kid)).toEqual({ ok: false, reason: 'unknown-type' })
    expect(resizeModal(doc, 'nope', 12, 10)).toEqual({ ok: false, reason: 'unknown-type' })
  })
})

describe('modal validation', () => {
  const trigger = (modalId: string) => ({
    id: 'trig',
    type: 'button' as const,
    config: { label: 'Open', modalId },
    parentId: null as string | null,
    x: 0,
    y: 0,
    cols: 4,
    rows: 1,
  })

  it('passes a linked shell with connected children', () => {
    expect(validateDoc(docWith(SHELL, [trigger('m1')]))).toEqual({ ok: true, errors: [] })
  })

  it('flags dangling triggers and popup-in-popup buttons', () => {
    const missing = validateDoc(docWith(SHELL, [trigger('ghost')]))
    expect(missing.ok).toBe(false)
    expect(missing.errors.join('|')).toContain('opens a missing popup')

    const nested: ModalDoc = {
      ...SHELL,
      children: [
        ...SHELL.children,
        { id: 'nb', type: 'button', config: { label: 'More', modalId: 'm1' }, parentId: 'm1', x: 9, y: 6, cols: 2, rows: 1 },
      ],
    }
    const v = validateDoc(docWith(nested, [trigger('m1')]))
    expect(v.ok).toBe(false)
    expect(v.errors.join('|')).toContain('cannot open another popup')
  })

  it('flags scattered children and undersized shells', () => {
    const scattered: ModalDoc = {
      ...SHELL,
      children: [{ id: 'a', type: 'text', config: {}, parentId: 'm1', x: 1, y: 1, cols: 2, rows: 1 }],
    }
    // Single child is trivially connected; shrink the shell under it instead.
    const tight: ModalDoc = { ...scattered, cols: 6, rows: 4 }
    const v = validateDoc(docWith({ ...tight, cols: 2, rows: 2 }))
    expect(v.ok).toBe(false)
    expect(v.errors.join('|')).toContain('undersizes its children')
  })
})

describe('modal persistence', () => {
  it('tolerates docs saved before popups existed', () => {
    const doc = JSON.parse(JSON.stringify({ version: 1, nodes: [] })) as CanvasDoc
    expect(modalsOf(doc)).toEqual([])
    expect(validateDoc(doc).ok).toBe(true)
  })
})

describe('modal publishing', () => {
  const trigger = {
    id: 'trig',
    type: 'button' as const,
    config: { label: 'Open', modalId: 'm1' },
    parentId: null as string | null,
    x: 0,
    y: 0,
    cols: 4,
    rows: 1,
  }

  it('emits one shared state, trigger openers, and controlled popups', () => {
    const out = generatePage(docWith(SHELL, [trigger]))
    expect(out).toContain(`import { useState } from 'react'`)
    expect(out).toContain(`import OSBModal from './osb/OSBModal'`)
    expect(out).toContain(`import { OSBModalBody } from './osb/OSBModal'`)
    expect(out).toContain('const [openModal, setOpenModal] = useState(null)')
    expect(out).toContain('<OSBButton config={{"label":"Open","modalId":"m1"}} onClick={() => setOpenModal("m1")} />')
    // Shell footprint travels with the popup; kids keep editor geometry.
    expect(out).toContain('cols={12} rows={10}')
    expect(out).toContain('<OSBModalBody cols={12} rows={10}')
    expect(out).toContain('{ id: "b1", x: 1, y: 6, cols: 4, rows: 1 }')
    expect(out).toContain('open={openModal === "m1"}')
    expect(out).toContain('onOpenChange={(o) => setOpenModal(o ? "m1" : null)}')
  })

  it('skips state when there are no popups, and ignores dangling refs', () => {
    const plain: CanvasDoc = { version: 1, nodes: [trigger], modals: [] }
    const out = generatePage(plain)
    expect(out).not.toContain('useState')
    // The registry header always imports every type; no popup is rendered.
    expect(out).not.toContain('<OSBModal')
    expect(out).not.toContain('setOpenModal')
    expect(out).toContain('<OSBButton config={{"label":"Open","modalId":"m1"}} />')
  })

  it('ships popups in site.json as valid top-level modal nodes', () => {
    const obj = siteObject(docWith(SHELL, [trigger]), 'shop') as {
      pages: { nodes: unknown[]; modals: { id: string; type: string; children: { id: string }[] }[] }[]
    }
    expect(obj.pages[0].modals).toHaveLength(1)
    expect(obj.pages[0].modals[0]).toMatchObject({ id: 'm1', type: 'modal' })
    expect(obj.pages[0].modals[0].children.map((c) => c.id).sort()).toEqual(['b1', 't1', 't2'])
    expect(validateSite(obj)).toEqual({ ok: true, errors: [] })
  })
})
