import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
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
  /** On-demand check results; null while the panel is closed. */
  validation: DocValidation | null
  onEndDrag(): void
  onValidate(): void
  onCloseValidation(): void
  onExit(): void
  onPush(): void
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
          <span className="ml-auto text-xs text-slate-400">Drag onto the canvas · drag to move · corner to resize</span>
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
          <Button variant="outline" size="sm" onClick={p.onExit}>
            Exit project
          </Button>
          <Button size="sm" disabled={p.pushing || !p.canPush} onClick={p.onPush}>
            {p.pushing ? 'Pushing…' : 'Push'}
          </Button>
        </div>
      </header>

      {p.validation && (
        <div data-testid="validate-panel" className="fixed right-3 top-16 z-50 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Checks</p>
            <Button type="button" aria-label="Close checks" variant="outline" size="sm" onClick={p.onCloseValidation}>
              ✕
            </Button>
          </div>
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
        </div>
      )}
    </>
  )
}
