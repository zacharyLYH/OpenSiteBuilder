import { useState, type ReactNode } from 'react'
import type { SiteManifest, SiteNode } from '../site/types'
import { buttonOverlayTarget } from './OSBButton'
import OSBDrawer, { type OSBDrawerConfig } from './OSBDrawer'
import OSBModal, { type OSBModalConfig } from './OSBModal'
import { OSBOverlayBody } from './OSBOverlay'
import { OSBThemeProvider } from './OSBTheme'
import { OSB_REGISTRY, isOverlayType, isTriggerType, type OSBNodeType } from './registry'
import type { OSBTheme } from './types'

/**
 * THE engine (codegen v2). The canvas no longer emits `.jsx`: it emits a
 * `site.json` manifest and ships this engine. `OSBRuntime` walks the manifest
 * tree, looks each node's type up in `OSB_REGISTRY`, and renders the matching
 * component. If the JSON is valid, the site renders — there is no string-
 * crammed markup to get wrong.
 *
 * One runtime for the published site and the screenshot harness, so what you
 * see is always what ships (WYSIWYG by construction).
 */

/** Unknown types never render — a newer manifest degrades, it never throws. */
const isKnown = (n: SiteNode | null | undefined): n is SiteNode =>
  !!n && typeof n.type === 'string' && n.type in OSB_REGISTRY

/** Positive integer cell value, else the fallback. */
const int = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : fallback

/** Nesting cap: the real rule is depth ≤ 1, so this only ever trips on a
 * corrupt/hand-edited manifest — it stops a stack overflow, never a real tree. */
const MAX_DEPTH = 32

export interface OSBNodeViewProps {
  node: SiteNode
  /** Opens a named overlay. Omitted renders triggers inert (screenshots). */
  onOpenOverlay?: (id: string) => void
  /** Overlay ids on the page — a trigger only opens one that exists. */
  overlayIds?: Set<string>
  /** Recursion depth (internal) — a corrupt manifest stops, never crashes. */
  depth?: number
}

/**
 * One manifest node through the registry: a leaf renders bare, a container
 * renders its children inside it. Recursion is the whole engine.
 */
export function OSBNodeView({ node, onOpenOverlay, overlayIds, depth = 0 }: OSBNodeViewProps): ReactNode {
  if (!isKnown(node) || depth >= MAX_DEPTH) return null
  const kids = Array.isArray(node.children) ? node.children.filter(isKnown) : []
  const children =
    kids.length > 0
      ? kids.map((k) => (
          <div key={k.id}>
            <OSBNodeView node={k} onOpenOverlay={onOpenOverlay} overlayIds={overlayIds} depth={depth + 1} />
          </div>
        ))
      : undefined
  // Only a trigger (button) carries an opener; the target is resolved from the
  // page's overlay ids so a dangling reference stays inert.
  const onClick =
    onOpenOverlay && overlayIds && isTriggerType(node.type)
      ? (() => {
          const target = buttonOverlayTarget(node.config, overlayIds)
          return target ? () => onOpenOverlay(target) : undefined
        })()
      : undefined
  return OSB_REGISTRY[node.type].render(node.config, children, onClick)
}

/**
 * THE live overlay shell: the shadcn dialog/sheet for an overlay kind, its
 * absolutely-positioned atom children, and the real dismiss contract (X,
 * outside press, Escape). Chrome comes from the registry entry, so a new
 * overlay kind renders with zero edits here. Shared by the engine (published
 * site) and the editor's Test button — one shell, no drift.
 */
export function OSBOverlayShell({
  overlayType,
  config,
  cols,
  rows,
  kids,
  renderKid,
  open,
  onOpenChange,
}: {
  overlayType: string
  config?: Record<string, unknown>
  cols: number
  rows: number
  kids: { id: string; x: number; y: number; cols: number; rows: number }[]
  renderKid: (id: string) => ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
}): ReactNode {
  const body = <OSBOverlayBody cols={cols} rows={rows} kids={kids} renderKid={renderKid} />
  const chrome = overlayType in OSB_REGISTRY ? OSB_REGISTRY[overlayType as OSBNodeType].chrome : undefined
  if (chrome === 'sheet') {
    return (
      <OSBDrawer config={config as Partial<OSBDrawerConfig>} cols={cols} rows={rows} open={open} onOpenChange={onOpenChange}>
        {body}
      </OSBDrawer>
    )
  }
  return (
    <OSBModal config={config as Partial<OSBModalConfig>} cols={cols} rows={rows} open={open} onOpenChange={onOpenChange}>
      {body}
    </OSBModal>
  )
}

export interface OSBOverlayViewProps {
  overlay: SiteNode
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * One overlay manifest node as a live shell: geometry defaults come from the
 * registry, kids keep their grid footprint, and chrome is the shared shell.
 */
export function OSBOverlayView({ overlay, open, onOpenChange }: OSBOverlayViewProps): ReactNode {
  if (!isKnown(overlay) || !isOverlayType(overlay.type)) return null
  const grid = OSB_REGISTRY[overlay.type].grid
  const kids = (Array.isArray(overlay.children) ? overlay.children : []).filter(isKnown)
  const byId = new Map(kids.map((k) => [k.id, k]))
  const geom = (k: SiteNode) => {
    const g = OSB_REGISTRY[k.type].grid
    return { id: k.id, x: int(k.x, 0), y: int(k.y, 0), cols: int(k.cols, g.cols), rows: int(k.rows, g.rows) }
  }
  return (
    <OSBOverlayShell
      overlayType={overlay.type}
      config={overlay.config}
      cols={int(overlay.cols, grid.cols)}
      rows={int(overlay.rows, grid.rows)}
      kids={kids.map(geom)}
      renderKid={(id) => {
        const k = byId.get(id)
        return k ? OSB_REGISTRY[k.type].render(k.config) : null
      }}
      open={open}
      onOpenChange={onOpenChange}
    />
  )
}

export interface OSBRuntimeProps {
  manifest: SiteManifest
}

/**
 * THE page renderer: the global theme, the first page's nodes, and its
 * overlays behind one piece of open state. Published sites import `site.json`
 * and hand it here — nothing is generated per site.
 */
export default function OSBRuntime({ manifest }: OSBRuntimeProps): ReactNode {
  const [openOverlay, setOpenOverlay] = useState<string | null>(null)
  const page = manifest.pages?.[0]
  if (!page) return null
  const theme: OSBTheme = manifest.site?.theme === 'dark' ? 'dark' : 'light'
  const bg = theme === 'dark' ? 'bg-slate-950 text-slate-50' : 'bg-white text-slate-900'
  const nodes = (page.nodes ?? []).filter(isKnown)
  const overlays = (page.overlays ?? []).filter((o) => isKnown(o) && isOverlayType(o.type))
  const overlayIds = new Set(overlays.map((o) => o.id))
  return (
    <OSBThemeProvider theme={theme}>
      <main className={`${bg} min-h-screen`}>
        {nodes.map((n) => (
          <div key={n.id}>
            <OSBNodeView node={n} onOpenOverlay={setOpenOverlay} overlayIds={overlayIds} />
          </div>
        ))}
        {overlays.map((o) => (
          <OSBOverlayView
            key={o.id}
            overlay={o}
            open={openOverlay === o.id}
            onOpenChange={(v) => setOpenOverlay(v ? o.id : null)}
          />
        ))}
      </main>
    </OSBThemeProvider>
  )
}
