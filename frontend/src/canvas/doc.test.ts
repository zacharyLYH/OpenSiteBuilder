import { describe, it, expect } from 'vitest'
import {
  canInsert,
  canInsertReason,
  canPlace,
  collides,
  conflictIds,
  containerFloor,
  eventCell,
  insertNode,
  insertPattern,
  isContiguous,
  moveNode,
  nestLocal,
  nestTargetAt,
  reasonText,
  removeNode,
  resolveDrop,
  resolveInsert,
  touches,
  validateDoc,
  type CanvasDoc,
  type PlacedNode,
} from './doc'
import { canContain } from '../osb/registry'
import { GRID_COLS } from './grid'
import { OSB_NODE_TYPES, OSB_REGISTRY } from '../osb/registry'

const root = (
  id: string,
  type: PlacedNode['type'],
  x: number,
  y: number,
  cols: number,
  rows: number,
): PlacedNode => ({ id, type, config: {}, parentId: null, x, y, cols, rows })
const kid = (
  id: string,
  type: PlacedNode['type'],
  parentId: string,
  x: number,
  y: number,
  cols: number,
  rows: number,
): PlacedNode => ({ id, type, config: {}, parentId, x, y, cols, rows })

describe('placement gate (no screenshots — pure rules)', () => {
  it('rejects overlaps but allows edge-touching neighbors', () => {
    const nodes = [root('a', 'card', 0, 0, 12, 10)]
    expect(canPlace(nodes, { x: 4, y: 4, cols: 4, rows: 4 })).toBe(false)
    expect(canPlace(nodes, { x: 2, y: 2, cols: 2, rows: 2 })).toBe(false)
    expect(canPlace(nodes, { x: 12, y: 0, cols: 4, rows: 4 })).toBe(true)
    expect(canPlace(nodes, { x: 0, y: 10, cols: 8, rows: 2 })).toBe(true)
    expect(collides({ x: 0, y: 0, cols: 1, rows: 1 }, { x: 1, y: 0, cols: 1, rows: 1 })).toBe(false)
  })

  it('rejects off-grid rects: negatives, fractions, and overflow', () => {
    expect(canPlace([], { x: -1, y: 0, cols: 4, rows: 4 })).toBe(false)
    expect(canPlace([], { x: 0, y: -1, cols: 4, rows: 4 })).toBe(false)
    expect(canPlace([], { x: 0.5, y: 0, cols: 4, rows: 4 })).toBe(false)
    expect(canPlace([], { x: 0, y: 0, cols: 0, rows: 4 })).toBe(false)
    expect(canPlace([], { x: GRID_COLS - 2, y: 0, cols: 4, rows: 1 })).toBe(false)
    expect(canPlace([], { x: GRID_COLS - 4, y: 0, cols: 4, rows: 1 })).toBe(true)
  })

  it('every registered footprint is sane: min >= 1, default inside min/max', () => {
    for (const t of OSB_NODE_TYPES) {
      const g = OSB_REGISTRY[t].grid
      expect(g.minCols).toBeGreaterThanOrEqual(1)
      expect(g.minRows).toBeGreaterThanOrEqual(1)
      expect(g.cols).toBeGreaterThanOrEqual(g.minCols)
      expect(g.rows).toBeGreaterThanOrEqual(g.minRows)
      expect(g.cols).toBeLessThanOrEqual(g.maxCols)
      expect(g.rows).toBeLessThanOrEqual(g.maxRows)
      expect(g.maxCols).toBeLessThanOrEqual(GRID_COLS)
    }
  })

  it('rejects footprints outside the type min/max with a reason', () => {
    // Button min is 2x1.
    expect(canInsertReason([], 'button', { x: 0, y: 0, cols: 1, rows: 1 }, null)).toBe('footprint')
    expect(canInsert([], 'button', { x: 0, y: 0, cols: 1, rows: 1 }, null)).toBe(false)
    expect(canInsertReason([], 'button', { x: 0, y: 0, cols: 4, rows: 1 }, null)).toBeNull()
  })
})

