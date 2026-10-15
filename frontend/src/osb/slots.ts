/**
 * Slide math for SLOTTED CONTAINERS — today, the carousel.
 *
 * A slotted container's child space is divided into equal vertical bands: one
 * band per slide. A child is stored with `slot` (which slide it sits in) and
 * an x that stays absolute inside the container, always within its own band.
 * Children of different slides therefore never touch in the coordinate space,
 * while each slide renders its own local box in the published track.
 *
 * This file is pure arithmetic with no imports: the canvas bands, the doc
 * gate, the drawer and `OSBRuntime` all read THIS rule, so the editor and the
 * published site can never disagree about where a slide begins.
 */

/** The most slides one slotted container may hold. A carousel, not a deck. */
export const SLOT_MAX = 6

/** A slide count from untrusted config: a whole number in 1..SLOT_MAX. */
export function clampSlots(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : 1
  return Math.max(1, Math.min(SLOT_MAX, v))
}

/** Cells in one slide: an even split of the container's width. The leftover
 * columns (< slots) stay empty at the right edge, so every band is the same
 * width and the layout stays predictable. */
export function slotBandCols(cols: number, slots: number): number {
  return Math.max(1, Math.floor(Math.max(1, cols) / clampSlots(slots)))
}

/** Left edge of a slide, in cells. */
export function slotLeft(slot: number, bandCols: number): number {
  const i = Math.max(0, Math.floor(slot) || 0)
  return i * Math.max(1, bandCols)
}
