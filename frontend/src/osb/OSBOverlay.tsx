import type { CSSProperties, ReactNode } from 'react'

/**
 * THE shared overlay geometry. Modals (centered dialog) and drawers (side
 * sheet) are both overlay shells whose atom children are absolutely
 * positioned from the same cell pitch — one rule, so a resize in the editor
 * lands at the same px in Test + published for either kind.
 */
export const OVERLAY_CELL_PX = 28

/** Shell width from the footprint, capped at 92vw (small viewports). */
export function overlayWidthPx(cols: number): string {
  return `min(92vw, ${Math.max(1, cols) * OVERLAY_CELL_PX}px)`
}

/** Shell body height from the footprint. Rows resize stays visible. */
export function overlayHeightPx(rows: number): string {
  return `${Math.max(1, rows) * OVERLAY_CELL_PX}px`
}

/** Percent box for a footprint inside the shell's cell rectangle. Shared by
 * the editor shell, the Test preview, and published overlays — one rule, so
 * buttons keep their grid width everywhere. */
export function overlayChildStyle(
  parent: { cols: number; rows: number },
  kid: { x: number; y: number; cols: number; rows: number },
): CSSProperties {
  return {
    position: 'absolute',
    left: `${(kid.x / parent.cols) * 100}%`,
    top: `${(kid.y / parent.rows) * 100}%`,
    width: `${(kid.cols / parent.cols) * 100}%`,
    height: `${(kid.rows / parent.rows) * 100}%`,
  }
}

export type OverlayKid = { id: string; x: number; y: number; cols: number; rows: number }

/**
 * Absolutely-positioned kids for inside an overlay body — shared by the
 * Test preview, the screenshot mount, and published overlays (via codegen).
 * Sorts flow order (top-to-bottom, left-to-right); each kid keeps its grid
 * footprint. The overlay itself owns the sized relative body; this returns
 * only the boxes.
 */
export function OSBOverlayBody({
  cols,
  rows,
  kids,
  renderKid,
}: {
  cols: number
  rows: number
  kids: OverlayKid[]
  renderKid: (id: string) => ReactNode
}): ReactNode {
  const shell = { cols, rows }
  return (
    <>
      {[...kids]
        .sort((a, b) => a.y - b.y || a.x - b.x)
        .map((k) => (
          <div key={k.id} style={overlayChildStyle(shell, k)} className="overflow-hidden">
            {renderKid(k.id)}
          </div>
        ))}
    </>
  )
}
