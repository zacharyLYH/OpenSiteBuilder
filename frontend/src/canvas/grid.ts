/**
 * Single source of truth for canvas grid metrics. Everything (RGL config,
 * drop math, drawer side, dot guides) derives from here.
 *
 * Cells are TRUE squares: row height always equals column width, so dots
 * sit exactly on item edges at every resolution. Below the band minimum
 * the canvas scrolls instead of crushing content — alignment never breaks.
 */
export const GRID_COLS = 32
export const GRID_MARGIN_X = 8
export const GRID_MARGIN_Y = 8
/** Desktop cell size floor: fits the smallest content (40px button). */
export const MIN_CELL = 32

/** Narrowest the grid may be; the scroll wrapper enforces this. */
export function minGridWidth(): number {
  return GRID_COLS * MIN_CELL + GRID_MARGIN_X * (GRID_COLS - 1)
}

/** Square cell size for a measured container width (mirrors RGL's math). */
export function cellSize(containerWidth: number): number {
  const fluid = (containerWidth - GRID_MARGIN_X * (GRID_COLS - 1)) / GRID_COLS
  return Math.max(MIN_CELL, fluid)
}

/** Row height == cell size. Always. That is what makes cells square. */
export function rowHeightFor(containerWidth: number): number {
  return cellSize(containerWidth)
}
