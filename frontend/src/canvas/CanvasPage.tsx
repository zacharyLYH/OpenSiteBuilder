import { useCallback, useEffect, useRef, useState } from 'react'
import type { GridLayoutProps, Layout, LayoutItem } from 'react-grid-layout'
import { OSB_PALETTE_TYPES, OSB_REGISTRY, type OSBNodeType } from '../osb/registry'
import { OSBModalTestPreview } from '../osb/OSBModal'
import { OSBThemeProvider } from '../osb/OSBTheme'
import { OSB_PATTERNS, OSB_PATTERN_IDS } from '../osb/patterns'
import { clearProjectSlug, getProjectSlug } from '../lib/project'
import { Button } from '../components/ui/button'
import { Label } from '../components/ui/label'
import CanvasHeader, { type PaletteEntry } from './CanvasHeader'
import CanvasStage from './CanvasStage'
import ConfigDrawer from './ConfigDrawer'
import ModalEditor from './ModalEditor'
import { movedRoots, overContainer, planAt, planRoute, type DragPlan } from './gesture'
import {
  canPlaceModalChild,
  eventCell,
  insertModalChild,
  insertNode,
  insertPattern,
  modalsOf,
  moveModalChild,
  moveNode,
  reasonText,
  removeModal,
  removeModalChild,
  removeNode,
  resizeModal,
  updateModalChildConfig,
  updateModalConfig,
  type CanvasDoc,
  type CellRect,
  type DocResult,
  type DocValidation,
  type DragPayload,
  type ModalDoc,
  type PlacedNode,
  type RejectReason,
} from './doc'
import { centeredCell, GRID_COLS } from './grid'
import { pushDoc } from './push'
import { useCanvasDoc } from './useCanvasDoc'
import { useDragSession } from './useDragSession'

/** How long a rejection stays on screen before it fades out. */
const DROP_MESSAGE_MS = 2600

/**
 * The controller. It owns the selection and the gesture vocabulary; the
 * document lives in useCanvasDoc, the drag session in useDragSession, every
 * rule that decides where a drag may land in gesture.ts (one query, one
 * verdict), and everything visible in CanvasHeader / CanvasStage.
 */
