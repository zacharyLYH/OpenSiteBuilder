import { useMemo, useRef, useState } from 'react'
import GridLayout, { useContainerWidth, type GridLayoutProps, type Layout } from 'react-grid-layout'
// Board chrome first, canvas theme last so its overrides win the cascade.
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import './canvas.css'
import { OSB_REGISTRY } from '../osb/registry'
import { containerFloor, type CanvasDoc, type PlacedNode } from './doc'
import { canvasMetrics, GRID_COLS, GRID_MARGIN_X, GRID_MARGIN_Y, HEADER_PX, minGridWidth } from './grid'
import type { Feedback } from './gesture'
import type { PaletteEntry } from './CanvasHeader'

// Free-form grid: overlap is gated by the doc layer, never by RGL — RGL must
// allow dragging over a container so nesting can land; rejects snap back.
const noOverlap: GridLayoutProps['compactor'] = {
  type: null,
  allowOverlap: true,
  preventCollision: false,
  compact: (layout) => layout,
}

/** Percent box for a footprint inside its parent's cell rectangle. */
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

/** Selected-node delete control; the caller passes the position classes. */
function RemoveButton({ id, onRemove, className }: { id: string; onRemove: (id: string) => void; className: string }) {
  return (
    <button
      type="button"
      data-testid="remove-node"
      aria-label="Remove element"
      onClick={(e) => {
        e.stopPropagation()
        onRemove(id)
      }}
      className={className}
    >
      Remove
    </button>
  )
}

/** The RGL callbacks the board forwards; declared by the grid itself so the
 * board can never drift from the library's contract. */
type GridCallbacks = Pick<GridLayoutProps, 'onDrop' | 'onDrag' | 'onDragStop' | 'onResizeStop'>

export interface CanvasStageProps {
  // Model.
  doc: CanvasDoc
  roots: PlacedNode[]
  selectedId: string | null
  fb: Feedback
  /** Palette labels — the empty state lists exactly what the bar offers. */
  palettes: PaletteEntry[]
  /** Remount key: a fresh grid every gesture end, so refused drags snap back. */
  epoch: number
  rgl: GridCallbacks
  /** Verdict for a root-area placeholder. The board measures its own box and
   * cell size, so the controller never touches the DOM to do the arithmetic. */
  onRootDragOver(e: React.DragEvent, box: DOMRect, cell: number): { w: number; h: number } | false
  // Intents.
  onClearSelection(): void
  onSelect(id: string): void
  onRemove(id: string): void
  onBeginChildDrag(id: string, e: React.DragEvent): void
  onEndDrag(): void
  /** A nested SE resize finished: commit through the usual gate. */
  onResizeKid(id: string, rect: { x: number; y: number; cols: number; rows: number }, parentId: string): void
  onHoverContainer(e: React.DragEvent, parent: PlacedNode): void
  onContainerDrop(e: React.DragEvent, parent: PlacedNode): void
}

/**
 * The canvas surface: backdrop, dot guides, empty invitation, the RGL board
 * and every node on it. Select / delete / resize / drag and the feedback
 * (ghosts, reds, bounds) render here; the controller owns the rules.
 */
