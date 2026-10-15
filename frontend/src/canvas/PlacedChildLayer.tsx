import type { CSSProperties } from 'react'
import { cn } from '../lib/utils'
import { overlayChildStyle } from '../osb/OSBOverlay'
import { OSB_REGISTRY } from '../osb/registry'
import type { PlacedNode } from './doc'
import RemoveControl from './RemoveControl'

/** The testid vocabulary: the canvas and the overlay editor name their own. */
export interface ChildIds {
  node: string
  resize: (id: string) => string
  remove: string
}

export interface PlacedChildLayerProps {
  /** Parent footprint for percent positioning; `id` adds data-parent. */
  parent: { cols: number; rows: number; id?: string }
  kids: PlacedNode[]
  selectedId: string | null
  /** Sibling ids that fight over the dragged cells (canvas only). */
  conflicts?: readonly string[]
  /** Live resize preview for exactly one kid, if any. */
  resizing: { id: string; cols: number; rows: number } | null
  /** Testid vocabulary: the canvas and the overlay editor name their own. */
  ids: ChildIds
  /** Wrap in the dashed bounds box (canvas container while selected). */
  bounds?: boolean
  /** Preview mode: no selection, drag, or resize — the real site surface. */
  interactive?: boolean
  onSelect(id: string): void
  onRemove(id: string): void
  onDragStart(kid: PlacedNode, e: React.DragEvent): void
  onDragEnd(): void
  onResize(e: React.MouseEvent, kid: PlacedNode): void
}

export interface PlacedChildBoxProps {
  kid: PlacedNode
  /** Parent node id, for `data-parent` — "who is this in?". */
  parentId?: string
  selected: boolean
  conflict: boolean
  interactive: boolean
  ids: ChildIds
  /** Live resize preview for THIS kid, if a gesture is in flight. */
  dims?: { cols: number; rows: number }
  /** Where the box sits, in percent of a parent cell rectangle. Absent means
   * the surrounding surface already sized it (a carousel slide positions its
   * own children), so the box fills its slot. */
  style?: CSSProperties
  onSelect(id: string): void
  onRemove(id: string): void
  onDragStart(kid: PlacedNode, e: React.DragEvent): void
  onDragEnd(): void
  onResize(e: React.MouseEvent, kid: PlacedNode): void
}

/**
 * ONE interactive child: the atom, its drag/select/click wiring, and — when
 * selected — the remove control and the SE resize handle. Both surfaces a
 * placed child can live on render this: the child layer (percent box inside a
 * container's cell rectangle) and a carousel slide (the slide itself does the
 * positioning, so the box just fills it). One markup, one interaction rule.
 */
export function PlacedChildBox(p: PlacedChildBoxProps) {
  const k = p.kid
  const content = OSB_REGISTRY[k.type].render(k.config)
  return (
    <div
      data-testid={p.ids.node}
      data-type={k.type}
      data-id={k.id}
      data-parent={p.parentId}
      draggable={p.interactive}
      onDragStart={(e) => {
        e.stopPropagation()
        p.onDragStart(k, e)
      }}
      onDragEnd={p.onDragEnd}
      onClick={
        p.interactive
          ? (e) => {
              // Linked buttons render real <a> tags: stay in the editor.
              e.preventDefault()
              e.stopPropagation()
              p.onSelect(k.id)
            }
          : undefined
      }
      style={p.style}
      className={cn(
        'osb-child pointer-events-auto overflow-hidden',
        p.style ? '' : 'relative h-full w-full',
        p.interactive && p.selected && 'canvas-selected',
        p.conflict && 'drag-conflict',
      )}
    >
      {content}
      {p.interactive && p.selected && (
        <>
          <div
            data-testid={p.ids.resize(k.id)}
            aria-label="Resize element"
            onMouseDown={(e) => p.onResize(e, k)}
            className="absolute bottom-0 right-0 z-10 h-4 w-4 cursor-se-resize rounded-tl-md border-l border-t border-sky-500 bg-white/90"
          />
          <RemoveControl
            testid={p.ids.remove}
            id={k.id}
            onRemove={p.onRemove}
            className="absolute right-0 top-0 z-10 h-auto rounded-none rounded-bl-md border-0 bg-white px-1 py-px text-[10px] font-normal text-slate-600 shadow-sm hover:bg-slate-100"
          />
        </>
      )}
    </div>
  )
}

/**
 * THE absolutely-positioned child layer: percent boxes inside a parent's cell
 * rectangle, each child draggable/selectable and, when selected, carrying the
 * SE resize handle and remove control. Shared by canvas container bodies and
 * the overlay editor — same geometry, same interactions, one markup.
 */
export default function PlacedChildLayer(p: PlacedChildLayerProps) {
  // Preview mode renders the real site: kids stay clickable (video controls,
  // links) but are never selected, dragged, or resized.
  const interactive = p.interactive !== false
  return (
    <div
      data-testid={p.bounds ? 'child-bounds' : undefined}
      className={`pointer-events-none absolute inset-0${p.bounds ? ' show-child-bounds' : ''}`}
    >
      {p.kids.map((k) => (
        <PlacedChildBox
          key={k.id}
          kid={k}
          parentId={p.parent.id}
          selected={k.id === p.selectedId}
          conflict={p.conflicts?.includes(k.id) ?? false}
          interactive={interactive}
          ids={p.ids}
          dims={p.resizing?.id === k.id ? p.resizing : undefined}
          style={overlayChildStyle(p.parent, p.resizing?.id === k.id ? { ...k, ...p.resizing } : k)}
          onSelect={p.onSelect}
          onRemove={p.onRemove}
          onDragStart={p.onDragStart}
          onDragEnd={p.onDragEnd}
          onResize={p.onResize}
        />
      ))}
    </div>
  )
}
