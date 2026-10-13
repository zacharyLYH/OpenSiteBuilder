import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogTitle } from './OSBDialog'
import { OSBOverlayBody, OSBOverlayStaticShell, overlayChromeShell, overlayHeightPx, overlayWidthPx } from './OSBOverlay'
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

// Popup chrome on top of the shadcn dialog base (which owns layout,
// rounding, padding, and animations). The surface map is shared with
// drawers (OSBOverlay) — only the scroll bound differs per chrome.
const SCROLL = 'max-h-[85vh] overflow-y-auto'

/**
 * The live dialog over the editor AND the drawer Test button: X, outside
 * press, and Escape all close. Absolutely-positioned atoms (shared
 * OSBOverlayBody) so Test matches the editor grid exactly.
 */
export function OSBModalTestPreview({
  config,
  cols,
  rows,
  kids,
  renderKid,
  open,
  onOpenChange,
}: {
  config?: Partial<OSBModalConfig>
  cols: number
  rows: number
  kids: { id: string; x: number; y: number; cols: number; rows: number }[]
  renderKid: (id: string) => ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
}): ReactNode {
  return (
    <OSBModal config={config} cols={cols} rows={rows} open={open} onOpenChange={onOpenChange}>
      <OSBOverlayBody cols={cols} rows={rows} kids={kids} renderKid={renderKid} />
    </OSBModal>
  )
}

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

export default function OSBModal({ config, cols = 12, rows = 10, open, onOpenChange, children }: OSBModalProps) {
  const c = resolveConfig(OSB_MODAL_DEFAULTS, config)
  const theme = useOSBTheme()
  // Same chrome on both paths; the shadcn base owns overlay/focus/anim AND
  // its p-6 padding. The inner body keeps editor-exact geometry (width from
  // cols, height from rows) inside that padding, so Test matches edit while
  // the transplanted dialog contract (outside press, Escape, X) stays whole.
  const shell = overlayChromeShell(c.variant, theme, SCROLL)
  const title = c.title.length === 0 ? 'Popup' : c.title
  const body = (
    <div style={{ height: overlayHeightPx(rows) }} className="relative w-full overflow-hidden">
      {children}
    </div>
  )

  if (open === undefined) {
    return (
      <OSBOverlayStaticShell
        title={title}
        width={overlayWidthPx(cols)}
        bodyHeight={overlayHeightPx(rows)}
        showClose={c.showClose}
        className="rounded-xl"
        shellClass={shell}
      >
        {children}
      </OSBOverlayStaticShell>
    )
  }

  // The shadcn contract: modal focus trap, scroll lock, Escape + outside
  // press to dismiss, and an always-offered X. Title stays screen-reader
  // only — popup headings are ordinary content atoms.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="osb-modal-content"
        style={{ width: overlayWidthPx(cols) }}
        className={shell}
        showCloseButton={c.showClose}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {body}
      </DialogContent>
    </Dialog>
  )
}
