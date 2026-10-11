import { useEffect, useMemo, useRef, useState } from 'react'
import GridLayout, {
  useContainerWidth,
  type Compactor,
  type Layout,
  type LayoutItem,
} from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import './canvas.css'
import { OSB_PALETTE_TYPES, OSB_REGISTRY, canContain, type OSBNodeType } from '../osb/registry'
import { OSB_PATTERNS, OSB_PATTERN_IDS } from '../osb/patterns'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import ConfigDrawer from './ConfigDrawer'
import {
  loadDoc,
  currentProjectName,
  storageKey,
  canInsertReason,
  canPlace,
  conflictIds,
  containerFloor,
  dragSpan,
  eventCell,
  insertNode,
  insertPattern,
  moveNode,
  reasonText,
  removeNode,
  resolveDrop,
  resolveInsert,
  validateDoc,
  type CanvasDoc,
  type DocResult,
  type DocValidation,
  type DragPayload,
  type PlacedNode,
  type RejectReason,
} from './doc'
import { clearProjectSlug } from '../lib/project'
import { GRID_COLS, GRID_MARGIN_X, GRID_MARGIN_Y, canvasMetrics, minGridWidth } from './grid'
import { pushDoc } from './push'
import { useDebouncedEffect } from './useDebouncedEffect'

// Free-form grid: no auto-compact. Overlap is gated by the doc layer
// (canPlace/moveNode), not by RGL — RGL must allow dragging over a
// container so child-driven nesting can land; rejected moves snap back
// because the layout prop never changes.
const noOverlap: Compactor = {
  type: null,
  allowOverlap: true,
  preventCollision: false,
  compact: (layout) => layout,
}

function childPos(
  parent: { cols: number; rows: number },
  kid: { x: number; y: number; cols: number; rows: number },
): React.CSSProperties {
  return {
    position: 'absolute',
    left: `${(kid.x / parent.cols) * 100}%`,
    top: `${(kid.y / parent.rows) * 100}%`,
    width: `${(kid.cols / parent.cols) * 100}%`,
    height: `${(kid.rows / parent.rows) * 100}%`,
  }
}

/** One palette entry: an atom type or a multi-node pattern. */
function PaletteButton({
  testid,
  label,
  onPick,
  onClear,
  onStart,
}: {
  testid: string
  label: string
  onPick: () => void
  onClear: () => void
  onStart: () => void
}) {
  return (
    <Button
      data-testid={testid}
      variant="outline"
      size="sm"
      draggable
      onPointerDown={onPick}
      onDragStart={(e) => {
        onPick()
        onStart()
        e.dataTransfer.setData('text/plain', label)
      }}
      onDragEnd={onClear}
      className="cursor-grab"
    >
      {label}
    </Button>
  )
}

