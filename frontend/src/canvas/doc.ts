import { OSB_PATTERNS } from '../osb/patterns'
import { OSB_REGISTRY, canContain, isAtomType, isContainerType, type OSBNodeType } from '../osb/registry'
import { CONTAINER_PAD } from '../osb/types'
import { getProjectSlug } from '../lib/project'
import { GRID_COLS } from './grid'

export interface PlacedNode {
  id: string
  type: OSBNodeType
  config: Record<string, unknown>
  /** Null = root. Otherwise id of the container parent. Max depth 1. */
  parentId: string | null
  /** Root: canvas coords. Child: coords relative to parent origin. */
  x: number
  y: number
  cols: number
  rows: number
}

export interface CanvasDoc {
  version: 1
  nodes: PlacedNode[]
}

const EMPTY: CanvasDoc = { version: 1, nodes: [] }

/** Project name comes from the existing onboarding flow (cookie), not new UI.
 * No fallback: returns null when no project is selected so the canvas can
 * redirect home instead of inventing a fake name. */
export function currentProjectName(): string | null {
  return getProjectSlug()
}

export function storageKey(projectName: string): string {
  return `osb.project.${projectName}`
}

export function loadDoc(key: string): CanvasDoc {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return { ...EMPTY, nodes: [] }
    const doc = JSON.parse(raw) as CanvasDoc
    if (doc.version !== 1 || !Array.isArray(doc.nodes)) return { ...EMPTY, nodes: [] }
    // Drop unknown types (removed components), then prune orphans: children
    // whose parent is missing, not a root container, or itself nested.
    const known = doc.nodes.filter((n) => n && typeof n.type === 'string' && n.type in OSB_REGISTRY)
    const roots = new Set(known.filter((n) => n.parentId === null && isContainerType(n.type)).map((n) => n.id))
    const nodes = known.filter(
      (n) =>
        n.parentId === null ||
        (roots.has((n as PlacedNode).parentId as string) && isAtomType(n.type)),
    ) as PlacedNode[]
    return { version: 1, nodes }
  } catch {
    return { ...EMPTY, nodes: [] }
  }
}

/** Rect overlap in cells; touching edges is fine. */
export function collides(
  a: { x: number; y: number; cols: number; rows: number },
  b: { x: number; y: number; cols: number; rows: number },
): boolean {
  return a.x < b.x + b.cols && b.x < a.x + a.cols && a.y < b.y + b.rows && b.y < a.y + a.rows
}

/** Edge-sharing with positive overlap. Corner-only contact does not count. */
export function touches(
  a: { x: number; y: number; cols: number; rows: number },
  b: { x: number; y: number; cols: number; rows: number },
): boolean {
  const xTouch =
    (a.x + a.cols === b.x || b.x + b.cols === a.x) && a.y < b.y + b.rows && b.y < a.y + a.rows
  const yTouch =
    (a.y + a.rows === b.y || b.y + b.rows === a.y) && a.x < b.x + b.cols && b.x < a.x + a.cols
  return xTouch || yTouch
}

/** A sibling set is valid when it forms one edge-connected patch. Zero or
 * one rect is vacuously connected. */
export function isContiguous(rects: readonly { x: number; y: number; cols: number; rows: number }[]): boolean {
  if (rects.length <= 1) return true
  const seen = new Set([0])
  const queue = [0]
  while (queue.length > 0) {
    const i = queue.pop()!
    for (let j = 0; j < rects.length; j++) {
      if (!seen.has(j) && touches(rects[i], rects[j])) {
        seen.add(j)
        queue.push(j)
      }
    }
  }
  return seen.size === rects.length
}

export interface CellRect {
  x: number
  y: number
  cols: number
  rows: number
}

function isRectOk(rect: CellRect): boolean {
  if (!Number.isInteger(rect.x + rect.y + rect.cols + rect.rows)) return false
  if (rect.x < 0 || rect.y < 0 || rect.cols < 1 || rect.rows < 1) return false
  return true
}

function footprintOk(type: OSBNodeType, rect: CellRect): boolean {
  const g = OSB_REGISTRY[type].grid
  return rect.cols >= g.minCols && rect.rows >= g.minRows && rect.cols <= g.maxCols && rect.rows <= g.maxRows
}

/** Parent-local cell for a drop whose center lands at `center` (same coords
 * as the parent origin). Floored so odd-sized atoms stay integral, clamped
 * into the shell. One function owns every center-point landing. */
export function nestLocal(
  parent: { x: number; y: number; cols: number; rows: number },
  center: { x: number; y: number },
  span: { cols: number; rows: number },
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(parent.cols - span.cols, Math.floor(center.x - parent.x))),
    y: Math.max(0, Math.min(parent.rows - span.rows, Math.floor(center.y - parent.y))),
  }
}

