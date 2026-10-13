import { OSB_PATTERNS } from '../osb/patterns'
import { OSB_REGISTRY, canContain, isAtomType, isContainerType, type OSBNodeType } from '../osb/registry'
import { CONTAINER_PAD, type OSBTheme } from '../osb/types'
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
  /** Popups live beside the grid, never in it: no overlap, contiguity, or
   * RGL layout ever sees them. Old docs load without the key (see loadDoc). */
  modals?: ModalDoc[]
  /** Side panels: same overlay contract as popups, a separate store so the
   * two kinds never collide. Old docs load without the key (see loadDoc). */
  drawers?: DrawerDoc[]
  /** Global light/dark for the whole site, not a per-node setting. Old docs
   * load without the key (see themeOf). */
  theme?: OSBTheme
}

/** A popup shell: card-like footprint plus free-form atom children. */
export interface ModalDoc {
  id: string
  config: Record<string, unknown>
  cols: number
  rows: number
  /** parentId of every child is this modal's id. Atoms only — never modals. */
  children: PlacedNode[]
}

/**
 * A drawer shell: the same shape as a popup (footprint + atom children).
 * One shape for both overlay kinds — every overlay op below is generic over
 * it, so modal and drawer logic cannot drift.
 */
export type DrawerDoc = ModalDoc

/** A fresh, empty canvas. Docs are never mutated, so sharing is safe. */
export const EMPTY_DOC: CanvasDoc = { version: 1, nodes: [], modals: [], drawers: [], theme: 'light' }

/** Modals, tolerating old docs saved before popups existed. */
export const modalsOf = (doc: CanvasDoc): ModalDoc[] => doc.modals ?? []

/** Drawers, tolerating old docs saved before panels existed. */
export const drawersOf = (doc: CanvasDoc): DrawerDoc[] => doc.drawers ?? []

/** The site theme, tolerating old docs saved before it was global. */
export const themeOf = (doc: CanvasDoc): OSBTheme => (doc.theme === 'dark' ? 'dark' : 'light')

type Rect = { x: number; y: number; cols: number; rows: number }

export const storageKey = (projectName: string): string => `osb.project.${projectName}`

export function loadDoc(key: string): CanvasDoc {
  try {
    const doc = JSON.parse(localStorage.getItem(key) ?? '') as CanvasDoc | null
    if (!doc || doc.version !== 1 || !Array.isArray(doc.nodes)) return EMPTY_DOC
    // Drop unknown types (removed components), then prune orphans: children
    // whose parent is missing, not a root container, or itself nested.
    const known = doc.nodes.filter((n) => n && typeof n.type === 'string' && n.type in OSB_REGISTRY)
    const roots = new Set(known.filter((n) => n.parentId === null && isContainerType(n.type)).map((n) => n.id))
    return {
      version: 1,
      nodes: known.filter(
        (n) => n.parentId === null || (n.parentId !== null && roots.has(n.parentId) && isAtomType(n.type)),
      ),
      modals: pruneOverlays(Array.isArray(doc.modals) ? doc.modals : []),
      drawers: pruneOverlays(Array.isArray(doc.drawers) ? doc.drawers : []),
      theme: themeOf(doc),
    }
  } catch {
    return EMPTY_DOC
  }
}

/** Keep well-formed overlays: string ids (first wins), atom children that
 * belong to their own shell. Geometry is validated on demand, not dropped.
 * One pruner for popups + drawers — the shape is identical. */
function pruneOverlays(raw: ModalDoc[]): ModalDoc[] {
  const seen = new Set<string>()
  const out: ModalDoc[] = []
  for (const m of raw) {
    if (!m || typeof m.id !== 'string' || m.id.length === 0 || seen.has(m.id)) continue
    seen.add(m.id)
    const children = Array.isArray(m.children)
      ? m.children.filter(
          (k) => k && typeof k.type === 'string' && k.type in OSB_REGISTRY && isAtomType(k.type) && k.parentId === m.id,
        )
      : []
    out.push({
      id: m.id,
      config: m.config && typeof m.config === 'object' ? m.config : {},
      cols: m.cols,
      rows: m.rows,
      children,
    })
  }
  return out
}

/** Rect overlap in cells; touching edges is fine. */
export const collides = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.cols && b.x < a.x + a.cols && a.y < b.y + b.rows && b.y < a.y + a.rows

/** Edge-sharing with positive overlap. Corner-only contact does not count. */
export const touches = (a: Rect, b: Rect): boolean =>
  ((a.x + a.cols === b.x || b.x + b.cols === a.x) && a.y < b.y + b.rows && b.y < a.y + a.rows) ||
  ((a.y + a.rows === b.y || b.y + b.rows === a.y) && a.x < b.x + b.cols && b.x < a.x + a.cols)