export default function CanvasPage() {
  const [projectName] = useState(currentProjectName)
  // No fallback: without a project cookie there is no doc to load and no
  // name to display — send the user back to onboarding.
  useEffect(() => {
    if (!projectName) window.location.href = '/'
  }, [projectName])
  const key = projectName ? storageKey(projectName) : ''
  const [doc, setDoc] = useState<CanvasDoc>(() => (key ? loadDoc(key) : { version: 1, nodes: [] }))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // One highlight rule while dragging: every border blue, conflicts red.
  const [dragging, setDragging] = useState(false)
  const [conflicts, setConflicts] = useState<string[]>([])
  // Live drop-cell preview for child drags inside a container: blue where
  // the footprint fits, red where it would be refused.
  const [childGhost, setChildGhost] = useState<{
    parentId: string
    x: number
    y: number
    cols: number
    rows: number
    ok: boolean
  } | null>(null)
  // Resync RGL's internal layout from props every gesture end, so a
  // refused drag can never linger as a phantom.
  const [layoutEpoch, setLayoutEpoch] = useState(0)
  // Live RGL-drag validity (red outline while over a forbidden spot).
  const [dragCheck, setDragCheck] = useState<{ id: string; ok: boolean } | null>(null)
  // On-demand validation panel (touch and friends are checked on click,
  // not at placement time, so pieces move like legos first).
  const [validation, setValidation] = useState<DocValidation | null>(null)
  const [pushing, setPushing] = useState(false)
  const [pushMsg, setPushMsg] = useState('')
  // Transient drop feedback: rejected gestures fail silently otherwise.
  const [dropMsg, setDropMsg] = useState<string | null>(null)
  const dropMsgTimer = useRef<number | null>(null)
  // Colors the RGL drop placeholder red while the previewed spot is forbidden.
  const [dropForbidden, setDropForbidden] = useState(false)
  // Live child-resize preview (committed to the doc on mouse-up).
  const [resizing, setResizing] = useState<{ id: string; cols: number; rows: number } | null>(null)
  const { width, containerRef, mounted } = useContainerWidth()
  // One query owns every resolution-dependent size (cell, dots, scroll height).
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 856
  const roots = useMemo(() => doc.nodes.filter((n) => n.parentId === null), [doc])
  const { cell, dotRows, height } = canvasMetrics(width, viewportHeight, roots)
  // One drag vocabulary for every gesture (palette, pattern, move).
  const dragRef = useRef<DragPayload | null>(null)
  // Latest doc for async gesture commits (resize mouse-up).
  const docRef = useRef(doc)
  docRef.current = doc
  // True while a child SE-resize is in flight (suppresses HTML5 drag).
  const resizeActive = useRef(false)
  const resizeDims = useRef<{ cols: number; rows: number } | null>(null)

  // Debounced persist; key is the project name from onboarding.
  useDebouncedEffect(() => {
    if (!key) return
    localStorage.setItem(key, JSON.stringify(doc))
  }, [doc, key], 500)

  const layout: Layout = useMemo(
    () =>
      roots.map((n) => {
        const g = OSB_REGISTRY[n.type].grid
        const floor = containerFloor(doc.nodes, n.id)
        const item: LayoutItem = {
          i: n.id,
          x: n.x,
          y: n.y,
          w: n.cols,
          h: n.rows,
          minW: Math.max(g.minCols, floor.cols),
          minH: Math.max(g.minRows, floor.rows),
          maxW: g.maxCols,
          maxH: g.maxRows,
        }
        return item
      }),
    [doc, roots],
  )

  const commit = (next: Layout, active?: LayoutItem | null) => {
    setDragCheck(null)
    setDragging(false)
    markConflicts([])
    setDropForbidden(false)
    // Resync RGL: a refused gesture must not linger as a phantom. Bumping
    // the key rebuilds RGL's internal layout from props every gesture end.
    setLayoutEpoch((e) => e + 1)
    // Functional read: rapid gestures always validate against the latest
    // doc, never a stale render closure.
    const d = docRef.current
    // Only the item the user actually dragged may persist. Anything else in
    // `next` that differs is RGL internal drift — never write it back.
    const targets = active?.i
      ? next.filter((l) => l.i === active.i)
      : (() => {
          const changed = next.filter((l) => {
            const cur = d.nodes.find((n) => n.id === l.i)
            return (
              cur &&
              cur.parentId === null &&
              (cur.x !== l.x || cur.y !== l.y || cur.cols !== l.w || cur.rows !== l.h)
            )
          })
          return changed.length === 1 ? changed : []
        })()
    let nodes = d.nodes
    let failed: RejectReason | null = null
    for (const l of targets) {
      const cur = nodes.find((n) => n.id === l.i)
      if (!cur || cur.parentId !== null) continue
      if (cur.x === l.x && cur.y === l.y && cur.cols === l.w && cur.rows === l.h) continue
      // Fungible move: nest when the center lands in an accepting
      // container, else stay at root — one shared resolution.
      const resolved = resolveDrop(nodes, l.i, { x: l.x, y: l.y, cols: l.w, rows: l.h })
      if (!resolved) continue
      const r = moveNode({ ...d, nodes }, l.i, resolved.rect, resolved.parentId)
      if (r.ok) nodes = r.doc.nodes
      else if (!failed) failed = r.reason
    }
    if (nodes !== d.nodes) setDoc({ ...d, nodes })
    // Bounce with words: a refused drag snaps back AND says why.
    if (failed) reject(failed)
  }

  /** Live validity while an RGL item drags: red outline over forbidden
   * spots, nest-aware so a valid nesting never flashes red. Updates only
   * when the verdict flips, not on every mousemove. */
  const onDragCheck = (next: Layout) => {
    setDragging(true)
    const nodes = docRef.current.nodes
    const changed = next.find((l) => {
      const cur = nodes.find((n) => n.id === l.i)
      return cur && cur.parentId === null && (cur.x !== l.x || cur.y !== l.y || cur.cols !== l.w || cur.rows !== l.h)
    })
    if (!changed) return
    const cur = nodes.find((n) => n.id === changed.i)!
    const resolved = resolveDrop(nodes, cur.id, { x: changed.x, y: changed.y, cols: changed.w, rows: changed.h })
    const ok =
      resolved !== null &&
      canInsertReason(nodes, cur.type, resolved.rect, resolved.parentId, cur.id) === null
    setDragCheck((prev) => (prev && prev.id === cur.id && prev.ok === ok ? prev : { id: cur.id, ok }))
    markConflicts(
      resolved ? conflictIds(nodes, cur.id, cur.type, resolved.rect, resolved.parentId) : [],
    )
  }

  /** Red-conflict ids, updated only on change (drag events fire constantly). */
  const markConflicts = (ids: string[]) => {
    setConflicts((prev) =>
      prev.length === ids.length && prev.every((id, i) => id === ids[i]) ? prev : ids,
    )
  }

  const clearDrag = () => {
    dragRef.current = null
    setDragging(false)
    markConflicts([])
    setDropForbidden(false)
    setChildGhost((g) => (g === null ? g : null))
  }

  /** Surface a rejection where the user can see it; auto-clears. */
  const reject = (reason: Parameters<typeof reasonText>[0]) => {
    if (dropMsgTimer.current !== null) window.clearTimeout(dropMsgTimer.current)
    setDropMsg(reasonText(reason))
    dropMsgTimer.current = window.setTimeout(() => setDropMsg(null), 2600)
  }

  /** One landing for every op result: apply + select, or bounce with words. */
  const applyResult = (r: DocResult, selectId?: string) => {
    if (r.ok) {
      setDoc(r.doc)
      if (selectId !== undefined) setSelectedId(selectId)
    } else {
      reject(r.reason)
    }
  }

  /** Palette or child drop onto the root canvas (RGL onDrop). Container
   * drops are owned by the container div (see onContainerDrop): RGL's native
   * listener fires before React handlers bubble, so without the guard below
   * one child drop would move twice and strand RGL's dropping placeholder. */
  const onDrop = (_layout: Layout, item: LayoutItem | undefined, e?: Event) => {
    if ((e?.target as HTMLElement | undefined)?.closest?.('[data-testid^="container-"]') != null) return
    const drag = dragRef.current
    clearDrag()
    if (!item || !drag) return
    if (drag.kind === 'move') {
      // Take-out to root (or re-nest): keep the child's size, resolve the
      // landing cell through the shared center-point rule.
      const moving = doc.nodes.find((n) => n.id === drag.id)
      if (!moving) return
      const resolved = resolveDrop(
        doc.nodes,
        drag.id,
        { x: item.x, y: item.y, cols: moving.cols, rows: moving.rows },
      )
      if (!resolved) return
      applyResult(moveNode(doc, drag.id, resolved.rect, resolved.parentId), drag.id)
      return
    }
    // Pattern drop: the whole composition lands atomically or not at all.
    if (drag.kind === 'pattern') {
      const pattern = OSB_PATTERNS[drag.pattern]
      if (!pattern) return
      const containerId = crypto.randomUUID()
      applyResult(
        insertPattern(
          doc,
          drag.pattern,
          containerId,
          { x: item.x, y: item.y, cols: 0, rows: 0 },
          pattern.children.map(() => crypto.randomUUID()),
        ),
        containerId,
      )
      return
    }
    const g = OSB_REGISTRY[drag.type].grid
    // Fresh atom: one shared center-point resolution, then the single gate.
    const resolved = resolveInsert(doc.nodes, drag.type, { x: item.x, y: item.y, cols: g.cols, rows: g.rows })
    const id = crypto.randomUUID()
    applyResult(
      insertNode(doc, { id, type: drag.type, config: {}, parentId: resolved.parentId, ...resolved.rect }),
      id,
    )
  }

  /** Take-out: HTML5 child drag dropped on root background (bypasses RGL). */
  const onRootDrop = (e: React.DragEvent) => {
    const drag = dragRef.current
    if (!drag || drag.kind !== 'move') return
    if ((e.target as HTMLElement).closest?.('[data-testid^="container-"]') != null) return
    if ((e.target as HTMLElement).closest?.('[data-parent]') != null) return
    e.preventDefault()
    e.stopPropagation()
    const moving = doc.nodes.find((n) => n.id === drag.id)
    clearDrag()
    if (!moving) return
    const el = e.currentTarget as HTMLElement
    const r = el.getBoundingClientRect()
    const pitchX = cell + GRID_MARGIN_X
    const pitchY = cell + GRID_MARGIN_Y
    const rect = {
      x: Math.max(0, Math.min(GRID_COLS - moving.cols, Math.floor((e.clientX - r.left) / pitchX))),
      y: Math.max(0, Math.floor((e.clientY - r.top) / pitchY)),
      cols: moving.cols,
      rows: moving.rows,
    }
    applyResult(moveNode(doc, drag.id, rect, null), drag.id)
  }

  /** Drop (palette child or existing node) onto a container div. */
  const onContainerDrop = (e: React.DragEvent, parent: PlacedNode) => {
    e.preventDefault()
    e.stopPropagation()
    const drag = dragRef.current
    const span = dragSpan(drag, doc.nodes)
    clearDrag()
    if (!span || !drag || drag.kind === 'pattern') {
      if (drag) reject('kind')
      return
    }
    const el = e.currentTarget as HTMLElement
    const at = eventCell(e.clientX, e.clientY, el.getBoundingClientRect(), parent, span)
    const rect = { ...at, ...span }
    if (drag.kind === 'move') {
      const moving = doc.nodes.find((n) => n.id === drag.id)
      if (!moving || !canContain(parent.type, moving.type)) {
        reject('kind')
        return
      }
      applyResult(moveNode(doc, drag.id, rect, parent.id), drag.id)
      return
    }
    if (!canContain(parent.type, drag.type)) {
      reject('kind')
      return
    }
    const id = crypto.randomUUID()
    applyResult(insertNode(doc, { id, type: drag.type, config: {}, parentId: parent.id, ...rect }), id)
  }

  const onContainerDragOver = (e: React.DragEvent, parent: PlacedNode) => {
    const drag = dragRef.current
    const moving = drag?.kind === 'move' ? doc.nodes.find((n) => n.id === drag.id) ?? null : null
    // Patterns are shells: hovering one over a container is always refused.
    const active = drag !== null
    if (active) e.preventDefault()
    // Live cell verdict: red ghost + red conflicts where this drag would be
    // refused. Everything else stays blue (see dragging-on).
    const span = dragSpan(drag, doc.nodes)
    if (!span || !drag || drag.kind === 'pattern') {
      setChildGhost((g) => (g === null ? g : null))
      if (drag?.kind === 'pattern') markConflicts([parent.id])
      return
    }
    // Live cell verdict: red ghost + red conflicts where this drag would be
    // refused. Everything else stays blue (see dragging-on).
    const ghostAt = eventCell(
      e.clientX,
      e.clientY,
      (e.currentTarget as HTMLElement).getBoundingClientRect(),
      parent,
      span,
    )
    const ghostRect = { ...ghostAt, ...span }
    const dragType = drag.kind === 'move' ? (moving?.type ?? '') : drag.type
    const verdict =
      drag.kind === 'move' && !moving
        ? ('unknown-type' as const)
        : canInsertReason(doc.nodes, dragType as OSBNodeType, ghostRect, parent.id, drag.kind === 'move' ? drag.id : undefined)
    markConflicts(
      verdict === null
        ? []
        : conflictIds(
            doc.nodes,
            drag.kind === 'move' ? drag.id : null,
            dragType,
            ghostRect,
            parent.id,
          ),
    )
    setChildGhost((g) => {
      const next = { parentId: parent.id, ...ghostRect, ok: verdict === null }
      if (
        g !== null &&
        g.parentId === next.parentId &&
        g.x === next.x &&
        g.y === next.y &&
        g.cols === next.cols &&
        g.rows === next.rows &&
        g.ok === next.ok
      )
        return g
      return next
    })
  }

  /** SE resize for nested atoms: pixels convert to parent cells, the doc
   * commits on release through the same gate as every other move. */
  const startChildResize = (e: React.MouseEvent, parent: PlacedNode, kid: PlacedNode) => {
    e.stopPropagation()
    e.preventDefault()
    const containerEl = (e.currentTarget as HTMLElement).closest(
      '[data-testid^="container-"]',
    ) as HTMLElement | null
    if (!containerEl) return
    const g = OSB_REGISTRY[kid.type].grid
    const box = containerEl.getBoundingClientRect()
    const pitchX = box.width / parent.cols
    const pitchY = box.height / parent.rows
    const startX = e.clientX
    const startY = e.clientY
    resizeActive.current = true
    resizeDims.current = { cols: kid.cols, rows: kid.rows }
    const onMove = (ev: MouseEvent) => {
      const cols = Math.max(
        g.minCols,
        Math.min(g.maxCols, Math.min(parent.cols - kid.x, kid.cols + Math.round((ev.clientX - startX) / pitchX))),
      )
      const rows = Math.max(
        g.minRows,
        Math.min(g.maxRows, Math.min(parent.rows - kid.y, kid.rows + Math.round((ev.clientY - startY) / pitchY))),
      )
      resizeDims.current = { cols, rows }
      setResizing((r) => (r && r.id === kid.id && r.cols === cols && r.rows === rows ? r : { id: kid.id, cols, rows }))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      resizeActive.current = false
      const dims = resizeDims.current
      resizeDims.current = null
      setResizing(null)
      if (!dims || (dims.cols === kid.cols && dims.rows === kid.rows)) return
      const res = moveNode(docRef.current, kid.id, { x: kid.x, y: kid.y, ...dims }, parent.id)
      if (res.ok) {
        setDoc(res.doc)
        setSelectedId(kid.id)
      } else {
        reject(res.reason)
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const renderChildrenOf = (parent: PlacedNode) => {
    const kids = doc.nodes.filter((n) => n.parentId === parent.id)
    // Bounds on demand: transparent atoms (text) are invisible otherwise.
    // Dragging lights every border blue via dragging-on; conflicts go red.
    const showBounds = parent.id === selectedId
    return (
      <>
        <div
          className={`pointer-events-none absolute inset-0${showBounds ? ' show-child-bounds' : ''}`}
        >
          {kids.map((k) => (
            <div
              key={k.id}
              data-testid="canvas-node"
              data-type={k.type}
              data-id={k.id}
              data-parent={parent.id}
              draggable
              onDragStart={(e) => {
                e.stopPropagation()
                if (resizeActive.current) {
                  e.preventDefault()
                  return
                }
                dragRef.current = { kind: 'move', id: k.id }
                setDragging(true)
                e.dataTransfer.setData('text/plain', k.id)
              }}
              onDragEnd={clearDrag}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedId(k.id)
              }}
              style={childPos(parent, resizing?.id === k.id ? { ...k, ...resizing } : k)}
              className={`osb-child pointer-events-auto ${k.id === selectedId ? 'canvas-selected overflow-hidden' : 'overflow-hidden'}${conflicts.includes(k.id) ? ' drag-conflict' : ''}`}
            >
              {OSB_REGISTRY[k.type].render(k.config)}
              {k.id === selectedId && (
                <div
                  data-testid={`resize-${k.id}`}
                  aria-label="Resize element"
                  onMouseDown={(e) => startChildResize(e, parent, k)}
                  className="absolute bottom-0 right-0 z-10 h-4 w-4 cursor-se-resize rounded-tl-md border-l border-t border-sky-500 bg-white/90"
                />
              )}
              {k.id === selectedId && (
                <button
                  type="button"
                  data-testid="remove-node"
                  aria-label="Remove element"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeSelected(k.id)
                  }}
                  className="absolute right-0 top-0 z-10 rounded-bl-md bg-white px-1.5 py-0.5 text-[10px] text-slate-600 shadow-sm hover:bg-slate-100"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        {childGhost && childGhost.parentId === parent.id && (
          <div
            aria-hidden
            data-testid="drop-ghost"
            data-ok={childGhost.ok}
            style={childPos(parent, childGhost)}
            className={
              childGhost.ok
                ? 'pointer-events-none absolute rounded-md border-2 border-dashed border-sky-500 bg-sky-500/10'
                : 'pointer-events-none absolute rounded-md border-2 border-dashed border-rose-500 bg-rose-500/10'
            }
          />
        )}
        {kids.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-3">
            <div
              data-testid={`empty-hint-${parent.id}`}
              className="rounded-lg border-2 border-dashed border-slate-300 bg-white/60 px-4 py-3 text-center text-xs text-slate-400"
            >
              {OSB_REGISTRY[parent.type].emptyHint ?? 'Drag content here'}
            </div>
          </div>
        )}
      </>
    )
  }

  const renderNodeBody = (n: PlacedNode) => {
    const entry = OSB_REGISTRY[n.type]
    if (entry.kind !== 'container') return entry.render(n.config)
    return (
      <div
        data-testid={`container-${n.id}`}
        data-type={n.type}
        onDragOver={(e) => onContainerDragOver(e, n)}
        onDrop={(e) => onContainerDrop(e, n)}
        className={`relative h-full w-full${conflicts.includes(n.id) ? ' drag-conflict' : ''}`}
      >
        {entry.render(n.config)}
        {renderChildrenOf(n)}
      </div>
    )
  }

  const selected = doc.nodes.find((n) => n.id === selectedId) ?? null
  const side = selected && selected.x + selected.cols / 2 >= GRID_COLS / 2 ? 'left' : 'right'
  // File-level backstop: edit-time gates keep docs connected, but removals
  // can strand islands. Non-blocking warning; structure is fixed on canvas.
  const docIssues = useMemo(() => validateDoc(doc), [doc])

  const removeSelected = (id: string) => {
    setDoc((d) => removeNode(d, id))
    setSelectedId((s) => (s === id ? null : s))
  }

  // Canvas owns structure: Delete/Backspace removes the selection unless
  // the user is typing in a field.
  useEffect(() => {
    if (!selectedId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const el = document.activeElement as HTMLElement | null
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return
      e.preventDefault()
      removeSelected(selectedId)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId])

  if (!projectName) {
    return (
      <div data-testid="canvas-no-project" className="flex h-screen w-screen items-center justify-center bg-white">
        <p className="text-sm text-slate-500">No project selected — returning home…</p>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-white">
      <header className="flex h-14 items-center gap-2 border-b border-slate-200 px-3">
        <Badge data-testid="canvas-project" variant="secondary" className="font-mono">
          {projectName}
        </Badge>
        {OSB_PALETTE_TYPES.map((t) => (
          <PaletteButton
            key={t}
            testid={`palette-${t}`}
            label={OSB_REGISTRY[t].name}
            onPick={() => {
              dragRef.current = { kind: 'palette', type: t }
            }}
            onClear={clearDrag}
            onStart={() => setDragging(true)}
          />
        ))}
        {OSB_PATTERN_IDS.map((p) => (
          <PaletteButton
            key={p}
            testid={`palette-pattern-${p}`}
            label={OSB_PATTERNS[p].name}
            onPick={() => {
              dragRef.current = { kind: 'pattern', pattern: p }
            }}
            onClear={clearDrag}
            onStart={() => setDragging(true)}
          />
        ))}
        <span className="ml-auto text-xs text-slate-400">Drag onto the canvas · drag to move · corner to resize</span>
        {!docIssues.ok && (
          <span data-testid="doc-warning" className="text-xs text-amber-600">
            Pieces must touch — drag them together
          </span>
        )}
        {dropMsg && (
          <span data-testid="drop-message" className="text-xs font-medium text-rose-600">
            {dropMsg}
          </span>
        )}
        {pushMsg && (
          <span data-testid="push-status" className="text-xs text-slate-500">
            {pushMsg}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          data-testid="validate"
          onClick={() => setValidation(validateDoc(doc))}
        >
          Validate
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            clearProjectSlug()
            window.location.href = '/'
          }}
        >
          Exit project
        </Button>
        <Button
          size="sm"
          disabled={pushing || doc.nodes.length === 0}
          onClick={() => {
            setPushing(true)
            setPushMsg('Pushing…')
            pushDoc(doc, projectName)
              .then((r) => {
                setPushMsg(r.ok ? `Pushed ${r.commit!.slice(0, 7)}` : `Push failed: ${r.error}`)
              })
              .catch((e) => setPushMsg(`Push failed: ${String(e)}`))
              .finally(() => setPushing(false))
          }}
        >
          {pushing ? 'Pushing…' : 'Push'}
        </Button>
      </header>

      {validation && (
        <div data-testid="validate-panel" className="fixed right-3 top-16 z-50 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Checks</p>
            <Button type="button" aria-label="Close checks" variant="outline" size="sm" onClick={() => setValidation(null)}>
              ✕
            </Button>
          </div>
          {validation.ok ? (
            <p data-testid="validate-ok" className="mt-2 text-sm text-emerald-700">
              All checks pass — pieces touch, nothing overlaps.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1">
              {validation.errors.map((e, i) => (
                <li key={i} data-testid="validate-issue" className="text-xs text-rose-700">
                  {e}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <main
        data-testid="canvas"
        onClick={() => setSelectedId(null)}
        onDrop={onRootDrop}
        className={`relative h-[calc(100vh-3.5rem)] overflow-auto${dragging ? ' dragging-on' : ''}${dropForbidden ? ' drop-forbidden' : ''}`}
      >
        <div ref={containerRef} style={{ minWidth: minGridWidth(), height }} className="relative">
          <div className="canvas-backdrop pointer-events-none absolute inset-0" />
          <div
            aria-hidden
            data-testid="canvas-dots"
            className="canvas-dots absolute left-0 top-0"
            style={{
              gridTemplateColumns: `repeat(${GRID_COLS}, ${cell}px)`,
              gridAutoRows: `${cell}px`,
              gap: `${GRID_MARGIN_X}px`,
              width: GRID_COLS * cell + GRID_MARGIN_X * (GRID_COLS - 1),
            }}
          >
            {Array.from({ length: GRID_COLS * dotRows }, (_, i) => (
              <i key={i} className="canvas-dot" />
            ))}
          </div>
        {doc.nodes.length === 0 && (
          <div
            data-testid="canvas-empty"
            className="pointer-events-none fixed bottom-0 left-0 right-0 top-14 flex flex-col items-center justify-center gap-1"
          >
            <p className="text-sm font-medium text-slate-500">Drag a component here to start building</p>
            <p className="text-xs text-slate-400">
              {[...OSB_PALETTE_TYPES.map((t) => OSB_REGISTRY[t].name), ...OSB_PATTERN_IDS.map((p) => OSB_PATTERNS[p].name)].join(' · ')} from the bar above
            </p>
          </div>
        )}
        {mounted && (
          <GridLayout
            key={layoutEpoch}
            width={width}
            layout={layout}
            className="min-h-full"
            gridConfig={{ cols: GRID_COLS, rowHeight: cell, margin: [GRID_MARGIN_X, GRID_MARGIN_Y], containerPadding: [0, 0] }}
            compactor={noOverlap}
            dropConfig={{ enabled: true, defaultItem: { w: 10, h: 10 } }}
            dragConfig={{ cancel: '.osb-child' }}
            onDropDragOver={(e) => {
              // Inside a container the container owns feedback (red/blue
              // ghost); a root-cell ghost there would fight it.
              if ((e.target as HTMLElement).closest?.('[data-testid^="container-"]') != null) {
                return false
              }
              // Dragged footprint at the cursor + conflicts, for palette,
              // pattern, and take-out drags alike. The container path owns
              // its own feedback, so this only paints root-area state.
              const drag = dragRef.current
              const span = dragSpan(drag, doc.nodes)
              if (!span || !drag) return false
              const el = containerRef.current
              if (!el) return { w: span.cols, h: span.rows }
              const r = el.getBoundingClientRect()
              const ix = Math.round((e.clientX - r.left) / (cell + GRID_MARGIN_X) - span.cols / 2)
              const iy = Math.round((e.clientY - r.top) / (cell + GRID_MARGIN_Y) - span.rows / 2)
              const rect = { x: ix, y: iy, ...span }
              const resolved =
                drag.kind === 'move'
                  ? resolveDrop(doc.nodes, drag.id, rect)
                  : drag.kind === 'palette'
                    ? resolveInsert(doc.nodes, drag.type, rect)
                    : { parentId: null as string | null, rect }
              if (!resolved) return false
              const selfId = drag.kind === 'move' ? drag.id : null
              const nodeType =
                drag.kind === 'move'
                  ? (doc.nodes.find((x) => x.id === drag.id)?.type ?? 'text')
                  : drag.kind === 'palette'
                    ? drag.type
                    : 'card'
              markConflicts(conflictIds(doc.nodes, selfId, nodeType, resolved.rect, resolved.parentId))
              setChildGhost((g) => (g === null ? g : null))
              // The placeholder always shows the footprint; red = forbidden.
              const ok =
                drag.kind === 'move'
                  ? canInsertReason(doc.nodes, nodeType as OSBNodeType, resolved.rect, resolved.parentId, drag.id) === null
                  : drag.kind === 'palette'
                    ? canInsertReason(doc.nodes, drag.type, resolved.rect, resolved.parentId) === null
                    : canPlace(doc.nodes, rect, null)
              setDropForbidden((prev) => (prev === !ok ? prev : !ok))
              return { w: span.cols, h: span.rows }
            }}
            onDrop={onDrop}
            resizeConfig={{ handles: ['se'] }}
            onDrag={onDragCheck}
            onDragStop={(layout, _old, dragged) => commit(layout, dragged)}
            onResizeStop={(layout, _old, dragged) => commit(layout, dragged)}
          >
            {roots.map((n) => (
              <div
                key={n.id}
                data-testid="canvas-node"
                data-type={n.type}
                data-id={n.id}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedId(n.id)
                }}
                className={`relative ${n.id === selectedId ? 'canvas-selected h-full' : 'h-full'}${dragCheck && dragCheck.id === n.id && !dragCheck.ok ? ' drag-invalid' : ''}${conflicts.includes(n.id) ? ' drag-conflict' : ''}`}
              >
                {renderNodeBody(n)}
                {n.id === selectedId && (
                  <button
                    type="button"
                    data-testid="remove-node"
                    aria-label="Remove element"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeSelected(n.id)
                    }}
                    className="absolute right-1 top-1 z-10 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-600 shadow-sm hover:bg-slate-100"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </GridLayout>
        )}
        </div>
      </main>

      {selected && (
        <ConfigDrawer
          key={selected.id}
          node={selected}
          side={side}
          onClose={() => setSelectedId(null)}
          onApply={(id, config) =>
            setDoc((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === id ? { ...n, config } : n)) }))
          }
        />
      )}
    </div>
  )
}
