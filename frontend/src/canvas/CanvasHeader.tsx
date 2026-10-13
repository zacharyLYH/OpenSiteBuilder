import type { ReactNode } from 'react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardTitle } from '../components/ui/card'
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
  onEndDrag(): void
  onValidate(): void
  onCloseValidation(): void
  onExit(): void
  onPush(): void
}

/** Shared chrome for the on-demand checks panel: one card, one header row,
 * one close affordance. */
function FloatingPanel(p: {
  testid: string
  title: string
  closeLabel: string
  onClose(): void
  children: ReactNode
}) {
  return (
    <Card
      data-testid={p.testid}
      className="fixed right-3 top-16 z-50 w-80 rounded-xl p-4 shadow-xl"
    >
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm font-semibold">{p.title}</CardTitle>
        <Button type="button" aria-label={p.closeLabel} variant="outline" size="sm" onClick={p.onClose}>
          ✕
        </Button>
      </div>
      {p.children}
    </Card>
  )
}

/** Lucide-style icons, inlined like the other builder chrome (no icon dep). */
function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

const THEME_OPTIONS: { value: OSBTheme; label: string; Icon: (p: { className?: string }) => ReactNode }[] = [
  { value: 'light', label: 'Light theme', Icon: SunIcon },
  { value: 'dark', label: 'Dark theme', Icon: MoonIcon },
]

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
          {/* Global appearance onward is the action cluster: it hugs the right
              edge, so the palette stays left and the controls stay reachable. */}
          <div role="group" aria-label="Site theme" className="ml-auto flex items-center gap-0.5 rounded-full bg-slate-100 p-0.5">
            {THEME_OPTIONS.map(({ value, label, Icon }) => {
              const active = p.theme === value
              return (
                <Button
                  key={value}
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid={`theme-${value}`}
                  aria-label={label}
                  aria-pressed={active}
                  onClick={() => p.onTheme(value)}
                  // Icon-only, and inside a segmented pill: strip the outline
                  // button's border/box so only the active half is raised.
                  className={`h-7 w-7 rounded-full border-0 p-0 text-slate-400 ${
                    active ? 'bg-white text-slate-900 shadow-sm hover:bg-white' : 'bg-transparent hover:bg-transparent hover:text-slate-600'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              )
            })}
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
    </>
  )
}
