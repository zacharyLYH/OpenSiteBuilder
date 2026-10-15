import { describe, it, expect } from 'vitest'
import { OSB_PATTERNS } from './patterns'
import { OSB_REGISTRY } from './registry'
import { clampSlots, slotBandCols } from './slots'
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
      // A slotted container (the carousel) is judged slide by slide: its
      // slides never touch, and every child has to live inside its own band.
      const slots = clampSlots((p.containerConfig as { items?: unknown }).items)
      const bandCols = slotBandCols(p.containerCols, slots)
      const groups = new Map<number, typeof p.children>()
      for (const c of p.children) {
        const slot = Math.max(0, Math.min(slots - 1, Math.floor((c.x + c.cols / 2) / bandCols)))
        expect(c.x).toBeGreaterThanOrEqual(slot * bandCols)
        expect(c.x + c.cols).toBeLessThanOrEqual(Math.min((slot + 1) * bandCols, p.containerCols))
        groups.set(slot, [...(groups.get(slot) ?? []), c])
      }
      if (slots <= 1) expect(isContiguous(p.children)).toBe(true)
      else for (const group of groups.values()) expect(isContiguous(group)).toBe(true)
    })
  }
})
