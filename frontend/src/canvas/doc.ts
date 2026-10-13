import { OSB_PATTERNS } from '../osb/patterns'
import { OSB_REGISTRY, canContain, isAtomType, isContainerType, isOverlayType, isTriggerType, overlayNoun, type OSBNodeType } from '../osb/registry'
import { CONTAINER_PAD, overlayTargetOf, type OSBTheme } from '../osb/types'
import type { SiteMeta } from '../site/types'
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
  /** Overlays live beside the grid, never in it: no overlap, contiguity, or
   * RGL layout ever sees them. One store for every overlay kind (popup,
   * drawer, …) — kind is data, not a separate array. */
  overlays?: OverlayDoc[]
  /** Global light/dark for the whole site, not a per-node setting. Old docs
   * load without the key (see themeOf). */
  theme?: OSBTheme
  /** Global SEO/social metadata, written by Site Settings and read by
   * siteObject when building the manifest. Optional; old docs lack it. */
  meta?: SiteMeta
}

/** Overlay kinds. Registry keys ('modal', 'drawer') — a new kind is a new
 * registry entry, never a new store. */
export type OverlayType = 'modal' | 'drawer'

/** An overlay shell: footprint plus free-form atom children. One shape for
 * every kind — every op below is generic over it. */
export interface OverlayDoc {
  id: string
  overlayType: OverlayType
  config: Record<string, unknown>
  cols: number
  rows: number
  /** parentId of every child is this shell's id. Atoms only — never overlays. */
  children: PlacedNode[]
}

/** The shell geometry the overlay gate reads: footprint + atom children. */
export type OverlayShell = Pick<OverlayDoc, 'cols' | 'rows' | 'children'>

/** A fresh, empty canvas. Docs are never mutated, so sharing is safe. */
export const EMPTY_DOC: CanvasDoc = { version: 1, nodes: [], overlays: [], theme: 'light' }

/** Every overlay shell on the doc. */
export const overlaysOf = (doc: CanvasDoc): OverlayDoc[] => doc.overlays ?? []

/** The site theme (defaults to light). */
export const themeOf = (doc: CanvasDoc): OSBTheme => (doc.theme === 'dark' ? 'dark' : 'light')

/** A rectangle in grid cells: origin + footprint. */
export type CellRect = { x: number; y: number; cols: number; rows: number }

export const storageKey = (projectName: string): string => `osb.project.${projectName}`

export function loadDoc(key: string): CanvasDoc {
  try {
    const doc = JSON.parse(localStorage.getItem(key) ?? '') as CanvasDoc | null
    if (!doc || doc.version !== 1 || !Array.isArray(doc.nodes)) return EMPTY_DOC
    // Drop unknown types (removed components), then prune orphans: children
    // whose parent is missing, dropped, misplaced, or nested too deep.
    // Depth follows the gate (root > container > atom); geometry is validated
    // on demand. Kept parents resolve breadth-first so orphans of dropped
    // parents never survive.
    const known = doc.nodes.filter((n) => n && typeof n.type === 'string' && n.type in OSB_REGISTRY)
    const kept = new Map<string, PlacedNode>()
    const keptDepth = new Map<string, number>()
    for (const n of known) {
      if (n.parentId === null && !kept.has(n.id)) {
        kept.set(n.id, n)
        keptDepth.set(n.id, 0)
      }
    }
    let grew = true
    while (grew) {
      grew = false
      for (const n of known) {
        if (kept.has(n.id) || n.parentId === null) continue
        const parent = kept.get(n.parentId)
        if (!parent || !canContain(parent.type, n.type)) continue
        const d = keptDepth.get(n.parentId)! + 1
        if (d > 2) continue
        if (isContainerType(n.type)) continue
        kept.set(n.id, n)
        keptDepth.set(n.id, d)
        grew = true
      }
    }
    return {
      version: 1,
      nodes: known.filter((n) => kept.has(n.id)),
      overlays: pruneOverlays(overlaysOf(doc)),
      theme: themeOf(doc),
      // Untrusted storage: keep meta only when it is a plain object.
      meta: doc.meta && typeof doc.meta === 'object' ? doc.meta : undefined,
    }
  } catch {
    return EMPTY_DOC
  }
}

