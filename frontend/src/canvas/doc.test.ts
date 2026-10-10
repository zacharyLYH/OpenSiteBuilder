import { describe, it, expect } from 'vitest'
import { canPlace, collides, type PlacedNode } from './doc'
import { GRID_COLS } from './grid'
import { OSB_NODE_TYPES, OSB_REGISTRY } from '../osb/registry'

const node = (x: number, y: number, cols: number, rows: number): PlacedNode => ({
  id: `${x},${y}`,
  type: 'card',
  config: {},
  x,
  y,
  cols,
  rows,
})

describe('placement gate (no screenshots — pure rules)', () => {
  it('rejects overlaps but allows edge-touching neighbors', () => {
    const nodes = [node(0, 0, 8, 8)]
    expect(canPlace(nodes, { x: 4, y: 4, cols: 4, rows: 4 })).toBe(false)
    expect(canPlace(nodes, { x: 2, y: 2, cols: 2, rows: 2 })).toBe(false)
    expect(canPlace(nodes, { x: 8, y: 0, cols: 4, rows: 4 })).toBe(true)
    expect(canPlace(nodes, { x: 0, y: 8, cols: 8, rows: 2 })).toBe(true)
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

  it('every registered footprint is sane: min >= 1 dot square, default inside min/max', () => {
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
})
