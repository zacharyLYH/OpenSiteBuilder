import type { ReactNode } from 'react'
import { overlayTitle } from './OSBOverlay'
import OSBOverlayView from './OSBOverlayView'
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

/** A popup = the shared overlay view in a centered dialog. */
export default function OSBModal({ config, cols = 12, rows = 10, open, onOpenChange, children }: OSBModalProps) {
  const c = resolveConfig(OSB_MODAL_DEFAULTS, config)
  return (
    <OSBOverlayView
      chrome="dialog"
      testid="osb-modal-content"
      title={overlayTitle(c.title, 'Popup')}
      variant={c.variant}
      showClose={c.showClose}
      scroll="max-h-[85vh] overflow-y-auto"
      staticClassName="rounded-xl"
      cols={cols}
      rows={rows}
      open={open}
      onOpenChange={onOpenChange}
    >
      {children}
    </OSBOverlayView>
  )
}
