import type { ReactNode } from 'react'
import { Sheet, SheetContent, SheetTitle } from './OSBSheet'
import { OSBOverlayBodyBox, OSBOverlayStaticShell, overlayChromeShell, overlayHeightPx, overlayTitle, overlayWidthPx } from './OSBOverlay'
import { useOSBTheme } from './OSBTheme'
import { resolveConfig, SURFACE_OPTIONS, type OSBField, type OSBSurface } from './types'

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
// overlay, focus, and slide animation). Surface + static shell are shared
// with modals (OSBOverlay) — only the scroll bound differs per chrome.
const SCROLL = 'max-h-full overflow-y-auto'

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
  const shell = overlayChromeShell(c.variant, theme, SCROLL)
  const title = overlayTitle(c.title, 'Panel')

  if (open === undefined) {
    return (
      <OSBOverlayStaticShell
        title={title}
        width={overlayWidthPx(cols)}
        bodyHeight={overlayHeightPx(rows)}
        showClose={c.showClose}
        className="border border-slate-200 bg-white p-4 shadow-xl"
        shellClass={shell}
      >
        {children}
      </OSBOverlayStaticShell>
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
        style={{ width: overlayWidthPx(cols) }}
        className={shell}
        showCloseButton={c.showClose}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <OSBOverlayBodyBox height={overlayHeightPx(rows)}>{children}</OSBOverlayBodyBox>
      </SheetContent>
    </Sheet>
  )
}
