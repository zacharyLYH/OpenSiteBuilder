import OverlayEditor, { OverlayTestPreview } from './OverlayEditor'
import type { OSBNodeType } from '../osb/registry'
import type { CellRect, ModalDoc, PlacedNode, RejectReason } from './doc'
import type { ArmedDrag } from './useDragSession'

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
 * The popup editing surface — thin wrapper over the shared OverlayEditor
 * (kind="modal"). Keeps the existing `modal` prop + `modal-*` testids so
 * the popup journey specs keep passing untouched.
 */
export default function ModalEditor(p: ModalEditorProps) {
  return <OverlayEditor kind="modal" overlay={p.modal} {...rest(p)} />
}

const rest = (p: ModalEditorProps): Omit<Parameters<typeof OverlayEditor>[0], 'kind' | 'overlay'> => ({
  armed: p.armed,
  armedType: p.armedType,
  selectedId: p.selectedId,
  onSelect: p.onSelect,
  onClose: p.onClose,
  onReject: p.onReject,
  onConsumeDrag: p.onConsumeDrag,
  onDropChild: p.onDropChild,
  onMoveIn: p.onMoveIn,
  onMoveChild: p.onMoveChild,
  onResizeChild: p.onResizeChild,
  onResizeShell: p.onResizeShell,
  onRemoveChild: p.onRemoveChild,
})

/** The real dialog from anywhere (editor Test, drawer Test): overlays the
 * editor, and X, outside press, and Escape all close. Absolute kids, so it
 * matches the editor grid exactly. */
export function ModalTestPreview({ modal, onClose }: { modal: ModalDoc; onClose: () => void }) {
  return <OverlayTestPreview kind="modal" overlay={modal} onClose={onClose} />
}

export type { PlacedNode }
