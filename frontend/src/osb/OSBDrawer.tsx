import type { ReactNode } from 'react'
import { cn } from '../lib/utils'
import { Sheet, SheetContent, SheetTitle } from '../components/ui/sheet'
import { overlayChromeShell, overlayTitle, overlayWidthPx } from './OSBOverlay'
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

/** A drawer = an edge-docked sheet. No open state = closed portal (nothing
 * shown). There is no fake preview: the canvas edits overlay children in
 * the overlay editor, and the live site owns open state. */
export default function OSBDrawer({ config, cols = 10, open, onOpenChange, children }: OSBDrawerProps) {
  const c = resolveConfig(OSB_DRAWER_DEFAULTS, config)
  const title = overlayTitle(c.title, 'Panel')
  const shell = overlayChromeShell(c.variant, useOSBTheme(), 'max-h-full overflow-y-auto')
  const width = overlayWidthPx(cols)
  return (
    <Sheet open={open ?? false} onOpenChange={onOpenChange}>
      <SheetContent
        side={c.side}
        data-testid="osb-drawer-content"
        style={{ width }}
        className={cn(shell, !c.showClose && '[&>button]:hidden')}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  )
}
