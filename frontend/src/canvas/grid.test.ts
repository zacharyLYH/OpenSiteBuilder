import { describe, it, expect } from 'vitest'
import { GRID_COLS, GRID_MARGIN_X, MIN_CELL, canvasMetrics, cellSize, minGridWidth } from './grid'

describe('grid metrics', () => {
  it('cells are true squares at any width: row height equals cell size', () => {
    // RGL gets its rowHeight straight from the metrics query, so asserting on
    // the query is what keeps rows and columns square.
    for (const w of [390, 800, 1280, 1920, 2560]) {
      expect(canvasMetrics(w, 856, []).cell).toBe(cellSize(w))
    }
    // Unmeasured container: no NaN, a usable default.
    expect(canvasMetrics(0, 856, []).cell).toBe(48)
  })

  it('fills wide viewports exactly, floors instead of crushing content', () => {
    const w = 2560
    expect(cellSize(w) * GRID_COLS + GRID_MARGIN_X * (GRID_COLS - 1)).toBeCloseTo(w, 10)
    expect(cellSize(1280)).toBeCloseTo(32.25, 10)
    expect(cellSize(390)).toBe(MIN_CELL)
    expect(minGridWidth()).toBe(GRID_COLS * MIN_CELL + GRID_MARGIN_X * (GRID_COLS - 1))
  })
})
