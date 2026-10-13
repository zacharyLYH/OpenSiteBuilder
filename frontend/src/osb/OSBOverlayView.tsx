import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogTitle } from './OSBDialog'
import { Sheet, SheetContent, SheetTitle } from './OSBSheet'
import { OSBOverlayBodyBox, OSBOverlayStaticShell, overlayChromeShell, overlayHeightPx, overlayWidthPx } from './OSBOverlay'
import { useOSBTheme } from './OSBTheme'
import type { OSBSurface } from './types'

/** A popup and a drawer differ only in chrome (centered dialog vs docked
 * sheet), scroll bound, and the static thumbnail's decoration. Everything
 * else — title, surface, close, editor-exact body — lives here once.
 * `open === undefined` renders the static shell (thumbnail + editor preview);
 * otherwise the live shadcn portal owns focus, Escape, outside press, and X. */
export default function OSBOverlayView({
  chrome,
  testid,
  title,
  variant,
  showClose,
  scroll,
  staticClassName,
  side,
  cols,
  rows,
  open,
  onOpenChange,
  children,
}: {
  chrome: 'dialog' | 'sheet'
  testid: string
  title: string
  variant: OSBSurface
  showClose: boolean
  scroll: string
  staticClassName: string
  side?: 'left' | 'right'
  cols: number
  rows: number
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: ReactNode
}): ReactNode {
  const shell = overlayChromeShell(variant, useOSBTheme(), scroll)
  const width = overlayWidthPx(cols)

  if (open === undefined) {
    return (
      <OSBOverlayStaticShell
        title={title}
        width={width}
        bodyHeight={overlayHeightPx(rows)}
        showClose={showClose}
        className={staticClassName}
        shellClass={shell}
      >
        {children}
      </OSBOverlayStaticShell>
    )
  }

  const body = <OSBOverlayBodyBox height={overlayHeightPx(rows)}>{children}</OSBOverlayBodyBox>
  const content = { 'data-testid': testid, style: { width }, className: shell, showCloseButton: showClose }
  if (chrome === 'sheet') {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side={side} {...content}>
          <SheetTitle className="sr-only">{title}</SheetTitle>
          {body}
        </SheetContent>
      </Sheet>
    )
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent {...content}>
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {body}
      </DialogContent>
    </Dialog>
  )
}
