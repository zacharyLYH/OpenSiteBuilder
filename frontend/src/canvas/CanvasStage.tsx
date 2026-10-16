import { useMemo, useRef, useState } from 'react'
import GridLayout, { useContainerWidth, type GridLayoutProps, type Layout } from 'react-grid-layout'
// Board chrome first, canvas theme last so its overrides win the cascade.
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import './canvas.css'
import { OSB_REGISTRY } from '../osb/registry'
import { overlayChildStyle } from '../osb/OSBOverlay'
import { useOSBTheme } from '../osb/OSBTheme'
import { startChildResize } from './childResize'
import { containerFloor, type CanvasDoc, type PlacedNode } from './doc'
import PlacedChildLayer from './PlacedChildLayer'
import RemoveControl from './RemoveControl'
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
  /** Hide the editor grid (dots + backdrop) so the canvas reads as the site. */
  preview: boolean
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
  const { doc, selectedId, fb, preview } = p
  const theme = useOSBTheme()
  // The board measures itself: width in, geometry out. The controller only
  // ever asks for numbers, never for the element.
  const { width, containerRef, mounted } = useContainerWidth()
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 856
  const { cell, dotRows, height } = canvasMetrics(width, viewportHeight, p.roots)
  // Live child-resize preview (committed to the doc on mouse-up).
  const [resizing, setResizing] = useState<{ id: string; cols: number; rows: number } | null>(null)
  // True while a child SE-resize is in flight (suppresses HTML5 drag).
  const resizeActive = useRef(false)

  /** SE resize for nested kids; commits on release through the usual gate.
   * The box is the nearest container shell. */
  const onChildResize = (e: React.MouseEvent, parent: PlacedNode, kid: PlacedNode) => {
    const shell = (e.currentTarget as HTMLElement).closest(
      '[data-testid^="container-"]',
    ) as HTMLElement | null
    if (!shell) return
    startChildResize(e, {
      box: shell.getBoundingClientRect(),
      parent,
      kid,
      grid: OSB_REGISTRY[kid.type].grid,
      onActive: (a) => (resizeActive.current = a),
      onPreview: (dims) => setResizing(dims ? { id: kid.id, ...dims } : null),
      onCommit: (dims) => p.onResizeKid(kid.id, { x: kid.x, y: kid.y, ...dims }, parent.id),
    })
  }

  /** One shell body for any container with children. Chrome, layer, landing
   * ghost, and the dashed invitation read the same. */
  const shellDecor = (parent: PlacedNode) => (
    <>
      {fb.ghost && fb.ghost.parentId === parent.id && (
        <div
          aria-hidden
          data-testid="drop-ghost"
          data-ok={fb.ghost.ok}
          style={overlayChildStyle(parent, fb.ghost)}
          className={`pointer-events-none absolute rounded-md border-2 border-dashed ${fb.ghost.ok ? 'border-sky-500 bg-sky-500/10' : 'border-rose-500 bg-rose-500/10'
            }`}
        />
      )}
      {doc.nodes.filter((n) => n.parentId === parent.id).length === 0 && (
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

  /** The child layer for a container: its atom kids on the shared surface. */
  const childLayerFor = (parent: PlacedNode, bounds = false) => (
    <PlacedChildLayer
      parent={parent}
      kids={doc.nodes.filter((n) => n.parentId === parent.id)}
      selectedId={selectedId}
      conflicts={fb.conflicts}
      resizing={resizing}
      bounds={bounds}
      ids={{ node: 'canvas-node', resize: (id) => `resize-${id}`, remove: 'remove-node' }}
      interactive={!preview}
      onSelect={p.onSelect}
      onRemove={p.onRemove}
      onDragStart={(k, e) => {
        if (resizeActive.current) {
          e.preventDefault()
          return
        }
        p.onBeginChildDrag(k.id, e)
      }}
      onDragEnd={p.onEndDrag}
      onResize={(e, k) => onChildResize(e, parent, k)}
    />
  )

  /** A container's whole body: its chrome, its children, the landing ghost,
   * and the dashed invitation when it is empty. */
  const containerBody = (parent: PlacedNode) => {
    // Bounds on demand: transparent atoms (text) are invisible otherwise.
    const showBounds = parent.id === selectedId
    // The children render inside an inset box, so items sit off the interior
    // edge exactly as the published flow layout does. The drop/resize handlers
    // stay on the OUTER shell, though: the doc grid is the full container box,
    // so padding is a pure visual inset and never shifts the coordinate space.
    const inset = OSB_REGISTRY[parent.type].contentPad?.(parent.config) ?? ''
    return (
      <div
        data-testid={`container-${parent.id}`}
        data-type={parent.type}
        onDragOver={preview ? undefined : (e) => p.onHoverContainer(e, parent)}
        onDrop={preview ? undefined : (e) => p.onContainerDrop(e, parent)}
        className={`relative h-full w-full${fb.conflicts.includes(parent.id) ? ' drag-conflict' : ''}`}
      >
        {OSB_REGISTRY[parent.type].render(parent.config)}
        <div className={`absolute inset-0 ${inset}`}>
          <div data-testid={`content-box-${parent.id}`} className="relative h-full w-full">
            {childLayerFor(parent, showBounds)}
            {!preview && shellDecor(parent)}
          </div>
        </div>
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
      data-theme={theme}
      data-preview={preview ? 'true' : 'false'}
      onClick={p.onClearSelection}
      style={{ height: `calc(100vh - ${HEADER_PX}px)` }}
      className={`relative overflow-auto${theme === 'dark' ? ' bg-slate-950' : preview ? ' bg-white' : ''}${fb.dragging ? ' dragging-on' : ''
        }${fb.forbidden ? ' drop-forbidden' : ''}`}
    >
      <div ref={containerRef} style={{ minWidth: minGridWidth(), height }} className="relative">
        {/* Neon backdrop is editor chrome and light-only; preview hides it. */}
        {!preview && theme === 'light' && <div className="canvas-backdrop pointer-events-none absolute inset-0" />}
        {!preview && (
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
        )}
        {doc.nodes.length === 0 && !preview && (
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
            dropConfig={{ enabled: !preview, defaultItem: { w: 10, h: 10 } }}
            dragConfig={{ cancel: '.osb-child', enabled: !preview }}
            resizeConfig={{ enabled: !preview, handles: ['se'] }}
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
                onClick={
                  preview
                    ? undefined
                    : (e) => {
                        // Linked buttons render real <a> tags: stay in the editor.
                        e.preventDefault()
                        e.stopPropagation()
                        p.onSelect(n.id)
                      }
                }
                className={`relative ${!preview && n.id === selectedId ? 'canvas-selected h-full' : 'h-full'}${fb.check && fb.check.id === n.id && !fb.check.ok ? ' drag-invalid' : ''}${fb.conflicts.includes(n.id) ? ' drag-conflict' : ''}`}
              >
                {(() => {
                  // Containers own a child layer; leaves render bare.
                  // Overlays never sit on the grid (the gate refuses them),
                  // so there is nothing to draw for one here.
                  const kind = OSB_REGISTRY[n.type].kind
                  return kind === 'atom' ? OSB_REGISTRY[n.type].render(n.config) : kind === 'overlay' ? null : containerBody(n)
                })()}
                {!preview && n.id === selectedId && (
                  <RemoveControl
                    testid="remove-node"
                    id={n.id}
                    onRemove={p.onRemove}
                    className="absolute right-1 top-1 z-10 h-auto rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs font-normal text-slate-600 shadow-sm hover:bg-slate-100"
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
