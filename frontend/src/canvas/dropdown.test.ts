import { describe, it, expect } from 'vitest'
import { canInsertReason, insertNode, validateDoc, type CanvasDoc, type PlacedNode } from './doc'
import { siteObject } from './push'
import { validateSite } from '../site/validate'
import { canContain, isAtomType, isContainerType } from '../osb/registry'

const root = (id: string, type: PlacedNode['type'], x = 0, y = 0, cols = 12, rows = 10): PlacedNode => ({
  id,
  type,
  config: {},
  parentId: null,
  x,
  y,
  cols,
  rows,
})
const kid = (id: string, type: PlacedNode['type'], parentId: string, x = 0, y = 0, cols = 4, rows = 1): PlacedNode => ({
  id,
  type,
  config: {},
  parentId,
  x,
  y,
  cols,
  rows,
})
const menuAt = (id: string, parentId: string | null, x = 0, y = 0): PlacedNode => ({
  id,
  type: 'dropdown',
  config: { label: 'Menu', items: [] },
  parentId,
  x,
  y,
  cols: 6,
  rows: 4,
})

describe('dropdown is a collection-backed leaf, not a container (PRD §6.2/§10.5)', () => {
  it('lands at the root and inside a card, like any atom', () => {
    expect(canInsertReason([], 'dropdown', { x: 0, y: 0, cols: 6, rows: 4 }, null)).toBeNull()
    const nodes = [root('card1', 'card')]
    expect(canInsertReason(nodes, 'dropdown', { x: 1, y: 1, cols: 6, rows: 4 }, 'card1')).toBeNull()
  })

  it('refuses to hold children — you cannot drag anything into a dropdown', () => {
    const nodes = [menuAt('m', null)]
    expect(canInsertReason(nodes, 'button', { x: 1, y: 1, cols: 4, rows: 1 }, 'm')).toBe('depth')
    expect(canInsertReason(nodes, 'text', { x: 1, y: 1, cols: 4, rows: 1 }, 'm')).toBe('depth')
    expect(canInsertReason(nodes, 'dropdown', { x: 1, y: 2, cols: 4, rows: 2 }, 'm')).toBe('depth')
  })

  it('reads as an atom in the registry vocabulary', () => {
    expect(isAtomType('dropdown')).toBe(true)
    expect(isContainerType('dropdown')).toBe(false)
    expect(canContain('dropdown', 'button')).toBe(false)
  })
})

describe('dropdown publishing', () => {
  const docWithMenu = (): CanvasDoc => ({
    version: 1,
    nodes: [
      {
        id: 'm1',
        type: 'dropdown',
        config: {
          label: 'Products',
          items: [
            { label: 'Shop', link: 'https://example.com' },
            { label: 'About', link: '' },
          ],
        },
        parentId: null,
        x: 0,
        y: 0,
        cols: 6,
        rows: 4,
      },
    ],
  })

  it('ships options in site.json as config, with no canvas children', () => {
    const obj = siteObject(docWithMenu(), 'shop') as {
      pages: { nodes: { id: string; config: { items: unknown[] }; children?: unknown[] }[] }[]
    }
    const menu = obj.pages[0].nodes.find((n) => n.id === 'm1')
    expect(menu?.children).toBeUndefined()
    expect(menu?.config.items).toHaveLength(2)
    expect(validateSite(obj)).toEqual({ ok: true, errors: [] })
  })

  it('rejects a site.json that gives a dropdown canvas children', () => {
    const obj = siteObject(docWithMenu(), 'shop') as { pages: { nodes: { children?: unknown[] }[] }[] }
    obj.pages[0].nodes[0].children = [kid('b', 'button', 'm1')]
    const v = validateSite(obj)
    expect(v.ok).toBe(false)
    expect(v.errors.join(' ')).toContain('is not an atom in a container')
  })

  it('publishes submenu rows as nested config data, still no canvas children', () => {
    const doc = docWithMenu()
    doc.nodes[0].config = {
      label: 'Products',
      items: [{ label: 'Shop', link: '', children: [{ label: 'Sale', link: '/sale' }] }],
    }
    const obj = siteObject(doc, 'shop') as {
      pages: { nodes: { config: { items: { children: { label: string }[] }[] }; children?: unknown[] }[] }[]
    }
    const menu = obj.pages[0].nodes[0]
    // Submenu rows ride in config, never as canvas children.
    expect(menu.children).toBeUndefined()
    expect(menu.config.items[0].children[0].label).toBe('Sale')
    expect(validateSite(obj)).toEqual({ ok: true, errors: [] })
  })

  it('rejects a hand-edited submenu of a submenu', () => {
    const doc = docWithMenu()
    doc.nodes[0].config = {
      label: 'Products',
      items: [{ label: 'A', link: '', children: [{ label: 'B', link: '', children: [{ label: 'C', link: '' }] }] }],
    }
    const v = validateSite(siteObject(doc, 'shop'))
    expect(v.ok).toBe(false)
    expect(v.errors.join(' ')).toContain('nests too deep')
  })
})

describe('dropdown doc ops', () => {
  it('insertNode lands a dropdown through the gate', () => {
    const doc: CanvasDoc = { version: 1, nodes: [] }
    const r = insertNode(doc, menuAt('m', null))
    expect(r.ok).toBe(true)
    expect(validateDoc(r.ok ? r.doc : doc)).toEqual({ ok: true, errors: [] })
  })

  it('a dropdown inside a card stays a leaf (no grandkids)', () => {
    const doc: CanvasDoc = { version: 1, nodes: [root('card1', 'card'), menuAt('m', 'card1', 1, 1)] }
    // A button aimed at the nested dropdown is refused: it is not a container.
    expect(canInsertReason(doc.nodes, 'button', { x: 1, y: 1, cols: 4, rows: 1 }, 'm')).toBe('depth')
  })
})
