import { describe, it, expect } from 'vitest'
import {
  GRID_COLS,
  GRID_MARGIN_X,
  MIN_CELL,
  cellSize,
  minGridWidth,
  rowHeightFor,
} from './grid'

describe('grid metrics', () => {
  it('cells are true squares at any width: row height equals cell size', () => {
    for (const w of [390, 800, 1280, 1920, 2560]) {
      expect(rowHeightFor(w)).toBe(cellSize(w))
    }
  })

  it('fills wide viewports exactly, floors instead of crushing content', () => {
    const w = 2560
    expect(cellSize(w) * GRID_COLS + GRID_MARGIN_X * (GRID_COLS - 1)).toBeCloseTo(w, 10)
    expect(cellSize(1280)).toBeCloseTo(32.25, 10)
    expect(cellSize(390)).toBe(MIN_CELL)
    expect(minGridWidth()).toBe(GRID_COLS * MIN_CELL + GRID_MARGIN_X * (GRID_COLS - 1))
  })
})