/** Keep well-formed overlays: string ids (first wins), known overlay kinds,
 * atom children that belong to their own shell. Geometry is validated on
 * demand, not dropped. */
function pruneOverlays(raw: OverlayDoc[]): OverlayDoc[] {
  const seen = new Set<string>()
  const out: OverlayDoc[] = []
  for (const m of raw) {
    if (!m || typeof m.id !== 'string' || m.id.length === 0 || seen.has(m.id)) continue
    if (!isOverlayType(m.overlayType)) continue
    seen.add(m.id)
    const children = Array.isArray(m.children)
      ? m.children.filter(
          (k) => k && typeof k.type === 'string' && k.type in OSB_REGISTRY && isAtomType(k.type) && k.parentId === m.id,
        )
      : []
    out.push({
      id: m.id,
      overlayType: m.overlayType,
      config: m.config && typeof m.config === 'object' ? m.config : {},
      cols: m.cols,
      rows: m.rows,
      children,
    })
  }
  return out
}

/** Cell overlap; touching edges is fine. */
export const collides = (a: CellRect, b: CellRect): boolean =>
  a.x < b.x + b.cols && b.x < a.x + a.cols && a.y < b.y + b.rows && b.y < a.y + a.rows

/** Edge-sharing with positive overlap. Corner-only contact does not count. */
export const touches = (a: CellRect, b: CellRect): boolean =>
  ((a.x + a.cols === b.x || b.x + b.cols === a.x) && a.y < b.y + b.rows && b.y < a.y + a.rows) ||
  ((a.y + a.rows === b.y || b.y + b.rows === a.y) && a.x < b.x + b.cols && b.x < a.x + a.cols)

/** A sibling set is valid when it forms one edge-connected patch. Zero or
 * one rect is vacuously connected. */
