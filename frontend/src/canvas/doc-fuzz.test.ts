import { describe, it, expect } from 'vitest'
import {
  insertNode,
  insertPattern,
  moveNode,
  removeNode,
  validateDoc,
  type CanvasDoc,
  type PlacedNode,
} from './doc'
import { OSB_PATTERNS } from '../osb/patterns'

/** Deterministic PRNG so any failure reproduces exactly. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ATOMS = ['text', 'button', 'image'] as const

/**
 * Framework backstop: 2000 random ops through the public op layer must
 * never register an overlap, overflow, undersize, or kind violation.
 * Touch (scattered islands) is intentionally allowed at placement time and
 * checked on demand — everything else must bounce every single time.
 */
describe('doc fuzz: disallowed placements never register', () => {
  it('holds the no-overlap invariant across random inserts, moves, removes, patterns', () => {
    const rand = mulberry32(20261011)
    const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]
    let doc: CanvasDoc = { version: 1, nodes: [] }
    let ids = 0
    const riders = ['text', 'button', 'image', 'card'] as const

    const structuralErrors = (d: CanvasDoc): string[] =>
      validateDoc(d).errors.filter(
        (e) =>
          !e.includes('scattered'),
      )

    for (let i = 0; i < 2000; i++) {
      const roll = rand()
      const containers = doc.nodes.filter((n) => n.parentId === null && n.type === 'card')
      if (roll < 0.4 || doc.nodes.length === 0) {
        // Insert a random atom or card at a random root rect.
        const type = pick(riders)
        const node: PlacedNode = {
          id: `n${ids++}`,
          type,
          config: {},
          parentId: null,
          x: Math.floor(rand() * 32),
          y: Math.floor(rand() * 40),
          cols: 1 + Math.floor(rand() * 10),
          rows: 1 + Math.floor(rand() * 8),
        }
        const before = doc.nodes.length
        const r = insertNode(doc, node)
        if (r.ok) {
          doc = r.doc
          expect(doc.nodes.length).toBe(before + 1)
        } else {
          expect(doc.nodes.length).toBe(before)
        }
      } else if (roll < 0.55 && containers.length > 0) {
        // Insert a random atom at a random cell inside a random card.
        const parent = pick(containers)
        const node: PlacedNode = {
          id: `n${ids++}`,
          type: pick(ATOMS),
          config: {},
          parentId: parent.id,
          x: Math.floor(rand() * parent.cols),
          y: Math.floor(rand() * parent.rows),
          cols: 1 + Math.floor(rand() * 6),
          rows: 1 + Math.floor(rand() * 4),
        }
        const r = insertNode(doc, node)
        if (r.ok) doc = r.doc
      } else if (roll < 0.7 && Object.keys(OSB_PATTERNS).length > 0) {
        // Pattern at a random root cell.
        const key = pick(Object.keys(OSB_PATTERNS))
        const kids = OSB_PATTERNS[key].children.map(() => `n${ids++}`)
        const r = insertPattern(
          doc,
          key,
          `n${ids++}`,
          { x: Math.floor(rand() * 32), y: Math.floor(rand() * 40), cols: 0, rows: 0 },
          kids,
        )
        if (r.ok) doc = r.doc
      } else if (roll < 0.9 && doc.nodes.length > 0) {
        // Move/resize a random node to a random rect/parent.
        const node = pick(doc.nodes)
        const parentId = rand() < 0.5 || containers.length === 0 ? null : pick(containers).id
        const r = moveNode(
          doc,
          node.id,
          {
            x: Math.floor(rand() * 32),
            y: Math.floor(rand() * 40),
            cols: 1 + Math.floor(rand() * 10),
            rows: 1 + Math.floor(rand() * 8),
          },
          parentId,
        )
        if (r.ok) doc = r.doc
      } else if (doc.nodes.length > 0) {
        doc = removeNode(doc, pick(doc.nodes).id)
      }
      // Invariant: placement-time rules (everything but touch) always hold.
      expect(structuralErrors(doc)).toEqual([])
    }
  })
})
