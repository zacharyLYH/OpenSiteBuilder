import { useMemo, useState } from 'react'
import type { SiteNode } from '../site/types'
import { OSBThemeProvider } from './OSBTheme'
import { OSB_REGISTRY, OSBOverlayTestPreview, isOverlayType } from './registry'
import type { OSBTheme } from './types'

interface MountSpec {
  nodes: SiteNode[]
  theme: OSBTheme
}

/** `#nodes=<json>&theme=dark` — theme is global, not a per-node config. */
function parseHash(): MountSpec | null {
  try {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const raw = params.get('nodes')
    if (!raw) return null
    const nodes = JSON.parse(raw) as SiteNode[]
    if (!Array.isArray(nodes)) return null
    return {
      theme: params.get('theme') === 'dark' ? 'dark' : 'light',
      nodes: nodes.filter((n) => n && typeof n.type === 'string' && n.type in OSB_REGISTRY),
    }
  } catch {
    return null
  }
}

function renderSiteNode(n: SiteNode): React.ReactNode {
  const kids = Array.isArray(n.children)
    ? n.children.filter((k) => k && typeof k.type === 'string' && k.type in OSB_REGISTRY)
    : []
  const renderedKids = kids.length > 0 ? kids.map((k) => <div key={k.id}>{renderSiteNode(k)}</div>) : undefined
  // Overlays mount open: screenshots capture the dialog/sheet, not a page.
  if (isOverlayType(n.type)) return <OverlayPreview node={n} />
  return OSB_REGISTRY[n.type].render(n.config, renderedKids)
}

/** One overlay preview: local open state, shared geometry, real portal.
// Chrome comes from the node type — a new kind needs no new code here. */
function OverlayPreview({ node }: { node: SiteNode }) {
  const [open, setOpen] = useState(true)
  const kids = Array.isArray(node.children)
    ? node.children.filter((k) => k && typeof k.type === 'string' && k.type in OSB_REGISTRY)
    : []
  const byId = new Map(kids.map((k) => [k.id, k]))
  const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : fallback)
  const geom = (k: SiteNode): { id: string; x: number; y: number; cols: number; rows: number } => ({
    id: k.id,
    x: num(k.x, 0),
    y: num(k.y, 0),
    cols: num(k.cols, 4),
    rows: num(k.rows, 1),
  })
  return (
    <OSBOverlayTestPreview
      overlayType={node.type}
      config={node.config as Record<string, unknown>}
      cols={num(node.cols, OSB_REGISTRY[node.type].grid.cols)}
      rows={num(node.rows, OSB_REGISTRY[node.type].grid.rows)}
      kids={kids.map(geom)}
      renderKid={(id) => {
        const k = byId.get(id)
        return k ? OSB_REGISTRY[k.type].render(k.config) : null
      }}
      open={open}
      onOpenChange={setOpen}
    />
  )
}

/**
 * Generic screenshot mount for e2e specs: renders whatever node list the spec
 * passes in `#nodes=<json>&theme=dark` through the registry. Dev-only
 * /osb-mount route.
 */
export default function OsbMount() {
  const spec = useMemo(() => parseHash(), [])
  if (spec === null) {
    return <div data-testid="osb-mount-empty">missing #nodes=[site.json nodes]</div>
  }
  const { nodes, theme } = spec
  return (
    <OSBThemeProvider theme={theme}>
      <div
        data-testid="osb-mount"
        data-theme={theme}
        className={`p-4 ${theme === 'dark' ? 'bg-slate-950 text-slate-50' : 'bg-white text-slate-900'}`}
      >
        {nodes.map((n, i) => (
          <div key={typeof n.id === 'string' ? n.id : i}>{renderSiteNode(n)}</div>
        ))}
      </div>
    </OSBThemeProvider>
  )
}
