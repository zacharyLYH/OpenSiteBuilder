import type { Layout } from 'react-grid-layout'
import { OSB_PATTERNS } from '../osb/patterns'
import type { OSBNodeType } from '../osb/registry'
import {
  canInsertReason,
  conflictIds,
  resolveDrop,
  resolveInsert,
  type CellRect,
  type DragPayload,
  type PlacedNode,
  type RejectReason,
} from './doc'

/**
 * ONE answer to "what is this drag doing": where it lands, whether the gate
 * accepts it, and who flashes red. Hover, drop and commit all read this same
 * answer, so live feedback can never disagree with the final verdict.
 */
type PlanBase = {
  /** What is landing: the gated type, ready for the op that performs it. */
  type: OSBNodeType
  /** Root (null) or the container the landing sits in. */
  parentId: string | null
  /** Routed landing rect; differs from the raw dragged rect when nested. */
  rect: CellRect
  /** Nodes that must flash red; always empty when the landing is accepted. */
  conflicts: string[]
}

/** Discriminated: a refused plan always carries its reason, no `!` needed. */
export type DragPlan = PlanBase & ({ ok: true; reason: null } | { ok: false; reason: RejectReason })

/**
 * Every transient gesture signal in ONE object — they change together, so
 * they are stored together.
 */
export type Feedback = {
  dragging: boolean
  conflicts: string[]
  ghost: { parentId: string; x: number; y: number; cols: number; rows: number; ok: boolean } | null
  check: { id: string; ok: boolean } | null
  forbidden: boolean
}

export const IDLE: Feedback = { dragging: false, conflicts: [], ghost: null, check: null, forbidden: false }

/** Structural equality for tiny flat objects — lets `patch` no-op when
 * nothing changed, so constant drag events never force a pointless render. */
export const sameFeedback = (a: Feedback, b: Feedback): boolean => JSON.stringify(a) === JSON.stringify(b)

/** What a payload is dragging: the type to gate, the node to exclude. */
type Subject = { type: OSBNodeType; selfId: string | null }

function subjectOf(nodes: PlacedNode[], drag: DragPayload | null): Subject | null {
  if (!drag) return null
  // A pattern lands as its own container shell — see insertPattern.
  if (drag.kind === 'pattern') {
    const pattern = OSB_PATTERNS[drag.pattern]
    return pattern ? { type: pattern.containerType, selfId: null } : null
  }
  if (drag.kind === 'palette') return { type: drag.type, selfId: null }
  const node = nodes.find((n) => n.id === drag.id)
  return node ? { type: node.type, selfId: node.id } : null
}

function judge(nodes: PlacedNode[], subject: Subject, parentId: string | null, rect: CellRect): DragPlan {
  const { type, selfId } = subject
  const reason = canInsertReason(nodes, type, rect, parentId, selfId ?? undefined)
  if (reason === null) return { type, parentId, rect, ok: true, reason, conflicts: [] }
  return { type, parentId, rect, ok: false, reason, conflicts: conflictIds(nodes, selfId, type, rect, parentId) }
}

/** Landing already aimed at a parent we know: container hover and drop. */
export function planAt(
  nodes: PlacedNode[],
  drag: DragPayload | null,
  rect: CellRect,
  parentId: string | null,
): DragPlan | null {
  const subject = subjectOf(nodes, drag)
  return subject ? judge(nodes, subject, parentId, rect) : null
}

/** Landing chosen by the centre-point rule — nest when the centre sits in an
 * accepting container, else root. Every root-bound gesture routes here.
 * `slideIndex` is which slide each slotted container is showing, so a landing
 * on one is a slide the user can actually see (see resolveLanding). */
export function planRoute(
  nodes: PlacedNode[],
  drag: DragPayload | null,
  rect: CellRect,
  slideIndex?: Record<string, number>,
): DragPlan | null {
  if (!drag) return null
  const subject = subjectOf(nodes, drag)
  if (!subject) return null
  const landing =
    drag.kind === 'pattern'
      ? { parentId: null, rect }
      : drag.kind === 'move'
        ? resolveDrop(nodes, drag.id, rect, slideIndex)
        : resolveInsert(nodes, drag.type, rect, slideIndex)
  return landing ? judge(nodes, subject, landing.parentId, landing.rect) : null
}

/** Root items whose footprint differs from the doc: the only ones `commit`
 * is ever allowed to write back (everything else is RGL internal drift). */
export const movedRoots = (next: Layout, nodes: PlacedNode[]): Layout =>
  next.filter((l) => {
    const cur = nodes.find((n) => n.id === l.i)
    return cur && cur.parentId === null && (cur.x !== l.x || cur.y !== l.y || cur.cols !== l.w || cur.rows !== l.h)
  })

/** True when an event landed inside a container body. Containers own their
 * own feedback, so root-level handlers stand down there. */
export const overContainer = (target: EventTarget | null): boolean =>
  (target as HTMLElement | null)?.closest?.('[data-testid^="container-"]') != null
