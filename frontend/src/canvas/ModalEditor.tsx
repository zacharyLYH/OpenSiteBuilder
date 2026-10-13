import { useRef, useState } from 'react'
import { OSBModalTestPreview, MODAL_CELL_PX, modalChildStyle } from '../osb/OSBModal'
import { OSB_REGISTRY, type OSBNodeType } from '../osb/registry'
import { Button } from '../components/ui/button'
import {
  canPlaceModalChild,
  containerFloor,
  eventCell,
  type CellRect,
  type ModalDoc,
  type PlacedNode,
  type RejectReason,
} from './doc'
import { HEADER_PX } from './grid'
import type { ArmedDrag } from './useDragSession'

/** Preview pitch: the shell renders at a fixed scale, independent of canvas zoom. */
const CELL = MODAL_CELL_PX

/** Percent box for a footprint inside the shell's cell rectangle. */
function childPos(
  parent: { cols: number; rows: number },
  kid: { x: number; y: number; cols: number; rows: number },
): React.CSSProperties {
  return modalChildStyle(parent, kid)
}

export interface ModalEditorProps {
  modal: ModalDoc
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
 * The popup editing surface: a fixed overlay with the shell at preview
 * scale, its atom children absolutely positioned like card children, and
 * the same SE-resize vocabulary as the canvas. Palette atoms drop in;
 * canvas atoms move in; pattern shells and grid roots are refused with
 * words. A live Test preview opens the real dialog (X, outside, Escape).
 */
export default function ModalEditor(p: ModalEditorProps) {
  const { modal } = p
  const shellRef = useRef<HTMLDivElement>(null)
  // HTML5 move of one of our own children (the canvas session is untouched).
  const [dragId, setDragId] = useState<string | null>(null)
  const [ghost, setGhost] = useState<(CellRect & { ok: boolean }) | null>(null)
  // Live resize previews, committed on release through the usual gates.
  const [resizing, setResizing] = useState<{ id: string; cols: number; rows: number } | null>(null)
  const [shellPreview, setShellPreview] = useState<{ cols: number; rows: number } | null>(null)
  const [testing, setTesting] = useState(false)
  const resizeActive = useRef(false)
  const resizeDims = useRef<{ cols: number; rows: number } | null>(null)

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
    const reason = canPlaceModalChild(modal, subject.type, rect)
    // Canvas moves are judged like any atom; the drop performs the take-out.
    setGhost({ ...rect, ok: reason === null })
  }

  const hoverInternal = (e: React.DragEvent) => {
    const kid = modal.children.find((k) => k.id === dragId)
    if (!kid) return
    e.preventDefault()
    const rect = judgeAt(e.clientX, e.clientY, { cols: kid.cols, rows: kid.rows })
    if (!rect) return
    const reason = canPlaceModalChild(modal, kid.type, rect, kid.id)
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
    const reason = canPlaceModalChild(modal, subject.type, rect)
    if (reason) return void p.onReject(reason)
    if (p.armed.drag.kind === 'palette') return void p.onDropChild(subject.type as OSBNodeType, rect)
    if (subject.moveId) return void p.onMoveIn(subject.moveId, rect)
    p.onReject('kind')
  }

