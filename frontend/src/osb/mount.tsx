import { useMemo, useState } from 'react'
import type { SiteNode } from '../site/types'
import { OSBModalTestPreview } from './OSBModal'
import { OSB_REGISTRY } from './registry'

function parseHash(): SiteNode[] | null {
  try {
    const m = window.location.hash.match(/^#nodes=(.*)$/)
    if (!m) return null
    const nodes = JSON.parse(decodeURIComponent(m[1])) as SiteNode[]
    if (!Array.isArray(nodes)) return null
    return nodes.filter((n) => n && typeof n.type === 'string' && n.type in OSB_REGISTRY)
  } catch {
    return null
  }
}

function isDark(n: SiteNode): boolean {
  return (n.config as { theme?: unknown } | undefined)?.theme === 'dark'
}

function renderSiteNode(n: SiteNode): React.ReactNode {
  const kids = Array.isArray(n.children)
    ? n.children.filter((k) => k && typeof k.type === 'string' && k.type in OSB_REGISTRY)
    : []
  const renderedKids = kids.length > 0 ? kids.map((k) => <div key={k.id}>{renderSiteNode(k)}</div>) : undefined
  // Popups mount open: screenshots capture the dialog, not an empty page.
  if (n.type === 'modal') return <ModalPreview node={n} />
  return OSB_REGISTRY[n.type].render(n.config, renderedKids)
}

/** A popup with local open state, so specs can exercise the real dialog. */
function ModalPreview({ node }: { node: SiteNode }) {
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
    <OSBModalTestPreview
      config={node.config as Record<string, unknown>}
      cols={num(node.cols, 12)}
      rows={num(node.rows, 10)}
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
 * passes in `#nodes=<json>` through the registry. Dev-only /osb-mount route.
 */
export default function OsbMount() {
  const nodes = useMemo(() => parseHash(), [])
  if (nodes === null) {
    return <div data-testid="osb-mount-empty">missing #nodes=[site.json nodes]</div>
  }
  return (
    <div data-testid="osb-mount" className="bg-slate-200 p-4">
      {nodes.map((n, i) => (
        <div
          key={typeof n.id === 'string' ? n.id : i}
          className={isDark(n) ? 'bg-slate-950 p-4' : 'bg-white p-4'}
        >
          {renderSiteNode(n)}
        </div>
      ))}
    </div>
  )
}