export default function CanvasStage(p: CanvasStageProps) {
  const { doc, selectedId, fb } = p
  // The board measures itself: width in, geometry out. The controller only
  // ever asks for numbers, never for the element.
  const { width, containerRef, mounted } = useContainerWidth()
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 856
  const { cell, dotRows, height } = canvasMetrics(width, viewportHeight, p.roots)
  // Live child-resize preview (committed to the doc on mouse-up).
  const [resizing, setResizing] = useState<{ id: string; cols: number; rows: number } | null>(null)
  // True while a child SE-resize is in flight (suppresses HTML5 drag).
  const resizeActive = useRef(false)
  const resizeDims = useRef<{ cols: number; rows: number } | null>(null)

  /** SE resize for nested atoms; commits on release through the usual gate. */
  const startChildResize = (e: React.MouseEvent, parent: PlacedNode, kid: PlacedNode) => {
    e.stopPropagation()
    e.preventDefault()
    const shell = (e.currentTarget as HTMLElement).closest('[data-testid^="container-"]') as HTMLElement | null
    if (!shell) return
    const g = OSB_REGISTRY[kid.type].grid
    const { width: boxW, height: boxH } = shell.getBoundingClientRect()
    const { clientX: startX, clientY: startY } = e
    const pitchX = boxW / parent.cols
    const pitchY = boxH / parent.rows
    // Clamp into the shell and the type's own min/max footprint.
    const dimsAt = (dx: number, dy: number) => ({
      cols: Math.max(g.minCols, Math.min(g.maxCols, Math.min(parent.cols - kid.x, kid.cols + Math.round(dx / pitchX)))),
      rows: Math.max(g.minRows, Math.min(g.maxRows, Math.min(parent.rows - kid.y, kid.rows + Math.round(dy / pitchY)))),
    })
    resizeActive.current = true
    resizeDims.current = { cols: kid.cols, rows: kid.rows }
    const onMove = (ev: MouseEvent) => {
      const dims = dimsAt(ev.clientX - startX, ev.clientY - startY)
      resizeDims.current = dims
      setResizing((r) => (r && r.id === kid.id && r.cols === dims.cols && r.rows === dims.rows ? r : { id: kid.id, ...dims }))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      resizeActive.current = false
      const dims = resizeDims.current
      resizeDims.current = null
      setResizing(null)
      if (!dims || (dims.cols === kid.cols && dims.rows === kid.rows)) return
      p.onResizeKid(kid.id, { x: kid.x, y: kid.y, ...dims }, parent.id)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  /** A container's whole body: its chrome, its children, the landing ghost,
   * and the dashed invitation when it is empty. */
  const containerBody = (parent: PlacedNode) => {
    const entry = OSB_REGISTRY[parent.type]
    const kids = doc.nodes.filter((n) => n.parentId === parent.id)
    // Bounds on demand: transparent atoms (text) are invisible otherwise.
    const showBounds = parent.id === selectedId
    return (
      <div
        data-testid={`container-${parent.id}`}
        data-type={parent.type}
        onDragOver={(e) => p.onHoverContainer(e, parent)}
        onDrop={(e) => p.onContainerDrop(e, parent)}
        className={`relative h-full w-full${fb.conflicts.includes(parent.id) ? ' drag-conflict' : ''}`}
      >
        {entry.render(parent.config)}
        <div
          data-testid={showBounds ? 'child-bounds' : undefined}
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
                p.onBeginChildDrag(k.id, e)
              }}
              onDragEnd={p.onEndDrag}
              onClick={(e) => {
                e.stopPropagation()
                p.onSelect(k.id)
              }}
              style={childPos(parent, resizing?.id === k.id ? { ...k, ...resizing } : k)}
              className={`osb-child pointer-events-auto ${k.id === selectedId ? 'canvas-selected overflow-hidden' : 'overflow-hidden'}${fb.conflicts.includes(k.id) ? ' drag-conflict' : ''}`}
            >
              {OSB_REGISTRY[k.type].render(k.config)}
              {k.id === selectedId && (
                <>
                  <div
                    data-testid={`resize-${k.id}`}
                    aria-label="Resize element"
                    onMouseDown={(e) => startChildResize(e, parent, k)}
                    className="absolute bottom-0 right-0 z-10 h-4 w-4 cursor-se-resize rounded-tl-md border-l border-t border-sky-500 bg-white/90"
                  />
                  <RemoveButton
                    id={k.id}
                    onRemove={p.onRemove}
                    className="absolute right-0 top-0 z-10 rounded-bl-md bg-white px-1.5 py-0.5 text-[10px] text-slate-600 shadow-sm hover:bg-slate-100"
                  />
                </>
              )}
            </div>
          ))}
        </div>
        {fb.ghost && fb.ghost.parentId === parent.id && (
          <div
            aria-hidden
            data-testid="drop-ghost"
            data-ok={fb.ghost.ok}
            style={childPos(parent, fb.ghost)}
            className={`pointer-events-none absolute rounded-md border-2 border-dashed ${
              fb.ghost.ok ? 'border-sky-500 bg-sky-500/10' : 'border-rose-500 bg-rose-500/10'
            }`}
          />
        )}
        {kids.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-3">
            <div
              data-testid={`empty-hint-${parent.id}`}
              className="rounded-lg border-2 border-dashed border-slate-300 bg-white/60 px-4 py-3 text-center text-xs text-slate-400"
            >
              {entry.emptyHint ?? 'Drag content here'}
            </div>
          </div>
        )}
      </div>
    )
  }

  // One footprint per root, with the minimum its children demand.
  const layout: Layout = useMemo(
    () =>
      p.roots.map((n) => {
        const g = OSB_REGISTRY[n.type].grid
        const floor = containerFloor(doc.nodes, n.id)
        return {
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
      }),
    [doc, p.roots],
  )

  return (
    <main
      data-testid="canvas"
      onClick={p.onClearSelection}
      style={{ height: `calc(100vh - ${HEADER_PX}px)` }}
      className={`relative overflow-auto${fb.dragging ? ' dragging-on' : ''}${fb.forbidden ? ' drop-forbidden' : ''}`}
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
            <p className="text-xs text-slate-400">{p.palettes.map((e) => e.label).join(' · ')} from the bar above</p>
          </div>
        )}
        {mounted && (
          <GridLayout
            key={p.epoch}
            width={width}
            layout={layout}
            className="min-h-full"
            gridConfig={{ cols: GRID_COLS, rowHeight: cell, margin: [GRID_MARGIN_X, GRID_MARGIN_Y], containerPadding: [0, 0] }}
            compactor={noOverlap}
            dropConfig={{ enabled: true, defaultItem: { w: 10, h: 10 } }}
            dragConfig={{ cancel: '.osb-child' }}
            resizeConfig={{ handles: ['se'] }}
            {...p.rgl}
            onDropDragOver={(e) => {
              const box = containerRef.current?.getBoundingClientRect()
              return box ? p.onRootDragOver(e, box, cell) : false
            }}
          >
            {p.roots.map((n) => (
              <div
                key={n.id}
                data-testid="canvas-node"
                data-type={n.type}
                data-id={n.id}
                onClick={(e) => {
                  e.stopPropagation()
                  p.onSelect(n.id)
                }}
                className={`relative ${n.id === selectedId ? 'canvas-selected h-full' : 'h-full'}${fb.check && fb.check.id === n.id && !fb.check.ok ? ' drag-invalid' : ''}${fb.conflicts.includes(n.id) ? ' drag-conflict' : ''}`}
              >
                {OSB_REGISTRY[n.type].kind === 'container' ? containerBody(n) : OSB_REGISTRY[n.type].render(n.config)}
                {n.id === selectedId && (
                  <RemoveButton
                    id={n.id}
                    onRemove={p.onRemove}
                    className="absolute right-1 top-1 z-10 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-600 shadow-sm hover:bg-slate-100"
                  />
                )}
              </div>
            ))}
          </GridLayout>
        )}
      </div>
    </main>
  )
}