/** Plain-language rejection for drop feedback. Every reason maps somewhere. */
export function reasonText(reason: RejectReason): string {
  switch (reason) {
    case 'unknown-type':
    case 'kind':
      return "That can't go there"
    case 'depth':
      return "That can't nest there"
    case 'integrity':
    case 'footprint':
      return "That size isn't allowed"
    case 'containment':
      return "Doesn't fit inside"
    case 'overlap':
      return 'That spot is taken'
    case 'disconnected':
      return 'Pieces must touch — no gaps'
    case 'undersize':
      return 'Too small for its contents'
  }
}
/** R2 + R3: full containment in the parent inner rect (or canvas at root)
 * plus no overlap with siblings. Parent-child containment is never a
 * collision — only siblings collide. Pass ignoreId to move a node without
 * colliding with itself. */
export function canPlace(
  nodes: PlacedNode[],
  rect: CellRect,
  parentId: string | null = null,
  ignoreId?: string,
  cols = GRID_COLS,
): boolean {
  if (!isRectOk(rect)) return false
  if (parentId === null) {
    if (rect.x + rect.cols > cols) return false
  } else {
    const parent = nodes.find((n) => n.id === parentId)
    if (!parent) return false
    if (rect.x + rect.cols > parent.cols || rect.y + rect.rows > parent.rows) return false
  }
  return !nodes.some(
    (n) => n.parentId === parentId && n.id !== ignoreId && collides(rect, n),
  )
}

/** A node with children can never itself nest elsewhere (depth guard). */
export function isLeafNode(nodes: PlacedNode[], id: string): boolean {
  return !nodes.some((n) => n.parentId === id)
}

function parentChainOk(nodes: PlacedNode[], parentId: string | null): boolean {
  if (parentId === null) return true
  const parent = nodes.find((n) => n.id === parentId)
  if (!parent || parent.parentId !== null) return false
  return isContainerType(parent.type)
}

/** Sibling rects under one parent, optionally excluding one node. */
function siblingRects(nodes: PlacedNode[], parentId: string | null, ignoreId?: string): CellRect[] {
  return nodes
    .filter((n) => n.parentId === parentId && n.id !== ignoreId)
    .map((n) => ({ x: n.x, y: n.y, cols: n.cols, rows: n.rows }))
}

export type RejectReason =
  | 'unknown-type'
  | 'kind'
  | 'depth'
  | 'integrity'
  | 'footprint'
  | 'containment'
  | 'overlap'
  | 'disconnected'
  | 'undersize'

/** The single gate for every insert/move (R1–R4 + contiguity). Returns null
 * when the placement is valid, otherwise the reason it is not placeable:
 *
 * R1 KIND — containers live at root; only atoms nest, and only in
 *    containers. Collection kinds never sit on the canvas.
 * R2 CONTAINMENT — the full rect sits inside the parent inner rect.
 * R3 EXCLUSIVITY — siblings never overlap (touching edges is fine).
 * R4 INTEGRITY — integer coords, ≥ 1x1, within the type's min/max
 *    footprint. The box is the component: no zero-size or off-grid rects.
 *
 * Plus contiguity (§5): the resulting sibling set must stay one
 * edge-connected patch — no gaps, no islands.
 */
export function canInsertReason(
  nodes: PlacedNode[],
  type: OSBNodeType,
  rect: CellRect,
  parentId: string | null = null,
  ignoreId?: string,
): RejectReason | null {
  if (!(type in OSB_REGISTRY)) return 'unknown-type'
  if (!isRectOk(rect)) return 'integrity'
  if (!footprintOk(type, rect)) return 'footprint'
  if (parentId === null) {
    if (!isAtomType(type) && !isContainerType(type)) return 'kind'
  } else {
    const parent = nodes.find((n) => n.id === parentId)
    if (!parent) return 'depth'
    if (!parentChainOk(nodes, parentId)) return 'depth'
    if (!canContain(parent.type, type)) return 'kind'
    // Moving a node that already has children into a container is depth-2.
    if (ignoreId && !isLeafNode(nodes, ignoreId)) return 'depth'
  }
  if (!canPlace(nodes, rect, parentId, ignoreId)) {
    // Distinguish containment from overlap for a useful reason.
    if (parentId === null) {
      if (rect.x + rect.cols > GRID_COLS) return 'containment'
    } else {
      const parent = nodes.find((n) => n.id === parentId)!
      if (rect.x + rect.cols > parent.cols || rect.y + rect.rows > parent.rows) return 'containment'
    }
    return 'overlap'
  }
  if (!isContiguous([...siblingRects(nodes, parentId, ignoreId), rect])) return 'disconnected'
  return null
}