describe('kind rule: containers hold any atom, nothing else nests', () => {
  it('allows card>text|button|image, containers at root', () => {
    expect(canContain('card', 'text')).toBe(true)
    expect(canContain('card', 'button')).toBe(true)
    expect(canContain('card', 'image')).toBe(true)
  })

  it('denies by default: atoms accept nothing, containers never nest', () => {
    expect(canContain('button', 'button')).toBe(false)
    expect(canContain('text', 'button')).toBe(false)
    expect(canContain('button', 'text')).toBe(false)
    expect(canContain('card', 'card')).toBe(false)
    expect(canContain('nope', 'button')).toBe(false)
    expect(canContain('card', 'nope')).toBe(false)
  })

  it('canInsertReason names the rejection', () => {
    expect(canInsertReason([], 'video' as never, { x: 0, y: 0, cols: 4, rows: 2 }, null)).toBe('unknown-type')
    expect(canInsertReason([], 'button', { x: -1, y: 0, cols: 4, rows: 1 }, null)).toBe('integrity')
    const cards: CanvasDoc = { version: 1, nodes: [root('c', 'card', 0, 0, 12, 10)] }
    // Container inside a container: kind deny.
    expect(canInsertReason(cards.nodes, 'card', { x: 0, y: 0, cols: 6, rows: 4 }, 'c')).toBe('kind')
    // Atom under an atom: depth deny (parent is not a root container).
    const withBtn: CanvasDoc = {
      version: 1,
      nodes: [root('c', 'card', 0, 0, 12, 10), kid('b', 'button', 'c', 0, 0, 4, 1)],
    }
    expect(canInsertReason(withBtn.nodes, 'text', { x: 0, y: 0, cols: 4, rows: 2 }, 'b')).toBe('depth')
    // Overflowing the shell: containment.
    expect(canInsertReason(cards.nodes, 'button', { x: 10, y: 9, cols: 4, rows: 2 }, 'c')).toBe('containment')
  })
})

describe('touch is validated on demand, not at placement (lego freedom)', () => {
  it('touches counts shared edges, not corners', () => {
    expect(touches({ x: 0, y: 0, cols: 4, rows: 4 }, { x: 4, y: 0, cols: 4, rows: 4 })).toBe(true)
    expect(touches({ x: 0, y: 0, cols: 4, rows: 4 }, { x: 0, y: 4, cols: 4, rows: 4 })).toBe(true)
    expect(touches({ x: 0, y: 0, cols: 4, rows: 4 }, { x: 4, y: 4, cols: 4, rows: 4 })).toBe(false)
    expect(touches({ x: 0, y: 0, cols: 4, rows: 4 }, { x: 8, y: 0, cols: 4, rows: 4 })).toBe(false)
    // Partial edge overlap still touches.
    expect(touches({ x: 0, y: 0, cols: 12, rows: 10 }, { x: 12, y: 0, cols: 8, rows: 2 })).toBe(true)
  })

  it('isContiguous needs one patch: lines pass, islands fail', () => {
    expect(isContiguous([])).toBe(true)
    expect(isContiguous([{ x: 0, y: 0, cols: 4, rows: 4 }])).toBe(true)
    expect(
      isContiguous([
        { x: 0, y: 0, cols: 4, rows: 4 },
        { x: 4, y: 0, cols: 4, rows: 4 },
        { x: 8, y: 0, cols: 4, rows: 4 },
      ]),
    ).toBe(true)
    expect(
      isContiguous([
        { x: 0, y: 0, cols: 4, rows: 4 },
        { x: 4, y: 0, cols: 4, rows: 4 },
        { x: 20, y: 0, cols: 4, rows: 4 },
      ]),
    ).toBe(false)
  })

  it('insert lets a scattered second node land; the validator flags it', () => {
    const one: CanvasDoc = { version: 1, nodes: [root('c', 'card', 0, 0, 12, 10)] }
    const far = insertNode(one, root('t', 'text', 20, 0, 6, 1))
    expect(far.ok).toBe(true)
    if (!far.ok) return
    expect(validateDoc(far.doc).ok).toBe(false)
    expect(validateDoc(far.doc).errors.join('|')).toContain('scattered')
    const near = insertNode(one, root('t', 'text', 12, 0, 6, 1))
    expect(near.ok).toBe(true)
    if (!near.ok) return
    expect(validateDoc(near.doc)).toEqual({ ok: true, errors: [] })
  })

  it('move may split the patch; the validator flags the islands', () => {
    const doc: CanvasDoc = {
      version: 1,
      nodes: [
        root('a', 'text', 0, 0, 4, 2),
        root('b', 'text', 4, 0, 4, 2),
        root('c', 'text', 8, 0, 4, 2),
      ],
    }
    // Lifting the middle bridge away leaves two islands — allowed on the
    // canvas, caught by Validate.
    const r = moveNode(doc, 'b', { x: 4, y: 6, cols: 4, rows: 2 }, null)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(validateDoc(r.doc).errors.join('|')).toContain('scattered')
    // Sliding the right node under the left keeps one patch.
    const r2 = moveNode(doc, 'c', { x: 0, y: 2, cols: 4, rows: 2 }, null)
    expect(r2.ok).toBe(true)
  })
})

