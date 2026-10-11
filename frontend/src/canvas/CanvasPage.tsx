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
  canPlace,
  containerFloor,
  insertNode,
  insertPattern,
  moveNode,
  nestLocal,
  nestTargetAt,
  reasonText,
  removeNode,
  validateDoc,
  type CanvasDoc,
  type PlacedNode,
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

function childPos(parent: PlacedNode, kid: PlacedNode): React.CSSProperties {
  return {
    position: 'absolute',
    left: `${(kid.x / parent.cols) * 100}%`,
    top: `${(kid.y / parent.rows) * 100}%`,
    width: `${(kid.cols / parent.cols) * 100}%`,
    height: `${(kid.rows / parent.rows) * 100}%`,
  }
}

/** Local cell inside a container from a drop event (center-point rule). */
function localCellFromEvent(
  e: React.DragEvent,
  el: HTMLElement,
  parent: PlacedNode,
  span: { cols: number; rows: number },
): { x: number; y: number } {
  const r = el.getBoundingClientRect()
  const fx = (e.clientX - r.left) / Math.max(1, r.width)
  const fy = (e.clientY - r.top) / Math.max(1, r.height)
  return {
    x: Math.max(0, Math.min(parent.cols - span.cols, Math.floor(fx * parent.cols))),
    y: Math.max(0, Math.min(parent.rows - span.rows, Math.floor(fy * parent.rows))),
  }
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
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [pushing, setPushing] = useState(false)
  const [pushMsg, setPushMsg] = useState('')
  // Transient drop feedback: rejected gestures fail silently otherwise.
  const [dropMsg, setDropMsg] = useState<string | null>(null)
  const dropMsgTimer = useRef<number | null>(null)
  // Live child-resize preview (committed to the doc on mouse-up).
  const [resizing, setResizing] = useState<{ id: string; cols: number; rows: number } | null>(null)
  const { width, containerRef, mounted } = useContainerWidth()
  // One query owns every resolution-dependent size (cell, dots, scroll height).
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 856
  const roots = useMemo(() => doc.nodes.filter((n) => n.parentId === null), [doc])
  const { cell, dotRows, height } = canvasMetrics(width, viewportHeight, roots)
  // Palette drag type travels in a ref, not dataTransfer (reliable in tests).
  const dragType = useRef<OSBNodeType | null>(null)
  // Palette pattern (multi-node composition) being dragged, if any.
  const dragPattern = useRef<string | null>(null)
  // Existing child being reparented/repositioned.
  const dragId = useRef<string | null>(null)
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

  const commit = (next: Layout) => {
    setDoc((d) => {
      let nodes = d.nodes
      for (const l of next) {
        const cur = nodes.find((n) => n.id === l.i)
        if (!cur || cur.parentId !== null) continue
        if (cur.x === l.x && cur.y === l.y && cur.cols === l.w && cur.rows === l.h) continue
        const rect = { x: l.x, y: l.y, cols: l.w, rows: l.h }
        // Fungible move: an internal RGL drag whose center lands in a
        // container nests (child-driven); otherwise it stays at root.
        const center = { x: rect.x + rect.cols / 2, y: rect.y + rect.rows / 2 }
        const target = nestTargetAt(nodes, center)
        if (target && target.id !== cur.id && canContain(target.type, cur.type)) {
          const local = {
            x: Math.max(0, Math.min(target.cols - rect.cols, l.x - target.x)),
            y: Math.max(0, Math.min(target.rows - rect.rows, l.y - target.y)),
          }
          const r = moveNode({ ...d, nodes }, l.i, { ...local, cols: rect.cols, rows: rect.rows }, target.id)
          if (r.ok) {
            nodes = r.doc.nodes
            continue
          }
        }
        const r = moveNode({ ...d, nodes }, l.i, rect, null)
        if (r.ok) nodes = r.doc.nodes
      }
      return { ...d, nodes }
    })
  }

  const dropSpan = (): { cols: number; rows: number } | null => {
    if (dragId.current) {
      const n = doc.nodes.find((x) => x.id === dragId.current)
      return n ? { cols: n.cols, rows: n.rows } : null
    }
    if (dragPattern.current) {
      const p = OSB_PATTERNS[dragPattern.current]
      return p ? { cols: p.containerCols, rows: p.containerRows } : null
    }
    if (dragType.current) {
      const g = OSB_REGISTRY[dragType.current].grid
      return { cols: g.cols, rows: g.rows }
    }
    return null
  }

  const clearDrag = () => {
    dragType.current = null
    dragPattern.current = null
    dragId.current = null
    setHoverId((h) => (h === null ? h : null))
  }

  /** Surface a rejection where the user can see it; auto-clears. */
  const reject = (reason: Parameters<typeof reasonText>[0]) => {
    if (dropMsgTimer.current !== null) window.clearTimeout(dropMsgTimer.current)
    setDropMsg(reasonText(reason))
    dropMsgTimer.current = window.setTimeout(() => setDropMsg(null), 2600)
  }

  /** Palette or child drop onto the root canvas (RGL onDrop). Container
   * drops are owned by the container div (see onContainerDrop): RGL's native
   * listener fires before React handlers bubble, so without the guard below
   * one child drop would move twice and strand RGL's dropping placeholder. */
  const onDrop = (_layout: Layout, item: LayoutItem | undefined, e?: Event) => {
    if ((e?.target as HTMLElement | undefined)?.closest?.('[data-testid^="container-"]') != null) return
    const type = dragType.current
    const patternKey = dragPattern.current
    const movingId = dragId.current
    clearDrag()
    if (!item) return
    if (movingId) {
      // Take-out to root: keep the child's size, use the drop cell.
      const moving = doc.nodes.find((n) => n.id === movingId)
      if (!moving) return
      const rect = { x: item.x, y: item.y, cols: moving.cols, rows: moving.rows }
      // Center inside a container = nest instead of root (child-driven).
      const center = { x: rect.x + rect.cols / 2, y: rect.y + rect.rows / 2 }
      const target = nestTargetAt(doc.nodes, center)
      if (target && target.id !== moving.parentId && canContain(target.type, moving.type)) {
        // Floored: odd-sized atoms have fractional centers; rects stay integral.
        const local = nestLocal(target, center, { cols: rect.cols, rows: rect.rows })
        const r = moveNode(doc, movingId, { ...local, cols: rect.cols, rows: rect.rows }, target.id)
        if (r.ok) {
          setDoc(r.doc)
          setSelectedId(movingId)
        } else {
          reject(r.reason)
        }
        return
      }
      const r = moveNode(doc, movingId, rect, null)
      if (r.ok) {
        setDoc(r.doc)
        setSelectedId(movingId)
      } else {
        reject(r.reason)
      }
      return
    }
    // Pattern drop: the whole composition lands atomically or not at all.
    if (patternKey) {
      const r = insertPattern(
        doc,
        patternKey,
        crypto.randomUUID(),
        { x: item.x, y: item.y, cols: 0, rows: 0 },
        OSB_PATTERNS[patternKey].children.map(() => crypto.randomUUID()),
      )
      if (r.ok) {
        setDoc(r.doc)
        setSelectedId(r.doc.nodes[r.doc.nodes.length - OSB_PATTERNS[patternKey].children.length - 1].id)
      } else {
        reject(r.reason)
      }
      return
    }
    if (!type) return
    const g = OSB_REGISTRY[type].grid
    const rect = { x: item.x, y: item.y, cols: g.cols, rows: g.rows }
    // Child-driven nesting: center in a container + kind rule = child.
    const target = nestTargetAt(doc.nodes, { x: rect.x + rect.cols / 2, y: rect.y + rect.rows / 2 })
    if (target && canContain(target.type, type)) {
      // Floored: odd-sized atoms have fractional centers; rects stay integral.
      const local = nestLocal(target, { x: rect.x + rect.cols / 2, y: rect.y + rect.rows / 2 }, { cols: rect.cols, rows: rect.rows })
      const id = crypto.randomUUID()
      const r = insertNode(doc, { id, type, config: {}, parentId: target.id, ...local, cols: rect.cols, rows: rect.rows })
      if (r.ok) {
        setDoc(r.doc)
        setSelectedId(id)
      } else {
        reject(r.reason)
      }
      return
    }
    // Single gate: overlaps, gaps (contiguity), and bad footprints never land.
    const id = crypto.randomUUID()
    const r = insertNode(doc, { id, type, config: {}, parentId: null, ...rect })
    if (r.ok) {
      setDoc(r.doc)
      setSelectedId(id)
    } else {
      reject(r.reason)
    }
  }

  /** Take-out: HTML5 child drag dropped on root background (bypasses RGL). */
  const onRootDrop = (e: React.DragEvent) => {
    if (!dragId.current) return
    if ((e.target as HTMLElement).closest?.('[data-testid^="container-"]') != null) return
    if ((e.target as HTMLElement).closest?.('[data-parent]') != null) return
    e.preventDefault()
    e.stopPropagation()
    const movingId = dragId.current
    const moving = doc.nodes.find((n) => n.id === movingId)
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
    const res = moveNode(doc, movingId, rect, null)
    if (res.ok) {
      setDoc(res.doc)
      setSelectedId(movingId)
    } else {
      reject(res.reason)
    }
  }

  /** Drop (palette child or existing node) onto a container div. */
  const onContainerDrop = (e: React.DragEvent, parent: PlacedNode) => {
    e.preventDefault()
    e.stopPropagation()
    const span = dropSpan()
    const type = dragType.current
    const movingId = dragId.current
    clearDrag()
    if (!span) return
    const el = e.currentTarget as HTMLElement
    const at = localCellFromEvent(e, el, parent, span)
    const rect = { ...at, ...span }
    if (movingId) {
      const moving = doc.nodes.find((n) => n.id === movingId)
      if (!moving || !canContain(parent.type, moving.type)) {
        reject('kind')
        return
      }
      const r = moveNode(doc, movingId, rect, parent.id)
      if (r.ok) {
        setDoc(r.doc)
        setSelectedId(movingId)
      } else {
        reject(r.reason)
      }
      return
    }
    if (!type || !canContain(parent.type, type)) {
      reject('kind')
      return
    }
    const id = crypto.randomUUID()
    const r = insertNode(doc, { id, type, config: {}, parentId: parent.id, ...rect })
    if (r.ok) {
      setDoc(r.doc)
      setSelectedId(id)
    } else {
      reject(r.reason)
    }
  }

  const onContainerDragOver = (e: React.DragEvent, parent: PlacedNode) => {
    const type = dragType.current
    const movingId = dragId.current
    const moving = movingId ? doc.nodes.find((n) => n.id === movingId) : null
    const ok = type
      ? canContain(parent.type, type)
      : moving && moving.parentId !== parent.id
        ? canContain(parent.type, moving.type)
        : moving && moving.parentId === parent.id
    if (type || moving) e.preventDefault()
    // Update only on change (one UI state field).
    setHoverId((h) => {
      const next = ok ? parent.id : null
      return h === next ? h : next
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
    const hovering = hoverId === parent.id
    // Bounds on demand: transparent atoms (text) are invisible otherwise.
    const showBounds = hovering || parent.id === selectedId
    return (
      <>
        <div
          className={
            hovering
              ? 'pointer-events-none absolute inset-0 opacity-40'
              : `pointer-events-none absolute inset-0${showBounds ? ' show-child-bounds' : ''}`
          }
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
                dragId.current = k.id
                dragType.current = null
                dragPattern.current = null
                e.dataTransfer.setData('text/plain', k.id)
              }}
              onDragEnd={clearDrag}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedId(k.id)
              }}
              style={childPos(parent, resizing?.id === k.id ? { ...k, ...resizing } : k)}
              className={`osb-child pointer-events-auto ${k.id === selectedId ? 'canvas-selected overflow-hidden' : 'overflow-hidden'}`}
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
        {hovering && <div aria-hidden data-testid={`drop-wash-${parent.id}`} className="pointer-events-none absolute inset-0 bg-sky-400/10" />}
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
    const hovering = hoverId === n.id
    return (
      <div
        data-testid={`container-${n.id}`}
        data-type={n.type}
        onDragOver={(e) => onContainerDragOver(e, n)}
        onDragLeave={() => setHoverId((h) => (h === n.id ? null : h))}
        onDrop={(e) => onContainerDrop(e, n)}
        className={`relative h-full w-full ${hovering ? 'ring-4 ring-sky-400' : ''}`}
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
          <Button
            key={t}
            data-testid={`palette-${t}`}
            variant="outline"
            size="sm"
            draggable
            onPointerDown={() => {
              dragType.current = t
              dragPattern.current = null
              dragId.current = null
            }}
            onDragStart={(e) => {
              dragType.current = t
              dragPattern.current = null
              dragId.current = null
              e.dataTransfer.setData('text/plain', t)
            }}
            onDragEnd={clearDrag}
            className="cursor-grab"
          >
            {OSB_REGISTRY[t].name}
          </Button>
        ))}
        {OSB_PATTERN_IDS.map((p) => (
          <Button
            key={p}
            data-testid={`palette-pattern-${p}`}
            variant="outline"
            size="sm"
            draggable
            onPointerDown={() => {
              dragPattern.current = p
              dragType.current = null
              dragId.current = null
            }}
            onDragStart={(e) => {
              dragPattern.current = p
              dragType.current = null
              dragId.current = null
              e.dataTransfer.setData('text/plain', p)
            }}
            onDragEnd={clearDrag}
            className="cursor-grab"
          >
            {OSB_PATTERNS[p].name}
          </Button>
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

      <main
        data-testid="canvas"
        onClick={() => setSelectedId(null)}
        onDragOver={(e) => {
          // Allow root take-out drops.
          if (dragId.current) e.preventDefault()
        }}
        onDrop={onRootDrop}
        className="relative h-[calc(100vh-3.5rem)] overflow-auto"
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
            width={width}
            layout={layout}
            className="min-h-full"
            gridConfig={{ cols: GRID_COLS, rowHeight: cell, margin: [GRID_MARGIN_X, GRID_MARGIN_Y], containerPadding: [0, 0] }}
            compactor={noOverlap}
            dropConfig={{ enabled: true, defaultItem: { w: 10, h: 10 } }}
            dragConfig={{ cancel: '.osb-child' }}
            onDropDragOver={(e) => {
              // Inside a container the container owns feedback (hover ring);
              // a root-cell ghost there would fight it and strand on drop.
              if (dragId.current && (e.target as HTMLElement).closest?.('[data-testid^="container-"]') != null) {
                return false
              }
              if (dragId.current) {
                const n = doc.nodes.find((x) => x.id === dragId.current)
                return n ? { w: n.cols, h: n.rows } : false
              }
              const pk = dragPattern.current
              if (pk) {
                const p = OSB_PATTERNS[pk]
                return p ? { w: p.containerCols, h: p.containerRows } : false
              }
              const t = dragType.current
              if (!t) return false
              // No false promise: only preview drops the gate would accept.
              // Center-point rule first (a center inside an accepting
              // container nests), then the root overlap gate.
              const g = OSB_REGISTRY[t].grid
              const el = containerRef.current
              if (el) {
                const r = el.getBoundingClientRect()
                const ix = Math.round((e.clientX - r.left) / (cell + GRID_MARGIN_X) - g.cols / 2)
                const iy = Math.round((e.clientY - r.top) / (cell + GRID_MARGIN_Y) - g.rows / 2)
                const rect = { x: ix, y: iy, cols: g.cols, rows: g.rows }
                const target = nestTargetAt(doc.nodes, { x: ix + g.cols / 2, y: iy + g.rows / 2 })
                if (target && canContain(target.type, t)) return { w: g.cols, h: g.rows }
                if (!target && canPlace(doc.nodes, rect, null)) return { w: g.cols, h: g.rows }
                return false
              }
              return { w: g.cols, h: g.rows }
            }}
            onDrop={onDrop}
            resizeConfig={{ handles: ['se'] }}
            onDragStop={commit}
            onResizeStop={commit}
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
                className={`relative ${n.id === selectedId || hoverId === n.id ? 'canvas-selected h-full' : 'h-full'}`}
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