export function isContiguous(rects: readonly CellRect[]): boolean {
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

function isRectOk(rect: CellRect): boolean {
  if (!Number.isInteger(rect.x + rect.y + rect.cols + rect.rows)) return false
  if (rect.x < 0 || rect.y < 0 || rect.cols < 1 || rect.rows < 1) return false
  return true
}

function footprintOk(type: OSBNodeType, rect: CellRect): boolean {
  const g = OSB_REGISTRY[type].grid
  return rect.cols >= g.minCols && rect.rows >= g.minRows && rect.cols <= g.maxCols && rect.rows <= g.maxRows
}

/** THE parent-local landing rule: floor to a whole cell, then keep the whole
 * footprint inside the shell. Every "where does it sit inside its parent"
 * answer — pointer or centre-point — comes from here. */
const clampInto = (
  x: number,
  y: number,
  parent: { cols: number; rows: number },
  span: { cols: number; rows: number },
): { x: number; y: number } => ({
  x: Math.max(0, Math.min(parent.cols - span.cols, Math.floor(x))),
  y: Math.max(0, Math.min(parent.rows - span.rows, Math.floor(y))),
})

/** Parent-local cell for a drop whose center lands at `center`. */
export function nestLocal(
  parent: { x: number; y: number; cols: number; rows: number },
  center: { x: number; y: number },
  span: { cols: number; rows: number },
): { x: number; y: number } {
  return clampInto(center.x - parent.x, center.y - parent.y, parent, span)
}

/** Plain-language rejection for drop feedback and the checks panel.
 * Exhaustive: a new reason will not compile until it says something. */
export const REASON_TEXT: Record<RejectReason, string> = {
  'unknown-type': "That can't go there",
  kind: "That can't go there",
  depth: "That can't nest there",
  integrity: "That size isn't allowed",
  footprint: "That size isn't allowed",
  containment: "Doesn't fit inside",
  overlap: 'That spot is taken',
  disconnected: 'Pieces must touch — no gaps',
  undersize: 'Too small for its contents',
}

export const reasonText = (reason: RejectReason): string => REASON_TEXT[reason]

/** Ids of the siblings under `parentId` that collide with `rect` — the one
 * definition of "these fight over the same cells", shared by the gate and by
 * the red-highlight query. */
function overlapIds(nodes: PlacedNode[], rect: CellRect, parentId: string | null, ignoreId?: string | null): string[] {
  return nodes.filter((n) => n.parentId === parentId && n.id !== ignoreId && collides(rect, n)).map((n) => n.id)
}

/** Direct children of `parentId` in a node list. `ordered` sorts them into
 * flow order (top→bottom, left→right). THE answer to "what sits inside this
 * node", shared by the published site object and the generated page. */
export function childrenOf(nodes: readonly PlacedNode[], parentId: string, ordered = false): PlacedNode[] {
  const kids = nodes.filter((n) => n.parentId === parentId)
  return ordered ? [...kids].sort((a, b) => a.y - b.y || a.x - b.x) : kids
}

/** A node with children can never itself nest elsewhere (depth guard). */
export const isChildless = (nodes: PlacedNode[], id: string): boolean => !nodes.some((n) => n.parentId === id)

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

/** Depth of a node by parent chain (roots are 0). Cycle-safe: -1 when the
 * chain loops or dangles. Shared by the gate, the loader, and the router so
 * "nothing nests twice" lives in exactly one place. */
export function depthOf(nodes: readonly PlacedNode[], id: string | null): number {
  if (id === null) return -1
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const seen = new Set<string>()
  let cur = byId.get(id)
  let d = 0
  while (cur && cur.parentId !== null) {
    if (seen.has(cur.parentId)) return -1
    seen.add(cur.parentId)
    cur = byId.get(cur.parentId)
    if (!cur) return -1
    d += 1
  }
  return cur ? d : -1
}

/** A move's whole subtree still fits the depth rule at its new home: no
 * cycles, everything at depth ≤ 2 (root > container > atom). */
function subtreeFits(nodes: PlacedNode[], id: string, parentId: string | null): boolean {
  if (parentId !== null) {
    const seen = new Set<string>([id])
    let cur: PlacedNode | undefined = nodes.find((n) => n.id === parentId)
    while (cur) {
      if (seen.has(cur.id)) return false
      seen.add(cur.id)
      if (cur.parentId === null) break
      cur = nodes.find((n) => n.id === cur!.parentId)
      if (!cur) return false
    }
    if (!cur) return false
  }
  const base = parentId === null ? 0 : depthOf(nodes, parentId) + 1
  if (base < 0) return false
  const kids = new Map<string, PlacedNode[]>()
  for (const n of nodes) {
    if (n.parentId === null || n.id === id) continue
    const list = kids.get(n.parentId) ?? []
    list.push(n)
    kids.set(n.parentId, list)
  }
  const queue: { pid: string; d: number }[] = [{ pid: id, d: base }]
  if (base > 2) return false
  while (queue.length > 0) {
    const { pid, d } = queue.pop()!
    for (const k of kids.get(pid) ?? []) {
      const kd = d + 1
      if (kd > 2) return false
      queue.push({ pid: k.id, d: kd })
    }
  }
  return true
}

/** The single gate for every insert/move (R1–R4). Touch (contiguity) is NOT
 * enforced here — pieces move freely, and Validate checks touch on demand.
 * Depth is global: atoms live at depth ≤ 2, containers at depth 0.
 * Returns null when valid, else the reason. */
export function canInsertReason(
  nodes: PlacedNode[],
  type: OSBNodeType,
  rect: CellRect,
  parentId: string | null = null,
  ignoreId?: string,
): RejectReason | null {
  if (!(type in OSB_REGISTRY)) return 'unknown-type'
  // Overlays never enter through node ops — only createOverlay makes one.
  if (isOverlayType(type)) return 'kind'
  if (!isRectOk(rect)) return 'integrity'
  if (!footprintOk(type, rect)) return 'footprint'
  if (parentId === null) {
    if (!isAtomType(type) && !isContainerType(type)) return 'kind'
    if (rect.x + rect.cols > GRID_COLS) return 'containment'
  } else {
    const parent = nodes.find((n) => n.id === parentId)
    // Atoms and overlays never hold children; containers only at the root.
    if (!parent || isAtomType(parent.type) || isOverlayType(parent.type)) return 'depth'
    if (isContainerType(parent.type) && parent.parentId !== null) return 'depth'
    if (!canContain(parent.type, type)) return 'kind'
    const childDepth = depthOf(nodes, parent.id) + 1
    if (childDepth < 0 || childDepth > 2) return 'depth'
    if (isContainerType(type)) return 'depth'
    if (ignoreId && !subtreeFits(nodes, ignoreId, parentId)) return 'depth'
    if (rect.x + rect.cols > parent.cols || rect.y + rect.rows > parent.rows) return 'containment'
  }
  return overlapIds(nodes, rect, parentId, ignoreId).length > 0 ? 'overlap' : null
}

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
 * The single drag vocabulary: every gesture funnels through one ref of this
 * shape, so the editor never tracks parallel drag states that can drift.
 */
export type DragPayload =
  | { kind: 'palette'; type: OSBNodeType }
  | { kind: 'pattern'; pattern: string }
  | { kind: 'move'; id: string }

/** Dragged footprint in cells, from the payload + current nodes. */
export function dragSpan(
  drag: DragPayload | null,
  nodes: PlacedNode[],
): { cols: number; rows: number } | null {
  if (!drag) return null
  if (drag.kind === 'move') {
    const n = nodes.find((x) => x.id === drag.id)
    return n ? { cols: n.cols, rows: n.rows } : null
  }
  if (drag.kind === 'pattern') {
    const p = OSB_PATTERNS[drag.pattern]
    return p ? { cols: p.containerCols, rows: p.containerRows } : null
  }
  const g = OSB_REGISTRY[drag.type].grid
  return { cols: g.cols, rows: g.rows }
}

/**
 * One document path for insert/move/remove. Move is fungible: reposition,
 * reparent, and take-out-to-root differ only in parentId + rect.
 */
export function insertNode(doc: CanvasDoc, node: PlacedNode): DocResult {
  const reason = canInsertReason(doc.nodes, node.type, node, node.parentId ?? null)
  if (reason) return { ok: false, reason }
  return { ok: true, doc: { ...doc, nodes: [...doc.nodes, node] } }
}

/** Shallow-merge one node's config — the one path non-spatial props take. */
export function updateNodeConfig(doc: CanvasDoc, id: string, patch: Record<string, unknown>): CanvasDoc {
  return { ...doc, nodes: doc.nodes.map((n) => (n.id === id ? { ...n, config: { ...n.config, ...patch } } : n)) }
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
  // Growing/moving a container over siblings is still an overlap (rejected
  // above); shrinking it under its own children is rejected here.
  if (!isChildless(doc.nodes, id) && !containerFitsKids(doc.nodes, { id, cols: rect.cols, rows: rect.rows })) {
    return { ok: false, reason: 'undersize' }
  }
  const nodes = doc.nodes.map((n) => (n.id === id ? { ...n, parentId, ...rect } : n))
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
  const container: PlacedNode = {
    id: containerId,
    type: 'card',
    config: { ...OSB_REGISTRY.card.defaults, ...pattern.containerConfig },
    parentId: null,
    ...containerRect,
  }
  // Children are pattern-authored, but still run through the one gate:
  // footprint, kind, containment and exclusivity inside the new shell.
  const withShell = [...doc.nodes, container]
  for (const k of kids) {
    const reason = canInsertReason(withShell, k.type, k, containerId)
    if (reason) return { ok: false, reason }
  }
  if (!isContiguous(kids)) return { ok: false, reason: 'disconnected' }
  return { ok: true, doc: { ...doc, nodes: [...doc.nodes, container, ...kids] } }
}

export function removeNode(doc: CanvasDoc, id: string): CanvasDoc {
  const ids = new Set([id])
  // Transitive cascade: removing a shell removes everything under it, at
  // any depth.
  let grew = true
  while (grew) {
    grew = false
    for (const n of doc.nodes) {
      if (n.parentId && ids.has(n.parentId) && !ids.has(n.id)) {
        ids.add(n.id)
        grew = true
      }
    }
  }
  return { ...doc, nodes: doc.nodes.filter((n) => !ids.has(n.id)) }
}

// ---------------------------------------------------------------------------
// Overlays. One store, one gate, one ops set. Kind is data (overlayType),
// never a separate array or a parallel function family.
// ---------------------------------------------------------------------------

/** THE overlay landing rule: atoms only (never overlay-in-overlay), inside
 * the shell, on whole cells, never overlapping a sibling. */
export function canPlaceOverlayChild(
  shell: OverlayShell,
  type: string,
  rect: CellRect,
  ignoreId?: string,
): RejectReason | null {
  if (!(type in OSB_REGISTRY)) return 'unknown-type'
  if (!isAtomType(type)) return 'kind'
  if (!isRectOk(rect)) return 'integrity'
  if (!footprintOk(type as OSBNodeType, rect)) return 'footprint'
  if (rect.x + rect.cols > shell.cols || rect.y + rect.rows > shell.rows) return 'containment'
  const hit = shell.children.some((k) => k.id !== ignoreId && collides(rect, k))
  return hit ? 'overlap' : null
}

/** One overlay by id — the lookup every overlay op shares. */
export const findOverlay = (doc: CanvasDoc, id: string): OverlayDoc | undefined =>
  overlaysOf(doc).find((m) => m.id === id)

/** Every overlay mutation funnels here: replace one shell by id, untouched
 * siblings preserved. */
const mapOverlay = (doc: CanvasDoc, id: string, fn: (m: OverlayDoc) => OverlayDoc): CanvasDoc => ({
  ...doc,
  overlays: overlaysOf(doc).map((m) => (m.id === id ? fn(m) : m)),
})

/** Append a shell. Children arrive via insertOverlayChild. */
export function createOverlay(doc: CanvasDoc, overlay: OverlayDoc): CanvasDoc {
  return { ...doc, overlays: [...overlaysOf(doc), overlay] }
}

export function updateOverlayConfig(doc: CanvasDoc, id: string, config: Record<string, unknown>): CanvasDoc {
  return mapOverlay(doc, id, (m) => ({ ...m, config }))
}

/** Resize the shell: same floor rule as containers (never under children).
 * Grid limits come from the registry entry for the shell's own kind. */
export function resizeOverlay(doc: CanvasDoc, id: string, cols: number, rows: number): DocResult {
  const shell = findOverlay(doc, id)
  if (!shell) return { ok: false, reason: 'unknown-type' }
  const g = OSB_REGISTRY[shell.overlayType].grid
  if (!Number.isInteger(cols + rows) || cols < g.minCols || rows < g.minRows || cols > g.maxCols || rows > g.maxRows) {
    return { ok: false, reason: 'footprint' }
  }
  if (!containerFitsKids(shell.children, { id, cols, rows })) return { ok: false, reason: 'undersize' }
  return { ok: true, doc: mapOverlay(doc, id, (m) => ({ ...m, cols, rows })) }
}

/** Removing an overlay unlinks every button that opened it (canvas + sibling
 * overlay kids, which are scrubbed defensively though validation forbids). */
export function removeOverlay(doc: CanvasDoc, id: string): CanvasDoc {
  const scrub = (n: PlacedNode): PlacedNode =>
    overlayTargetOf(n.config) === id ? { ...n, config: { ...n.config, targetId: '' } } : n
  return {
    ...doc,
    nodes: doc.nodes.map(scrub),
    overlays: overlaysOf(doc)
      .filter((m) => m.id !== id)
      .map((m) => ({ ...m, children: m.children.map(scrub) })),
  }
}

export function insertOverlayChild(doc: CanvasDoc, overlayId: string, child: PlacedNode): DocResult {
  const shell = findOverlay(doc, overlayId)
  if (!shell) return { ok: false, reason: 'unknown-type' }
  const reason = canPlaceOverlayChild(shell, child.type, child)
  if (reason) return { ok: false, reason }
  return { ok: true, doc: mapOverlay(doc, overlayId, (m) => ({ ...m, children: [...m.children, child] })) }
}

export function moveOverlayChild(doc: CanvasDoc, overlayId: string, id: string, rect: CellRect): DocResult {
  const shell = findOverlay(doc, overlayId)
  const child = shell?.children.find((k) => k.id === id)
  if (!shell || !child) return { ok: false, reason: 'unknown-type' }
  const reason = canPlaceOverlayChild(shell, child.type, rect, id)
  if (reason) return { ok: false, reason }
  return {
    ok: true,
    doc: mapOverlay(doc, overlayId, (m) => ({
      ...m,
      children: m.children.map((k) => (k.id === id ? { ...k, ...rect } : k)),
    })),
  }
}

export function removeOverlayChild(doc: CanvasDoc, overlayId: string, id: string): CanvasDoc {
  return mapOverlay(doc, overlayId, (m) => ({ ...m, children: m.children.filter((k) => k.id !== id) }))
}

export function updateOverlayChildConfig(
  doc: CanvasDoc,
  overlayId: string,
  id: string,
  config: Record<string, unknown>,
): CanvasDoc {
  return mapOverlay(doc, overlayId, (m) => ({
    ...m,
    children: m.children.map((k) => (k.id === id ? { ...k, config } : k)),
  }))
}

/** Absolute top-left of a node in root cells: the node's own cell plus its
 * ancestor chain (child coords are parent-local, so a root's are already
 * absolute). Cycle-safe: null when the chain loops or dangles. */
export function absoluteOrigin(nodes: readonly PlacedNode[], id: string): { x: number; y: number } | null {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const start = byId.get(id)
  if (!start) return null
  const seen = new Set<string>()
  let cur = start
  let x = start.x
  let y = start.y
  while (cur.parentId !== null) {
    if (seen.has(cur.parentId)) return null
    seen.add(cur.parentId)
    const parent = byId.get(cur.parentId)
    if (!parent) return null
    x += parent.x
    y += parent.y
    cur = parent
  }
  return { x, y }
}

/** Center-point hit test: the deepest container holding the point.
 * Roots-only docs behave exactly as before (deepest ties keep doc order). */
export function nestTargetAt(
  nodes: PlacedNode[],
  point: { x: number; y: number },
): PlacedNode | null {
  let best: PlacedNode | null = null
  let bestDepth = -1
  for (const n of nodes) {
    if (!isContainerType(n.type)) continue
    const o = absoluteOrigin(nodes, n.id)
    if (!o) continue
    if (point.x >= o.x && point.x < o.x + n.cols && point.y >= o.y && point.y < o.y + n.rows) {
      const d = depthOf(nodes, n.id)
      if (d > bestDepth) {
        best = n
        bestDepth = d
      }
    }
  }
  return best
}

/**
 * Where a dragged rect lands: nested as a child when its center sits in an
 * accepting shell, otherwise at root. Pure routing — the caller still
 * runs the result through insertNode/moveNode (the gate). Nested shells
 * route in absolute cells, then convert back to parent-local.
 */
function resolveLanding(
  nodes: PlacedNode[],
  type: OSBNodeType,
  rect: CellRect,
  ignoreId?: string,
): { parentId: string | null; rect: CellRect } {
  const span = { cols: rect.cols, rows: rect.rows }
  const center = { x: rect.x + span.cols / 2, y: rect.y + span.rows / 2 }
  const target = nestTargetAt(nodes, center)
  if (target && target.id !== ignoreId && canContain(target.type, type)) {
    const o = absoluteOrigin(nodes, target.id) ?? { x: target.x, y: target.y }
    const local = nestLocal({ ...target, x: o.x, y: o.y }, center, span)
    return { parentId: target.id, rect: { ...local, ...span } }
  }
  return { parentId: null, rect }
}

/** Where an existing node's dragged rect lands. */
export function resolveDrop(
  nodes: PlacedNode[],
  id: string,
  rect: CellRect,
): { parentId: string | null; rect: CellRect } | null {
  const node = nodes.find((n) => n.id === id)
  return node ? resolveLanding(nodes, node.type, rect, id) : null
}

/** Where a fresh palette rect lands: same center-point rule as resolveDrop. */
export function resolveInsert(
  nodes: PlacedNode[],
  type: OSBNodeType,
  rect: CellRect,
): { parentId: string | null; rect: CellRect } {
  return resolveLanding(nodes, type, rect)
}

/**
 * Who turns red while a footprint is dragged: the siblings it would overlap
 * at the resolved target, or the container itself when the kind rule refuses
 * the dragged type. Pure and unit-tested.
 */
export function conflictIds(
  nodes: PlacedNode[],
  selfId: string | null,
  type: string,
  rect: CellRect,
  parentId: string | null,
): string[] {
  if (parentId === null) return overlapIds(nodes, rect, null, selfId)
  const parent = nodes.find((n) => n.id === parentId)
  if (!parent) return []
  return canContain(parent.type, type) ? overlapIds(nodes, rect, parentId, selfId) : [parentId]
}

/** Parent-local cell for a pointer position over a container (HTML5 drops
 * and hover ghosts share this math). Pure and unit-tested. */
export function eventCell(
  clientX: number,
  clientY: number,
  box: { left: number; top: number; width: number; height: number },
  parent: { cols: number; rows: number },
  span: { cols: number; rows: number },
): { x: number; y: number } {
  const fx = (clientX - box.left) / Math.max(1, box.width)
  const fy = (clientY - box.top) / Math.max(1, box.height)
  return clampInto(fx * parent.cols, fy * parent.rows, parent, span)
}

export interface DocValidation {
  ok: boolean
  errors: string[]
}

/**
 * Whole-document validator. Per node it re-runs THE gate (footprint,
 * containment, kind, exclusivity) instead of restating those rules; the only
 * checks it adds are the ones that need the whole document: known types,
 * connected parents, one edge-connected patch per sibling set, and container
 * floors. Edit-time gates keep docs valid — this is the file-level backstop
 * for site.json round-trips.
 */
export function validateDoc(doc: CanvasDoc): DocValidation {
  if (doc.version !== 1 || !Array.isArray(doc.nodes)) {
    return { ok: false, errors: ['document must be a version-1 canvas doc'] }
  }
  const errors: string[] = []
  // Messages name the component, never its id: a uuid tells a user nothing,
  // whereas "Card" narrows it down the same way for them. An unknown type has
  // no name to show, so it gets a plain-language fallback.
  const nameOf = (type: string): string => (type in OSB_REGISTRY ? OSB_REGISTRY[type as OSBNodeType].name : 'Piece')
  const at = (type: string, msg: string) => errors.push(`${nameOf(type)}: ${msg}`)
  const byId = new Map(doc.nodes.map((n) => [n.id, n]))
  for (const n of doc.nodes) {
    if (!(n.type in OSB_REGISTRY)) {
      errors.push(`A piece has an unknown type ${JSON.stringify((n as { type: unknown }).type)}`)
      continue
    }
    if (n.parentId !== null && !byId.has(n.parentId)) at(n.type, 'is missing its parent')
    // Overlaps are reported once per pair below, where both names read well.
    const reason = canInsertReason(doc.nodes, n.type, n, n.parentId, n.id)
    if (reason && reason !== 'overlap') at(n.type, reasonText(reason))
  }
  // Sibling overlap pairs, contiguity, and container floors per set.
  const sets = new Map<string | null, PlacedNode[]>()
  for (const n of doc.nodes) sets.set(n.parentId ?? null, [...(sets.get(n.parentId ?? null) ?? []), n])
  for (const [parentId, set] of sets) {
    for (let i = 0; i < set.length; i++)
      for (let j = i + 1; j < set.length; j++)
        if (collides(set[i], set[j])) errors.push(`${nameOf(set[i].type)} and ${nameOf(set[j].type)} overlap`)
    if (!isContiguous(set)) {
      errors.push(parentId === null ? 'Page pieces are scattered (must touch)' : `${nameOf(byId.get(parentId)?.type ?? '')} pieces are scattered (must touch)`)
    }
    const parent = parentId === null ? null : byId.get(parentId)
    if (parent && !containerFitsKids(doc.nodes, parent)) {
      errors.push(`${nameOf(parent.type)} is too small for its contents`)
    }
  }
  // Overlays: same whole-document backstop as nodes — shell footprint,
  // child gates, pairwise overlaps, one connected patch, and trigger
  // integrity. One loop for every kind; labels and grid limits come from the
  // shell's own registry entry, never a per-kind map.
  const overlayIds = new Set<string>()
  for (const m of overlaysOf(doc)) {
    const label = overlayNoun(m.overlayType)
    if (typeof m.id !== 'string' || m.id.length === 0 || overlayIds.has(m.id)) {
      errors.push(`${label} has a bad or duplicate id`)
      continue
    }
    if (!(m.overlayType in OSB_REGISTRY)) {
      errors.push(`${label} has an unknown overlay kind`)
      continue
    }
    overlayIds.add(m.id)
    const g = OSB_REGISTRY[m.overlayType].grid
    if (!Number.isInteger(m.cols + m.rows) || m.cols < g.minCols || m.rows < g.minRows || m.cols > g.maxCols || m.rows > g.maxRows) {
      errors.push(`${label}: that size isn't allowed`)
    }
    const kids = Array.isArray(m.children) ? m.children : []
    for (const k of kids) {
      if (!(k.type in OSB_REGISTRY) || !isAtomType(k.type)) {
        errors.push(`${label} child: that can't go there`)
        continue
      }
      if (k.parentId !== m.id) errors.push(`${label} child: missing parent`)
      const reason = canPlaceOverlayChild({ cols: m.cols, rows: m.rows, children: kids }, k.type, k, k.id)
      if (reason && reason !== 'overlap') errors.push(`${label} child: ${reasonText(reason).toLowerCase()}`)
    }
    for (let i = 0; i < kids.length; i++)
      for (let j = i + 1; j < kids.length; j++)
        if (collides(kids[i], kids[j])) errors.push(`${label} pieces overlap`)
    if (!isContiguous(kids)) errors.push(`${label} pieces are scattered (must touch)`)
    if (!containerFitsKids(kids, { id: m.id, cols: m.cols, rows: m.rows })) {
      errors.push(`${label} is too small for its contents`)
    }
  }
  // Trigger integrity: a trigger opens one overlay by id, and a trigger inside
  // an overlay never opens another one.
  const overlayKindOf = (id: string): string => {
    const found = overlaysOf(doc).find((o) => o.id === id)
    return found ? overlayNoun(found.overlayType) : 'overlay'
  }
  const checkTrigger = (n: PlacedNode, where: string, inOverlay: boolean) => {
    if (!isTriggerType(n.type)) return
    const target = overlayTargetOf(n.config)
    if (!target) return
    if (inOverlay) {
      errors.push(`${where} inside an overlay cannot open another overlay`)
      return
    }
    if (!overlayIds.has(target)) errors.push(`${where} opens a missing ${overlayKindOf(target)}`)
  }
  for (const n of doc.nodes) checkTrigger(n, nameOf(n.type), false)
  for (const m of overlaysOf(doc)) {
    const label = overlayNoun(m.overlayType)
    for (const k of m.children) checkTrigger(k, `${label} content`, true)
  }
  return { ok: errors.length === 0, errors }
}
