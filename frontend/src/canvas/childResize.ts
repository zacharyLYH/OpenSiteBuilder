/** Cell footprint in the parent's grid. */
export interface Dims {
  cols: number
  rows: number
}

/** A placed child being resized: its origin plus its current footprint. */
export interface ResizeKid extends Dims {
  x: number
  y: number
}

export interface ResizeGestureOptions {
  /** Parent cell box in px; pointer deltas map onto its pitch. */
  box: { width: number; height: number }
  /** Parent footprint in cells. */
  parent: Dims
  /** The child's fixed origin and starting footprint. */
  kid: ResizeKid
  /** The child type's own floor/ceiling footprint. */
  grid: { minCols: number; minRows: number; maxCols: number; maxRows: number }
  /** Live footprint while dragging (null = gesture over, nothing to show). */
  onPreview(dims: Dims | null): void
  /** Gesture ended with a real change; apply it through the usual gate. */
  onCommit(dims: Dims): void
  /** Resize in flight — callers suppress their own drag handlers with this. */
  onActive?(active: boolean): void
}

/**
 * THE south-east resize gesture for a placed child, shared by canvas container
 * children and popup children. Pointer deltas map onto the parent's cell
 * pitch; the result is clamped into the shell AND the type's own footprint
 * (the same limits the doc gate enforces, so the preview can never promise
 * something the commit refuses). Previews live, commits once on release.
 *
 * Callers own only where the box comes from and what a commit means.
 */
export function startChildResize(e: React.MouseEvent, o: ResizeGestureOptions): void {
  e.stopPropagation()
  e.preventDefault()
  const pitchX = o.box.width / o.parent.cols
  const pitchY = o.box.height / o.parent.rows
  const startX = e.clientX
  const startY = e.clientY
  const dimsAt = (dx: number, dy: number): Dims => ({
    cols: Math.max(
      o.grid.minCols,
      Math.min(o.grid.maxCols, Math.min(o.parent.cols - o.kid.x, o.kid.cols + Math.round(dx / pitchX))),
    ),
    rows: Math.max(
      o.grid.minRows,
      Math.min(o.grid.maxRows, Math.min(o.parent.rows - o.kid.y, o.kid.rows + Math.round(dy / pitchY))),
    ),
  })
  let last: Dims = { cols: o.kid.cols, rows: o.kid.rows }
  o.onActive?.(true)
  const onMove = (ev: MouseEvent) => {
    last = dimsAt(ev.clientX - startX, ev.clientY - startY)
    o.onPreview(last)
  }
  const onUp = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    o.onActive?.(false)
    o.onPreview(null)
    if (last.cols !== o.kid.cols || last.rows !== o.kid.rows) o.onCommit(last)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}
