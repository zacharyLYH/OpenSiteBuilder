import { useState, type ReactNode } from 'react'
import type { SiteManifest, SiteNode } from '../site/types'
import OSBDrawer, { type OSBDrawerConfig } from './OSBDrawer'
import OSBModal, { type OSBModalConfig } from './OSBModal'
import { gridBoxStyle, OSBOverlayBody } from './OSBOverlay'
import { OSBThemeProvider } from './OSBTheme'
import { OSB_REGISTRY, isOverlayType, isTriggerType, slotCountOf, type OSBNodeType } from './registry'
import { slotBandCols, slotLeft } from './slots'
import { overlayTargetOf, type OSBSlot, type OSBTheme } from './types'

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
  const entry = OSB_REGISTRY[node.type]
  const kids = Array.isArray(node.children) ? node.children.filter(isKnown) : []
  const kid = (k: SiteNode) => (
    <OSBNodeView node={k} onOpenOverlay={onOpenOverlay} overlayIds={overlayIds} depth={depth + 1} />
  )
  // Only a trigger (button) carries an opener; the target is resolved from the
  // page's overlay ids so a dangling reference stays inert.
  const target = overlayTargetOf(node.config)
  const onClick =
    onOpenOverlay && overlayIds && target && overlayIds.has(target) && isTriggerType(node.type)
      ? () => onOpenOverlay(target)
      : undefined
  // A slotted container (the carousel) hands its children over as slides, not
  // as a stack — the same bands the canvas draws. Its own footprint travels
  // with it, so in a flow page (which has no cells) it renders in the box the
  // canvas shows: the cell pitch stands in, exactly like an overlay shell.
  if (entry.slots) {
    const grid = entry.grid
    return (
      <div style={gridBoxStyle(int(node.cols, grid.cols), int(node.rows, grid.rows))}>
        {entry.render(node.config, undefined, onClick, slidesOf(node, kids, kid))}
      </div>
    )
  }
  const children = kids.length > 0 ? kids.map((k) => <div key={k.id}>{kid(k)}</div>) : undefined
  return entry.render(node.config, children, onClick)
}

/**
 * A slotted container's children as SLIDES: the configured number of them,
 * each with the cell grid it positions its children in, and each child with
 * its slide-local box. The bands come from `osb/slots` — the very arithmetic
 * the canvas bands use — so a slide lays out identically in the editor and on
 * the published page. A child whose slide no longer exists falls back to the
 * last one: content never disappears because a setting changed.
 */
function slidesOf(parent: SiteNode, kids: SiteNode[], kid: (k: SiteNode) => ReactNode): OSBSlot[] {
  const count = slotCountOf(parent.type, parent.config)
  const grid = OSB_REGISTRY[parent.type].grid
  const cols = int(parent.cols, grid.cols)
  const rows = int(parent.rows, grid.rows)
  const bandCols = slotBandCols(cols, count)
  const slideOfKid = (k: SiteNode) => Math.max(0, Math.min(count - 1, Math.floor(k.slot ?? 0)))
  return Array.from({ length: count }, (_, i) => ({
    cols: bandCols,
    rows,
    kids: kids
      .filter((k) => slideOfKid(k) === i)
      .map((k) => ({
        id: k.id,
        x: int(k.x, 0) - slotLeft(i, bandCols),
        y: int(k.y, 0),
        cols: int(k.cols, OSB_REGISTRY[k.type].grid.cols),
        rows: int(k.rows, OSB_REGISTRY[k.type].grid.rows),
        content: kid(k),
      })),
  }))
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
