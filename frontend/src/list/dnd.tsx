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
export function Gap({ to }: { to: Landing }) {
  const { payload, hover, rejected, judge } = useContext(DragCtx)
  const drop = useGapDrop(to)
  const key = gapKey(to)
  if (!payload) {
    // A refused drop leaves its halo behind until the complaint fades, so
    // the failed state screenshots (and reads) as failed.
    if (rejected === key)
      return <div data-testid="canvas-gap" data-rejected="true" className="h-1.5 rounded bg-rose-600 ring-2 ring-rose-300" />
    return <div data-testid="canvas-gap" className="h-1" />
  }
  if (hover !== key) return <div data-testid="canvas-gap" className="h-2 bg-transparent" {...drop} />
  const ok = judge(payload, to)
  return (
    <div
      data-testid="canvas-gap"
      data-accept={ok}
      className={ok ? 'h-2 rounded bg-green-600' : 'h-2 rounded bg-rose-600 ring-2 ring-rose-300'}
      {...drop}
    />
  )
}
