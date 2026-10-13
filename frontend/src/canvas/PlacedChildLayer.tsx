import { modalChildStyle } from '../osb/OSBModal'
import { OSB_REGISTRY } from '../osb/registry'
import type { PlacedNode } from './doc'

export interface PlacedChildLayerProps {
  /** Parent footprint for percent positioning; `id` adds data-parent. */
  parent: { cols: number; rows: number; id?: string }
  kids: PlacedNode[]
  selectedId: string | null
  /** Sibling ids that fight over the dragged cells (canvas only). */
  conflicts?: readonly string[]
  /** Live resize preview for exactly one kid, if any. */
  resizing: { id: string; cols: number; rows: number } | null
  /** Testid vocabulary: the canvas and the popup editor name their own. */
  ids: { node: string; resize: (id: string) => string; remove: string }
  /** Wrap in the dashed bounds box (canvas container while selected). */
  bounds?: boolean
  onSelect(id: string): void
  onRemove(id: string): void
  onDragStart(kid: PlacedNode, e: React.DragEvent): void
  onDragEnd(): void
  onResize(e: React.MouseEvent, kid: PlacedNode): void
}

/**
 * THE absolutely-positioned child layer: percent boxes inside a parent's cell
 * rectangle, each child draggable/selectable and, when selected, carrying the
 * SE resize handle and remove control. Shared by canvas container bodies and
 * the popup editor — same geometry, same interactions, one markup.
 */
export default function PlacedChildLayer(p: PlacedChildLayerProps) {
  return (
    <div
      data-testid={p.bounds ? 'child-bounds' : undefined}
      className={`pointer-events-none absolute inset-0${p.bounds ? ' show-child-bounds' : ''}`}
    >
      {p.kids.map((k) => (
        <div
          key={k.id}
          data-testid={p.ids.node}
          data-type={k.type}
          data-id={k.id}
          data-parent={p.parent.id}
          draggable
          onDragStart={(e) => {
            e.stopPropagation()
            p.onDragStart(k, e)
          }}
          onDragEnd={p.onDragEnd}
          onClick={(e) => {
            // Linked buttons render real <a> tags: stay in the editor.
            e.preventDefault()
            e.stopPropagation()
            p.onSelect(k.id)
          }}
          style={modalChildStyle(p.parent, p.resizing?.id === k.id ? { ...k, ...p.resizing } : k)}
          className={`osb-child pointer-events-auto ${
            k.id === p.selectedId ? 'canvas-selected overflow-hidden' : 'overflow-hidden'
          }${p.conflicts?.includes(k.id) ? ' drag-conflict' : ''}`}
        >
          {OSB_REGISTRY[k.type].render(k.config)}
          {k.id === p.selectedId && (
            <>
              <div
                data-testid={p.ids.resize(k.id)}
                aria-label="Resize element"
                onMouseDown={(e) => p.onResize(e, k)}
                className="absolute bottom-0 right-0 z-10 h-4 w-4 cursor-se-resize rounded-tl-md border-l border-t border-sky-500 bg-white/90"
              />
              <button
                type="button"
                data-testid={p.ids.remove}
                aria-label="Remove element"
                onClick={(e) => {
                  e.stopPropagation()
                  p.onRemove(k.id)
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
  )
}
