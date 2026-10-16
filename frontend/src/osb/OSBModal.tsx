import type { ReactNode } from 'react'
import { cn } from '../lib/utils'
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog'
import { overlayChromeShell, overlayTitle, overlayWidthPx } from './OSBOverlay'
import { useOSBTheme } from './OSBTheme'
import { resolveConfig, SURFACE_OPTIONS, type OSBField, type OSBSurface } from './types'

export type OSBModalConfig = {
  /** Internal name + accessible title. Read aloud on open, never shown. */
  title: string
  /** Surface emphasis, shared with cards (osb/types). */
  variant: OSBSurface
  /** Every popup keeps an X — shadcn parity, touch users need a target. */
  showClose: boolean
}

export const OSB_MODAL_DEFAULTS: OSBModalConfig = {
  title: 'Popup',
  variant: 'elevated',
  showClose: true,
}

export const OSB_MODAL_FIELDS: OSBField[] = [
  {
    key: 'title',
    label: 'Popup name',
    hint: 'Read aloud when the popup opens. Not shown on screen.',
    kind: 'text',
    required: true,
  },
  { key: 'variant', label: 'Popup style', kind: 'select', options: SURFACE_OPTIONS },
  { key: 'showClose', label: 'Show close button', kind: 'boolean' },
]

export interface OSBModalProps {
  config?: Partial<OSBModalConfig>
  /** Shell footprint in cells. Sizes the dialog + the editor preview. */
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

/** A popup = a centered dialog. No open state = closed portal (nothing
 * shown). There is no fake preview: the canvas edits overlay children in
 * the overlay editor, and the live site owns open state. */
export default function OSBModal({ config, cols = 12, open, onOpenChange, children }: OSBModalProps) {
  const c = resolveConfig(OSB_MODAL_DEFAULTS, config)
  const title = overlayTitle(c.title, 'Popup')
  const shell = overlayChromeShell(c.variant, useOSBTheme(), 'max-h-[85vh] overflow-y-auto')
  const width = overlayWidthPx(cols)
  return (
    <Dialog open={open ?? false} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="osb-modal-content"
        style={{ width }}
        className={cn(shell, !c.showClose && '[&>button]:hidden')}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  )
}
