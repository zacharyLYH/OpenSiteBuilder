import { useCallback, useEffect, useRef, useState } from 'react'
import type { GridLayoutProps, Layout, LayoutItem } from 'react-grid-layout'
import { OSB_PALETTE_TYPES, OSB_REGISTRY, isOverlayType, isTriggerType, overlayNoun, type OSBNodeType } from '../osb/registry'
import { OSBThemeProvider } from '../osb/OSBTheme'
import { OSB_PATTERNS, OSB_PATTERN_IDS } from '../osb/patterns'
import { overlayTargetOf } from '../osb/types'
import { clearProjectSlug, getProjectSlug } from '../lib/project'
import { Button } from '../components/ui/button'
import { Label } from '../components/ui/label'
import CanvasHeader, { type PaletteEntry, type PushStatus } from './CanvasHeader'
import CanvasStage from './CanvasStage'
import ConfigDrawer from './ConfigDrawer'
import OverlayEditor, { OverlayTestPreview } from './OverlayEditor'
import { movedRoots, overContainer, planAt, planRoute, type DragPlan } from './gesture'
import {
  canPlaceOverlayChild,
  createOverlay as addOverlay,
  eventCell,
  findOverlay,
  insertNode,
  insertOverlayChild,
  insertPattern,
  moveNode,
  moveOverlayChild,
  overlaysOf,
  reasonText,
  removeNode,
  removeOverlay,
  removeOverlayChild,
  resizeOverlay,
  updateNodeConfig,
  updateOverlayChildConfig,
  updateOverlayConfig,
  type CellRect,
  type DocResult,
  type DocValidation,
  type DragPayload,
  type OverlayDoc,
  type OverlayType,
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
  // Overlay editing: which shell is open in the shared overlay editor, and
  // which is under a live Test preview. Kind is data, never parallel state.
  const [editingOverlayId, setEditingOverlayId] = useState<string | null>(null)
  const [testingOverlayId, setTestingOverlayId] = useState<string | null>(null)
  const [push, setPush] = useState<PushStatus | null>(null)
  // In flight is a state of the push itself, not a parallel flag.
  const pushing = push?.kind === 'busy'
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

  /** One landing for every op result: apply + select, or bounce with words.
   * Node and popup ops land here alike — the select is simply optional. */
  const applyResult = (r: DocResult, selectId?: string) => {
    if (!r.ok) return reject(r.reason)
    setDoc(r.doc)
    if (selectId !== undefined) setSelectedId(selectId)
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
      const overlay = findOverlay(d, id) ?? null
      if (overlay && overlay.id === id && id === editingOverlayId) {
        setDoc(removeOverlay(d, id))
        setEditingOverlayId((cur) => (cur === id ? null : cur))
        setSelectedId((s) => (s === id ? null : s))
        return
      }
      const parent = overlaysOf(d).find((o) => o.children.some((k) => k.id === id)) ?? null
      if (parent) {
        setDoc(removeOverlayChild(d, parent.id, id))
        setSelectedId((s) => (s === id ? null : s))
        return
      }
      setDoc((prev) => removeNode(prev, id))
      setSelectedId((s) => (s === id ? null : s))
    },
    [setDoc, editingOverlayId, docRef],
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
    setPush({ kind: 'busy', text: 'Pushing…' })
    pushDoc(doc, projectName)
      .then((r) =>
        setPush(
          r.ok
            ? { kind: 'ok', text: `Pushed ${r.commit.slice(0, 7)}` }
            : { kind: 'error', text: `Push failed: ${r.error}` },
        ),
      )
      .catch((e) => setPush({ kind: 'error', text: `Push failed: ${String(e)}` }))
  }

  const editingOverlay: OverlayDoc | null = findOverlay(doc, editingOverlayId ?? '') ?? null
  const testingOverlay: OverlayDoc | null = findOverlay(doc, testingOverlayId ?? '') ?? null

  /** Attach a fresh overlay (pre-filled like the Card pattern) to a trigger.
   * One target id per trigger — attaching retargets. The prefill title
   * comes from the kind's own defaults, never a per-kind branch. */
  const createOverlay = (kind: OverlayType, buttonId: string) => {
    const g = OSB_REGISTRY[kind].grid
    const oid = crypto.randomUUID()
    const titleWord = (OSB_REGISTRY[kind].defaults as { title?: unknown }).title
    const titleBase = typeof titleWord === 'string' && titleWord.length > 0 ? titleWord : overlayNoun(kind)
    const kids: { type: OSBNodeType; config: Record<string, unknown>; x: number; y: number; cols: number; rows: number }[] = [
      { type: 'text', config: { text: `${titleBase} title` }, x: 1, y: 1, cols: 8, rows: 2 },
      { type: 'text', config: { text: `${titleBase} body copy.` }, x: 1, y: 3, cols: 8, rows: 3 },
      { type: 'button', config: { label: 'Got it' }, x: 1, y: 6, cols: 4, rows: 1 },
    ]
    const shell: OverlayDoc = {
      id: oid,
      overlayType: kind,
      config: { ...OSB_REGISTRY[kind].defaults },
      cols: g.cols,
      rows: g.rows,
      children: kids.map((k) => ({
        id: crypto.randomUUID(),
        type: k.type,
        config: { ...OSB_REGISTRY[k.type].defaults, ...k.config },
        parentId: oid,
        x: k.x,
        y: k.y,
        cols: k.cols,
        rows: k.rows,
      })),
    }
    setDoc((d) => updateNodeConfig(addOverlay(d, shell), buttonId, { targetId: oid }))
    setSelectedId(oid)
    setEditingOverlayId(oid)
  }

  const unlinkOverlay = (buttonId: string) => {
    setDoc((d) => updateNodeConfig(d, buttonId, { targetId: '' }))
  }

  /** Remove an overlay shell entirely (and unlink its trigger). The trigger's
   * own drawer hosts this — there is no separate overlay list to manage. */
  const removeOverlayFlow = (id: string) => {
    setDoc((d) => removeOverlay(d, id))
    setEditingOverlayId((cur) => (cur === id ? null : cur))
    setTestingOverlayId((cur) => (cur === id ? null : cur))
    setSelectedId((s) => (s === id ? null : s))
  }

  /** The drawer edits nodes, overlay children, and overlay shells alike. */
  const applyConfig = (id: string, config: Record<string, unknown>) => {
    const overlay = findOverlay(docRef.current, editingOverlayId ?? '')
    if (overlay && overlay.id === id) return void setDoc((d) => updateOverlayConfig(d, id, config))
    if (overlay && overlay.children.some((k) => k.id === id)) {
      return void setDoc((d) => updateOverlayChildConfig(d, overlay.id, id, config))
    }
    setDoc((d) => updateNodeConfig(d, id, config))
  }

  // The armed drag's gated type for the overlay editor (patterns land as cards).
  const armed = currentDrag()
  const armedType: string | null = (() => {
    if (!armed) return null
    const { drag } = armed
    if (drag.kind === 'palette') return drag.type
    if (drag.kind === 'pattern') return 'card'
    return doc.nodes.find((n) => n.id === drag.id)?.type ?? null
  })()

  /** A canvas atom dragged into the open overlay: lands in the shell, leaves. */
  const moveIntoOverlay = (overlayId: string, id: string, rect: CellRect) => {
    const d = docRef.current
    const node = d.nodes.find((n) => n.id === id)
    if (!node) return
    const shell = findOverlay(d, overlayId)
    if (!shell) return
    const reason = canPlaceOverlayChild(shell, node.type, rect)
    if (reason) return reject(reason)
    const r = insertOverlayChild(d, overlayId, { ...node, parentId: overlayId, ...rect })
    if (!r.ok) return reject(r.reason)
    setDoc(removeNode(r.doc, id))
    setSelectedId(id)
  }

  const selected: PlacedNode | null =
    doc.nodes.find((n) => n.id === selectedId) ?? editingOverlay?.children.find((k) => k.id === selectedId) ?? null
  // Overlay shells edit through the same drawer via a synthetic node.
  const drawerNode: PlacedNode | null =
    editingOverlay && selectedId === editingOverlay.id
      ? { id: editingOverlay.id, type: editingOverlay.overlayType, config: editingOverlay.config, parentId: null, x: 0, y: 0, cols: editingOverlay.cols, rows: editingOverlay.rows }
      : selected
  const side = drawerNode && drawerNode.x + drawerNode.cols / 2 >= GRID_COLS / 2 ? 'left' : 'right'

  /** Trigger-only drawer section: attach, open, test, or detach its overlay.
   * A trigger inside an overlay never gets one (no overlay-in-overlay). */
  const inOverlay = !!editingOverlay && editingOverlay.children.some((k) => k.id === selectedId)
  const linkedOverlay = drawerNode ? findOverlay(doc, overlayTargetOf(drawerNode.config) ?? '') ?? null : null
  const drawerActions =
    drawerNode && isTriggerType(drawerNode.type) && !inOverlay ? (
      <OverlayTriggerSection
        linked={linkedOverlay}
        onCreate={(kind) => createOverlay(kind, drawerNode.id)}
        onEdit={(id) => setEditingOverlayId(id)}
        onTest={(id) => setTestingOverlayId(id)}
        onUnlink={() => unlinkOverlay(drawerNode.id)}
        onDelete={(id) => removeOverlayFlow(id)}
      />
    ) : drawerNode && isOverlayType(drawerNode.type) && !editingOverlay ? (
      <div className="flex flex-col gap-1">
        <Button
          type="button"
          data-testid={`edit-${overlayNoun(drawerNode.type)}-content`}
          size="sm"
          onClick={() => setEditingOverlayId(drawerNode.id)}
        >
          Edit {overlayNoun(drawerNode.type)} content
        </Button>
      </div>
    ) : null

  return (
    <OSBThemeProvider theme={theme}>
      <div className="h-screen w-screen overflow-hidden bg-white">
        <CanvasHeader
          project={projectName}
          palettes={palettes}
          theme={theme}
          preview={preview}
          onTheme={setTheme}
          onTogglePreview={() => setPreview((v) => !v)}
          dropMsg={dropMsg}
          push={push}
          pushing={pushing}
          canPush={doc.nodes.length > 0}
          validation={validation}
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

        {editingOverlay && (
          <OverlayEditor
            kind={editingOverlay.overlayType}
            overlay={editingOverlay}
            armed={armed}
            armedType={armedType}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id)}
            onClose={() => setEditingOverlayId(null)}
            onReject={reject}
            onConsumeDrag={clearDrag}
            onDropChild={(type, rect) =>
              applyResult(
                insertOverlayChild(docRef.current, editingOverlay.id, {
                  id: crypto.randomUUID(),
                  type,
                  config: {},
                  parentId: editingOverlay.id,
                  ...rect,
                }),
              )
            }
            onMoveIn={(id, rect) => moveIntoOverlay(editingOverlay.id, id, rect)}
            onMoveChild={(id, rect) => applyResult(moveOverlayChild(docRef.current, editingOverlay.id, id, rect))}
            onResizeChild={(id, rect) => applyResult(moveOverlayChild(docRef.current, editingOverlay.id, id, rect))}
            onResizeShell={(cols, rows) => applyResult(resizeOverlay(docRef.current, editingOverlay.id, cols, rows))}
            onRemoveChild={(id) => removeSelected(id)}
          />
        )}

        {testingOverlay && (
          <OverlayTestPreview kind={testingOverlay.overlayType} overlay={testingOverlay} onClose={() => setTestingOverlayId(null)} />
        )}
      </div>
    </OSBThemeProvider>
  )
}