export function canInsert(
  nodes: PlacedNode[],
  type: OSBNodeType,
  rect: CellRect,
  parentId: string | null = null,
  ignoreId?: string,
): boolean {
  return canInsertReason(nodes, type, rect, parentId, ignoreId) === null
}

export { canContain }

/** Children bounding box + padding = container floor (no undersize). */
export function containerFloor(
  nodes: PlacedNode[],
  parentId: string,
): { cols: number; rows: number } {
  const kids = nodes.filter((n) => n.parentId === parentId)
  if (kids.length === 0) return { cols: 0, rows: 0 }
  const cols = Math.max(...kids.map((k) => k.x + k.cols)) + CONTAINER_PAD
  const rows = Math.max(...kids.map((k) => k.y + k.rows)) + CONTAINER_PAD
  return { cols, rows }
}

/** Container still fits its children after a resize/remove. */
export function containerFitsKids(
  nodes: PlacedNode[],
  parent: Pick<PlacedNode, 'id' | 'cols' | 'rows'>,
  ignoreId?: string,
): boolean {
  const kids = nodes.filter((n) => n.parentId === parent.id && n.id !== ignoreId)
  return kids.every((k) => k.x + k.cols <= parent.cols && k.y + k.rows <= parent.rows)
}

export type DocResult = { ok: true; doc: CanvasDoc } | { ok: false; reason: RejectReason }

/**
 * One document path for insert/move/remove. Move is fungible: reposition
 * within one parent, reparent across parents, or take out to root are the
 * same call — only parentId + rect differ.
 */
export function insertNode(doc: CanvasDoc, node: PlacedNode): DocResult {
  const reason = canInsertReason(doc.nodes, node.type, node, node.parentId ?? null)
  if (reason) return { ok: false, reason }
  return { ok: true, doc: { ...doc, nodes: [...doc.nodes, node] } }
}

export function moveNode(
  doc: CanvasDoc,
  id: string,
  rect: CellRect,
  parentId: string | null,
): DocResult {
  const node = doc.nodes.find((n) => n.id === id)
  if (!node) return { ok: false, reason: 'unknown-type' }
  const reason = canInsertReason(doc.nodes, node.type, rect, parentId, id)
  if (reason) return { ok: false, reason }
  // Leaving the old sibling set must not strand it as islands.
  if (node.parentId !== parentId && node.parentId !== null) {
    if (!isContiguous(siblingRects(doc.nodes, node.parentId, id))) {
      return { ok: false, reason: 'disconnected' }
    }
  }
  // Growing/moving a container over siblings is still an overlap (no
  // absorb, already rejected above); shrinking it under its own children
  // is rejected here.
  if (!isLeafNode(doc.nodes, id)) {
    if (!containerFitsKids(doc.nodes, { id, cols: rect.cols, rows: rect.rows })) {
      return { ok: false, reason: 'undersize' }
    }
  }
  const nodes = doc.nodes.map((n) =>
    n.id === id ? { ...n, parentId, ...rect } : n,
  )
  return { ok: true, doc: { ...doc, nodes } }
}

/**
 * Atomic pattern insert: a container at a root rect plus its pre-arranged
 * atoms. Either the whole composition lands or nothing does.
 */
export function insertPattern(
  doc: CanvasDoc,
  patternKey: string,
  containerId: string,
  rect: CellRect,
  childIds: string[],
): DocResult {
  const pattern = OSB_PATTERNS[patternKey]
  if (!pattern) return { ok: false, reason: 'unknown-type' }
  if (childIds.length !== pattern.children.length) return { ok: false, reason: 'integrity' }
  const containerRect = { ...rect, cols: pattern.containerCols, rows: pattern.containerRows }
  const reason = canInsertReason(doc.nodes, 'card', containerRect, null)
  if (reason) return { ok: false, reason }
  const kids: PlacedNode[] = pattern.children.map((c, i) => ({
    id: childIds[i],
    type: c.type,
    config: { ...OSB_REGISTRY[c.type].defaults, ...c.config },
    parentId: containerId,
    x: c.x,
    y: c.y,
    cols: c.cols,
    rows: c.rows,
  }))
  // Children are pattern-authored, but verify anyway: containment,
  // exclusivity, footprints, and contiguity inside the new shell.
  const kidRects = kids.map((k) => ({ x: k.x, y: k.y, cols: k.cols, rows: k.rows }))
  for (const k of kids) {
    if (!isRectOk(k) || !footprintOk(k.type, k)) return { ok: false, reason: 'footprint' }
    if (k.x + k.cols > containerRect.cols || k.y + k.rows > containerRect.rows) {
      return { ok: false, reason: 'containment' }
    }
  }
  for (let i = 0; i < kids.length; i++) {
    for (let j = i + 1; j < kids.length; j++) {
      if (collides(kids[i], kids[j])) return { ok: false, reason: 'overlap' }
    }
  }
  if (!isContiguous(kidRects)) return { ok: false, reason: 'disconnected' }
  const container: PlacedNode = {
    id: containerId,
    type: 'card',
    config: { ...OSB_REGISTRY.card.defaults, ...pattern.containerConfig },
    parentId: null,
    ...containerRect,
  }
  return { ok: true, doc: { ...doc, nodes: [...doc.nodes, container, ...kids] } }
}

