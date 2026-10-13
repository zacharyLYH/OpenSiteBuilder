import { useRef, useState } from 'react'
import { OVERLAY_CELL_PX, overlayChildStyle } from '../osb/OSBOverlay'
import { OSB_REGISTRY, OSBOverlayTestPreview, overlayNoun, type OSBNodeType } from '../osb/registry'
import { Button } from '../components/ui/button'
import { startChildResize } from './childResize'
import PlacedChildLayer from './PlacedChildLayer'
import {
  canPlaceOverlayChild,
  containerFloor,
  eventCell,
  type CellRect,
  type OverlayDoc,
  type OverlayType,
  type PlacedNode,
  type RejectReason,
} from './doc'
import { HEADER_PX } from './grid'
import type { ArmedDrag } from './useDragSession'

/** Preview pitch: the shell renders at a fixed scale, independent of canvas zoom. */
const CELL = OVERLAY_CELL_PX

/** Legacy alias. New code takes the registry key directly. */
export type OverlayKind = OverlayType

/** Title + noun from the registry entry — no per-kind map. Modal's entry
 * name is 'Popup', so its title falls back to 'Popup' exactly as before. */
const wordsFor = (kind: string): { Title: string; noun: string } => {
  const noun = overlayNoun(kind)
  const entry = kind in OSB_REGISTRY ? OSB_REGISTRY[kind as OSBNodeType] : null
  const fallback = (entry?.defaults as { title?: unknown } | undefined)?.title
  const Title = typeof fallback === 'string' && fallback.length > 0 ? fallback : noun[0].toUpperCase() + noun.slice(1)
  return { Title, noun }
}

export interface OverlayEditorProps {
  kind: string
  overlay: OverlayDoc
  /** The canvas-wide armed drag (palette only lands here). */
  armed: ArmedDrag | null
  /** Resolved dragged type for move/pattern payloads (null = unknown). */
  armedType: string | null
  selectedId: string | null
  onSelect(id: string): void
  onClose(): void
  onReject(reason: RejectReason): void
  onConsumeDrag(): void
  onDropChild(type: OSBNodeType, rect: CellRect): void
  /** A canvas atom dragged in: lands in the shell, leaves the canvas. */
  onMoveIn(id: string, rect: CellRect): void
  onMoveChild(id: string, rect: CellRect): void
  onResizeChild(id: string, rect: CellRect): void
  onResizeShell(cols: number, rows: number): void
  onRemoveChild(id: string): void
}

/**
 * THE overlay editing surface (popups + drawers): a fixed overlay with the
 * shell at preview scale, its atom children absolutely positioned like card
 * children, and the same SE-resize vocabulary as the canvas. Palette atoms
 * drop in; canvas atoms move in; pattern shells and grid roots are refused
 * with words. A live Test preview opens the real dialog/sheet (X, outside,
 * Escape). Kind only changes labels, testids, and which live preview opens.
 */