/** The button's overlay attach: new, edit, test, or detach. Owned by the
 * controller (it writes the doc); the drawer only hosts the slot. One
 * section for every overlay kind — linked state names the attached shell,
 * unlinked state offers one create button per kind. Legacy testids
 * (new-popup/edit-popup/… + new-drawer/edit-drawer/…) stay so specs keep
 * addressing each kind directly. */
function OverlayTriggerSection({
  linked,
  onCreate,
  onEdit,
  onTest,
  onUnlink,
  onDelete,
}: {
  linked: OverlayDoc | null
  onCreate(kind: OverlayType): void
  onEdit(id: string): void
  onTest(id: string): void
  onUnlink(): void
  onDelete(id: string): void
}) {
  if (linked) {
    const noun = overlayNoun(linked.overlayType)
    const Noun = noun[0].toUpperCase() + noun.slice(1)
    const linkedTitle = (linked.config as { title?: unknown } | undefined)?.title
    const fallback = (OSB_REGISTRY[linked.overlayType].defaults as { title?: unknown }).title
    const fallbackTitle = typeof fallback === 'string' && fallback.length > 0 ? fallback : Noun
    return (
      <div className="flex flex-col gap-1">
        <Label>{Noun}</Label>
        <p data-testid={`linked-${noun}-name`} className="text-xs text-slate-600">
          Opens “{typeof linkedTitle === 'string' && linkedTitle.length > 0 ? linkedTitle : fallbackTitle}”
        </p>
        <div className="flex gap-2">
          <Button type="button" data-testid={`edit-${noun}`} variant="outline" size="sm" onClick={() => onEdit(linked.id)}>
            Edit {noun}
          </Button>
          <Button type="button" data-testid={`test-${noun}`} variant="outline" size="sm" onClick={() => onTest(linked.id)}>
            Test {noun}
          </Button>
          <Button type="button" data-testid={`unlink-${noun}`} variant="outline" size="sm" onClick={onUnlink}>
            Detach
          </Button>
          <Button
            type="button"
            data-testid={`delete-${noun}`}
            variant="outline"
            size="sm"
            onClick={() => onDelete(linked.id)}
          >
            Delete
          </Button>
        </div>
        <p className="text-xs text-slate-500">A link is ignored while an overlay is attached.</p>
      </div>
    )
  }
  // Unlinked: one create button per overlay kind, straight from the
  // registry — a new kind adds its own button with zero edits here.
  const overlayKinds = (Object.keys(OSB_REGISTRY) as OSBNodeType[]).filter(
    (t): t is OverlayType => isOverlayType(t),
  )
  return (
    <div className="flex flex-col gap-1">
      <Label>Overlay</Label>
      <div className="flex gap-2">
        {overlayKinds.map((kind) => {
          const noun = overlayNoun(kind)
          return (
            <Button key={kind} type="button" data-testid={`new-${noun}`} variant="outline" size="sm" onClick={() => onCreate(kind)}>
              ＋ New {noun}
            </Button>
          )
        })}
      </div>
      <p className="text-xs text-slate-500">Opens an overlay when visitors click this button.</p>
    </div>
  )
}