describe('fungible move: reposition / nest / take-out (no screenshots)', () => {
  const card = () => root('card1', 'card', 0, 0, 12, 10)
  const docWithCard = (): CanvasDoc => ({ version: 1, nodes: [card()] })

  it('nests any atom inside a card', () => {
    expect(insertNode(docWithCard(), kid('t1', 'text', 'card1', 1, 1, 8, 2)).ok).toBe(true)
    expect(insertNode(docWithCard(), kid('b1', 'button', 'card1', 1, 1, 4, 1)).ok).toBe(true)
    expect(insertNode(docWithCard(), kid('i1', 'image', 'card1', 1, 1, 8, 6)).ok).toBe(true)
  })

  it('rejects containers inside containers', () => {
    expect(insertNode(docWithCard(), kid('c', 'card', 'card1', 1, 1, 6, 4)).ok).toBe(false)
  })

  it('rejects sibling overlap inside the container but allows edge-touching', () => {
    let doc = docWithCard()
    doc = (insertNode(doc, kid('b1', 'button', 'card1', 0, 0, 4, 1)) as { ok: true; doc: CanvasDoc }).doc
    expect(insertNode(doc, kid('b2', 'button', 'card1', 2, 0, 4, 1)).ok).toBe(false)
    expect(insertNode(doc, kid('b2', 'button', 'card1', 4, 0, 4, 1)).ok).toBe(true)
  })

  it('repositions within the same container (same call as nesting)', () => {
    let doc = docWithCard()
    doc = (insertNode(doc, kid('b1', 'button', 'card1', 0, 0, 4, 1)) as { ok: true; doc: CanvasDoc }).doc
    const r = moveNode(doc, 'b1', { x: 5, y: 5, cols: 4, rows: 1 }, 'card1')
    expect(r.ok).toBe(true)
    expect((r as { ok: true; doc: CanvasDoc }).doc.nodes.find((n) => n.id === 'b1')).toMatchObject({
      parentId: 'card1',
      x: 5,
      y: 5,
    })
  })

  it('rejects a child overflowing the parent inner rect', () => {
    const doc = docWithCard()
    expect(moveNode(doc, 'card1', { x: 0, y: 0, cols: 12, rows: 10 }, 'card1').ok).toBe(false)
    const withKid: CanvasDoc = {
      version: 1,
      nodes: [card(), kid('b1', 'button', 'card1', 0, 0, 4, 1)],
    }
    expect(moveNode(withKid, 'b1', { x: 9, y: 8, cols: 4, rows: 1 }, 'card1').ok).toBe(false)
  })

  it('takes a child out to root when it lands touching the patch', () => {
    const doc: CanvasDoc = { version: 1, nodes: [card(), kid('b1', 'button', 'card1', 0, 0, 4, 1)] }
    const r = moveNode(doc, 'b1', { x: 12, y: 0, cols: 4, rows: 1 }, null)
    expect(r.ok).toBe(true)
    expect((r as { ok: true; doc: CanvasDoc }).doc.nodes.find((n) => n.id === 'b1')?.parentId).toBeNull()
  })

  it('take-out that splits the old row lands; the validator flags the islands', () => {
    const doc: CanvasDoc = {
      version: 1,
      nodes: [
        card(),
        kid('k1', 'text', 'card1', 0, 0, 4, 2),
        kid('k2', 'text', 'card1', 4, 0, 4, 2),
        kid('k3', 'text', 'card1', 8, 0, 4, 2),
      ],
    }
    // k2 touches the root patch at its take-out cell; lifting it splits the
    // container row into islands — allowed on canvas, caught by Validate.
    const r = moveNode(doc, 'k2', { x: 12, y: 0, cols: 4, rows: 2 }, null)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.doc.nodes.find((n) => n.id === 'k2')?.parentId).toBeNull()
    expect(validateDoc(r.doc).errors.join('|')).toContain('scattered')
  })

  it('no absorb: moving a container over a root node is still an overlap', () => {
    const doc: CanvasDoc = {
      version: 1,
      nodes: [root('card1', 'card', 0, 0, 12, 10), root('btn', 'button', 14, 0, 4, 1)],
    }
    expect(moveNode(doc, 'card1', { x: 12, y: 0, cols: 12, rows: 10 }, null).ok).toBe(false)
  })

  it('no undersize: shrinking a container under its children is rejected', () => {
    const doc: CanvasDoc = {
      version: 1,
      nodes: [root('card1', 'card', 0, 0, 12, 10), kid('b1', 'button', 'card1', 6, 7, 4, 1)],
    }
    expect(moveNode(doc, 'card1', { x: 0, y: 0, cols: 8, rows: 8 }, null).ok).toBe(false)
    expect(moveNode(doc, 'card1', { x: 0, y: 0, cols: 14, rows: 12 }, null).ok).toBe(true)
  })

  it('removing a container cascades to its children', () => {
    const doc: CanvasDoc = { version: 1, nodes: [card(), kid('b1', 'button', 'card1', 0, 0, 4, 1)] }
    expect(removeNode(doc, 'card1').nodes).toEqual([])
  })

  it('container floor grows with children bbox + padding', () => {
    const nodes = [card(), kid('b1', 'button', 'card1', 2, 3, 4, 1)]
    expect(containerFloor(nodes, 'card1')).toEqual({ cols: 7, rows: 5 })
    expect(containerFloor([card()], 'card1')).toEqual({ cols: 0, rows: 0 })
  })

  it('center-point hit test finds the container and ignores children depth', () => {
    const nodes = [root('c', 'card', 0, 0, 12, 10), root('t', 'text', 12, 0, 8, 2)]
    expect(nestTargetAt(nodes, { x: 5, y: 5 })?.id).toBe('c')
    expect(nestTargetAt(nodes, { x: 14, y: 1 })).toBeNull()
    expect(nestTargetAt(nodes, { x: 25, y: 5 })).toBeNull()
  })

  it('canInsert validates unknown parents and nesting under nested nodes', () => {
    expect(canInsert([], 'button', { x: 0, y: 0, cols: 4, rows: 1 }, 'ghost')).toBe(false)
    const doc: CanvasDoc = {
      version: 1,
      nodes: [root('c', 'card', 0, 0, 12, 10), kid('b', 'button', 'c', 0, 0, 4, 1)],
    }
    // 'b' is an atom inside a container: nothing nests under it, and a
    // container with children can never itself nest elsewhere.
    expect(canInsert(doc.nodes, 'button', { x: 0, y: 0, cols: 4, rows: 1 }, 'b')).toBe(false)
    expect(canInsert(doc.nodes, 'card', { x: 12, y: 0, cols: 6, rows: 4 }, null)).toBe(true)
  })
})

