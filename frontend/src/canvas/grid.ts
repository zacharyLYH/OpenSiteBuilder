/**
 * Single source of truth for every canvas size decision. No other module does
 * cell/row/height math — the canvas asks `canvasMetrics` once per render.
 *
 * Cells are TRUE squares: row height always equals column width, so dots sit
 * exactly on item edges at every resolution. Below the band minimum the canvas
 * scrolls instead of crushing content — alignment never breaks.
 */
export const GRID_COLS = 32
export const GRID_MARGIN_X = 8
export const GRID_MARGIN_Y = 8
/** Desktop cell-size floor: fits the smallest content (40px button). */
export const MIN_CELL = 32
/** Height of the fixed app header; the canvas fills the rest of the viewport. */
export const HEADER_PX = 56

/** Square cell size for a measured container width. Pure and idempotent. */
export const cellSize = (containerWidth: number): number =>
  Math.max(MIN_CELL, (containerWidth - GRID_MARGIN_X * (GRID_COLS - 1)) / GRID_COLS)

/** Row height == cell size. Always. That is what makes cells square. */
export const rowHeightFor = cellSize

/** Narrowest the grid may be; the scroll wrapper enforces this. */
export const minGridWidth = (): number =>
  GRID_COLS * MIN_CELL + GRID_MARGIN_X * (GRID_COLS - 1)

export interface CanvasMetrics {
  /** Square cell size in px. */
  cell: number
  /** Dot rows to paint, always covering content plus a little slack. */
  dotRows: number
  /** Wrapper height, so the empty grid is a real drop target and grows with content. */
  height: number
}

/**
 * The one layout query the canvas needs: same inputs, same output. Cell size,
 * dot coverage, and scroll height — everything resolution-dependent — derives
 * here, so callers hold no size math of their own.
 */
export function canvasMetrics(
  containerWidth: number,
  viewportHeight: number,
  nodes: readonly { y: number; rows: number }[],
): CanvasMetrics {
  const cell = containerWidth > 0 ? cellSize(containerWidth) : 48
  const bottom = nodes.reduce((m, n) => Math.max(m, n.y + n.rows), 0)
  return {
    cell,
    dotRows: Math.max(30, bottom + 8),
    height: Math.max(viewportHeight - HEADER_PX, bottom * (cell + GRID_MARGIN_Y) + 64),
  }
}