export function removeNode(doc: CanvasDoc, id: string): CanvasDoc {
  const ids = new Set([id])
  // Depth-1 cascade: removing a container removes its children.
  for (const n of doc.nodes) {
    if (n.parentId && ids.has(n.parentId)) ids.add(n.id)
  }
  return { ...doc, nodes: doc.nodes.filter((n) => !ids.has(n.id)) }
}

/** Center-point hit test: at most one container candidate (depth 1). */
export function nestTargetAt(
  nodes: PlacedNode[],
  point: { x: number; y: number },
): PlacedNode | null {
  const roots = nodes.filter((n) => n.parentId === null)
  return (
    roots.find(
      (n) =>
        isContainerType(n.type) &&
        point.x >= n.x &&
        point.x < n.x + n.cols &&
        point.y >= n.y &&
        point.y < n.y + n.rows,
    ) ?? null
  )
}

export interface DocValidation {
  ok: boolean
  errors: string[]
}

/**
 * Whole-document validator: R1–R4, container floors, and contiguity for
 * every sibling set (root + each container). Edit-time gates keep docs
 * valid; this is the file-level backstop for site.json round-trips.
 */
export function validateDoc(doc: CanvasDoc): DocValidation {
  const errors: string[] = []
  if (doc.version !== 1 || !Array.isArray(doc.nodes)) {
    return { ok: false, errors: ['document must be a version-1 canvas doc'] }
  }
  const byId = new Map(doc.nodes.map((n) => [n.id, n]))
  for (const n of doc.nodes) {
    if (!(n.type in OSB_REGISTRY)) {
      errors.push(`node ${n.id}: unknown type ${JSON.stringify((n as { type: unknown }).type)}`)
      continue
    }
    if (!isRectOk(n)) errors.push(`node ${n.id}: rect not integral or too small`)
    else if (!footprintOk(n.type, n)) errors.push(`node ${n.id}: footprint outside min/max`)
    if (n.parentId === null) {
      if (!isAtomType(n.type) && !isContainerType(n.type)) errors.push(`node ${n.id}: kind cannot sit at root`)
      if (n.x + n.cols > GRID_COLS) errors.push(`node ${n.id}: overflows canvas`)
    } else {
      const parent = byId.get(n.parentId)
      if (!parent) errors.push(`node ${n.id}: missing parent`)
      else {
        if (parent.parentId !== null || !isContainerType(parent.type)) {
          errors.push(`node ${n.id}: parent must be a root container`)
        }
        if (!canContain(parent.type, n.type)) errors.push(`node ${n.id}: kind cannot nest in ${parent.type}`)
        if (n.x + n.cols > parent.cols || n.y + n.rows > parent.rows) {
          errors.push(`node ${n.id}: overflows parent`)
        }
      }
    }
  }
  // Sibling overlap, floors, and contiguity per sibling set.
  const sets = new Map<string | null, PlacedNode[]>()
  for (const n of doc.nodes) {
    const k = n.parentId ?? null
    if (!sets.has(k)) sets.set(k, [])
    sets.get(k)!.push(n)
  }
  for (const [parentId, set] of sets) {
    for (let i = 0; i < set.length; i++) {
      for (let j = i + 1; j < set.length; j++) {
        if (collides(set[i], set[j])) errors.push(`nodes ${set[i].id} and ${set[j].id} overlap`)
      }
    }
    if (!isContiguous(set)) {
      errors.push(
        parentId === null ? 'root nodes are scattered (must touch)' : `children of ${parentId} are scattered (must touch)`,
      )
    }
    if (parentId !== null) {
      const parent = byId.get(parentId)
      if (parent && !containerFitsKids(doc.nodes, parent)) {
        errors.push(`container ${parentId} undersizes its children`)
      }
    }
  }
  return { ok: errors.length === 0, errors }
}