describe('nestLocal + reasonText (drop plumbing)', () => {
  it('lands odd-sized atoms on integral cells, clamped into the shell', () => {
    const shell = { x: 0, y: 14, cols: 12, rows: 10 }
    // 4x1 button centered at (5, 20.5) -> (5, 6) local, not (5, 6.5).
    expect(nestLocal(shell, { x: 5, y: 20.5 }, { cols: 4, rows: 1 })).toEqual({ x: 5, y: 6 })
    // Past the far edge clamps; before origin floors to zero.
    expect(nestLocal(shell, { x: 99, y: 99 }, { cols: 4, rows: 1 })).toEqual({ x: 8, y: 9 })
    expect(nestLocal(shell, { x: -3, y: -3 }, { cols: 4, rows: 1 })).toEqual({ x: 0, y: 0 })
  })

  it('every rejection reason has plain-language feedback', () => {
    const reasons = [
      'unknown-type',
      'kind',
      'depth',
      'integrity',
      'footprint',
      'containment',
      'overlap',
      'disconnected',
      'undersize',
    ] as const
    for (const r of reasons) {
      expect(reasonText(r).length).toBeGreaterThan(0)
    }
    expect(reasonText('overlap')).toBe('That spot is taken')
    expect(reasonText('disconnected')).toBe('Pieces must touch — no gaps')
  })

  it('user scenario: nesting onto occupied card cells reports overlap', () => {
    // Pattern card at root: title (1,1,8,2) covers the drop.
    let doc = (
      insertPattern({ version: 1, nodes: [] }, 'card-content', 'c1', { x: 0, y: 0, cols: 0, rows: 0 }, [
        't1',
        't2',
        'b1',
      ]) as { ok: true; doc: CanvasDoc }
    ).doc
    const card = doc.nodes.find((n) => n.id === 'c1')!
    const local = nestLocal(card, { x: 3, y: 3 }, { cols: 4, rows: 1 })
    const r = insertNode(doc, { id: 'x', type: 'button', config: {}, parentId: 'c1', ...local, cols: 4, rows: 1 })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe('overlap')
      expect(reasonText(r.reason)).toBe('That spot is taken')
    }
    expect(doc.nodes).toHaveLength(4)
  })
})

