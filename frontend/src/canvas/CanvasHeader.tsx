import type { ReactNode } from 'react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import type { OSBTheme } from '../osb/types'
import type { DocValidation } from './doc'
import { HEADER_PX } from './grid'

/** One palette entry: an atom type or a multi-node pattern. */
export interface PaletteEntry {
  testid: string
  label: string
  pick: () => void
}

export interface CanvasHeaderProps {
  project: string
  palettes: PaletteEntry[]
  /** The doc is not one connected patch — warn until it is. */
  issues: boolean
  dropMsg: string | null
  pushMsg: string
  pushing: boolean
  canPush: boolean
  /** Global site theme (light/dark) — the one place it is chosen. */
  theme: OSBTheme
  /** Hide the editor grid (dots + backdrop) to preview the real site. */
  preview: boolean
  onTheme(theme: OSBTheme): void
  onTogglePreview(): void
  /** On-demand check results; null while the panel is closed. */
  validation: DocValidation | null
  /** Popup count for the tray button. */
  modalCount: number
  /** Open tray rows (id + raw title); null while the tray is closed. */
  popups: { id: string; title: unknown }[] | null
  onOpenPopups(): void
  onClosePopups(): void
  onEditModal(id: string): void
  onRemoveModal(id: string): void
  onEndDrag(): void
  onValidate(): void
  onCloseValidation(): void
  onExit(): void
  onPush(): void
}

/** Shared chrome for the on-demand panels (checks, popups): one card, one
 * header row, one close affordance, so they read as a single system. */
function FloatingPanel(p: {
  testid: string
  title: string
  closeLabel: string
  onClose(): void
  children: ReactNode
}) {
  return (
    <div
      data-testid={p.testid}
      className="fixed right-3 top-16 z-50 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{p.title}</p>
        <Button type="button" aria-label={p.closeLabel} variant="outline" size="sm" onClick={p.onClose}>
          ✕
        </Button>
      </div>
      {p.children}
    </div>
  )
}

/** App bar + the on-demand checks panel. Pure presentation: it renders the
 * messages it is handed and reports intents, nothing else. */
export default function CanvasHeader(p: CanvasHeaderProps) {
  return (
    <>
      {/* Narrow windows must still reach Push / Exit / Validate: the bar
          scrolls sideways, and the inner row keeps its natural width instead
          of squashing its buttons into unreadable stubs. */}
      <header style={{ height: HEADER_PX }} className="overflow-x-auto border-b border-slate-200">
        <div className="flex h-full min-w-max items-center gap-2 px-3">
          <Badge data-testid="canvas-project" variant="secondary" className="font-mono">
            {p.project}
          </Badge>
          {/* The single way to add content: `pick` arms the drag on pointer-down
              and on drag-start alike; release hands control back to the canvas. */}
          {p.palettes.map((entry) => (
            <Button
              key={entry.testid}
              data-testid={entry.testid}
              variant="outline"
              size="sm"
              draggable
              onPointerDown={entry.pick}
              onDragStart={(e) => {
                entry.pick()
                e.dataTransfer.setData('text/plain', entry.label)
              }}
              onDragEnd={p.onEndDrag}
              className="cursor-grab"
            >
              {entry.label}
            </Button>
          ))}
          {/* Global appearance: the single light/dark switch for the whole site,
              not a per-component setting. */}
          <div role="group" aria-label="Site theme" className="flex gap-0.5 rounded-md bg-slate-100 p-0.5">
            {(['light', 'dark'] as const).map((t) => (
              <Button
                key={t}
                type="button"
                data-testid={`theme-${t}`}
                aria-pressed={p.theme === t}
                variant={p.theme === t ? 'default' : 'secondary'}
                size="sm"
                onClick={() => p.onTheme(t)}
                className="capitalize"
              >
                {t}
              </Button>
            ))}
          </div>
          <Button
            type="button"
            data-testid="toggle-preview"
            aria-pressed={p.preview}
            variant={p.preview ? 'default' : 'outline'}
            size="sm"
            onClick={p.onTogglePreview}
          >
            {p.preview ? 'Show grid' : 'Preview site'}
          </Button>
          {p.issues && (
            <span data-testid="doc-warning" className="text-xs text-amber-600">
              Pieces must touch — drag them together
            </span>
          )}
          {p.dropMsg && (
            <span data-testid="drop-message" className="text-xs font-medium text-rose-600">
              {p.dropMsg}
            </span>
          )}
          {p.pushMsg && (
            <span data-testid="push-status" className="text-xs text-slate-500">
              {p.pushMsg}
            </span>
          )}
          <Button variant="outline" size="sm" data-testid="validate" onClick={p.onValidate}>
            Validate
          </Button>
          <Button variant="outline" size="sm" data-testid="popups" onClick={p.onOpenPopups}>
            Popups{p.modalCount > 0 ? ` (${p.modalCount})` : ''}
          </Button>
          <Button variant="outline" size="sm" onClick={p.onExit}>
            Exit project
          </Button>
          <Button size="sm" disabled={p.pushing || !p.canPush} onClick={p.onPush}>
            {p.pushing ? 'Pushing…' : 'Push'}
          </Button>
        </div>
      </header>

      {p.validation && (
        <FloatingPanel testid="validate-panel" title="Checks" closeLabel="Close checks" onClose={p.onCloseValidation}>
          {p.validation.ok ? (
            <p data-testid="validate-ok" className="mt-2 text-sm text-emerald-700">
              All checks pass — pieces touch, nothing overlaps.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1">
              {p.validation.errors.map((e, i) => (
                <li key={i} data-testid="validate-issue" className="text-xs text-rose-700">
                  {e}
                </li>
              ))}
            </ul>
          )}
        </FloatingPanel>
      )}

      {p.popups && (
        <FloatingPanel testid="popups-panel" title="Popups" closeLabel="Close popups" onClose={p.onClosePopups}>
          {p.popups.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">No popups yet — select a button to attach one.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {p.popups.map((m) => (
                <li key={m.id} data-testid="popup-row" data-id={m.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-slate-700">
                    {typeof m.title === 'string' && m.title.length > 0 ? m.title : 'Popup'}
                  </span>
                  <span className="flex gap-1">
                    <Button type="button" data-testid="popup-edit" variant="outline" size="sm" onClick={() => p.onEditModal(m.id)}>
                      Edit
                    </Button>
                    <Button type="button" data-testid="popup-remove" variant="outline" size="sm" onClick={() => p.onRemoveModal(m.id)}>
                      Remove
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </FloatingPanel>
      )}
    </>
  )
}
