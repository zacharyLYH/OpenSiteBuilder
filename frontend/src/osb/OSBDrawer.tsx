import type { ReactNode } from 'react'
import { cn } from '../lib/utils'
import { Sheet, SheetContent, SheetTitle } from './OSBSheet'
import { OSBOverlayBody, overlayHeightPx, overlayWidthPx } from './OSBOverlay'
import { useOSBTheme } from './OSBTheme'
import { resolveConfig, SURFACE_OPTIONS, type OSBField, type OSBSurface, type OSBTheme } from './types'

export type OSBDrawerSide = 'left' | 'right'

export type OSBDrawerConfig = {
  /** Internal name + accessible title. Read aloud on open, never shown. */
  title: string
  /** Surface emphasis, shared with cards + modals (osb/types). */
  variant: OSBSurface
  /** Every overlay keeps an X — shadcn parity, touch users need a target. */
  showClose: boolean
  /** Which edge the panel docks to (shadcn Sheet `side`). */
  side: OSBDrawerSide
}

export const OSB_DRAWER_DEFAULTS: OSBDrawerConfig = {
  title: 'Panel',
  variant: 'elevated',
  showClose: true,
  side: 'right',
}

export const OSB_DRAWER_SIDES: { value: OSBDrawerSide; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
]

export const OSB_DRAWER_FIELDS: OSBField[] = [
  {
    key: 'title',
    label: 'Panel name',
    hint: 'Read aloud when the panel opens. Not shown on screen.',
    kind: 'text',
    required: true,
  },
  { key: 'variant', label: 'Panel style', kind: 'select', options: SURFACE_OPTIONS },
  { key: 'side', label: 'Side', kind: 'select', options: OSB_DRAWER_SIDES },
  { key: 'showClose', label: 'Show close button', kind: 'boolean' },
]

// Drawer chrome on top of the shadcn sheet base (which owns edge docking,
// overlay, focus, and slide animation). Complete static classes (PRD §6.6);
// color overrides merge over the sheet's neutral slate base — the same map
// shape as the modal, so the two surfaces never drift in wording.
const SHELL_CLASSES: Record<OSBDrawerConfig['variant'], Record<OSBTheme, string>> = {
  elevated: {
    light: 'bg-white shadow-2xl',
    dark: 'border-slate-700 bg-slate-900 shadow-2xl',
  },
  outlined: {
    light: 'bg-white',
    dark: 'border-slate-700 bg-slate-900',
  },
  plain: {
    light: 'border-transparent bg-transparent shadow-none',
    dark: 'border-transparent bg-transparent shadow-none',
  },
}

/** Panel width from the shell footprint, capped at 92vw (small viewports). */
export function drawerWidthPx(cols: number): string {
  return overlayWidthPx(cols)
}

/** Panel body height from the shell footprint. Rows resize stays visible. */
export function drawerHeightPx(rows: number): string {
  return overlayHeightPx(rows)
}

/**
 * The live sheet over the editor AND the drawer Test button: X, outside
 * press, and Escape all close. Absolutely-positioned atoms (shared
 * OSBOverlayBody) so Test matches the editor grid exactly.
 */
export function OSBDrawerTestPreview({
  config,
  cols,
  rows,
  kids,
  renderKid,
  open,
  onOpenChange,
}: {
  config?: Partial<OSBDrawerConfig>
  cols: number
  rows: number
  kids: { id: string; x: number; y: number; cols: number; rows: number }[]
  renderKid: (id: string) => ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
}): ReactNode {
  return (
    <OSBDrawer config={config} cols={cols} rows={rows} open={open} onOpenChange={onOpenChange}>
      <OSBOverlayBody cols={cols} rows={rows} kids={kids} renderKid={renderKid} />
    </OSBDrawer>
  )
}

export interface OSBDrawerProps {
  config?: Partial<OSBDrawerConfig>
  /** Shell footprint in cells. Sizes the panel + the editor preview. */
  cols?: number
  rows?: number
  /**
   * Controlled open state (published site + live preview). Undefined renders
   * a static shell — the drawer thumbnail and the registry preview.
   */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: ReactNode
}

export default function OSBDrawer({ config, cols = 10, rows = 10, open, onOpenChange, children }: OSBDrawerProps) {
  const c = resolveConfig(OSB_DRAWER_DEFAULTS, config)
  const theme = useOSBTheme()
  // Same chrome on both paths; the shadcn base owns overlay/focus/anim AND
  // its p-4 padding. The inner body keeps editor-exact geometry (width from
  // cols, height from rows) inside that padding, so Test matches edit while
  // the transplanted sheet contract (outside press, Escape, X) stays whole.
  // The sheet base docks full-height; the panel width comes from the shell.
  const shell = cn('max-h-full overflow-y-auto', SHELL_CLASSES[c.variant][theme])
  const title = c.title.length === 0 ? 'Panel' : c.title
  const body = (
    <div style={{ height: drawerHeightPx(rows) }} className="relative w-full overflow-hidden">
      {children}
    </div>
  )

  // Static shell: no portal, no focus trap — pure preview chrome that
  // mirrors the sheet's footprint and colors.
  if (open === undefined) {
    return (
      <div
        role="dialog"
        aria-label={title}
        style={{ width: drawerWidthPx(cols) }}
        className={cn('relative max-w-full border border-slate-200 bg-white p-4 shadow-xl', shell)}
      >
        {body}
        {c.showClose && (
          <span className="absolute right-4 top-4 rounded-sm opacity-70" aria-hidden="true">
            ✕
          </span>
        )}
      </div>
    )
  }

  // The shadcn contract: modal focus trap, scroll lock, Escape + outside
  // press to dismiss, and an always-offered X. Title stays screen-reader
  // only — panel headings are ordinary content atoms.
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={c.side}
        data-testid="osb-drawer-content"
        style={{ width: drawerWidthPx(cols) }}
        className={shell}
        showCloseButton={c.showClose}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        {body}
      </SheetContent>
    </Sheet>
  )
}
