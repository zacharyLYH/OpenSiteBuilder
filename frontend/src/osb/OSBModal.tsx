import type { ReactNode } from 'react'
import { cn } from '../lib/utils'
import { Dialog, DialogContent, DialogTitle } from './OSBDialog'
import {
  OSBOverlayBody,
  OVERLAY_CELL_PX,
  overlayChildStyle,
  overlayHeightPx,
  overlayWidthPx,
} from './OSBOverlay'
import { useOSBTheme } from './OSBTheme'
import { resolveConfig, SURFACE_OPTIONS, type OSBField, type OSBSurface, type OSBTheme } from './types'

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
// rounding, padding, and animations). Complete static classes (PRD §6.6);
// color overrides merge over the dialog's neutral slate base.
const SHELL_CLASSES: Record<OSBModalConfig['variant'], Record<OSBTheme, string>> = {
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

/**
 * Single cell pitch shared by the editor shell and the live dialog, so a
 * resize in the editor lands at the same px in Test + published. The dialog
 * caps width at 92vw (small viewports); the editor shell is uncapped so drop
 * math stays in whole cells.
 *
 * THE overlay pitch lives in OSBOverlay — modals and drawers share it so
 * the two shells never drift. The MODAL_* names stay as aliases: existing
 * imports (editor, tests, codegen) keep working.
 */
export const MODAL_CELL_PX = OVERLAY_CELL_PX

/** Dialog width from the shell footprint, capped at 92vw. */
export function modalWidthPx(cols: number): string {
  return overlayWidthPx(cols)
}

/** Dialog body height from the shell footprint. Rows resize stays visible. */
export function modalHeightPx(rows: number): string {
  return overlayHeightPx(rows)
}

/** Percent box for a footprint inside the shell's cell rectangle. Shared by
 * the editor shell, the Test preview, and published popups — one rule, so
 * the Got It button keeps its grid width everywhere. */
export function modalChildStyle(
  parent: { cols: number; rows: number },
  kid: { x: number; y: number; cols: number; rows: number },
) {
  return overlayChildStyle(parent, kid)
}

/**
 * Absolutely-positioned kids for inside an OSBModal body — shared by the
 * Test preview, the screenshot mount, and published popups (via codegen).
 * Sorts flow order (top-to-bottom, left-to-right); each kid keeps its grid
 * footprint, so the Got It button keeps its editor width everywhere.
 * OSBModal owns the sized relative body; this returns only the boxes.
 *
 * THE shared overlay body lives in OSBOverlay — this stays as an alias so
 * the editor, mount, and codegen keep one import per overlay kind.
 */
export function OSBModalBody({
  cols,
  rows,
  kids,
  renderKid,
}: {
  cols: number
  rows: number
  kids: { id: string; x: number; y: number; cols: number; rows: number }[]
  renderKid: (id: string) => ReactNode
}): ReactNode {
  return <OSBOverlayBody cols={cols} rows={rows} kids={kids} renderKid={renderKid} />
}

/**
 * The live dialog over the editor AND the drawer Test button: X, outside
 * press, and Escape all close. Absolutely-positioned atoms (shared
 * OSBModalBody) so Test matches the editor grid exactly.
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
      <OSBModalBody cols={cols} rows={rows} kids={kids} renderKid={renderKid} />
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
  const shell = cn('max-h-[85vh] overflow-y-auto', SHELL_CLASSES[c.variant][theme])
  const title = c.title.length === 0 ? 'Popup' : c.title
  const body = (
    <div style={{ height: modalHeightPx(rows) }} className="relative w-full overflow-hidden">
      {children}
    </div>
  )

  // Static shell: no portal, no focus trap — pure preview chrome that
  // mirrors the dialog's footprint and colors.
  if (open === undefined) {
    return (
      <div
        role="dialog"
        aria-label={title}
        style={{ width: modalWidthPx(cols) }}
        className={cn('relative max-w-full rounded-xl', shell)}
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
  // only — popup headings are ordinary content atoms.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="osb-modal-content"
        style={{ width: modalWidthPx(cols) }}
        className={shell}
        showCloseButton={c.showClose}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {body}
      </DialogContent>
    </Dialog>
  )
}