describe('drop resolution: one center-point rule for every gesture', () => {
  // card1 (0,0,12,10) with a button kid (1,6,4,1); text at (12,0,6,1).
  const doc: CanvasDoc = {
    version: 1,
    nodes: [
      root('card1', 'card', 0, 0, 12, 10),
      kid('b1', 'button', 'card1', 1, 6, 4, 1),
      root('t1', 'text', 12, 0, 6, 1),
    ],
  }

  it('resolveDrop nests when the center lands in an accepting container', () => {
    // Root button dragged so its center (10,2.5) sits in the card.
    expect(resolveDrop(doc.nodes, 't1', { x: 8, y: 2, cols: 6, rows: 1 })).toEqual({
      parentId: 'card1',
      rect: { x: 6, y: 2, cols: 6, rows: 1 },
    })
  })

  it('resolveDrop stays at root outside containers (routing only, no verdict)', () => {
    expect(resolveDrop(doc.nodes, 't1', { x: 20, y: 0, cols: 6, rows: 1 })).toEqual({
      parentId: null,
      rect: { x: 20, y: 0, cols: 6, rows: 1 },
    })
  })

  it('resolveDrop routes container-over-container to root (gate denies it)', () => {
    const two: CanvasDoc = {
      version: 1,
      nodes: [root('card1', 'card', 0, 0, 12, 10), root('card2', 'card', 12, 0, 12, 10)],
    }
    // Center (5,4) sits in card1, but shells never nest: root routing, and
    // the gate (not the router) rejects the overlap.
    expect(resolveDrop(two.nodes, 'card2', { x: 2, y: 2, cols: 6, rows: 4 })).toEqual({
      parentId: null,
      rect: { x: 2, y: 2, cols: 6, rows: 4 },
    })
    expect(canInsertReason(two.nodes, 'card', { x: 2, y: 2, cols: 6, rows: 4 }, null, 'card2')).toBe('overlap')
  })

  it('resolveDrop returns null for unknown ids', () => {
    expect(resolveDrop(doc.nodes, 'ghost', { x: 0, y: 0, cols: 1, rows: 1 })).toBeNull()
  })

  it('resolveInsert mirrors the rule for fresh palette rects', () => {
    expect(resolveInsert(doc.nodes, 'button', { x: 8, y: 2, cols: 4, rows: 1 })).toEqual({
      parentId: 'card1',
      rect: { x: 8, y: 2, cols: 4, rows: 1 },
    })
    expect(resolveInsert(doc.nodes, 'text', { x: 20, y: 0, cols: 6, rows: 1 })).toEqual({
      parentId: null,
      rect: { x: 20, y: 0, cols: 6, rows: 1 },
    })
    // Odd-sized centers floor to integral cells.
    expect(resolveInsert(doc.nodes, 'button', { x: 3, y: 6, cols: 4, rows: 1 })).toEqual({
      parentId: 'card1',
      rect: { x: 5, y: 6, cols: 4, rows: 1 },
    })
  })

  it('eventCell maps pointer pixels to parent cells with edge clamping', () => {
    const box = { left: 0, top: 0, width: 400, height: 200 }
    const parent = { cols: 12, rows: 10 }
    expect(eventCell(100, 150, box, parent, { cols: 4, rows: 1 })).toEqual({ x: 3, y: 7 })
    expect(eventCell(9999, 9999, box, parent, { cols: 4, rows: 1 })).toEqual({ x: 8, y: 9 })
    expect(eventCell(-50, -50, box, parent, { cols: 4, rows: 1 })).toEqual({ x: 0, y: 0 })
  })
})

