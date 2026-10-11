import { useRef, useState } from 'react'
import { dragSpan, type CanvasDoc, type DragPayload } from './doc'
import { IDLE, sameFeedback, type Feedback } from './gesture'

/** A drag in flight: the armed payload and the cells it occupies. */
export interface ArmedDrag {
  drag: DragPayload
  span: { cols: number; rows: number }
}

/**
 * One drag session: the armed payload plus every transient signal (drag
 * chrome, landing ghost, conflicts, drag verdict). They all change together,
 * so they are stored together; `patch` no-ops when nothing actually changed,
 * so constant mouse-move events never force a pointless render.
 */
export function useDragSession(doc: CanvasDoc) {
  const [feedback, setFeedback] = useState<Feedback>(IDLE)
  const payload = useRef<DragPayload | null>(null)

  const patch = (p: Partial<Feedback>) =>
    setFeedback((f) => {
      const next = { ...f, ...p }
      return sameFeedback(f, next) ? f : next
    })

  /** Arm a drag: the single place that sets the payload and lights the chrome. */
  const arm = (drag: DragPayload) => {
    payload.current = drag
    patch({ dragging: true })
  }

  /** Back to neutral: nothing armed, no highlights, no ghost, no verdicts. */
  const clear = () => {
    payload.current = null
    patch(IDLE)
  }

  /** The armed drag and its footprint, or null when nothing is armed. */
  const current = (): ArmedDrag | null => {
    const drag = payload.current
    const span = dragSpan(drag, doc.nodes)
    return drag && span ? { drag, span } : null
  }

  return { feedback, patch, arm, clear, current }
}