  /** SE resize for a child in place; commits on release through the gate. */
  const startChildResize = (e: React.MouseEvent, kid: PlacedNode) => {
    e.stopPropagation()
    e.preventDefault()
    const box = shellBox()
    if (!box) return
    const g = OSB_REGISTRY[kid.type].grid
    const { clientX: startX, clientY: startY } = e
    const pitchX = box.width / modal.cols
    const pitchY = box.height / modal.rows
    const dimsAt = (dx: number, dy: number) => ({
      cols: Math.max(g.minCols, Math.min(g.maxCols, Math.min(modal.cols - kid.x, kid.cols + Math.round(dx / pitchX)))),
      rows: Math.max(g.minRows, Math.min(g.maxRows, Math.min(modal.rows - kid.y, kid.rows + Math.round(dy / pitchY)))),
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
      p.onResizeChild(kid.id, { x: kid.x, y: kid.y, ...dims })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  /** SE resize for the shell itself; never under its children. */
  const startShellResize = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const box = shellBox()
    if (!box) return
    const g = OSB_REGISTRY.modal.grid
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
    <div data-testid="modal-editor" className="fixed bottom-0 left-0 right-0 z-40 overflow-auto bg-slate-950/40" style={{ top: HEADER_PX }} onClick={(e) => { if (e.target === e.currentTarget) p.onClose() }}>
      <div className="mx-auto flex min-h-full w-fit flex-col items-center gap-3 p-6">
        <div className="flex items-center gap-2 rounded-full bg-white py-1 pl-4 pr-1 shadow-lg">
          <p className="text-sm font-medium text-slate-700">{typeof title === 'string' && title.length > 0 ? title : 'Popup'}</p>
          <Button type="button" data-testid="modal-test" variant="outline" size="sm" onClick={() => setTesting(true)}>
            Test popup
          </Button>
          <Button type="button" data-testid="modal-done" variant="default" size="sm" onClick={p.onClose}>
            Done
          </Button>
        </div>

        <div
          ref={shellRef}
          data-testid="modal-editor-shell"
          onDragOver={(e) => (dragId ? hoverInternal(e) : hoverArmed(e))}
          onDragLeave={() => setGhost(null)}
          onDrop={dropShell}
          onClick={() => p.onSelect(modal.id)}
          style={{ width: shell.cols * CELL, height: shell.rows * CELL }}
          className="relative rounded-xl bg-white shadow-2xl ring-1 ring-slate-900/10"
        >
          <div className="pointer-events-none absolute inset-0">
            {modal.children.map((k) => (
              <div
                key={k.id}
                data-testid="modal-child"
                data-type={k.type}
                data-id={k.id}
                draggable
                onDragStart={(e) => {
                  e.stopPropagation()
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
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  p.onSelect(k.id)
                }}
                style={childPos(shell, resizing?.id === k.id ? { ...k, ...resizing } : k)}
                className={`osb-child pointer-events-auto ${k.id === p.selectedId ? 'canvas-selected overflow-hidden' : 'overflow-hidden'}`}
              >
                {OSB_REGISTRY[k.type].render(k.config)}
                {k.id === p.selectedId && (
                  <>
                    <div
                      data-testid={`modal-resize-${k.id}`}
                      aria-label="Resize element"
                      onMouseDown={(e) => startChildResize(e, k)}
                      className="absolute bottom-0 right-0 z-10 h-4 w-4 cursor-se-resize rounded-tl-md border-l border-t border-sky-500 bg-white/90"
                    />
                    <button
                      type="button"
                      data-testid="modal-remove-child"
                      aria-label="Remove element"
                      onClick={(e) => {
                        e.stopPropagation()
                        p.onRemoveChild(k.id)
                      }}
                      className="absolute right-0 top-0 z-10 rounded-bl-md bg-white px-1.5 py-0.5 text-[10px] text-slate-600 shadow-sm hover:bg-slate-100"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          {ghost && (
            <div
              aria-hidden
              data-testid="modal-ghost"
              data-ok={ghost.ok}
              style={childPos(shell, ghost)}
              className={`pointer-events-none absolute rounded-md border-2 border-dashed ${
                ghost.ok ? 'border-sky-500 bg-sky-500/10' : 'border-rose-500 bg-rose-500/10'
              }`}
            />
          )}
          {modal.children.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-3">
              <div
                data-testid="modal-empty-hint"
                className="rounded-lg border-2 border-dashed border-slate-300 bg-white/60 px-4 py-3 text-center text-xs text-slate-400"
              >
                {OSB_REGISTRY.modal.emptyHint ?? 'Drag content here'}
              </div>
            </div>
          )}
          <div
            data-testid="modal-resize-shell"
            aria-label="Resize popup"
            onMouseDown={startShellResize}
            className="absolute bottom-1 right-1 z-10 h-5 w-5 cursor-se-resize rounded-tl-md border-l-2 border-t-2 border-slate-400 bg-white/90"
          />
        </div>
        <p className="text-xs text-white/80">Drag text, buttons or images into the popup · corner to resize · Test popup tries the real dialog</p>
      </div>

      {testing && (
        <TestPreview
          modal={modal}
          onClose={() => setTesting(false)}
        />
      )}
    </div>
  )
}

/** The real dialog over the editor: X, outside press, and Escape all close. */
function TestPreview({ modal, onClose }: { modal: ModalDoc; onClose: () => void }) {
  const byId = new Map(modal.children.map((k) => [k.id, k]))
  return (
    <OSBModalTestPreview
      config={modal.config}
      cols={modal.cols}
      rows={modal.rows}
      kids={modal.children}
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