describe('conflictIds: one red rule for roots and nested children', () => {
  // card1 (0,0,12,10) with button kid (1,6,4,1); text at (12,0,6,1).
  const doc: CanvasDoc = {
    version: 1,
    nodes: [
      root('card1', 'card', 0, 0, 12, 10),
      kid('b1', 'button', 'card1', 1, 6, 4, 1),
      root('t1', 'text', 12, 0, 6, 1),
    ],
  }

  it('flags root siblings the dragged rect overlaps, excluding self', () => {
    expect(conflictIds(doc.nodes, null, 'text', { x: 10, y: 0, cols: 6, rows: 1 }, null)).toEqual(
      expect.arrayContaining(['card1', 't1']),
    )
    // A moving node never conflicts with itself.
    expect(conflictIds(doc.nodes, 't1', 'text', { x: 12, y: 0, cols: 6, rows: 1 }, null)).toEqual([])
    // Mere edge touch is legal: no conflict.
    expect(conflictIds(doc.nodes, null, 'text', { x: 18, y: 0, cols: 6, rows: 1 }, null)).toEqual([])
  })

  it('flags nested kids the dragged rect overlaps inside the container', () => {
    // Image dragged over the button kid (not over the title).
    expect(conflictIds(doc.nodes, null, 'image', { x: 2, y: 6, cols: 4, rows: 2 }, 'card1')).toEqual(['b1'])
    expect(conflictIds(doc.nodes, null, 'button', { x: 5, y: 6, cols: 4, rows: 1 }, 'card1')).toEqual([])
  })

  it('flags the container itself when the kind rule refuses', () => {
    expect(conflictIds(doc.nodes, null, 'card', { x: 0, y: 0, cols: 6, rows: 4 }, 'card1')).toEqual(['card1'])
    expect(conflictIds(doc.nodes, 'b1', 'button', { x: 5, y: 6, cols: 4, rows: 1 }, 'nope')).toEqual([])
  })
})

describe('patterns: atomic compositions (no screenshots)', () => {
  it('inserts card + connected children in one call', () => {
    const r = insertPattern({ version: 1, nodes: [] }, 'card-content', 'c1', { x: 0, y: 0, cols: 0, rows: 0 }, [
      't1',
      't2',
      'b1',
    ])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.doc.nodes).toHaveLength(4)
    expect(r.doc.nodes.find((n) => n.id === 'c1')).toMatchObject({ type: 'card', cols: 12, rows: 10 })
    for (const n of r.doc.nodes) {
      if (n.id !== 'c1') expect(n.parentId).toBe('c1')
    }
  })

  it('rejects unknown patterns and id-count mismatches without mutating', () => {
    const doc: CanvasDoc = { version: 1, nodes: [] }
    expect(insertPattern(doc, 'nope', 'c1', { x: 0, y: 0, cols: 0, rows: 0 }, []).ok).toBe(false)
    expect(insertPattern(doc, 'card-content', 'c1', { x: 0, y: 0, cols: 0, rows: 0 }, ['only']).ok).toBe(false)
    expect(doc.nodes).toEqual([])
  })

  it('a second pattern may land apart; the validator flags the gap', () => {
    let doc = (
      insertPattern({ version: 1, nodes: [] }, 'card-content', 'c1', { x: 0, y: 0, cols: 0, rows: 0 }, [
        't1',
        't2',
        'b1',
      ]) as { ok: true; doc: CanvasDoc }
    ).doc
    const far = insertPattern(doc, 'card-content', 'c2', { x: 20, y: 0, cols: 0, rows: 0 }, ['t3', 't4', 'b2'])
    expect(far.ok).toBe(true)
    if (far.ok) expect(validateDoc(far.doc).errors.join('|')).toContain('scattered')
    const near = insertPattern(doc, 'card-content', 'c2', { x: 12, y: 0, cols: 0, rows: 0 }, ['t3', 't4', 'b2'])
    expect(near.ok).toBe(true)
    if (near.ok) doc = near.doc
    expect(doc.nodes).toHaveLength(8)
  })
})

describe('validateDoc: file-level backstop (no screenshots)', () => {
  it('accepts a connected doc, flags scattered / overlapping docs', () => {
    const good: CanvasDoc = {
      version: 1,
      nodes: [root('c', 'card', 0, 0, 12, 10), root('t', 'text', 12, 0, 8, 2)],
    }
    expect(validateDoc(good)).toEqual({ ok: true, errors: [] })
    const scattered: CanvasDoc = {
      version: 1,
      nodes: [root('c', 'card', 0, 0, 12, 10), root('t', 'text', 24, 0, 8, 2)],
    }
    const v = validateDoc(scattered)
    expect(v.ok).toBe(false)
    expect(v.errors.join('|')).toContain('scattered')
    const overlap: CanvasDoc = {
      version: 1,
      nodes: [root('c', 'card', 0, 0, 12, 10), root('t', 'text', 6, 0, 8, 2)],
    }
    expect(validateDoc(overlap).errors.join('|')).toContain('overlap')
  })
})