export default function CanvasPage() {
  const [projectName] = useState(getProjectSlug)
  // No project cookie means no doc and no name: send the user home.
  useEffect(() => {
    if (!projectName) window.location.href = '/'
  }, [projectName])

  const { doc, roots, issues, theme, epoch, docRef, setDoc, setTheme, resync } = useCanvasDoc(projectName)
  const { feedback: fb, patch, arm, clear: clearDrag, current: currentDrag } = useDragSession(doc)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Preview hides the editor grid (dots + backdrop) to show the real site.
  // An editor preference, not document state — it never publishes.
  const [preview, setPreview] = useState(false)
  // On-demand checks panel: touch is checked on click, not at placement.
  const [validation, setValidation] = useState<DocValidation | null>(null)
  // Popup editing: which modal shell is open in the overlay editor, and
  // whether the header tray listing every popup is open.
  const [editingModalId, setEditingModalId] = useState<string | null>(null)
  const [testingModalId, setTestingModalId] = useState<string | null>(null)
  const [popupsOpen, setPopupsOpen] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [pushMsg, setPushMsg] = useState('')
  // Rejected gestures fail silently otherwise.
  const [dropMsg, setDropMsg] = useState<string | null>(null)
  const dropMsgTimer = useRef<number | null>(null)

  /** Palette + pattern entries, one shape: atoms first, then compositions. */
  const palettes: PaletteEntry[] = [
    ...OSB_PALETTE_TYPES.map((t) => ({
      testid: `palette-${t}`,
      label: OSB_REGISTRY[t].name,
      pick: () => arm({ kind: 'palette', type: t }),
    })),
    ...OSB_PATTERN_IDS.map((p) => ({
      testid: `palette-pattern-${p}`,
      label: OSB_PATTERNS[p].name,
      pick: () => arm({ kind: 'pattern', pattern: p }),
    })),
  ]

  /** Surface a rejection where the user can see it; auto-clears. */
  const reject = (reason: RejectReason) => {
    if (dropMsgTimer.current !== null) window.clearTimeout(dropMsgTimer.current)
    setDropMsg(reasonText(reason))
    dropMsgTimer.current = window.setTimeout(() => setDropMsg(null), DROP_MESSAGE_MS)
  }
  // The timer outlives nothing: clear it on unmount so no setState fires late.
  useEffect(
    () => () => {
      if (dropMsgTimer.current !== null) window.clearTimeout(dropMsgTimer.current)
    },
    [],
  )

  /** One landing for every op result: apply + select, or bounce with words. */
  const applyResult = (r: DocResult, selectId?: string) => {
    if (!r.ok) return reject(r.reason)
    setDoc(r.doc)
    if (selectId !== undefined) setSelectedId(selectId)
  }

  /** One landing for every popup op result: apply, or bounce with words. */
  const applyModalResult = (r: DocResult) => {
    if (!r.ok) return reject(r.reason)
    setDoc(r.doc)
  }

  /** One landing for every drop: the gate already ruled, so this only applies. */
  const land = (drag: DragPayload, plan: DragPlan) => {
    if (!plan.ok) return reject(plan.reason)
    const d = docRef.current
    if (drag.kind === 'move') return applyResult(moveNode(d, drag.id, plan.rect, plan.parentId), drag.id)
    const id = crypto.randomUUID()
    if (drag.kind === 'pattern') {
      const pattern = OSB_PATTERNS[drag.pattern]
      if (!pattern) return
      const childIds = pattern.children.map(() => crypto.randomUUID())
      return applyResult(insertPattern(d, drag.pattern, id, plan.rect, childIds), id)
    }
    applyResult(insertNode(d, { id, type: drag.type, config: {}, parentId: plan.parentId, ...plan.rect }), id)
  }

  /** A gesture ended: persist only what the user actually moved, then resync. */
  const commit = (next: Layout, active?: LayoutItem | null) => {
    clearDrag()
    resync()
    // Rapid gestures always validate against the latest doc, never a stale closure.
    const d = docRef.current
    const changed = movedRoots(next, d.nodes)
    const targets = active?.i ? next.filter((l) => l.i === active.i) : changed.length === 1 ? changed : []
    let nodes = d.nodes
    let failed: RejectReason | null = null
    for (const l of targets) {
      const cur = nodes.find((n) => n.id === l.i)
      if (!cur || cur.parentId !== null) continue
      if (cur.x === l.x && cur.y === l.y && cur.cols === l.w && cur.rows === l.h) continue
      // Fungible move: nest when the centre lands in an accepting container.
      const plan = planRoute(nodes, { kind: 'move', id: l.i }, { x: l.x, y: l.y, cols: l.w, rows: l.h })
      if (!plan) continue
      const r = moveNode({ ...d, nodes }, l.i, plan.rect, plan.parentId)
      if (r.ok) nodes = r.doc.nodes
      else if (!failed) failed = r.reason
    }
    if (nodes !== d.nodes) setDoc({ ...d, nodes })
    // Bounce with words: a refused drag snaps back AND says why.
    if (failed) reject(failed)
  }

  /** Live RGL-drag verdict: red outline over forbidden spots, nest-aware. */
  const onDragCheck: NonNullable<GridLayoutProps['onDrag']> = (next) => {
    patch({ dragging: true })
    const nodes = docRef.current.nodes
    const moved = movedRoots(next, nodes)[0]
    if (!moved) return
    const cur = nodes.find((n) => n.id === moved.i)
    if (!cur) return
    const plan = planRoute(nodes, { kind: 'move', id: cur.id }, { x: moved.x, y: moved.y, cols: moved.w, rows: moved.h })
    patch({ check: { id: cur.id, ok: plan?.ok ?? false }, conflicts: plan?.conflicts ?? [] })
  }

  /** Root-area drop of a palette item, a pattern, or a moved root. */
  const onDrop: NonNullable<GridLayoutProps['onDrop']> = (_layout, item, e) => {
    // Container drops are owned by the container div; without this guard one
    // child drop would move twice and strand its placeholder.
    if (overContainer(e.target)) return
    const cur = currentDrag()
    const plan = item && cur ? planRoute(doc.nodes, cur.drag, { x: item.x, y: item.y, ...cur.span }) : null
    clearDrag()
    if (cur && plan) land(cur.drag, plan)
  }

  /** Root-area placeholder: one verdict for reds, ghost and forbid flag. The
   * board hands over its own box + cell; the controller only judges. */
  const onRootDragOver: (e: React.DragEvent, box: DOMRect, cell: number) => { w: number; h: number } | false = (
    e,
    box,
    cell,
  ) => {
    // Inside a container the container owns feedback; a root-cell ghost there
    // would fight it. This path paints root-area only.
    if (overContainer(e.target)) return false
    const cur = currentDrag()
    if (!cur) return false
    const plan = planRoute(doc.nodes, cur.drag, centeredCell(e.clientX, e.clientY, box, cur.span, cell))
    if (!plan) return false
    // The placeholder always shows the footprint; red = forbidden.
    patch({ conflicts: plan.conflicts, ghost: null, forbidden: !plan.ok })
    return { w: cur.span.cols, h: cur.span.rows }
  }

  /** The live drag's verdict over a container body — hover and drop share it. */
  const planOnContainer = (e: React.DragEvent, parent: PlacedNode): DragPlan | null => {
    const cur = currentDrag()
    if (!cur) return null
    const box = e.currentTarget.getBoundingClientRect()
    const rect = { ...eventCell(e.clientX, e.clientY, box, parent, cur.span), ...cur.span }
    return planAt(doc.nodes, cur.drag, rect, parent.id)
  }

  /** Live verdict while a drag hovers a container: ghost + conflicting siblings. */
  const hoverContainer = (e: React.DragEvent, parent: PlacedNode) => {
    const cur = currentDrag()
    if (cur) e.preventDefault()
    const plan = planOnContainer(e, parent)
    if (!cur || !plan) return void patch({ ghost: null })
    // Shells never nest, so there is no landing to preview: the container
    // itself turns red instead of drawing a ghost.
    if (cur.drag.kind === 'pattern') return void patch({ ghost: null, conflicts: plan.conflicts })
    patch({ conflicts: plan.conflicts, ghost: { parentId: parent.id, ...plan.rect, ok: plan.ok } })
  }

  /** Drop (a palette item or an existing node) onto a container. */
  const containerDrop = (e: React.DragEvent, parent: PlacedNode) => {
    e.preventDefault()
    e.stopPropagation()
    const cur = currentDrag()
    const plan = planOnContainer(e, parent)
    clearDrag()
    if (!cur) return
    // No verdict at all means the payload names nothing we know.
    if (!plan) return reject('kind')
    land(cur.drag, plan)
  }

  const beginChildDrag = (id: string, e: React.DragEvent) => {
    arm({ kind: 'move', id })
    e.dataTransfer.setData('text/plain', id)
  }

  /** Structure is owned here: delete removes the selection, resize re-gates.
   * Stable identity: the delete-key listener and the remove buttons share it. */
  const removeSelected = useCallback(
    (id: string) => {
      const d = docRef.current
      const em = modalsOf(d).find((m) => m.id === editingModalId) ?? null
      if (em && em.id === id) {
        setDoc(removeModal(d, id))
        setEditingModalId((cur) => (cur === id ? null : cur))
        setSelectedId((s) => (s === id ? null : s))
        return
      }
      if (em && em.children.some((k) => k.id === id)) {
        setDoc(removeModalChild(d, em.id, id))
        setSelectedId((s) => (s === id ? null : s))
        return
      }
      setDoc((prev) => removeNode(prev, id))
      setSelectedId((s) => (s === id ? null : s))
    },
    [setDoc, editingModalId, docRef],
  )

  const resizeKid = (id: string, rect: CellRect, parentId: string) =>
    applyResult(moveNode(docRef.current, id, rect, parentId), id)

  const exitProject = () => {
    clearProjectSlug()
    window.location.href = '/'
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
      // The settings drawer is a form surface: Delete never eats a node while
      // focus is in it, not even from one of its buttons.
      if (el?.closest?.('[role="dialog"]')) return
      e.preventDefault()
      removeSelected(selectedId)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // removeSelected is stable (useCallback), so this re-subscribes on selection only.
  }, [selectedId, removeSelected])

  if (!projectName) {
    return (
      <div data-testid="canvas-no-project" className="flex h-screen w-screen items-center justify-center bg-white">
        <p className="text-sm text-slate-500">No project selected — returning home…</p>
      </div>
    )
  }

  const publish = () => {
    setPushing(true)
    setPushMsg('Pushing…')
    pushDoc(doc, projectName)
      .then((r) => setPushMsg(r.ok ? `Pushed ${r.commit.slice(0, 7)}` : `Push failed: ${r.error}`))
      .catch((e) => setPushMsg(`Push failed: ${String(e)}`))
      .finally(() => setPushing(false))
  }

  const editingModal: ModalDoc | null = modalsOf(doc).find((m) => m.id === editingModalId) ?? null
  const testingModal: ModalDoc | null = modalsOf(doc).find((m) => m.id === testingModalId) ?? null

  /** Attach a fresh popup (pre-filled like the Card pattern) to a button. */
  const createModal = (buttonId: string) => {
    const g = OSB_REGISTRY.modal.grid
    const mid = crypto.randomUUID()
    const kids: { type: OSBNodeType; config: Record<string, unknown>; x: number; y: number; cols: number; rows: number }[] = [
      { type: 'text', config: { text: 'Popup title' }, x: 1, y: 1, cols: 8, rows: 2 },
      { type: 'text', config: { text: 'Popup body copy.' }, x: 1, y: 3, cols: 8, rows: 3 },
      { type: 'button', config: { label: 'Got it' }, x: 1, y: 6, cols: 4, rows: 1 },
    ]
    const modal: ModalDoc = {
      id: mid,
      config: { ...OSB_REGISTRY.modal.defaults },
      cols: g.cols,
      rows: g.rows,
      children: kids.map((k) => ({
        id: crypto.randomUUID(),
        type: k.type,
        config: { ...OSB_REGISTRY[k.type].defaults, ...k.config },
        parentId: mid,
        x: k.x,
        y: k.y,
        cols: k.cols,
        rows: k.rows,
      })),
    }
    setDoc((d) => {
      const withModal: CanvasDoc = { ...d, modals: [...modalsOf(d), modal] }
      return {
        ...withModal,
        nodes: withModal.nodes.map((n) => (n.id === buttonId ? { ...n, config: { ...n.config, modalId: mid } } : n)),
      }
    })
    setSelectedId(mid)
    setEditingModalId(mid)
  }

  const unlinkModal = (buttonId: string) => {
    setDoc((d) => ({
      ...d,
      nodes: d.nodes.map((n) => (n.id === buttonId ? { ...n, config: { ...n.config, modalId: '' } } : n)),
    }))
  }

  const removeModalFlow = (id: string) => {
    setDoc((d) => removeModal(d, id))
    setEditingModalId((cur) => (cur === id ? null : cur))
    setTestingModalId((cur) => (cur === id ? null : cur))
    setSelectedId((s) => (s === id ? null : s))
  }

  /** The drawer edits nodes, popup children, and popup shells alike. */
  const applyConfig = (id: string, config: Record<string, unknown>) => {
    const em = modalsOf(docRef.current).find((m) => m.id === editingModalId) ?? null
    if (em && em.id === id) return void setDoc((d) => updateModalConfig(d, id, config))
    if (em && em.children.some((k) => k.id === id)) {
      return void setDoc((d) => updateModalChildConfig(d, em.id, id, config))
    }
    setDoc((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === id ? { ...n, config } : n)) }))
  }

  // The armed drag's gated type for the popup editor (patterns land as cards).
  const armed = currentDrag()
  const armedType: string | null = !armed
    ? null
    : armed.drag.kind === 'palette'
      ? armed.drag.type
      : armed.drag.kind === 'pattern'
        ? 'card'
        : (doc.nodes.find((n) => n.id === (armed.drag as { id: string }).id)?.type ?? null)

  /** A canvas atom dragged into the open popup: lands in the shell, leaves. */
  const moveIntoModal = (modalId: string, id: string, rect: CellRect) => {
    const d = docRef.current
    const node = d.nodes.find((n) => n.id === id)
    if (!node) return
    const modal = modalsOf(d).find((m) => m.id === modalId)
    if (!modal) return
    const reason = canPlaceModalChild(modal, node.type, rect)
    if (reason) return reject(reason)
    const r = insertModalChild(d, modalId, { ...node, parentId: modalId, ...rect })
    if (!r.ok) return reject(r.reason)
    setDoc(removeNode(r.doc, id))
    setSelectedId(id)
  }

  const selected: PlacedNode | null =
    doc.nodes.find((n) => n.id === selectedId) ?? editingModal?.children.find((k) => k.id === selectedId) ?? null
  // The popup shell edits through the same drawer via a synthetic node.
  const drawerNode: PlacedNode | null =
    editingModal && selectedId === editingModal.id
      ? { id: editingModal.id, type: 'modal', config: editingModal.config, parentId: null, x: 0, y: 0, cols: editingModal.cols, rows: editingModal.rows }
      : selected
  const side = drawerNode && drawerNode.x + drawerNode.cols / 2 >= GRID_COLS / 2 ? 'left' : 'right'

  /** Button-only drawer section: attach, open, test, or detach its popup. A
   * button inside a popup never gets one (no popup-in-popup). */
  const inModal = !!editingModal && editingModal.children.some((k) => k.id === selectedId)
  const drawerActions =
    drawerNode && drawerNode.type === 'button' && !inModal ? (
      <PopupSection
        node={drawerNode}
        modals={modalsOf(doc)}
        onCreate={() => createModal(drawerNode.id)}
        onEdit={(mid) => setEditingModalId(mid)}
        onTest={(mid) => setTestingModalId(mid)}
        onUnlink={() => unlinkModal(drawerNode.id)}
      />
    ) : drawerNode && drawerNode.type === 'modal' && !editingModal ? (
      <div className="flex flex-col gap-1">
        <Button type="button" data-testid="edit-popup-content" size="sm" onClick={() => setEditingModalId(drawerNode.id)}>
          Edit popup content
        </Button>
      </div>
    ) : null

  return (
    <OSBThemeProvider theme={theme}>
    <div className="h-screen w-screen overflow-hidden bg-white">
      <CanvasHeader
        project={projectName}
        palettes={palettes}
        issues={!issues.ok}
        theme={theme}
        preview={preview}
        onTheme={setTheme}
        onTogglePreview={() => setPreview((v) => !v)}
        dropMsg={dropMsg}
        pushMsg={pushMsg}
        pushing={pushing}
        canPush={doc.nodes.length > 0}
        validation={validation}
        modalCount={modalsOf(doc).length}
        popups={
          popupsOpen
            ? modalsOf(doc).map((m) => ({
                id: m.id,
                title: (m.config as { title?: unknown } | undefined)?.title,
              }))
            : null
        }
        onOpenPopups={() => setPopupsOpen(true)}
        onClosePopups={() => setPopupsOpen(false)}
        onEditModal={(id) => {
          setPopupsOpen(false)
          setSelectedId(id)
          setEditingModalId(id)
        }}
        onRemoveModal={removeModalFlow}
        onEndDrag={clearDrag}
        onValidate={() => setValidation(issues)}
        onCloseValidation={() => setValidation(null)}
        onExit={exitProject}
        onPush={publish}
      />

      <CanvasStage
        doc={doc}
        roots={roots}
        selectedId={selectedId}
        fb={fb}
        palettes={palettes}
        preview={preview}
        epoch={epoch}
        onRootDragOver={onRootDragOver}
        rgl={{
          onDrop,
          onDrag: onDragCheck,
          onDragStop: (layout, _old, dragged) => commit(layout, dragged),
          onResizeStop: (layout, _old, dragged) => commit(layout, dragged),
        }}
        onClearSelection={() => setSelectedId(null)}
        onSelect={(id) => setSelectedId(id)}
        onRemove={removeSelected}
        onBeginChildDrag={beginChildDrag}
        onEndDrag={clearDrag}
        onResizeKid={resizeKid}
        onHoverContainer={hoverContainer}
        onContainerDrop={containerDrop}
      />

      {drawerNode && (
        <ConfigDrawer
          key={drawerNode.id}
          node={drawerNode}
          side={side}
          onClose={() => setSelectedId(null)}
          onApply={applyConfig}
          actions={drawerActions}
        />
      )}

      {editingModal && (
        <ModalEditor
          modal={editingModal}
          armed={armed}
          armedType={armedType}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
          onClose={() => setEditingModalId(null)}
          onReject={reject}
          onConsumeDrag={clearDrag}
          onDropChild={(type, rect) =>
            applyModalResult(
              insertModalChild(docRef.current, editingModal.id, {
                id: crypto.randomUUID(),
                type,
                config: {},
                parentId: editingModal.id,
                ...rect,
              }),
            )
          }
          onMoveIn={(id, rect) => moveIntoModal(editingModal.id, id, rect)}
          onMoveChild={(id, rect) => applyModalResult(moveModalChild(docRef.current, editingModal.id, id, rect))}
          onResizeChild={(id, rect) => applyModalResult(moveModalChild(docRef.current, editingModal.id, id, rect))}
          onResizeShell={(cols, rows) => applyModalResult(resizeModal(docRef.current, editingModal.id, cols, rows))}
          onRemoveChild={(id) => removeSelected(id)}
        />
      )}

      {testingModal && (
        <ModalTestPreview modal={testingModal} onClose={() => setTestingModalId(null)} />
      )}
    </div>
    </OSBThemeProvider>
  )
}

