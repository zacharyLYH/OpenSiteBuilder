import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../lib/utils'
import type { OSBSurface, OSBTheme } from './types'

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

/** A non-empty config string, else its fallback — overlay titles are never blank. */
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

/** A non-empty config string, else its fallback — overlay titles are never blank. */
export const overlayTitle = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.length > 0 ? value : fallback

/**
 * THE one surface map for every overlay shell. Cards keep their own (they
 * add radius/shadow/padding axes); popups and drawers share this, so the
 * two overlay surfaces never drift in value or wording.
 */
export const OVERLAY_SURFACE_CLASSES: Record<OSBSurface, Record<OSBTheme, string>> = {
  elevated: {
    light: 'bg-white shadow-2xl ring-1 ring-slate-900/10',
    dark: 'border-slate-700 bg-slate-900 shadow-2xl ring-1 ring-white/10',
  },
  outlined: {
    light: 'bg-white ring-1 ring-slate-300',
    dark: 'border-slate-700 bg-slate-900 ring-1 ring-slate-700',
  },
  plain: {
    light: 'border-transparent bg-transparent shadow-none',
    dark: 'border-transparent bg-transparent shadow-none',
  },
}

/** Scroll wrapper + shared surface: the one live-shell line per chrome. */
export function overlayChromeShell(variant: OSBSurface, theme: OSBTheme, scroll: string): string {
  return cn(scroll, OVERLAY_SURFACE_CLASSES[variant][theme])
}

/**
 * Absolutely-positioned kids for inside an overlay body — shared by the
 * Test preview, the screenshot mount, and published overlays (via the engine).
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