/** A sibling set is valid when it forms one edge-connected patch. Zero or
 * one rect is vacuously connected. */
export function isContiguous(rects: readonly Rect[]): boolean {
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

export type CellRect = Rect

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
function overlapIds(nodes: PlacedNode[], rect: Rect, parentId: string | null, ignoreId?: string | null): string[] {
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

/** The single gate for every insert/move (R1–R4). Touch (contiguity) is NOT
 * enforced here — pieces move freely, and Validate checks touch on demand.
 * Returns null when valid, else the reason. */
export function canInsertReason(
  nodes: PlacedNode[],
  type: OSBNodeType,
  rect: CellRect,
  parentId: string | null = null,
  ignoreId?: string,
): RejectReason | null {
  if (!(type in OSB_REGISTRY)) return 'unknown-type'
  // Overlays never enter through node ops — only createModal/createDrawer make one.
  if (type === 'modal' || type === 'drawer') return 'kind'
  if (!isRectOk(rect)) return 'integrity'
  if (!footprintOk(type, rect)) return 'footprint'
  if (parentId === null) {
    if (!isAtomType(type) && !isContainerType(type)) return 'kind'
    if (rect.x + rect.cols > GRID_COLS) return 'containment'
  } else {
    const parent = nodes.find((n) => n.id === parentId)
    // A node with children can never itself nest (depth guard).
    if (!parent || parent.parentId !== null || !isContainerType(parent.type)) return 'depth'
    if (!canContain(parent.type, type)) return 'kind'
    if (ignoreId && !isChildless(nodes, ignoreId)) return 'depth'
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
  // Depth-1 cascade: removing a container removes its children.
  for (const n of doc.nodes) {
    if (n.parentId && ids.has(n.parentId)) ids.add(n.id)
  }
  return { ...doc, nodes: doc.nodes.filter((n) => !ids.has(n.id)) }
}

// ---------------------------------------------------------------------------
// Overlays (popups + drawers). Same vocabulary as nodes (one gate, atomic
// ops, plain-language reasons) but separate stores, so grid rules never see
// overlay content. Modal and drawer ops below are thin wrappers over one
// generic core — the shape is identical, only the collection differs.
// ---------------------------------------------------------------------------

export type ModalShell = Pick<ModalDoc, 'cols' | 'rows' | 'children'>

/** The overlay landing rule: atoms only (never an overlay-in-overlay),
// inside the shell, on whole cells, never overlapping a sibling. */
export function canPlaceOverlayChild(
  shell: ModalShell,
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

/** THE popup landing rule — alias over the shared overlay gate. */
export function canPlaceModalChild(
  modal: ModalShell,
  type: string,
  rect: CellRect,
  ignoreId?: string,
): RejectReason | null {
  return canPlaceOverlayChild(modal, type, rect, ignoreId)
}

/** THE drawer landing rule — alias over the shared overlay gate. */
export function canPlaceDrawerChild(
  drawer: ModalShell,
  type: string,
  rect: CellRect,
  ignoreId?: string,
): RejectReason | null {
  return canPlaceOverlayChild(drawer, type, rect, ignoreId)
}

type OverlayKey = 'modals' | 'drawers'

const overlaysOf = (doc: CanvasDoc, key: OverlayKey): ModalDoc[] => (key === 'modals' ? modalsOf(doc) : drawersOf(doc))

/** One overlay by id — the lookup every overlay op shares. */
const findOverlay = (doc: CanvasDoc, key: OverlayKey, id: string): ModalDoc | undefined =>
  overlaysOf(doc, key).find((m) => m.id === id)

/** Every overlay mutation funnels here: replace one shell by id, untouched
 * siblings preserved. Keeps the "map over overlays" boilerplate in one place. */
const mapOverlay = (doc: CanvasDoc, key: OverlayKey, id: string, fn: (m: ModalDoc) => ModalDoc): CanvasDoc => ({
  ...doc,
  [key]: overlaysOf(doc, key).map((m) => (m.id === id ? fn(m) : m)),
})

/** One popup by id — the lookup every popup op shares. */
export const findModal = (doc: CanvasDoc, id: string): ModalDoc | undefined => findOverlay(doc, 'modals', id)

/** One drawer by id — the lookup every drawer op shares. */
export const findDrawer = (doc: CanvasDoc, id: string): DrawerDoc | undefined => findOverlay(doc, 'drawers', id)

/** Every popup mutation funnels here: replace one shell by id, untouched
 * siblings preserved. Keeps the "map over modals" boilerplate in one place. */
const mapModal = (doc: CanvasDoc, id: string, fn: (m: ModalDoc) => ModalDoc): CanvasDoc => mapOverlay(doc, 'modals', id, fn)

/** Every drawer mutation funnels here — mirror of mapModal. */
const mapDrawer = (doc: CanvasDoc, id: string, fn: (m: DrawerDoc) => DrawerDoc): CanvasDoc =>
  mapOverlay(doc, 'drawers', id, fn)

/** Append a popup shell. Children arrive via insertModalChild. */
export function createModal(doc: CanvasDoc, modal: ModalDoc): CanvasDoc {
  return { ...doc, modals: [...modalsOf(doc), modal] }
}

/** Append a drawer shell. Children arrive via insertDrawerChild. */
export function createDrawer(doc: CanvasDoc, drawer: DrawerDoc): CanvasDoc {
  return { ...doc, drawers: [...drawersOf(doc), drawer] }
}

export function updateModalConfig(doc: CanvasDoc, id: string, config: Record<string, unknown>): CanvasDoc {
  return mapModal(doc, id, (m) => ({ ...m, config }))
}

export function updateDrawerConfig(doc: CanvasDoc, id: string, config: Record<string, unknown>): CanvasDoc {
  return mapDrawer(doc, id, (m) => ({ ...m, config }))
}

function resizeOverlay(
  doc: CanvasDoc,
  key: OverlayKey,
  gridType: OSBNodeType,
  id: string,
  cols: number,
  rows: number,
): DocResult {
  const shell = findOverlay(doc, key, id)
  if (!shell) return { ok: false, reason: 'unknown-type' }
  const g = OSB_REGISTRY[gridType].grid
  if (!Number.isInteger(cols + rows) || cols < g.minCols || rows < g.minRows || cols > g.maxCols || rows > g.maxRows) {
    return { ok: false, reason: 'footprint' }
  }
  if (!containerFitsKids(shell.children, { id, cols, rows })) return { ok: false, reason: 'undersize' }
  return { ok: true, doc: mapOverlay(doc, key, id, (m) => ({ ...m, cols, rows })) }
}

/** Resize the shell: same floor rule as containers (never under children). */
export function resizeModal(doc: CanvasDoc, id: string, cols: number, rows: number): DocResult {
  return resizeOverlay(doc, 'modals', 'modal', id, cols, rows)
}

/** Resize the drawer shell — mirror of resizeModal. */
export function resizeDrawer(doc: CanvasDoc, id: string, cols: number, rows: number): DocResult {
  return resizeOverlay(doc, 'drawers', 'drawer', id, cols, rows)
}

/** Removing a popup unlinks every button that opened it (canvas + overlays). */
export function removeModal(doc: CanvasDoc, id: string): CanvasDoc {
  const scrub = (n: PlacedNode): PlacedNode =>
    (n.config as { modalId?: unknown } | undefined)?.modalId === id
      ? { ...n, config: { ...n.config, modalId: '' } }
      : n
  return {
    ...doc,
    nodes: doc.nodes.map(scrub),
    modals: modalsOf(doc)
      .filter((m) => m.id !== id)
      .map((m) => ({ ...m, children: m.children.map(scrub) })),
    drawers: drawersOf(doc).map((m) => ({ ...m, children: m.children.map(scrub) })),
  }
}

/** Removing a drawer unlinks every button that opened it (canvas + overlays). */
export function removeDrawer(doc: CanvasDoc, id: string): CanvasDoc {
  const scrub = (n: PlacedNode): PlacedNode =>
    (n.config as { drawerId?: unknown } | undefined)?.drawerId === id
      ? { ...n, config: { ...n.config, drawerId: '' } }
      : n
  return {
    ...doc,
    nodes: doc.nodes.map(scrub),
    drawers: drawersOf(doc)
      .filter((m) => m.id !== id)
      .map((m) => ({ ...m, children: m.children.map(scrub) })),
    modals: modalsOf(doc).map((m) => ({ ...m, children: m.children.map(scrub) })),
  }
}

function insertOverlayChild(
  doc: CanvasDoc,
  key: OverlayKey,
  overlayId: string,
  child: PlacedNode,
): DocResult {
  const shell = findOverlay(doc, key, overlayId)
  if (!shell) return { ok: false, reason: 'unknown-type' }
  const reason = canPlaceOverlayChild(shell, child.type, child)
  if (reason) return { ok: false, reason }
  return { ok: true, doc: mapOverlay(doc, key, overlayId, (m) => ({ ...m, children: [...m.children, child] })) }
}

function moveOverlayChild(doc: CanvasDoc, key: OverlayKey, overlayId: string, id: string, rect: CellRect): DocResult {
  const shell = findOverlay(doc, key, overlayId)
  const child = shell?.children.find((k) => k.id === id)
  if (!shell || !child) return { ok: false, reason: 'unknown-type' }
  const reason = canPlaceOverlayChild(shell, child.type, rect, id)
  if (reason) return { ok: false, reason }
  return {
    ok: true,
    doc: mapOverlay(doc, key, overlayId, (m) => ({
      ...m,
      children: m.children.map((k) => (k.id === id ? { ...k, ...rect } : k)),
    })),
  }
}

function removeOverlayChild(doc: CanvasDoc, key: OverlayKey, overlayId: string, id: string): CanvasDoc {
  return mapOverlay(doc, key, overlayId, (m) => ({ ...m, children: m.children.filter((k) => k.id !== id) }))
}

function updateOverlayChildConfig(
  doc: CanvasDoc,
  key: OverlayKey,
  overlayId: string,
  id: string,
  config: Record<string, unknown>,
): CanvasDoc {
  return mapOverlay(doc, key, overlayId, (m) => ({
    ...m,
    children: m.children.map((k) => (k.id === id ? { ...k, config } : k)),
  }))
}

export function insertModalChild(doc: CanvasDoc, modalId: string, child: PlacedNode): DocResult {
  return insertOverlayChild(doc, 'modals', modalId, child)
}

export function insertDrawerChild(doc: CanvasDoc, drawerId: string, child: PlacedNode): DocResult {
  return insertOverlayChild(doc, 'drawers', drawerId, child)
}

export function moveModalChild(doc: CanvasDoc, modalId: string, id: string, rect: CellRect): DocResult {
  return moveOverlayChild(doc, 'modals', modalId, id, rect)
}

export function moveDrawerChild(doc: CanvasDoc, drawerId: string, id: string, rect: CellRect): DocResult {
  return moveOverlayChild(doc, 'drawers', drawerId, id, rect)
}

export function removeModalChild(doc: CanvasDoc, modalId: string, id: string): CanvasDoc {
  return removeOverlayChild(doc, 'modals', modalId, id)
}

export function removeDrawerChild(doc: CanvasDoc, drawerId: string, id: string): CanvasDoc {
  return removeOverlayChild(doc, 'drawers', drawerId, id)
}

export function updateModalChildConfig(
  doc: CanvasDoc,
  modalId: string,
  id: string,
  config: Record<string, unknown>,
): CanvasDoc {
  return updateOverlayChildConfig(doc, 'modals', modalId, id, config)
}

export function updateDrawerChildConfig(
  doc: CanvasDoc,
  drawerId: string,
  id: string,
  config: Record<string, unknown>,
): CanvasDoc {
  return updateOverlayChildConfig(doc, 'drawers', drawerId, id, config)
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

/**
 * Where a dragged rect lands: nested as a child when its center sits in an
 * accepting container, otherwise at root. Pure routing — the caller still
 * runs the result through insertNode/moveNode (the gate).
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
    const local = nestLocal(target, center, span)
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
  const at = (id: string, msg: string) => errors.push(`node ${id}: ${msg}`)
  const byId = new Map(doc.nodes.map((n) => [n.id, n]))
  for (const n of doc.nodes) {
    if (!(n.type in OSB_REGISTRY)) {
      at(n.id, `unknown type ${JSON.stringify((n as { type: unknown }).type)}`)
      continue
    }
    if (n.parentId !== null && !byId.has(n.parentId)) at(n.id, 'missing parent')
    // Overlaps are reported once per pair below, where both ids read well.
    const reason = canInsertReason(doc.nodes, n.type, n, n.parentId, n.id)
    if (reason && reason !== 'overlap') at(n.id, reasonText(reason))
  }
  // Sibling overlap pairs, contiguity, and container floors per set.
  const sets = new Map<string | null, PlacedNode[]>()
  for (const n of doc.nodes) sets.set(n.parentId ?? null, [...(sets.get(n.parentId ?? null) ?? []), n])
  for (const [parentId, set] of sets) {
    for (let i = 0; i < set.length; i++)
      for (let j = i + 1; j < set.length; j++)
        if (collides(set[i], set[j])) errors.push(`nodes ${set[i].id} and ${set[j].id} overlap`)
    if (!isContiguous(set)) {
      errors.push(
        parentId === null ? 'root nodes are scattered (must touch)' : `children of ${parentId} are scattered (must touch)`,
      )
    }
    const parent = parentId === null ? null : byId.get(parentId)
    if (parent && !containerFitsKids(doc.nodes, parent)) {
      errors.push(`container ${parentId} undersizes its children`)
    }
  }
  // Overlays: same whole-document backstop as nodes — shell footprint,
  // child gates, pairwise overlaps, one connected patch, and trigger
  // integrity. Popups + drawers share one checker; only the label differs.
  const checkOverlaySet = (label: string, shells: ModalDoc[], gridType: OSBNodeType, seen: Set<string>) => {
    for (const m of shells) {
      if (typeof m.id !== 'string' || m.id.length === 0 || seen.has(m.id)) {
        errors.push(`${label} ${JSON.stringify((m as { id: unknown } | null)?.id)} has a bad or duplicate id`)
        continue
      }
      seen.add(m.id)
      const g = OSB_REGISTRY[gridType].grid
      if (!Number.isInteger(m.cols + m.rows) || m.cols < g.minCols || m.rows < g.minRows || m.cols > g.maxCols || m.rows > g.maxRows) {
        errors.push(`${label} ${m.id}: that size isn't allowed`)
      }
      const kids = Array.isArray(m.children) ? m.children : []
      for (const k of kids) {
        if (!(k.type in OSB_REGISTRY) || !isAtomType(k.type)) {
          errors.push(`${label} ${m.id} child ${k.id}: that can't go there`)
          continue
        }
        if (k.parentId !== m.id) errors.push(`${label} ${m.id} child ${k.id}: missing parent`)
        const reason = canPlaceOverlayChild({ cols: m.cols, rows: m.rows, children: kids }, k.type, k, k.id)
        if (reason && reason !== 'overlap') errors.push(`${label} ${m.id} child ${k.id}: ${reasonText(reason).toLowerCase()}`)
      }
      for (let i = 0; i < kids.length; i++)
        for (let j = i + 1; j < kids.length; j++)
          if (collides(kids[i], kids[j])) errors.push(`${label} ${m.id} children ${kids[i].id} and ${kids[j].id} overlap`)
      if (!isContiguous(kids)) errors.push(`children of ${label} ${m.id} are scattered (must touch)`)
      if (!containerFitsKids(kids, { id: m.id, cols: m.cols, rows: m.rows })) {
        errors.push(`${label} ${m.id} undersizes its children`)
      }
    }
  }
  const overlayIds = new Set<string>()
  checkOverlaySet('popup', modalsOf(doc), 'modal', overlayIds)
  const drawerStart = overlayIds.size
  checkOverlaySet('drawer', drawersOf(doc), 'drawer', overlayIds)
  void drawerStart
  // Cross-kind duplicate ids (a popup and a drawer sharing one id) would
  // confuse triggers: flag the drawer side.
  // (overlayIds already unions both sets; per-set dupes are caught above.)
  const modalIds = new Set(modalsOf(doc).map((m) => m.id))
  const drawerIds = new Set(drawersOf(doc).map((m) => m.id))
  for (const id of drawerIds) {
    if (modalIds.has(id)) errors.push(`drawer ${id} duplicates a popup id`)
  }
  // Trigger integrity: buttons open existing overlays (at most one — a link
  // is ignored while either is attached), and buttons inside an overlay
  // never open another one.
  const checkTrigger = (n: PlacedNode, where: string, inOverlay: boolean) => {
    if (n.type !== 'button') return
    const cfg = n.config as { modalId?: unknown; drawerId?: unknown } | undefined
    const modalTarget = typeof cfg?.modalId === 'string' && cfg.modalId.length > 0 ? cfg.modalId : null
    const drawerTarget = typeof cfg?.drawerId === 'string' && cfg.drawerId.length > 0 ? cfg.drawerId : null
    if (modalTarget && drawerTarget) {
      errors.push(`${where} button ${n.id} cannot open two overlays`)
      return
    }
    const target = modalTarget ?? drawerTarget
    if (!target) return
    if (inOverlay) {
      errors.push(`${where} button ${n.id} inside a ${where.startsWith('popup') ? 'popup' : 'drawer'} cannot open another ${modalTarget ? 'popup' : 'drawer'}`)
      return
    }
    if (!overlayIds.has(target)) errors.push(`${where} button ${n.id} opens a missing ${modalTarget ? 'popup' : 'drawer'}`)
  }
  for (const n of doc.nodes) checkTrigger(n, 'node', false)
  for (const m of modalsOf(doc)) for (const k of m.children) checkTrigger(k, `popup ${m.id} child`, true)
  for (const m of drawersOf(doc)) for (const k of m.children) checkTrigger(k, `drawer ${m.id} child`, true)
  return { ok: errors.length === 0, errors }
}