/** The button's popup attach: new, edit, test, or detach. Owned by the
 * controller (it writes the doc); the drawer only hosts the slot. */
function PopupSection({
  node,
  modals,
  onCreate,
  onEdit,
  onTest,
  onUnlink,
}: {
  node: PlacedNode
  modals: ModalDoc[]
  onCreate(): void
  onEdit(mid: string): void
  onTest(mid: string): void
  onUnlink(): void
}) {
  const modalId = (node.config as { modalId?: unknown } | undefined)?.modalId
  const linked = typeof modalId === 'string' && modalId.length > 0 ? modals.find((m) => m.id === modalId) ?? null : null
  const linkedTitle = (linked?.config as { title?: unknown } | undefined)?.title
  return (
    <div className="flex flex-col gap-1">
      <Label>Popup</Label>
      {linked ? (
        <>
          <p data-testid="linked-popup-name" className="text-xs text-slate-600">
            Opens “{typeof linkedTitle === 'string' && linkedTitle.length > 0 ? linkedTitle : 'Popup'}”
          </p>
          <div className="flex gap-2">
            <Button type="button" data-testid="edit-popup" variant="outline" size="sm" onClick={() => onEdit(linked.id)}>
              Edit popup
            </Button>
            <Button type="button" data-testid="test-popup" variant="outline" size="sm" onClick={() => onTest(linked.id)}>
              Test popup
            </Button>
            <Button type="button" data-testid="unlink-popup" variant="outline" size="sm" onClick={onUnlink}>
              Detach
            </Button>
          </div>
          <p className="text-xs text-slate-500">A link is ignored while a popup is attached.</p>
        </>
      ) : (
        <>
          <Button type="button" data-testid="new-popup" variant="outline" size="sm" onClick={onCreate}>
            ＋ New popup
          </Button>
          <p className="text-xs text-slate-500">Opens a popup when visitors click this button.</p>
        </>
      )}
    </div>
  )
}

/** The live dialog from anywhere (editor Test, drawer Test): X, outside
 * press, and Escape all close. Shared absolute kids, so it matches edit. */
function ModalTestPreview({ modal, onClose }: { modal: ModalDoc; onClose: () => void }) {
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
