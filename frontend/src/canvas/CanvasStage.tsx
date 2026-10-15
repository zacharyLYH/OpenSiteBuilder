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
import OSBCarousel from '../osb/OSBCarousel'
import { slotLeft } from '../osb/slots'
import { containerFloor, slotBandsOf, slotOfRect, slideWindowOf, type CanvasDoc, type PlacedNode, type SlideWindow } from './doc'
import PlacedChildLayer, { PlacedChildBox } from './PlacedChildLayer'
import RemoveControl from './RemoveControl'
import { canvasMetrics, GRID_COLS, GRID_MARGIN_X, GRID_MARGIN_Y, HEADER_PX, minGridWidth } from './grid'
import type { OSBSlotKid, OSBSlot } from '../osb/types'
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
  /** Which slide each slotted container is showing, by node id. The controller
   * owns it because the landing rules (drop routing) read it too. */
  slideOf: Record<string, number>
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
  /** `window` is the page of slides a slotted container is showing; the
   * controller's cell math needs it to know which slide is under the pointer. */
  onHoverContainer(e: React.DragEvent, parent: PlacedNode, window: SlideWindow): void
  onContainerDrop(e: React.DragEvent, parent: PlacedNode, window: SlideWindow): void
  /** The editor's carousel moved: the controller's drop zones follow it. */
  onSlideChange(id: string, index: number): void
  /** A drag left a container body (ghost + reds belong to the hover). */
  onLeaveContainer(e: React.DragEvent): void
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

  /** The page of slides a slotted container is showing right now. The arrows
   * and dots move it (the component reports the change up), and the drop math
   * + the ghost read it — so what a user drops on is always what they see. */
  const windowFor = (parent: PlacedNode): SlideWindow => slideWindowOf(parent, p.slideOf[parent.id] ?? 0)

  /** SE resize for nested kids; commits on release through the usual gate.
   * The box is the nearest container shell — or, in a carousel, the slide on
   * screen, so a resize can never reach into another slide. */
  const onChildResize = (e: React.MouseEvent, parent: PlacedNode, kid: PlacedNode) => {
    const el = e.currentTarget as HTMLElement
    const slide = el.closest('[data-testid="osb-carousel-slide"]') as HTMLElement | null
    const shell = el.closest('[data-testid^="container-"]') as HTMLElement | null
    const box = slide ?? shell
    if (!box) return
    const bands = slotBandsOf(parent)
    const slotted = bands.slots > 1
    startChildResize(e, {
      box: box.getBoundingClientRect(),
      parent: slotted ? { cols: bands.bandCols, rows: parent.rows } : parent,
      kid: slotted ? { ...kid, x: kid.x - slotLeft(slotOfRect(bands, kid), bands.bandCols) } : kid,
      grid: OSB_REGISTRY[kid.type].grid,
      onActive: (a) => (resizeActive.current = a),
      onPreview: (dims) => setResizing(dims ? { id: kid.id, ...dims } : null),
      onCommit: (dims) => p.onResizeKid(kid.id, { x: kid.x, y: kid.y, ...dims }, parent.id),
    })
  }

  /**
   * Where a slide — and a cell inside it — sits on screen. A carousel shows a
   * PAGE of slides, so a slide is a slice of the shell and its cells are its
   * own; the controller's drop math (`eventCell`) reads the same window.
   */
  const slideStyle = (
    parent: PlacedNode,
    w: SlideWindow,
    slot: number,
    rect: { x: number; y: number; cols: number; rows: number },
  ) => {
    const bands = slotBandsOf(parent)
    const page = Math.max(1, w.perView)
    const local = (rect.x - slotLeft(slot, bands.bandCols)) / bands.bandCols
    return {
      position: 'absolute' as const,
      left: `${((slot - w.index + local) * 100) / page}%`,
      top: `${(rect.y / parent.rows) * 100}%`,
      width: `${((rect.cols / bands.bandCols) * 100) / page}%`,
      height: `${(rect.rows / parent.rows) * 100}%`,
    }
  }

  /** The landing ghost: a percent box inside the shell — or, in a carousel, on
   * the slide that is on screen, exactly where the drop would land. */
  const ghostFor = (parent: PlacedNode) => {
    if (!fb.ghost || fb.ghost.parentId !== parent.id) return null
    const bands = slotBandsOf(parent)
    const style =
      bands.slots <= 1 ? overlayChildStyle(parent, fb.ghost) : slideStyle(parent, windowFor(parent), slotOfRect(bands, fb.ghost), fb.ghost)
    return (
      <div
        aria-hidden
        data-testid="drop-ghost"
        data-ok={fb.ghost.ok}
        style={style}
        className={`pointer-events-none absolute rounded-md border-2 border-dashed ${fb.ghost.ok ? 'border-sky-500 bg-sky-500/10' : 'border-rose-500 bg-rose-500/10'
          }`}
      />
    )
  }

  /** The dashed invitation of a plain container. */
  const emptyHint = (parent: PlacedNode) =>
    doc.nodes.filter((n) => n.parentId === parent.id).length === 0 && (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-3">
        <div
          data-testid={`empty-hint-${parent.id}`}
          className="rounded-lg border-2 border-dashed border-slate-300 bg-white/60 px-4 py-3 text-center text-xs text-slate-400"
        >
          {OSB_REGISTRY[parent.type].emptyHint ?? 'Drag content here'}
        </div>
      </div>
    )

  /** A slotted container invites the user slide by slide: one dashed box per
   * empty slide ON SCREEN, named, so "where do I drop this?" answers itself. */
  const slideHints = (parent: PlacedNode) => {
    const bands = slotBandsOf(parent)
    const w = windowFor(parent)
    return Array.from({ length: w.perView }, (_, i) => {
      const slot = w.index + i
      if (doc.nodes.some((n) => n.parentId === parent.id && slotOfRect(bands, n) === slot)) return null
      return (
        <div
          key={slot}
          data-testid={`empty-hint-${parent.id}-${slot}`}
          style={slideStyle(parent, w, slot, { x: slotLeft(slot, bands.bandCols), y: 0, cols: bands.bandCols, rows: parent.rows })}
          className="pointer-events-none flex items-center justify-center p-3"
        >
          <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 px-3 py-2 text-center text-[10px] leading-4 text-slate-400">
            <span className="block font-medium">Slide {slot + 1}</span>
            {OSB_REGISTRY[parent.type].emptyHint ?? 'Drag content here'}
          </div>
        </div>
      )
    })
  }

  /** The child layer for a container: its atom kids on the shared surface.
   * `space` overrides the cell box the kids are measured against — a slide of
   * a slotted container measures against its own band. */
  const childLayerFor = (parent: PlacedNode, bounds = false, space?: { cols: number; rows: number; kids: PlacedNode[] }) => (
    <PlacedChildLayer
      parent={{ cols: space?.cols ?? parent.cols, rows: space?.rows ?? parent.rows, id: parent.id }}
      kids={space?.kids ?? doc.nodes.filter((n) => n.parentId === parent.id)}
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

  /**
   * A slotted container renders the REAL carousel — the same component the
   * published site ships, arrows and dots included, one slide at a time — with
   * each child handed back to it as the same interactive box the child layer
   * uses. So the editor looks like the site, and editing happens on the slide
   * on screen: move with the arrows/dots, drop wherever you are.
   */
  const carouselFor = (parent: PlacedNode) => {
    const bands = slotBandsOf(parent)
    const slots: OSBSlot[] = Array.from({ length: bands.slots }, () => ({
      cols: bands.bandCols,
      rows: parent.rows,
      kids: [] as OSBSlotKid[],
    }))
    for (const k of doc.nodes.filter((n) => n.parentId === parent.id)) {
      // Which slide a child belongs to comes from where it SITS: the stored
      // `slot` is only that same number written down for the manifest.
      const slot = slotOfRect(bands, k)
      const dims = resizing?.id === k.id ? resizing : null
      slots[slot].kids.push({
        id: k.id,
        x: k.x - slotLeft(slot, bands.bandCols),
        y: k.y,
        cols: dims?.cols ?? k.cols,
        rows: dims?.rows ?? k.rows,
        content: (
          <PlacedChildBox
            kid={k}
            parentId={parent.id}
            selected={k.id === selectedId}
            conflict={fb.conflicts.includes(k.id)}
            interactive={!preview}
            ids={{ node: 'canvas-node', resize: (id) => `resize-${id}`, remove: 'remove-node' }}
            onSelect={p.onSelect}
            onRemove={p.onRemove}
            onDragStart={(kid, e) => {
              if (resizeActive.current) {
                e.preventDefault()
                return
              }
              p.onBeginChildDrag(kid.id, e)
            }}
            onDragEnd={p.onEndDrag}
            onResize={(e, kid) => onChildResize(e, parent, kid)}
          />
        ),
      })
    }
    return (
      <OSBCarousel
        // While EDITING, the arrows and dots are the navigation: swipe and
        // autoplay would fight the two gestures that matter here (drag an atom,
        // drop an atom) — embla's own drag swallows native dragstart. Preview
        // mode passes the real config, so the site's behaviour stays visible.
        config={preview ? parent.config : { ...parent.config, drag: false, autoplay: false }}
        slots={slots}
        index={p.slideOf[parent.id] ?? 0}
        onSlideChange={(i) => p.onSlideChange(parent.id, i)}
      />
    )
  }

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
    const bands = slotBandsOf(parent)
    const slotted = bands.slots > 1
    return (
      <div
        data-testid={`container-${parent.id}`}
        data-type={parent.type}
        onDragOver={preview ? undefined : (e) => p.onHoverContainer(e, parent, windowFor(parent))}
        onDragLeave={preview ? undefined : p.onLeaveContainer}
        onDrop={preview ? undefined : (e) => p.onContainerDrop(e, parent, windowFor(parent))}
        className={`relative h-full w-full${fb.conflicts.includes(parent.id) ? ' drag-conflict' : ''}`}
      >
        {slotted ? carouselFor(parent) : OSB_REGISTRY[parent.type].render(parent.config)}
        {/* The overlay sits ABOVE the carousel, whose slides hold the real,
            interactive children — so it must never eat their mouse events
            (dragging an atom, clicking an atom, playing a video). Everything
            it draws here (ghost, invitations) is pointer-events-none. */}
        <div className={`absolute inset-0 ${inset}${slotted ? ' pointer-events-none' : ''}`}>
          <div data-testid={`content-box-${parent.id}`} className="relative h-full w-full">
            {!slotted && childLayerFor(parent, showBounds)}
            {!preview && ghostFor(parent)}
            {!preview && (slotted ? slideHints(parent) : emptyHint(parent))}
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
                  // Containers own a child layer; leaves (atoms) and overlays
                  // render bare. New shell kinds need no branch here.
                  const kind = OSB_REGISTRY[n.type].kind
                  return kind === 'atom' || kind === 'overlay' ? OSB_REGISTRY[n.type].render(n.config) : containerBody(n)
                })()}
                {!preview && n.id === selectedId && (
                  <RemoveControl
                    testid="remove-node"
                    id={n.id}
                    onRemove={p.onRemove}
                    className="absolute right-1 top-1 z-10 h-auto rounded-md border border-slate-300 bg-white px-1.5 py-px text-[10px] font-normal text-slate-600 shadow-sm hover:bg-slate-100"
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
