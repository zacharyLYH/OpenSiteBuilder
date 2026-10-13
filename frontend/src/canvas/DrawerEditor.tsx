import OverlayEditor, { OverlayTestPreview } from './OverlayEditor'
import type { OSBNodeType } from '../osb/registry'
import type { CellRect, DrawerDoc, RejectReason } from './doc'
import type { ArmedDrag } from './useDragSession'

export interface DrawerEditorProps {
  drawer: DrawerDoc
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

/** The drawer editing surface — mirror of ModalEditor over kind="drawer". */
export default function DrawerEditor(p: DrawerEditorProps) {
  const { drawer, ...r } = p
  return <OverlayEditor kind="drawer" overlay={drawer} {...r} />
}

/** The real sheet from anywhere (editor Test, drawer Test). */
export function DrawerTestPreview({ drawer, onClose }: { drawer: DrawerDoc; onClose: () => void }) {
  return <OverlayTestPreview kind="drawer" overlay={drawer} onClose={onClose} />
}
