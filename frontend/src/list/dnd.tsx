// List drag and drop: gaps are the only targets. Native HTML5, no dep.
//
// A drag carries a payload string: an existing node id, or `new:<type>` from
// the palette. Hovering a gap lights the verdict line (green lands, red
// refuses); release calls land. Rejections are voiced by the caller, never
// silent.
import { createContext, useContext } from 'react'

/** Drag payload: an existing node id, or `new:<type>` from the palette. */
export type Landing = { parentId: string | null; index: number }

export const DragCtx = createContext<{
  payload: string | null
  setPayload: (p: string | null) => void
  hover: string | null
  setHover: (h: string | null) => void
  rejected: string | null
  setRejected: (r: string | null) => void
  /** Live verdict for the hovered gap: true = this drop would land. */
  judge: (payload: string, to: Landing) => boolean
  land: (payload: string, to: Landing) => void
}>({
  payload: null,
  setPayload: () => {},
  hover: null,
  setHover: () => {},
  rejected: null,
  setRejected: () => {},
  judge: () => false,
  land: () => {},
})

export const gapKey = (to: Landing): string => `${to.parentId ?? 'root'}:${to.index}`

// One drop handler shared by every gap state: a refused halo stays a live
// target (the refusal was about that payload, not the gap itself).
function useGapDrop(to: Landing) {
  const { payload, setPayload, setHover, land } = useContext(DragCtx)
  return {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setHover(gapKey(to))
    },
    onDragLeave: () => setHover(null),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setPayload(null)
      setHover(null)
      land(payload ?? '', to)
    },
  }
}

// The line between items: the only drop target. Hidden (1px spacer) until a
// drag starts, so the page reads clean at rest. Hover verdicts come from the
// same gate the drop enforces: green lands, red refuses. The box never
// resizes under the cursor — hover recolors only — or the target slides out
// from under the pointer mid-drag and the drop misses. (Refused halos render
// at rest, after the drop, so their size is harmless.)
// `vertical` lays the line between side-by-side slots (columns row) instead
// of stacked rows: same verdict colors, swapped axis.
export function Gap({ to, vertical }: { to: Landing; vertical?: boolean }) {
  const { payload, hover, rejected, judge } = useContext(DragCtx)
  const drop = useGapDrop(to)
  const key = gapKey(to)
  // Row gaps are horizontal lines (h-*, full width); column gaps are vertical
  // lines (w-*, full height) between side-by-side slots.
  const idle = vertical ? 'w-1 self-stretch' : 'h-1'
  const haloBad = vertical ? 'w-1.5 self-stretch rounded bg-rose-600 ring-2 ring-rose-300' : 'h-1.5 rounded bg-rose-600 ring-2 ring-rose-300'
  const armed = vertical ? 'w-2 self-stretch bg-transparent' : 'h-2 bg-transparent'
  const okCls = vertical ? 'w-2 self-stretch rounded bg-green-600' : 'h-2 rounded bg-green-600'
  const badCls = vertical ? 'w-2 self-stretch rounded bg-rose-600 ring-2 ring-rose-300' : 'h-2 rounded bg-rose-600 ring-2 ring-rose-300'
  if (!payload) {
    // A refused drop leaves its halo behind until the complaint fades, so
    // the failed state screenshots (and reads) as failed.
    if (rejected === key) return <div data-testid="canvas-gap" data-rejected="true" className={haloBad} />
    return <div data-testid="canvas-gap" className={idle} />
  }
  if (hover !== key) return <div data-testid="canvas-gap" className={armed} {...drop} />
  const ok = judge(payload, to)
  return <div data-testid="canvas-gap" data-accept={ok} className={ok ? okCls : badCls} {...drop} />
}
