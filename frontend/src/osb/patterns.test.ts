import { describe, it, expect } from 'vitest'
import { OSB_PATTERNS } from './patterns'
import { OSB_REGISTRY } from './registry'
import { collides, isContiguous } from '../canvas/doc'

// Patterns are authored compositions: guard them so a future edit can't
// ship overlapping, overflowing, disconnected, or mis-sized children.
describe('patterns (no screenshots — pure rules)', () => {
  for (const [id, p] of Object.entries(OSB_PATTERNS)) {
    it(`${id}: children fit, connect, and match their footprints`, () => {
      expect(p.children.length).toBeGreaterThan(0)
      for (const c of p.children) {
        const g = OSB_REGISTRY[c.type].grid
        expect(c.cols).toBeGreaterThanOrEqual(g.minCols)
        expect(c.rows).toBeGreaterThanOrEqual(g.minRows)
        expect(c.x + c.cols).toBeLessThanOrEqual(p.containerCols)
        expect(c.y + c.rows).toBeLessThanOrEqual(p.containerRows)
      }
      for (let i = 0; i < p.children.length; i++) {
        for (let j = i + 1; j < p.children.length; j++) {
          expect(collides(p.children[i], p.children[j])).toBe(false)
        }
      }
      expect(isContiguous(p.children)).toBe(true)
    })
  }
})