export default function OverlayEditor(p: OverlayEditorProps) {
  const { kind, overlay: modal } = p
  const word = wordsFor(kind)
  const shellRef = useRef<HTMLDivElement>(null)
  // HTML5 move of one of our own children (the canvas session is untouched).
  const [dragId, setDragId] = useState<string | null>(null)
  const [ghost, setGhost] = useState<(CellRect & { ok: boolean }) | null>(null)
  // Live resize previews, committed on release through the usual gates.
  const [resizing, setResizing] = useState<{ id: string; cols: number; rows: number } | null>(null)
  const [shellPreview, setShellPreview] = useState<{ cols: number; rows: number } | null>(null)
  const [testing, setTesting] = useState(false)
  const resizeActive = useRef(false)

  const shell = shellPreview ?? { cols: modal.cols, rows: modal.rows }
  const floor = containerFloor(modal.children, modal.id)
  const title = (modal.config as { title?: unknown } | undefined)?.title
  const shellBox = (): DOMRect | null => shellRef.current?.getBoundingClientRect() ?? null

  /** The gated type for the canvas-wide drag, or null when nothing applies. */
  const armedSubject = (): { type: string; moveId: string | null } | null => {
    const a = p.armed
    if (!a) return null
    if (a.drag.kind === 'palette') return { type: a.drag.type, moveId: null }
    if (a.drag.kind === 'pattern') return { type: 'card', moveId: null }
    if (p.armedType) return { type: p.armedType, moveId: (a.drag as { id: string }).id }
    return null
  }

  const judgeAt = (clientX: number, clientY: number, span: { cols: number; rows: number }) => {
    const box = shellBox()
    if (!box) return null
    const rect = { ...eventCell(clientX, clientY, box, modal, span), ...span }
    return rect
  }

  const hoverArmed = (e: React.DragEvent) => {
    const subject = armedSubject()
    if (!subject || !p.armed) return void setGhost(null)
    e.preventDefault()
    const rect = judgeAt(e.clientX, e.clientY, p.armed.span)
    if (!rect) return
    const reason = canPlaceOverlayChild(modal, subject.type, rect)
    // Canvas moves are judged like any atom; the drop performs the take-out.
    setGhost({ ...rect, ok: reason === null })
  }

  const hoverInternal = (e: React.DragEvent) => {
    const kid = modal.children.find((k) => k.id === dragId)
    if (!kid) return
    e.preventDefault()
    const rect = judgeAt(e.clientX, e.clientY, { cols: kid.cols, rows: kid.rows })
    if (!rect) return
    const reason = canPlaceOverlayChild(modal, kid.type, rect, kid.id)
    setGhost({ ...rect, ok: reason === null })
  }

  const dropShell = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (dragId) {
      const kid = modal.children.find((k) => k.id === dragId)
      setDragId(null)
      setGhost(null)
      if (!kid) return
      const rect = judgeAt(e.clientX, e.clientY, { cols: kid.cols, rows: kid.rows })
      if (rect) p.onMoveChild(kid.id, rect)
      return
    }
    const subject = armedSubject()
    const span = p.armed?.span
    p.onConsumeDrag()
    setGhost(null)
    if (!subject || !span || !p.armed) return void p.onReject('kind')
    const rect = judgeAt(e.clientX, e.clientY, span)
    if (!rect) return
    const reason = canPlaceOverlayChild(modal, subject.type, rect)
    if (reason) return void p.onReject(reason)
    if (p.armed.drag.kind === 'palette') return void p.onDropChild(subject.type as OSBNodeType, rect)
    if (subject.moveId) return void p.onMoveIn(subject.moveId, rect)
    p.onReject('kind')
  }

  /** SE resize for a child in place; commits on release through the gate. */
  const onChildResize = (e: React.MouseEvent, kid: PlacedNode) => {
    const box = shellBox()
    if (!box) return
    startChildResize(e, {
      box,
      parent: modal,
      kid,
      grid: OSB_REGISTRY[kid.type].grid,
      onActive: (a) => (resizeActive.current = a),
      onPreview: (dims) => setResizing(dims ? { id: kid.id, ...dims } : null),
      onCommit: (dims) => p.onResizeChild(kid.id, { x: kid.x, y: kid.y, ...dims }),
    })
  }

  /** SE resize for the shell itself; never under its children. */
  const startShellResize = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const box = shellBox()
    if (!box) return
    const g = OSB_REGISTRY[kind as OSBNodeType].grid
    const { clientX: startX, clientY: startY } = e
    const pitchX = box.width / modal.cols
    const pitchY = box.height / modal.rows
    const dimsAt = (dx: number, dy: number) => ({
      cols: Math.max(Math.max(g.minCols, floor.cols), Math.min(g.maxCols, modal.cols + Math.round(dx / pitchX))),
      rows: Math.max(Math.max(g.minRows, floor.rows), Math.min(g.maxRows, modal.rows + Math.round(dy / pitchY))),
    })
    const onMove = (ev: MouseEvent) => setShellPreview(dimsAt(ev.clientX - startX, ev.clientY - startY))
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setShellPreview((preview) => {
        if (preview && (preview.cols !== modal.cols || preview.rows !== modal.rows)) {
          p.onResizeShell(preview.cols, preview.rows)
        }
        return null
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div data-testid={`${kind}-editor`} className="fixed bottom-0 left-0 right-0 z-40 overflow-auto bg-slate-950/40" style={{ top: HEADER_PX }} onClick={(e) => { if (e.target === e.currentTarget) p.onClose() }}>
      <div className="mx-auto flex min-h-full w-fit flex-col items-center gap-3 p-6">
        <div className="flex items-center gap-2 rounded-full bg-white py-1 pl-4 pr-1 shadow-lg">
          <p className="text-sm font-medium text-slate-700">{typeof title === 'string' && title.length > 0 ? title : word.Title}</p>
          <Button type="button" data-testid={`${kind}-test`} variant="outline" size="sm" onClick={() => setTesting(true)}>
            Test {word.noun}
          </Button>
          <Button type="button" data-testid={`${kind}-done`} variant="default" size="sm" onClick={p.onClose}>
            Done
          </Button>
        </div>

        <div
          ref={shellRef}
          data-testid={`${kind}-editor-shell`}
          onDragOver={(e) => (dragId ? hoverInternal(e) : hoverArmed(e))}
          onDragLeave={() => setGhost(null)}
          onDrop={dropShell}
          onClick={() => p.onSelect(modal.id)}
          style={{ width: shell.cols * CELL, height: shell.rows * CELL }}
          className="relative rounded-xl bg-white shadow-2xl ring-1 ring-slate-900/10"
        >
          <PlacedChildLayer
            parent={modal}
            kids={modal.children}
            selectedId={p.selectedId}
            resizing={resizing}
            ids={{ node: `${kind}-child`, resize: (id) => `${kind}-resize-${id}`, remove: `${kind}-remove-child` }}
            onSelect={p.onSelect}
            onRemove={p.onRemoveChild}
            onDragStart={(k, e) => {
              if (resizeActive.current) {
                e.preventDefault()
                return
              }
              setDragId(k.id)
              e.dataTransfer.setData('text/plain', k.id)
            }}
            onDragEnd={() => {
              setDragId(null)
              setGhost(null)
            }}
            onResize={(e, k) => onChildResize(e, k)}
          />
          {ghost && (
            <div
              aria-hidden
              data-testid={`${kind}-ghost`}
              data-ok={ghost.ok}
              style={overlayChildStyle(shell, ghost)}
              className={`pointer-events-none absolute rounded-md border-2 border-dashed ${
                ghost.ok ? 'border-sky-500 bg-sky-500/10' : 'border-rose-500 bg-rose-500/10'
              }`}
            />
          )}
          {modal.children.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-3">
              <div
                data-testid={`${kind}-empty-hint`}
                className="rounded-lg border-2 border-dashed border-slate-300 bg-white/60 px-4 py-3 text-center text-xs text-slate-400"
              >
                {OSB_REGISTRY[kind as OSBNodeType].emptyHint ?? 'Drag content here'}
              </div>
            </div>
          )}
          <div
            data-testid={`${kind}-resize-shell`}
            aria-label={`Resize ${word.noun}`}
            onMouseDown={startShellResize}
            className="absolute bottom-1 right-1 z-10 h-5 w-5 cursor-se-resize rounded-tl-md border-l-2 border-t-2 border-slate-400 bg-white/90"
          />
        </div>
        <p className="text-xs text-white/80">Drag text, buttons or images into the {word.noun} · corner to resize · Test {word.noun} tries the real {OSB_REGISTRY[kind as OSBNodeType]?.chrome === 'sheet' ? 'sheet' : 'dialog'}</p>
      </div>

      {testing && <OverlayTestPreview kind={kind} overlay={modal} onClose={() => setTesting(false)} />}
    </div>
  )
}

/** The real dialog/sheet from anywhere (editor Test, drawer Test): overlays
 * the editor, and X, outside press, and Escape all close. Absolute kids, so
 * it matches the editor grid exactly. Chrome comes from the registry. */
export function OverlayTestPreview({ kind, overlay, onClose }: { kind: string; overlay: OverlayDoc; onClose: () => void }) {
  const byId = new Map(overlay.children.map((k) => [k.id, k]))
  return (
    <OSBOverlayTestPreview
      overlayType={kind}
      config={overlay.config}
      cols={overlay.cols}
      rows={overlay.rows}
      kids={overlay.children}
      renderKid={(id) => {
        const k = byId.get(id)
        return k ? OSB_REGISTRY[k.type].render(k.config) : null
      }}
      open
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    />
  )
}
